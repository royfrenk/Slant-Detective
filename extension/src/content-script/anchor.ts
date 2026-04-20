import type { EvidenceSpan, AnchoredSpan } from '../shared/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * HTML tag names to skip when walking the live DOM to build the text corpus.
 * These nodes are stripped by Readability, so their text content would cause
 * offsets to diverge from the Readability-produced body string.
 */
export const SKIP_TAGS: ReadonlySet<string> = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED',
  'NAV', 'HEADER', 'FOOTER', 'ASIDE', 'FIGURE', 'FIGCAPTION',
  'FORM', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA',
  'TIME', 'ADDRESS',  // publish dates, bylines
])

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface TextNodeEntry {
  node: Text
  start: number  // inclusive offset in corpus
  end: number    // exclusive offset in corpus
}

// ---------------------------------------------------------------------------
// Root selection
// ---------------------------------------------------------------------------

// Prefer article-body-specific containers over the outer <article> element.
// Outer <article> on news sites (NYT, WaPo) wraps the audio player, byline,
// dek, and publish date alongside the body — those inflate the corpus with
// text the LLM never saw, shifting every offset and dragging highlights onto
// metadata chrome. Body-specific selectors narrow the corpus to the same
// region Readability extracts for Layer 2.
function getArticleRoot(doc: Document): Element {
  return (
    doc.querySelector('[itemprop="articleBody"]') ??
    doc.querySelector('[data-testid="article-body"]') ??
    doc.querySelector('article section[name="articleBody"]') ??
    doc.querySelector('[class*="article-body"]') ??
    doc.querySelector('[class*="story-body"]') ??
    doc.querySelector('[class*="post-content"]') ??
    doc.querySelector('article') ??
    doc.querySelector('[role="main"]') ??
    doc.querySelector('main') ??
    doc.body
  )
}

// ---------------------------------------------------------------------------
// Corpus construction
// ---------------------------------------------------------------------------

/**
 * Walk `root` in depth-first pre-order and collect all visible text nodes,
 * skipping any subtree rooted in a SKIP_TAGS element.
 *
 * Returns:
 *   corpus — the concatenated text of all included text nodes
 *   map    — one entry per text node recording its [start, end) offsets in corpus
 */
export function buildCorpus(root: Element): { corpus: string; map: TextNodeEntry[] } {
  const map: TextNodeEntry[] = []
  let corpus = ''
  let cursor = 0

  // Depth-first walk using an explicit stack. Children are pushed in reverse
  // order so the leftmost child is processed first.
  const stack: Node[] = [root]

  while (stack.length > 0) {
    const node = stack.pop()!

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element
      if (SKIP_TAGS.has(el.tagName)) {
        // Skip this entire subtree.
        continue
      }
      if (el.getAttribute('aria-hidden') === 'true') {
        // Hidden decorative chrome (audio widgets, visual-only glyphs).
        continue
      }
      // Push children in reverse order so the first child is processed first.
      const children = el.childNodes
      for (let i = children.length - 1; i >= 0; i--) {
        stack.push(children[i])
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      const text = node as Text
      const value = text.nodeValue ?? ''
      if (value.length > 0) {
        map.push({ node: text, start: cursor, end: cursor + value.length })
        corpus += value
        cursor += value.length
      }
    }
  }

  return { corpus, map }
}

// ---------------------------------------------------------------------------
// Span anchoring
// ---------------------------------------------------------------------------

/**
 * Normalise a string for fuzzy matching: collapse runs of whitespace to a single
 * space and trim. Used when exact indexOf fails.
 */
