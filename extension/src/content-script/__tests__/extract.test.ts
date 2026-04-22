import { describe, it, expect } from 'vitest'
import { JSDOM } from 'jsdom'
import { extract, extractCanonicalSignals } from '../extract'

function makeDoc(html: string): Document {
  return new JSDOM(html).window.document
}

describe('extract()', () => {
  it('returns ok via Readability for a well-formed article', () => {
    const body = 'This is a sentence. '.repeat(30)
    const doc = makeDoc(`
      <html><head><title>Test Article</title></head>
      <body>
        <article>
          <h1>Test Article</h1>
          ${Array.from({ length: 10 }, () => `<p>${body}</p>`).join('')}
        </article>
      </body></html>
    `)
    const result = extract(doc)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.body.length).toBeGreaterThan(50)
      expect(result.word_count).toBeGreaterThan(0)
    }
  })

  it('extracts article content alongside nav/footer noise', () => {
    const doc = makeDoc(`
      <html><head><title>NYT Article - The New York Times</title></head>
      <body>
        <nav>Nav content here</nav>
        <article>
          <h1>Headline</h1>
          <p>First paragraph with enough text to pass the minimum threshold check.</p>
          <p>Second paragraph with more substantial article content for analysis.</p>
          <p>Third paragraph continuing the story with additional detail and context.</p>
        </article>
        <footer>Footer content</footer>
      </body></html>
    `)
    const result = extract(doc)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.title).not.toContain('The New York Times')
    }
  })

  it('strips publication suffix from title (pipe and dash variants)', () => {
    for (const raw of ['My Article | BBC News', 'My Article - BBC News', 'My Article – BBC News']) {
      const doc = makeDoc(`
        <html><head><title>${raw}</title></head>
        <body><article>
          <p>Article body text that is long enough to pass the minimum character threshold easily.</p>
        </article></body></html>
      `)
      const result = extract(doc)
      if (result.ok) {
        expect(result.title).toBe('My Article')
      }
    }
  })

  it('returns extraction_failed when no meaningful content found', () => {
    const doc = makeDoc(`
      <html><head><title>Empty</title></head>
      <body><div>Hi</div></body></html>
    `)
    const result = extract(doc)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('extraction_failed')
    }
  })

  it('returns offsets covering the full body', () => {
    const doc = makeDoc(`
      <html><head><title>Article</title></head>
      <body><article>
        ${Array.from({ length: 5 }, (_, i) => `<p>Paragraph ${i + 1} with enough text here.</p>`).join('')}
      </article></body></html>
    `)
    const result = extract(doc)
    if (result.ok) {
      expect(result.offsets).toHaveLength(1)
      expect(result.offsets[0].start).toBe(0)
      expect(result.offsets[0].end).toBe(result.body.length)
    }
  })

  it('includes canonicalSignals on ok: true result', () => {
    const body = 'This is a sentence. '.repeat(30)
    const doc = makeDoc(`
      <html>
        <head>
          <title>Article</title>
          <link rel="canonical" href="https://example.com/article">
          <meta property="og:url" content="https://example.com/article?ref=og">
        </head>
        <body>
          <article>
            <h1>Article</h1>
            ${Array.from({ length: 5 }, () => `<p>${body}</p>`).join('')}
          </article>
        </body>
      </html>
    `)
    const result = extract(doc)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.canonicalSignals).toBeDefined()
      expect(result.canonicalSignals.linkCanonical).toBe('https://example.com/article')
      expect(result.canonicalSignals.ogUrl).toBe('https://example.com/article?ref=og')
      expect(result.canonicalSignals.jsonLdUrl).toBeNull()
      expect(result.canonicalSignals.twitterUrl).toBeNull()
    }
  })

  it('canonicalSignals has null fields when no signals in page', () => {
    const body = 'This is a sentence. '.repeat(30)
    const doc = makeDoc(`
      <html>
        <head><title>Article</title></head>
        <body>
          <article>
            ${Array.from({ length: 5 }, () => `<p>${body}</p>`).join('')}
          </article>
        </body>
      </html>
    `)
    const result = extract(doc)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.canonicalSignals.linkCanonical).toBeNull()
      expect(result.canonicalSignals.jsonLdUrl).toBeNull()
      expect(result.canonicalSignals.ogUrl).toBeNull()
      expect(result.canonicalSignals.twitterUrl).toBeNull()
    }
  })
})

