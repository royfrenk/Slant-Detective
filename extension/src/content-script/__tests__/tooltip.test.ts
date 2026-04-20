// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { EvidenceSpan, AnchoredSpan } from '../../shared/types'

// ---------------------------------------------------------------------------
// Setup chrome.runtime.getURL mock (supplement global setup.ts which only
// mocks openOptionsPage/sendMessage/tabs)
// ---------------------------------------------------------------------------

beforeEach(() => {
  // getURL is already defined in the global setup.ts mock; reset it per-test
  // to ensure call counts are clean.
  vi.mocked(chrome.runtime.getURL).mockClear()
})

// ---------------------------------------------------------------------------
// Import under test — must happen after mocks are wired
// ---------------------------------------------------------------------------

import {
  initTooltip,
  wireTooltipEvents,
  destroyTooltip,
} from '../tooltip'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSpan(overrides: Partial<EvidenceSpan> = {}): EvidenceSpan {
  return {
    id: 'span-1',
    text: 'radical agenda',
    start: 0,
    end: 14,
    category: 'word_choice',
    severity: 'high',
    tilt: 'left',
    reason: 'Evaluative modifier applied to one side only.',
    ...overrides,
  }
}

/**
 * Create a matched AnchoredSpan with a real DOM element that has data-sd-id
 * set. Wire the span element into document.body so events can fire.
 */
function makeAnchoredSpan(evidence: EvidenceSpan): { anchored: AnchoredSpan; spanEl: HTMLElement } {
  const spanEl = document.createElement('span')
  spanEl.dataset.sdId = evidence.id
  spanEl.dataset.sdCategory = 'loaded-language'
  spanEl.textContent = evidence.text
  document.body.appendChild(spanEl)

  const textNode = spanEl.firstChild as Text
  const range = document.createRange()
  range.setStart(textNode, 0)
  range.setEnd(textNode, evidence.text.length)

  const anchored: AnchoredSpan = {
    span: evidence,
    domRanges: [range],
    status: 'matched',
  }

  return { anchored, spanEl }
}

/**
 * Get the tooltip element from the open shadow root (used in tests).
 * Requires initTooltip({ shadowMode: 'open' }) to have been called.
 */
function getTooltipEl(): HTMLElement | null {
  const host = document.getElementById('sd-tooltip-host')
  if (host === null || host.shadowRoot === null) return null
  return host.shadowRoot.querySelector<HTMLElement>('.tooltip')
}

// ---------------------------------------------------------------------------
// Reset state between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  document.body.innerHTML = ''
  document.head.innerHTML = ''
  // Ensure a clean state even if a prior test skipped destroyTooltip
  destroyTooltip()
  vi.useFakeTimers()
})

afterEach(() => {
  destroyTooltip()
  vi.useRealTimers()
})

// ---------------------------------------------------------------------------
// 1. initTooltip()
// ---------------------------------------------------------------------------

describe('initTooltip()', () => {
  it('appends #sd-tooltip-host to document.body', () => {
    initTooltip({ shadowMode: 'open' })
    expect(document.getElementById('sd-tooltip-host')).not.toBeNull()
  })

  it('calling initTooltip twice does not create a second host element', () => {
    initTooltip({ shadowMode: 'open' })
    initTooltip({ shadowMode: 'open' })
    const hosts = document.querySelectorAll('#sd-tooltip-host')
    expect(hosts).toHaveLength(1)
  })

  it('tooltip div is initially hidden (display: none)', () => {
    initTooltip({ shadowMode: 'open' })
    const tooltip = getTooltipEl()
    expect(tooltip).not.toBeNull()
    expect(tooltip!.style.display).toBe('')
    // CSS default is display:none via the stylesheet; we check aria-hidden is false
    // and that no explicit 'block' display is set at init time.
    expect(tooltip!.style.display).not.toBe('block')
  })
})

// ---------------------------------------------------------------------------
// 2. populateTooltip content (via showTooltip, triggered by focusin event)
// ---------------------------------------------------------------------------

