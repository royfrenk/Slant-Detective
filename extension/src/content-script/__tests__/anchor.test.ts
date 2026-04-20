// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { buildCorpus, anchorSpans, SKIP_TAGS } from '../anchor'
import type { EvidenceSpan } from '../../shared/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSpan(overrides: Partial<EvidenceSpan> & { start: number; end: number }): EvidenceSpan {
  return {
    id: 'test-id',
    text: '',
    category: 'word_choice',
    severity: 'low',
    tilt: 'unclear',
    reason: '',
    ...overrides,
  }
}

/**
 * Build a minimal jsdom Document with the provided HTML string as the body
 * inner HTML. Returns the document.
 */
function makeDocument(bodyHtml: string): Document {
  document.body.innerHTML = bodyHtml
  return document
}

// ---------------------------------------------------------------------------
// 1. buildCorpus() — basic corpus construction
// ---------------------------------------------------------------------------

describe('buildCorpus() — basic corpus construction', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('single text node: corpus equals node text, map has one entry', () => {
    document.body.appendChild(document.createTextNode('Hello world'))
    const { corpus, map } = buildCorpus(document.body)

    expect(corpus).toBe('Hello world')
    expect(map).toHaveLength(1)
    expect(map[0].start).toBe(0)
    expect(map[0].end).toBe('Hello world'.length)
  })

  it('multiple sibling text nodes: corpus is concatenation with correct offsets', () => {
    document.body.appendChild(document.createTextNode('Hello '))
    document.body.appendChild(document.createTextNode('world'))
    const { corpus, map } = buildCorpus(document.body)

    expect(corpus).toBe('Hello world')
    expect(map).toHaveLength(2)
    expect(map[0].start).toBe(0)
    expect(map[0].end).toBe(6)
    expect(map[1].start).toBe(6)
    expect(map[1].end).toBe(11)
  })

  it('nested block elements: text nodes from children are included', () => {
    document.body.innerHTML = '<p>First.</p><p>Second.</p>'
    const { corpus, map } = buildCorpus(document.body)

    expect(corpus).toBe('First.Second.')
    expect(map).toHaveLength(2)
    expect(map[0].start).toBe(0)
    expect(map[0].end).toBe(6)
    expect(map[1].start).toBe(6)
    expect(map[1].end).toBe(13)
  })

  it('SCRIPT text is excluded from corpus', () => {
    document.body.innerHTML = '<p>Visible text</p><script>var x = 1;</script>'
    const { corpus } = buildCorpus(document.body)

    expect(corpus).toBe('Visible text')
    expect(corpus).not.toContain('var x')
  })

  it('NAV text is excluded from corpus', () => {
    document.body.innerHTML = '<nav>Home | About</nav><p>Article text</p>'
    const { corpus } = buildCorpus(document.body)

    expect(corpus).toBe('Article text')
    expect(corpus).not.toContain('Home')
  })

  it('STYLE text is excluded from corpus', () => {
    document.body.innerHTML = '<style>body { color: red }</style><p>Article</p>'
    const { corpus } = buildCorpus(document.body)

    expect(corpus).toBe('Article')
  })

  it('empty DOM: returns empty corpus and empty map', () => {
    document.body.innerHTML = ''
    const { corpus, map } = buildCorpus(document.body)

    expect(corpus).toBe('')
    expect(map).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// 2. SKIP_TAGS export
// ---------------------------------------------------------------------------

describe('SKIP_TAGS', () => {
  it('includes SCRIPT, STYLE, NOSCRIPT', () => {
    expect(SKIP_TAGS.has('SCRIPT')).toBe(true)
    expect(SKIP_TAGS.has('STYLE')).toBe(true)
    expect(SKIP_TAGS.has('NOSCRIPT')).toBe(true)
  })

  it('includes NAV, HEADER, FOOTER, ASIDE', () => {
    expect(SKIP_TAGS.has('NAV')).toBe(true)
    expect(SKIP_TAGS.has('HEADER')).toBe(true)
    expect(SKIP_TAGS.has('FOOTER')).toBe(true)
    expect(SKIP_TAGS.has('ASIDE')).toBe(true)
  })

  it('does not include P, DIV, SPAN, ARTICLE', () => {
    expect(SKIP_TAGS.has('P')).toBe(false)
    expect(SKIP_TAGS.has('DIV')).toBe(false)
    expect(SKIP_TAGS.has('SPAN')).toBe(false)
    expect(SKIP_TAGS.has('ARTICLE')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 3. anchorSpans() — matched spans
// ---------------------------------------------------------------------------

describe('anchorSpans() — matched spans', () => {
  it('span perfectly aligned to a single text node returns one Range', () => {
    makeDocument('<p>Hello world</p>')
    const span = makeSpan({ start: 0, end: 5, text: 'Hello' })
    const result = anchorSpans([span], document)

    expect(result).toHaveLength(1)
    expect(result[0].status).toBe('matched')
    if (result[0].status === 'matched') {
      expect(result[0].domRanges).toHaveLength(1)
      const range = result[0].domRanges[0]
      expect(range.startOffset).toBe(0)
      expect(range.endOffset).toBe(5)
    }
  })

  it('span aligned to middle of a text node returns correct offsets', () => {
    makeDocument('<p>Hello world</p>')
    // "world" starts at offset 6
    const span = makeSpan({ start: 6, end: 11, text: 'world' })
    const result = anchorSpans([span], document)

    expect(result[0].status).toBe('matched')
    if (result[0].status === 'matched') {
      expect(result[0].domRanges).toHaveLength(1)
      const range = result[0].domRanges[0]
      expect(range.startOffset).toBe(6)
      expect(range.endOffset).toBe(11)
    }
  })

  it('span crossing two adjacent text nodes produces two sub-ranges', () => {
    // Inline element splits the paragraph into three text nodes, so a span
    // that covers two full words naturally crosses a node boundary while
    // remaining word-boundary-safe.
    document.body.innerHTML = '<p>Hello <em>quick</em> world</p>'
    // Text nodes: "Hello " [0,6), "quick" [6,11), " world" [11,17)
    // "Hello quick" covers [0,11) — crosses nodes 1 and 2.
    const span = makeSpan({ start: 0, end: 11, text: 'Hello quick' })
    const result = anchorSpans([span], document)

    expect(result[0].status).toBe('matched')
    if (result[0].status === 'matched') {
      expect(result[0].domRanges).toHaveLength(2)
      // First sub-range: "Hello " node, full length
      expect(result[0].domRanges[0].startOffset).toBe(0)
      expect(result[0].domRanges[0].endOffset).toBe(6)
      // Second sub-range: "quick" node, full length
      expect(result[0].domRanges[1].startOffset).toBe(0)
      expect(result[0].domRanges[1].endOffset).toBe(5)
    }
  })

  it('multiple non-overlapping spans each return their own matched range', () => {
    makeDocument('<p>The quick brown fox</p>')
    const spans = [
      makeSpan({ id: 'a', start: 0, end: 3, text: 'The' }),
      makeSpan({ id: 'b', start: 10, end: 15, text: 'brown' }),
    ]
    const result = anchorSpans(spans, document)

    expect(result).toHaveLength(2)
    expect(result[0].status).toBe('matched')
    expect(result[1].status).toBe('matched')
    if (result[0].status === 'matched') {
      expect(result[0].domRanges[0].startOffset).toBe(0)
      expect(result[0].domRanges[0].endOffset).toBe(3)
    }
    if (result[1].status === 'matched') {
      expect(result[1].domRanges[0].startOffset).toBe(10)
      expect(result[1].domRanges[0].endOffset).toBe(15)
    }
  })
})

// ---------------------------------------------------------------------------
// 4. anchorSpans() — unmatched spans
// ---------------------------------------------------------------------------

describe('anchorSpans() — unmatched spans', () => {
  beforeEach(() => {
    makeDocument('<p>Short text</p>')
  })

  it('start >= corpus.length → status: unmatched', () => {
    const corpusLength = 'Short text'.length
    const span = makeSpan({ start: corpusLength, end: corpusLength + 5 })
    const result = anchorSpans([span], document)

    expect(result[0].status).toBe('unmatched')
    if (result[0].status === 'unmatched') {
      expect(result[0].domRanges).toHaveLength(0)
    }
  })

  it('end > corpus.length → status: unmatched', () => {
    const corpusLength = 'Short text'.length
    const span = makeSpan({ start: 0, end: corpusLength + 1 })
    const result = anchorSpans([span], document)

    expect(result[0].status).toBe('unmatched')
  })

  it('zero-length span (start === end) → status: unmatched', () => {
    const span = makeSpan({ start: 3, end: 3 })
    const result = anchorSpans([span], document)

    expect(result[0].status).toBe('unmatched')
  })

  it('empty span array → returns []', () => {
    const result = anchorSpans([], document)
    expect(result).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// 5. anchorSpans() — cross-element span split
// ---------------------------------------------------------------------------

describe('anchorSpans() — cross-element span split', () => {
  it('span across sibling <p> elements produces two sub-ranges', () => {
    // Trailing space in the first <p> plus leading space handling means the
    // corpus concatenates as "First paragraph.Second paragraph". A cross-<p>
    // span must begin and end at word boundaries to survive anchoring.
    makeDocument('<p>First paragraph.</p><p>Second paragraph.</p>')
    // Corpus: "First paragraph.Second paragraph."
    // "paragraph.Second paragraph." spans both <p> text nodes and is
    // boundary-safe (before: ' ', after: end-of-corpus).
    const span = makeSpan({
      start: 6,
      end: 33,
      text: 'paragraph.Second paragraph.',
    })
    const result = anchorSpans([span], document)

    expect(result[0].status).toBe('matched')
    if (result[0].status === 'matched') {
      expect(result[0].domRanges).toHaveLength(2)
    }
  })
})

// ---------------------------------------------------------------------------
// 6. anchorSpans() — article root selection
// ---------------------------------------------------------------------------

describe('anchorSpans() — article root selection', () => {
  it('prefers <article> element over document.body for corpus', () => {
    // body has extra text, article has only article text
    document.body.innerHTML = '<nav>Nav text</nav><article><p>Article text</p></article>'
    const span = makeSpan({ start: 0, end: 12, text: 'Article text' })
    const result = anchorSpans([span], document)

    // The span matches "Article text" from the article element
    expect(result[0].status).toBe('matched')
  })
})

// ---------------------------------------------------------------------------
// 7. anchorSpans() — text-search anchoring (offset-mismatch resilience)
// ---------------------------------------------------------------------------

describe('anchorSpans() — text-search takes priority over LLM offsets', () => {
  it('matches correctly even when LLM offsets are completely wrong', () => {
    // Simulate what happens when Readability body != live-DOM corpus:
    // the LLM says the phrase is at offsets 0-3 but it is actually at 6-11.
    makeDocument('<p>Hello world</p>')
    const span = makeSpan({ start: 0, end: 3, text: 'world' }) // offsets lie; text is truth
    const result = anchorSpans([span], document)

    expect(result[0].status).toBe('matched')
    if (result[0].status === 'matched') {
      // Should find "world" at offset 6, not 0-3
      expect(result[0].domRanges[0].startOffset).toBe(6)
      expect(result[0].domRanges[0].endOffset).toBe(11)
    }
  })

  it('marks span unmatched when span.text is not found (no raw-offset fallback)', () => {
    // LLM offsets address the Readability body, not the live DOM. When text
    // can't be located, applying raw offsets to the live corpus can drag the
    // highlight onto byline/dek/date chrome — always unsafe. Unmatched spans
    // are surfaced in the evidence panel without an on-page highlight.
    makeDocument('<p>Hello world</p>')
    const span = makeSpan({ start: 0, end: 5, text: 'MISSING' })
    const result = anchorSpans([span], document)

    expect(result[0].status).toBe('unmatched')
    if (result[0].status === 'unmatched') {
      expect(result[0].domRanges).toHaveLength(0)
    }
  })

  it('does not match mid-word when span.text is a short in-word substring', () => {
    // "ten" appears inside "Listen" — must NOT produce a mid-word highlight.
    makeDocument('<p>Listen to this</p>')
    const span = makeSpan({ start: 0, end: 3, text: 'ten' })
    const result = anchorSpans([span], document)

    expect(result[0].status).toBe('unmatched')
  })

  it('returns unmatched when neither text nor offsets can resolve', () => {
    makeDocument('<p>Hello world</p>')
    const span = makeSpan({ start: 0, end: 0, text: '' }) // empty text, zero-length offsets
    const result = anchorSpans([span], document)

    expect(result[0].status).toBe('unmatched')
  })

  it('matches via typo-normalisation when LLM text has curly quotes but DOM has straight', () => {
    // Live DOM uses straight double-quotes; LLM received Readability text with curly quotes
    makeDocument('<p>He said "undermining" the claim.</p>')
    // span.text has curly quotes (as Readability may produce)
    const span = makeSpan({ start: 999, end: 999, text: '\u201Cundermining\u201D' })
    const result = anchorSpans([span], document)

    expect(result[0].status).toBe('matched')
    if (result[0].status === 'matched') {
      // Should land at offset 8 inside the text node: 'He said "undermining" the claim.'
      expect(result[0].domRanges[0].startOffset).toBe(8)
      expect(result[0].domRanges[0].endOffset).toBe(21)
    }
  })

  it('matches via combined ws+typo normalisation for em-dash + extra spaces', () => {
    makeDocument('<p>months undermining the claim</p>')
    // LLM text has em-dash where live DOM has straight hyphen + different spacing
    const span = makeSpan({ start: 999, end: 999, text: 'months  undermining' })
    const result = anchorSpans([span], document)

    expect(result[0].status).toBe('matched')
  })
})
