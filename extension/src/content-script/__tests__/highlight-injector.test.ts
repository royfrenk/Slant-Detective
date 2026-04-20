// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { EvidenceSpan, AnchoredSpan } from '../../shared/types'

// ---------------------------------------------------------------------------
// Mock anchorSpans so highlight-injector tests don't depend on anchor.ts logic
// ---------------------------------------------------------------------------

vi.mock('../anchor', () => ({
  anchorSpans: vi.fn(),
}))

import {
  categoryToAttr,
  categoryToLabel,
  injectHighlights,
  cleanupHighlights,
} from '../highlight-injector'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvidenceSpan(
  overrides: Partial<EvidenceSpan> & Pick<EvidenceSpan, 'category'>,
): EvidenceSpan {
  return {
    id: 'span-1',
    text: 'egregious',
    start: 0,
    end: 9,
    severity: 'medium',
    tilt: 'right',
    reason: 'loaded word',
    ...overrides,
  }
}

/**
 * Build a minimal AnchoredSpan with real DOM ranges so surroundContents()
 * can be called successfully during injection tests.
 */
function makeMatchedAnchoredSpan(
  evidenceSpan: EvidenceSpan,
  textContent: string,
): AnchoredSpan {
  // Create a text node with the content and add it to the document body so
  // ranges operate on a real DOM subtree.
  const p = document.createElement('p')
  p.textContent = textContent
  document.body.appendChild(p)

  const textNode = p.firstChild as Text
  const range = document.createRange()
  range.setStart(textNode, 0)
  range.setEnd(textNode, textContent.length)

  return { span: evidenceSpan, domRanges: [range], status: 'matched' }
}

function makeUnmatchedAnchoredSpan(evidenceSpan: EvidenceSpan): AnchoredSpan {
  return { span: evidenceSpan, domRanges: [], status: 'unmatched' }
}

// ---------------------------------------------------------------------------
// Reset DOM and module state between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  document.body.innerHTML = ''
  document.head.innerHTML = ''
  // Reset module-level state by calling cleanup (safe as a no-op when nothing injected)
  cleanupHighlights()
})

// ---------------------------------------------------------------------------
// 1. categoryToAttr()
// ---------------------------------------------------------------------------

describe('categoryToAttr()', () => {
  it('maps word_choice to loaded-language', () => {
    expect(categoryToAttr('word_choice')).toBe('loaded-language')
  })

  it('maps framing to framing', () => {
    expect(categoryToAttr('framing')).toBe('framing')
  })

  it('maps headline_slant to headline-slant', () => {
    expect(categoryToAttr('headline_slant')).toBe('headline-slant')
  })

  it('maps source_mix to source-mix', () => {
    expect(categoryToAttr('source_mix')).toBe('source-mix')
  })
})

// ---------------------------------------------------------------------------
// 2. categoryToLabel()
// ---------------------------------------------------------------------------

describe('categoryToLabel()', () => {
  it('maps word_choice to loaded language', () => {
    expect(categoryToLabel('word_choice')).toBe('loaded language')
  })

  it('maps framing to framing', () => {
    expect(categoryToLabel('framing')).toBe('framing')
  })

  it('maps headline_slant to headline slant', () => {
    expect(categoryToLabel('headline_slant')).toBe('headline slant')
  })

  it('maps source_mix to source mix', () => {
    expect(categoryToLabel('source_mix')).toBe('source mix')
  })
})

// ---------------------------------------------------------------------------
// 3. injectHighlights() — style tag
// ---------------------------------------------------------------------------