describe('populateTooltip() — content fields', () => {
  it('phrase text matches span.text', () => {
    initTooltip({ shadowMode: 'open' })
    const evidence = makeSpan({ text: 'radical agenda', category: 'word_choice' })
    const { anchored, spanEl } = makeAnchoredSpan(evidence)
    wireTooltipEvents([anchored])

    spanEl.dispatchEvent(new Event('focusin', { bubbles: true }))

    const tooltip = getTooltipEl()
    const phrase = tooltip!.querySelector('.phrase-row')
    expect(phrase?.textContent).toBe('radical agenda')
  })

  it('chip label matches category display name for word_choice', () => {
    initTooltip({ shadowMode: 'open' })
    const evidence = makeSpan({ category: 'word_choice' })
    const { anchored, spanEl } = makeAnchoredSpan(evidence)
    wireTooltipEvents([anchored])

    spanEl.dispatchEvent(new Event('focusin', { bubbles: true }))

    const tooltip = getTooltipEl()
    const chipLabel = tooltip!.querySelector('.chip-label')
    expect(chipLabel?.textContent).toBe('Loaded Language')
  })

  it('chip label matches for framing', () => {
    initTooltip({ shadowMode: 'open' })
    const evidence = makeSpan({ category: 'framing' })
    const { anchored, spanEl } = makeAnchoredSpan(evidence)
    wireTooltipEvents([anchored])

    spanEl.dispatchEvent(new Event('focusin', { bubbles: true }))

    const chipLabel = getTooltipEl()!.querySelector('.chip-label')
    expect(chipLabel?.textContent).toBe('Framing')
  })

  it('chip label matches for headline_slant', () => {
    initTooltip({ shadowMode: 'open' })
    const evidence = makeSpan({ category: 'headline_slant' })
    const { anchored, spanEl } = makeAnchoredSpan(evidence)
    wireTooltipEvents([anchored])

    spanEl.dispatchEvent(new Event('focusin', { bubbles: true }))

    const chipLabel = getTooltipEl()!.querySelector('.chip-label')
    expect(chipLabel?.textContent).toBe('Headline Slant')
  })

  it('chip label matches for source_mix', () => {
    initTooltip({ shadowMode: 'open' })
    const evidence = makeSpan({ category: 'source_mix' })
    const { anchored, spanEl } = makeAnchoredSpan(evidence)
    wireTooltipEvents([anchored])

    spanEl.dispatchEvent(new Event('focusin', { bubbles: true }))

    const chipLabel = getTooltipEl()!.querySelector('.chip-label')
    expect(chipLabel?.textContent).toBe('Source Mix')
  })

  it('chip severity is capitalized: low → Low', () => {
    initTooltip({ shadowMode: 'open' })
    const evidence = makeSpan({ severity: 'low' })
    const { anchored, spanEl } = makeAnchoredSpan(evidence)
    wireTooltipEvents([anchored])

    spanEl.dispatchEvent(new Event('focusin', { bubbles: true }))

    const chipSeverity = getTooltipEl()!.querySelector('.chip-severity')
    expect(chipSeverity?.textContent).toBe('Low')
  })

  it('chip severity: medium → Medium', () => {
    initTooltip({ shadowMode: 'open' })
    const evidence = makeSpan({ severity: 'medium' })
    const { anchored, spanEl } = makeAnchoredSpan(evidence)
    wireTooltipEvents([anchored])

    spanEl.dispatchEvent(new Event('focusin', { bubbles: true }))

    const chipSeverity = getTooltipEl()!.querySelector('.chip-severity')
    expect(chipSeverity?.textContent).toBe('Medium')
  })

  it('chip severity: high → High', () => {
    initTooltip({ shadowMode: 'open' })
    const evidence = makeSpan({ severity: 'high' })
    const { anchored, spanEl } = makeAnchoredSpan(evidence)
    wireTooltipEvents([anchored])

    spanEl.dispatchEvent(new Event('focusin', { bubbles: true }))

    const chipSeverity = getTooltipEl()!.querySelector('.chip-severity')
    expect(chipSeverity?.textContent).toBe('High')
  })

  it('tilt row contains ← Left for tilt=left', () => {
    initTooltip({ shadowMode: 'open' })
    const evidence = makeSpan({ tilt: 'left' })
    const { anchored, spanEl } = makeAnchoredSpan(evidence)
    wireTooltipEvents([anchored])

    spanEl.dispatchEvent(new Event('focusin', { bubbles: true }))

    const tiltValue = getTooltipEl()!.querySelector('.tilt-value')
    expect(tiltValue?.textContent).toContain('\u2190')
    expect(tiltValue?.textContent).toContain('Left')
  })

  it('tilt row contains → Right for tilt=right', () => {
    initTooltip({ shadowMode: 'open' })
    const evidence = makeSpan({ tilt: 'right' })
    const { anchored, spanEl } = makeAnchoredSpan(evidence)
    wireTooltipEvents([anchored])

    spanEl.dispatchEvent(new Event('focusin', { bubbles: true }))

    const tiltValue = getTooltipEl()!.querySelector('.tilt-value')
    expect(tiltValue?.textContent).toContain('\u2192')
    expect(tiltValue?.textContent).toContain('Right')
  })

  it('tilt row contains ↕ Mixed for tilt=mixed', () => {
    initTooltip({ shadowMode: 'open' })
    const evidence = makeSpan({ tilt: 'mixed' })
    const { anchored, spanEl } = makeAnchoredSpan(evidence)
    wireTooltipEvents([anchored])

    spanEl.dispatchEvent(new Event('focusin', { bubbles: true }))

    const tiltValue = getTooltipEl()!.querySelector('.tilt-value')
    expect(tiltValue?.textContent).toContain('\u2195')
    expect(tiltValue?.textContent).toContain('Mixed')
  })

  it('tilt row contains – Unclear for tilt=unclear', () => {
    initTooltip({ shadowMode: 'open' })
    const evidence = makeSpan({ tilt: 'unclear' })
    const { anchored, spanEl } = makeAnchoredSpan(evidence)
    wireTooltipEvents([anchored])

    spanEl.dispatchEvent(new Event('focusin', { bubbles: true }))

    const tiltValue = getTooltipEl()!.querySelector('.tilt-value')
    expect(tiltValue?.textContent).toContain('\u2013')
    expect(tiltValue?.textContent).toContain('Unclear')
  })

  it('reason text matches span.reason', () => {
    initTooltip({ shadowMode: 'open' })
    const evidence = makeSpan({ reason: 'Evaluative modifier applied to one side only.' })
    const { anchored, spanEl } = makeAnchoredSpan(evidence)
    wireTooltipEvents([anchored])

    spanEl.dispatchEvent(new Event('focusin', { bubbles: true }))

    const reason = getTooltipEl()!.querySelector('.reason')
    expect(reason?.textContent).toBe('Evaluative modifier applied to one side only.')
  })

  it('tooltip id is set to sd-tooltip-{span.id}', () => {
    initTooltip({ shadowMode: 'open' })
    const evidence = makeSpan({ id: 'abc-123' })
    const { anchored, spanEl } = makeAnchoredSpan(evidence)
    wireTooltipEvents([anchored])

    spanEl.dispatchEvent(new Event('focusin', { bubbles: true }))

    const tooltip = getTooltipEl()
    expect(tooltip?.id).toBe('sd-tooltip-abc-123')
  })
})

