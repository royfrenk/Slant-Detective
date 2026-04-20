import { describe, it, expect } from 'vitest'
import { JSDOM } from 'jsdom'
import { extract } from '../extract'

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
})