describe('injectHighlights() — style tag', () => {
  it('injects <style id="sd-highlight-styles"> into document.head after call with matched spans', () => {
    const evidenceSpan = makeEvidenceSpan({ category: 'framing' })
    const anchored = [makeMatchedAnchoredSpan(evidenceSpan, 'framing example')]

    injectHighlights(anchored)

    expect(document.getElementById('sd-highlight-styles')).not.toBeNull()
  })

  it('does NOT inject style tag when all spans are unmatched', () => {
    const evidenceSpan = makeEvidenceSpan({ category: 'framing' })
    const anchored = [makeUnmatchedAnchoredSpan(evidenceSpan)]

    injectHighlights(anchored)

    expect(document.getElementById('sd-highlight-styles')).toBeNull()
  })

  it('does NOT inject style tag when anchored array is empty', () => {
    injectHighlights([])

    expect(document.getElementById('sd-highlight-styles')).toBeNull()
  })

  it('style tag is idempotent when cleanupHighlights is called between calls', () => {
    const evidenceSpan = makeEvidenceSpan({ category: 'framing' })

    injectHighlights([makeMatchedAnchoredSpan(evidenceSpan, 'first call')])
    cleanupHighlights()

    document.body.innerHTML = ''
    injectHighlights([makeMatchedAnchoredSpan(evidenceSpan, 'second call')])

    const styleTags = document.querySelectorAll('#sd-highlight-styles')
    expect(styleTags).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// 4. injectHighlights() — span attributes
// ---------------------------------------------------------------------------

describe('injectHighlights() — span attributes', () => {
  it('injected span has correct data-sd-category attribute', () => {
    const evidenceSpan = makeEvidenceSpan({ category: 'word_choice', text: 'egregious' })
    injectHighlights([makeMatchedAnchoredSpan(evidenceSpan, 'egregious')])

    const span = document.querySelector('[data-sd-category]')
    expect(span?.getAttribute('data-sd-category')).toBe('loaded-language')
  })

  it('injected span has correct data-sd-id attribute', () => {
    const evidenceSpan = makeEvidenceSpan({ id: 'span-42', category: 'framing', text: 'frames' })
    injectHighlights([makeMatchedAnchoredSpan(evidenceSpan, 'frames')])

    const span = document.querySelector('[data-sd-id]')
    expect(span?.getAttribute('data-sd-id')).toBe('span-42')
  })

  it('injected span has role="mark"', () => {
    const evidenceSpan = makeEvidenceSpan({ category: 'source_mix', text: 'according to' })
    injectHighlights([makeMatchedAnchoredSpan(evidenceSpan, 'according to')])

    const span = document.querySelector('[data-sd-id]')
    expect(span?.getAttribute('role')).toBe('mark')
  })

  it('injected span aria-label contains the category display name', () => {
    const evidenceSpan = makeEvidenceSpan({ category: 'headline_slant', text: 'shocking' })
    injectHighlights([makeMatchedAnchoredSpan(evidenceSpan, 'shocking')])

    const span = document.querySelector('[data-sd-id]')
    expect(span?.getAttribute('aria-label')).toContain('headline slant')
  })

  it('injected span aria-label contains the flagged text', () => {
    const evidenceSpan = makeEvidenceSpan({ category: 'word_choice', text: 'radical' })
    injectHighlights([makeMatchedAnchoredSpan(evidenceSpan, 'radical')])

    const span = document.querySelector('[data-sd-id]')
    expect(span?.getAttribute('aria-label')).toContain('radical')
  })
})

// ---------------------------------------------------------------------------
// 5. injectHighlights() — article root attribute
// ---------------------------------------------------------------------------

describe('injectHighlights() — article root attribute', () => {
  it('sets data-sd-injected="true" on the article root', () => {
    const evidenceSpan = makeEvidenceSpan({ category: 'framing', text: 'shaped' })
    injectHighlights([makeMatchedAnchoredSpan(evidenceSpan, 'shaped')])

    const root =
      document.querySelector('article') ??
      document.querySelector('[role="main"]') ??
      document.querySelector('main') ??
      document.body
    expect(root.getAttribute('data-sd-injected')).toBe('true')
  })

  it('prefers <article> over <main> over <body>', () => {
    document.body.innerHTML = '<main id="main-el"><article id="article-el"></article></main>'
    const evidenceSpan = makeEvidenceSpan({ category: 'framing', text: 'chosen' })

    // Need a real DOM subtree for the range — add text to article
    const article = document.getElementById('article-el')!
    const p = document.createElement('p')
    p.textContent = 'chosen'
    article.appendChild(p)

    const textNode = p.firstChild as Text
    const range = document.createRange()
    range.setStart(textNode, 0)
    range.setEnd(textNode, 'chosen'.length)

    const anchored: AnchoredSpan = {
      span: evidenceSpan,
      domRanges: [range],
      status: 'matched',
    }

    injectHighlights([anchored])

    expect(document.getElementById('article-el')?.getAttribute('data-sd-injected')).toBe('true')
    expect(document.getElementById('main-el')?.getAttribute('data-sd-injected')).toBeNull()
  })

  it('falls back to <main> when no <article> exists', () => {
    document.body.innerHTML = '<main id="main-el"></main>'
    const main = document.getElementById('main-el')!
    const p = document.createElement('p')
    p.textContent = 'fallback to main'
    main.appendChild(p)

    const evidenceSpan = makeEvidenceSpan({ category: 'framing', text: 'fallback to main' })
    const textNode = p.firstChild as Text
    const range = document.createRange()
    range.setStart(textNode, 0)
    range.setEnd(textNode, 'fallback to main'.length)

    const anchored: AnchoredSpan = {
      span: evidenceSpan,
      domRanges: [range],
      status: 'matched',
    }

    injectHighlights([anchored])

    expect(document.getElementById('main-el')?.getAttribute('data-sd-injected')).toBe('true')
  })
})

// ---------------------------------------------------------------------------
// 6. cleanupHighlights()
// ---------------------------------------------------------------------------

describe('cleanupHighlights()', () => {
  it('removes all [data-sd-id] spans from DOM after inject + cleanup', () => {
    const evidenceSpan = makeEvidenceSpan({ category: 'word_choice', text: 'loaded' })
    injectHighlights([makeMatchedAnchoredSpan(evidenceSpan, 'loaded')])

    expect(document.querySelectorAll('[data-sd-id]').length).toBeGreaterThan(0)

    cleanupHighlights()

    expect(document.querySelectorAll('[data-sd-id]').length).toBe(0)
  })

  it('removes <style id="sd-highlight-styles"> after inject + cleanup', () => {
    const evidenceSpan = makeEvidenceSpan({ category: 'framing', text: 'framed' })
    injectHighlights([makeMatchedAnchoredSpan(evidenceSpan, 'framed')])

    expect(document.getElementById('sd-highlight-styles')).not.toBeNull()

    cleanupHighlights()

    expect(document.getElementById('sd-highlight-styles')).toBeNull()
  })

  it('removes data-sd-injected attribute from article root after inject + cleanup', () => {
    const evidenceSpan = makeEvidenceSpan({ category: 'source_mix', text: 'according to' })
    injectHighlights([makeMatchedAnchoredSpan(evidenceSpan, 'according to')])

    cleanupHighlights()

    const root =
      document.querySelector('article') ??
      document.querySelector('[role="main"]') ??
      document.querySelector('main') ??
      document.body
    expect(root.getAttribute('data-sd-injected')).toBeNull()
  })

  it('preserves original text content after inject + cleanup', () => {
    const text = 'This is the original text'
    const p = document.createElement('p')
    p.textContent = text
    document.body.appendChild(p)

    const evidenceSpan = makeEvidenceSpan({ category: 'word_choice', text: 'original', id: 'e1' })
    const textNode = p.firstChild as Text
    const range = document.createRange()
    range.setStart(textNode, 8)
    range.setEnd(textNode, 16)

    const anchored: AnchoredSpan = {
      span: evidenceSpan,
      domRanges: [range],
      status: 'matched',
    }

    injectHighlights([anchored])
    cleanupHighlights()

    expect(p.textContent).toBe(text)
  })

  it('calling cleanupHighlights with nothing injected does not throw', () => {
    expect(() => cleanupHighlights()).not.toThrow()
  })
})