function normaliseWs(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

/**
 * Normalise typographic characters that differ between Readability output (given
 * to the LLM) and the live DOM (NYT, WaPo etc. use HTML entities / curly quotes).
 */
function normaliseTypo(s: string): string {
  return s
    .replace(/[\u2018\u2019]/g, "'")   // curly single quotes → '
    .replace(/[\u201C\u201D]/g, '"')   // curly double quotes → "
    .replace(/\u2013/g, '-')            // en-dash → -
    .replace(/\u2014/g, '--')           // em-dash → --
    .replace(/\u00A0/g, ' ')            // non-breaking space → space
}

/**
 * Find the first occurrence of `needle` in `haystack` that sits at a word
 * boundary — i.e. the character before the match (if any) is not a letter or
 * digit, and the character after the match (if any) is not a letter or digit.
 *
 * Returns -1 when no boundary-safe match exists.
 */
function indexOfAtBoundary(haystack: string, needle: string): number {
  let searchFrom = 0
  while (searchFrom <= haystack.length - needle.length) {
    const idx = haystack.indexOf(needle, searchFrom)
    if (idx === -1) return -1

    const before = idx === 0 ? true : !/[\p{L}\p{N}]/u.test(haystack[idx - 1])
    const after = idx + needle.length >= haystack.length
      ? true
      : !/[\p{L}\p{N}]/u.test(haystack[idx + needle.length])

    if (before && after) return idx
    searchFrom = idx + 1
  }
  return -1
}

/**
 * Resolve the best [start, end) interval in `corpus` for `span`.
 *
 * Only boundary-safe matches are returned. Mid-word matches and raw
 * LLM offsets are intentionally NOT used as fallbacks:
 *   - Mid-word matches produce ragged highlights (e.g. "ten" inside "Listen").
 *   - LLM offsets address the Readability-extracted body, so applying them
 *     to the live-DOM corpus drags highlights onto byline/dek/date chrome
 *     by exactly the length of that prefix.
 *
 * An unmatched span is surfaced in the evidence panel without an on-page
 * highlight, which is always safer than a wrong highlight.
 *
 * Priority:
 *   1. Exact match of span.text in corpus at a word boundary.
 *   2. Whitespace-normalised match at a word boundary.
 *   3. Quote/dash-normalised match (Readability vs live-DOM typographic divergence).
 *   4. Whitespace + typo normalisation combined.
 */
function resolveInterval(
  span: EvidenceSpan,
  corpus: string,
): { start: number; end: number } | null {
  const text = span.text.trim()
  if (!text) return null

  // 1. Exact search at word boundary
  const exact = indexOfAtBoundary(corpus, text)
  if (exact >= 0) return { start: exact, end: exact + text.length }

  // 2. Whitespace-normalised search at word boundary
  const normCorpus = normaliseWs(corpus)
  const normText = normaliseWs(text)
  const normIdx = indexOfAtBoundary(normCorpus, normText)
  if (normIdx >= 0) return { start: normIdx, end: normIdx + normText.length }

  // 3. Typo-normalised search at word boundary (curly quotes, en/em-dash, nbsp)
  const typoCorpus = normaliseTypo(corpus)
  const typoText = normaliseTypo(text)
  const typoIdx = indexOfAtBoundary(typoCorpus, typoText)
  if (typoIdx >= 0) return { start: typoIdx, end: typoIdx + typoText.length }

  // 4. Whitespace + typo combined at word boundary
  const fullNormCorpus = normaliseWs(typoCorpus)
  const fullNormText = normaliseWs(typoText)
  const fullIdx = indexOfAtBoundary(fullNormCorpus, fullNormText)
  if (fullIdx >= 0) return { start: fullIdx, end: fullIdx + fullNormText.length }

  return null
}

/**
 * Given a pre-built corpus map and a single EvidenceSpan, return an AnchoredSpan.
 *
 * Creates one DOM Range per text node that the span overlaps. This ensures that
 * Range.surroundContents() can always be called safely (no range ever partially
 * straddles an element node).
 *
 * Returns an unmatched result if:
 *   - The span text cannot be located in the corpus
 *   - An unexpected error occurs during Range construction
 */
function anchorOneSpan(
  span: EvidenceSpan,
  corpus: string,
  map: TextNodeEntry[],
  doc: Document,
): AnchoredSpan {
  try {
    const interval = resolveInterval(span, corpus)
    if (!interval) {
      return { span, domRanges: [], status: 'unmatched' }
    }

    const { start, end } = interval

    // Find all TextNodeEntry items that overlap [start, end).
    const overlapping = map.filter(
      (entry) => entry.end > start && entry.start < end,
    )

    if (overlapping.length === 0) {
      return { span, domRanges: [], status: 'unmatched' }
    }

    const domRanges: Range[] = overlapping.map((entry) => {
      const startOffset = Math.max(0, start - entry.start)
      const endOffset = Math.min(entry.node.nodeValue?.length ?? 0, end - entry.start)
      const range = doc.createRange()
      range.setStart(entry.node, startOffset)
      range.setEnd(entry.node, endOffset)
      return range
    })

    return { span, domRanges, status: 'matched' }
  } catch {
    // Range construction can throw if the DOM is mutated mid-walk; degrade gracefully
    // to unmatched rather than crashing the entire highlight pass.
    return { span, domRanges: [], status: 'unmatched' }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Map an array of EvidenceSpan objects to live DOM ranges.
 *
 * Each span's [start, end) offsets address the Readability-extracted plain-text
 * body. This function reconstructs an equivalent text corpus by walking the live
 * DOM (skipping Readability-stripped tag types) and aligns each span to one or
 * more DOM Range objects — one Range per text node the span touches.
 *
 * Spans that cannot be matched (offset drift, zero-length, out-of-bounds) are
 * returned with status: 'unmatched' and an empty domRanges array. The caller
 * (SD-021 highlight injector) renders them as panel-only evidence rows.
 *
 * The corpus is re-built on every call — not cached — because highlight cleanup
 * and re-injection may replace DOM text nodes between calls.
 */
export function anchorSpans(spans: EvidenceSpan[], doc: Document): AnchoredSpan[] {
  if (spans.length === 0) {
    return []
  }

  const root = getArticleRoot(doc)
  const { corpus, map } = buildCorpus(root)

  return spans.map((span) => anchorOneSpan(span, corpus, map, doc))
}