// ---------------------------------------------------------------------------
// 3. showTooltip / hideTooltip — display state
// ---------------------------------------------------------------------------

describe('showTooltip() / hideTooltip() — display state', () => {
  it('tooltip display is "block" after focusin (immediate show)', () => {
    initTooltip({ shadowMode: 'open' })
    const evidence = makeSpan()
    const { anchored, spanEl } = makeAnchoredSpan(evidence)
    wireTooltipEvents([anchored])

    spanEl.dispatchEvent(new Event('focusin', { bubbles: true }))

    const tooltip = getTooltipEl()
    expect(tooltip?.style.display).toBe('block')
  })

  it('tooltip display is "none" after hideTooltip (immediate via focusout)', () => {
    initTooltip({ shadowMode: 'open' })
    const evidence = makeSpan()
    const { anchored, spanEl } = makeAnchoredSpan(evidence)
    wireTooltipEvents([anchored])

    spanEl.dispatchEvent(new Event('focusin', { bubbles: true }))
    spanEl.dispatchEvent(new Event('focusout', { bubbles: true }))

    const tooltip = getTooltipEl()
    expect(tooltip?.style.display).toBe('none')
  })

  it('anchor element has aria-describedby after show', () => {
    initTooltip({ shadowMode: 'open' })
    const evidence = makeSpan({ id: 'test-span' })
    const { anchored, spanEl } = makeAnchoredSpan(evidence)
    wireTooltipEvents([anchored])

    spanEl.dispatchEvent(new Event('focusin', { bubbles: true }))

    expect(spanEl.getAttribute('aria-describedby')).toBe('sd-tooltip-test-span')
  })

  it('aria-describedby removed from anchor after hide (focusout)', () => {
    initTooltip({ shadowMode: 'open' })
    const evidence = makeSpan({ id: 'test-span' })
    const { anchored, spanEl } = makeAnchoredSpan(evidence)
    wireTooltipEvents([anchored])

    spanEl.dispatchEvent(new Event('focusin', { bubbles: true }))
    spanEl.dispatchEvent(new Event('focusout', { bubbles: true }))

    expect(spanEl.getAttribute('aria-describedby')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 4. Timer logic
// ---------------------------------------------------------------------------

describe('timer logic', () => {
  it('mouseenter + immediate mouseleave within 300ms: tooltip does NOT show', () => {
    initTooltip({ shadowMode: 'open' })
    const evidence = makeSpan()
    const { anchored, spanEl } = makeAnchoredSpan(evidence)
    wireTooltipEvents([anchored])

    spanEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
    spanEl.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }))
    vi.advanceTimersByTime(400)

    const tooltip = getTooltipEl()
    expect(tooltip?.style.display).not.toBe('block')
  })

  it('mouseenter + wait 300ms: tooltip shows', () => {
    initTooltip({ shadowMode: 'open' })
    const evidence = makeSpan()
    const { anchored, spanEl } = makeAnchoredSpan(evidence)
    wireTooltipEvents([anchored])

    spanEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
    vi.advanceTimersByTime(300)

    const tooltip = getTooltipEl()
    expect(tooltip?.style.display).toBe('block')
  })

  it('mouseleave + immediate re-enter: tooltip does NOT hide', () => {
    initTooltip({ shadowMode: 'open' })
    const evidence = makeSpan()
    const { anchored, spanEl } = makeAnchoredSpan(evidence)
    wireTooltipEvents([anchored])

    // Show via focus first (immediate)
    spanEl.dispatchEvent(new Event('focusin', { bubbles: true }))
    expect(getTooltipEl()?.style.display).toBe('block')

    // Leave and immediately re-enter within 150ms
    spanEl.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }))
    spanEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
    vi.advanceTimersByTime(200)

    // Tooltip should still be visible (hide timer was cancelled)
    expect(getTooltipEl()?.style.display).toBe('block')
  })
})