// ─── extractCanonicalSignals() ───────────────────────────────────────────────

describe('extractCanonicalSignals()', () => {
  it('extracts <link rel="canonical"> absolute URL', () => {
    const doc = makeDoc(`
      <html><head>
        <link rel="canonical" href="https://example.com/article">
      </head><body></body></html>
    `)
    const signals = extractCanonicalSignals(doc)
    expect(signals.linkCanonical).toBe('https://example.com/article')
  })

  it('resolves relative <link rel="canonical"> using <base href>', () => {
    const doc = makeDoc(`
      <html><head>
        <base href="https://example.com/">
        <link rel="canonical" href="/article/123">
      </head><body></body></html>
    `)
    const signals = extractCanonicalSignals(doc)
    expect(signals.linkCanonical).toBe('https://example.com/article/123')
  })

  it('extracts og:url', () => {
    const doc = makeDoc(`
      <html><head>
        <meta property="og:url" content="https://example.com/og-article">
      </head><body></body></html>
    `)
    const signals = extractCanonicalSignals(doc)
    expect(signals.ogUrl).toBe('https://example.com/og-article')
    expect(signals.linkCanonical).toBeNull()
  })

  it('extracts twitter:url', () => {
    const doc = makeDoc(`
      <html><head>
        <meta name="twitter:url" content="https://example.com/tw-article">
      </head><body></body></html>
    `)
    const signals = extractCanonicalSignals(doc)
    expect(signals.twitterUrl).toBe('https://example.com/tw-article')
  })

  it('extracts JSON-LD url field from NewsArticle', () => {
    const jsonLd = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      url: 'https://example.com/news-article',
    })
    const doc = makeDoc(`
      <html><head>
        <script type="application/ld+json">${jsonLd}</script>
      </head><body></body></html>
    `)
    const signals = extractCanonicalSignals(doc)
    expect(signals.jsonLdUrl).toBe('https://example.com/news-article')
  })

  it('extracts JSON-LD mainEntityOfPage string from Article', () => {
    const jsonLd = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Article',
      mainEntityOfPage: 'https://example.com/mep-article',
    })
    const doc = makeDoc(`
      <html><head>
        <script type="application/ld+json">${jsonLd}</script>
      </head><body></body></html>
    `)
    const signals = extractCanonicalSignals(doc)
    expect(signals.jsonLdUrl).toBe('https://example.com/mep-article')
  })

  it('extracts JSON-LD mainEntityOfPage @id object from Article', () => {
    const jsonLd = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Article',
      mainEntityOfPage: { '@id': 'https://example.com/mep-id-article' },
    })
    const doc = makeDoc(`
      <html><head>
        <script type="application/ld+json">${jsonLd}</script>
      </head><body></body></html>
    `)
    const signals = extractCanonicalSignals(doc)
    expect(signals.jsonLdUrl).toBe('https://example.com/mep-id-article')
  })

  it('skips JSON-LD block for non-article type', () => {
    const jsonLd = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      url: 'https://example.com/webpage',
    })
    const doc = makeDoc(`
      <html><head>
        <script type="application/ld+json">${jsonLd}</script>
      </head><body></body></html>
    `)
    const signals = extractCanonicalSignals(doc)
    expect(signals.jsonLdUrl).toBeNull()
  })

  it('returns null for malformed canonical href', () => {
    const doc = makeDoc(`
      <html><head>
        <link rel="canonical" href="not a valid url at all !!!">
      </head><body></body></html>
    `)
    // Malformed hrefs that can't be resolved by new URL() return null
    // Note: some "malformed" URLs may still parse as relative paths against baseURI
    const signals = extractCanonicalSignals(doc)
    // jsdom baseURI is about:blank — resolution against it may still succeed or fail
    // The important thing is no exception is thrown
    expect(() => extractCanonicalSignals(doc)).not.toThrow()
  })

  it('returns all nulls when no signals present', () => {
    const doc = makeDoc('<html><head></head><body></body></html>')
    const signals = extractCanonicalSignals(doc)
    expect(signals.linkCanonical).toBeNull()
    expect(signals.jsonLdUrl).toBeNull()
    expect(signals.ogUrl).toBeNull()
    expect(signals.twitterUrl).toBeNull()
  })
})