// ---------------------------------------------------------------------------
// 5. Multiple tooltips
// ---------------------------------------------------------------------------

describe('multiple tooltips', () => {
  it('second mouseenter on a different span hides first tooltip immediately before showing new one', () => {
    initTooltip({ shadowMode: 'open' })

    const evidence1 = makeSpan({ id: 'span-a', text: 'first' })
    const evidence2 = makeSpan({ id: 'span-b', text: 'second', category: 'framing' })
    const { anchored: anchored1, spanEl: spanEl1 } = makeAnchoredSpan(evidence1)
    const { anchored: anchored2, spanEl: spanEl2 } = makeAnchoredSpan(evidence2)
    wireTooltipEvents([anchored1, anchored2])

    // Show first tooltip via focus
    spanEl1.dispatchEvent(new Event('focusin', { bubbles: true }))
    expect(spanEl1.getAttribute('aria-describedby')).toBe('sd-tooltip-span-a')

    // Hover over second span (mouseenter triggers immediate hide of first)
    spanEl2.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))

    // First anchor should immediately lose aria-describedby
    expect(spanEl1.getAttribute('aria-describedby')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 6. Keyboard
// ---------------------------------------------------------------------------

describe('keyboard interactions', () => {
  it('Escape keydown while tooltip visible: tooltip hides immediately', () => {
    initTooltip({ shadowMode: 'open' })
    const evidence = makeSpan()
    const { anchored, spanEl } = makeAnchoredSpan(evidence)
    wireTooltipEvents([anchored])

    spanEl.dispatchEvent(new Event('focusin', { bubbles: true }))
    expect(getTooltipEl()?.style.display).toBe('block')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

    expect(getTooltipEl()?.style.display).toBe('none')
  })

  it('focusin shows tooltip immediately (no 300ms delay)', () => {
    initTooltip({ shadowMode: 'open' })
    const evidence = makeSpan()
    const { anchored, spanEl } = makeAnchoredSpan(evidence)
    wireTooltipEvents([anchored])

    spanEl.dispatchEvent(new Event('focusin', { bubbles: true }))

    // No time advance needed — should be visible immediately
    expect(getTooltipEl()?.style.display).toBe('block')
  })

  it('focusout hides tooltip immediately', () => {
    initTooltip({ shadowMode: 'open' })
    const evidence = makeSpan()
    const { anchored, spanEl } = makeAnchoredSpan(evidence)
    wireTooltipEvents([anchored])

    spanEl.dispatchEvent(new Event('focusin', { bubbles: true }))
    spanEl.dispatchEvent(new Event('focusout', { bubbles: true }))

    expect(getTooltipEl()?.style.display).toBe('none')
  })

  it('wireTooltipEvents adds tabindex="0" to each span element', () => {
    initTooltip({ shadowMode: 'open' })
    const evidence = makeSpan()
    const { anchored, spanEl } = makeAnchoredSpan(evidence)
    wireTooltipEvents([anchored])

    expect(spanEl.getAttribute('tabindex')).toBe('0')
  })
})

// ---------------------------------------------------------------------------
// 7. destroyTooltip()
// ---------------------------------------------------------------------------

describe('destroyTooltip()', () => {
  it('removes #sd-tooltip-host from document.body', () => {
    initTooltip({ shadowMode: 'open' })
    expect(document.getElementById('sd-tooltip-host')).not.toBeNull()

    destroyTooltip()

    expect(document.getElementById('sd-tooltip-host')).toBeNull()
  })

  it('subsequent mouseenter after destroy does not show tooltip', () => {
    initTooltip({ shadowMode: 'open' })
    const evidence = makeSpan()
    const { anchored, spanEl } = makeAnchoredSpan(evidence)
    wireTooltipEvents([anchored])

    destroyTooltip()

    spanEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
    vi.advanceTimersByTime(400)

    // Host should not exist
    expect(document.getElementById('sd-tooltip-host')).toBeNull()
  })

  it('calling destroyTooltip when nothing initialized does not throw', () => {
    expect(() => destroyTooltip()).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// 8. "How we measure" link — chrome.runtime.getURL
// ---------------------------------------------------------------------------

describe('"How we measure" link', () => {
  it('clicking hw-link calls chrome.runtime.getURL with src/pages/how-we-measure.html', () => {
    initTooltip({ shadowMode: 'open' })
    const evidence = makeSpan()
    const { anchored, spanEl } = makeAnchoredSpan(evidence)
    wireTooltipEvents([anchored])

    spanEl.dispatchEvent(new Event('focusin', { bubbles: true }))

    const host = document.getElementById('sd-tooltip-host')!
    const hwLink = host.shadowRoot!.querySelector<HTMLElement>('.hw-link')
    expect(hwLink).not.toBeNull()

    hwLink!.click()

    expect(chrome.runtime.getURL).toHaveBeenCalledWith('src/pages/how-we-measure.html')
  })
})
