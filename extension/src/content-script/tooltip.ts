import type { EvidenceSpan, AnchoredSpan } from '../shared/types'

// ---------------------------------------------------------------------------
// Category accent colors — SD-023 design spec values.
// NOTE: These differ intentionally from SD-021 underline colors.
// Framing uses #d97706 (not #e96666) and headline_slant uses #2563eb (not #f5a623).
// ---------------------------------------------------------------------------

const CATEGORY_ACCENT: Record<EvidenceSpan['category'], string> = {
  word_choice: '#6d28d9',
  framing: '#d97706',
  headline_slant: '#2563eb',
  source_mix: '#475569',
}

const CATEGORY_GLYPH: Record<EvidenceSpan['category'], string> = {
  word_choice: '\u26A0',   // ⚠
  framing: '\u25C8',       // ◈
  headline_slant: '\u270E', // ✎
  source_mix: '\u201C',    // "
}

const CATEGORY_DISPLAY: Record<EvidenceSpan['category'], string> = {
  word_choice: 'Word Choice',
  framing: 'Framing',
  headline_slant: 'Headline Slant',
  source_mix: 'Source Mix',
}

interface TiltConfig {
  glyph: string
  label: string
  isHighSignal: boolean
}

const TILT_MAP: Record<EvidenceSpan['tilt'], TiltConfig> = {
  left: { glyph: '\u2190', label: 'Left', isHighSignal: true },   // ←
  right: { glyph: '\u2192', label: 'Right', isHighSignal: true },  // →
  mixed: { glyph: '\u2195', label: 'Mixed', isHighSignal: false }, // ↕
  unclear: { glyph: '\u2013', label: 'Unclear', isHighSignal: false }, // –
}

// Grace period after the cursor leaves a highlighted span before the tooltip
// hides, giving the user time to reach the tooltip's footer links. A shorter
// 150ms often hid the tooltip before the cursor crossed the 8px span->tooltip gap.
const SPAN_LEAVE_HIDE_DELAY_MS = 3000
const TOOLTIP_LEAVE_HIDE_DELAY_MS = 150

// ---------------------------------------------------------------------------
// Full Shadow DOM stylesheet
// ---------------------------------------------------------------------------

function buildTooltipCSS(): string {
  return `
:host {
  --bg: rgba(247, 249, 251, 0.92);
  --surface-variant: #f2f4f6;
  --on-surface: #191c1e;
  --on-surface-variant: #45474c;
  --outline-alpha: rgba(225, 227, 232, 0.6);
  --primary-fixed: #00668a;
  --tertiary: #ba1a1a;
  --category-framing: #d97706;
  --category-headline: #2563eb;
  --category-source: #475569;
  /* Base font-size: set from the anchored span's computed size in showTooltip,
     clamped to [14px, 20px]. All inner text uses em so the tooltip visually
     matches the article's body text rather than feeling like a tiny badge. */
  font-size: 15px;
}

.tooltip {
  position: fixed;
  width: 340px;
  padding: 16px;
  background: var(--bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-radius: 12px;
  box-shadow: 0 12px 32px -4px rgba(25, 28, 30, 0.08);
  border: 1px solid var(--outline-alpha);
  z-index: 2147483647;
  pointer-events: auto;
  display: none;
  font-family: Inter, system-ui, sans-serif;
  color: var(--on-surface);
  animation: tooltip-in 160ms ease-out forwards;
  box-sizing: border-box;
}

.tooltip.hiding {
  animation: tooltip-out 120ms ease-in forwards;
}

@keyframes tooltip-in {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes tooltip-out {
  from { opacity: 1; transform: translateY(0); }
  to   { opacity: 0; transform: translateY(4px); }
}

@media (prefers-reduced-motion: reduce) {
  .tooltip, .tooltip.hiding {
    animation: none;
    transition: opacity 60ms linear;
  }
}

.phrase-row {
  font-size: 1em;
  font-weight: 600;
  color: var(--on-surface);
  border-left: 3px solid currentColor;
  padding-left: 8px;
  margin-bottom: 10px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--surface-variant);
  border-radius: 100px;
  padding: 4px 10px;
  margin-bottom: 8px;
}

.chip-icon {
  font-size: 0.9em;
}

.chip-label {
  font-size: 0.9em;
  font-weight: 500;
}

.chip-sep {
  color: var(--on-surface-variant);
  padding: 0 2px;
  font-size: 0.9em;
}

.chip-severity {
  font-size: 0.9em;
  font-weight: 400;
  color: var(--on-surface-variant);
}

.tilt-row {
  font-size: 0.9em;
  font-weight: 400;
  color: var(--on-surface-variant);
  margin-bottom: 8px;
}

.tilt-label {
  color: var(--on-surface-variant);
}

.tilt-value {
  font-weight: 500;
}

.reason {
  font-size: 0.95em;
  font-weight: 400;
  color: var(--on-surface);
  line-height: 1.5;
  margin-bottom: 12px;
}

.separator {
  height: 4px;
  background: var(--surface-variant);
  width: 100%;
  margin-bottom: 10px;
}

.footer-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.hw-link {
  font-size: 0.8em;
  font-weight: 400;
  color: var(--primary-fixed);
  text-decoration: none;
  cursor: pointer;
  display: inline-block;
}

.hw-link:hover {
  text-decoration: underline;
}

@media (hover: none) {
  .hw-link {
    min-height: 44px;
    display: flex;
    align-items: center;
  }
}
`.trim()
}

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

// NOTE: mode:'closed' means hostEl.shadowRoot === null after attachment.
// The return value of attachShadow() is the only reference to the shadow root.
// We store it here at module level.
let shadowRoot: ShadowRoot | null = null

let hostEl: HTMLElement | null = null
let tooltipEl: HTMLElement | null = null
let phraseEl: HTMLElement | null = null
let chipIconEl: HTMLElement | null = null
let chipLabelEl: HTMLElement | null = null
let chipSeverityEl: HTMLElement | null = null
let tiltValueEl: HTMLElement | null = null
let reasonEl: HTMLElement | null = null

let currentAnchorEl: HTMLElement | null = null
let showTimer: ReturnType<typeof setTimeout> | null = null
let hideTimer: ReturnType<typeof setTimeout> | null = null

// WeakMap so event controllers don't hold strong references to removed DOM nodes.
const listenerMap = new WeakMap<Element, AbortController>()

// MutationObserver to detect if a highlighted span is removed from the DOM
// while the tooltip is visible.
let domObserver: MutationObserver | null = null

// AbortController for the document-level keydown listener
let docKeyController: AbortController | null = null

// ---------------------------------------------------------------------------
// Tooltip construction
// ---------------------------------------------------------------------------

/**
 * Build the tooltip DOM structure and return element references.
 * All elements are created but not yet attached to the shadow root.
 */
function buildTooltipDOM(shadow: ShadowRoot): {
  tooltip: HTMLElement
  phrase: HTMLElement
  chipIcon: HTMLElement
  chipLabel: HTMLElement
  chipSeverity: HTMLElement
  tiltValue: HTMLElement
  reason: HTMLElement
} {
  const style = document.createElement('style')
  style.textContent = buildTooltipCSS()

  const tooltip = document.createElement('div')
  tooltip.className = 'tooltip'
  tooltip.setAttribute('role', 'tooltip')
  tooltip.setAttribute('aria-live', 'polite')

  // Phrase row
  const phrase = document.createElement('div')
  phrase.className = 'phrase-row'

  // Chip row
  const chip = document.createElement('div')
  chip.className = 'chip'

  const chipIcon = document.createElement('span')
  chipIcon.className = 'chip-icon'

  const chipLabel = document.createElement('span')
  chipLabel.className = 'chip-label'

  const chipSep = document.createElement('span')
  chipSep.className = 'chip-sep'
  chipSep.textContent = '\u00B7' // ·

  const chipSeverity = document.createElement('span')
  chipSeverity.className = 'chip-severity'

  chip.appendChild(chipIcon)
  chip.appendChild(chipLabel)
  chip.appendChild(chipSep)
  chip.appendChild(chipSeverity)

  // Tilt row
  const tiltRow = document.createElement('div')
  tiltRow.className = 'tilt-row'

  const tiltLabel = document.createElement('span')
  tiltLabel.className = 'tilt-label'
  tiltLabel.textContent = 'Tilt:\u00A0' // "Tilt: " with non-breaking space

  const tiltValue = document.createElement('span')
  tiltValue.className = 'tilt-value'

  tiltRow.appendChild(tiltLabel)
  tiltRow.appendChild(tiltValue)

  // Reason
  const reason = document.createElement('div')
  reason.className = 'reason'

  // Separator
  const separator = document.createElement('div')
  separator.className = 'separator'
  separator.setAttribute('aria-hidden', 'true')

  // "How we measure" link
  const hwLink = document.createElement('a')
  hwLink.className = 'hw-link'
  hwLink.setAttribute('role', 'button')
  hwLink.setAttribute('tabindex', '0')

  const hwText = document.createElement('span')
  hwText.textContent = 'How we measure\u00A0'

  const hwArrow = document.createElement('span')
  hwArrow.setAttribute('aria-hidden', 'true')
  hwArrow.textContent = '\u2192' // →

  hwLink.appendChild(hwText)
  hwLink.appendChild(hwArrow)

  hwLink.addEventListener('click', () => {
    try {
      // Route through the service worker via chrome.tabs.create. window.open
      // from a content script hits a web_accessible_resources check that
      // refuses chrome-extension:// URLs opened from http/https pages
      // (ERR_BLOCKED_BY_CLIENT).
      chrome.runtime.sendMessage({ action: 'openPage', page: 'how-we-measure' })
    } catch {
      // Non-critical: message send failed (e.g., chrome API unavailable in test env).
    }
  })

  hwLink.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      hwLink.click()
    }
  })

  // "Report bug" link
  const rbLink = document.createElement('a')
  rbLink.className = 'hw-link'
  rbLink.setAttribute('role', 'button')
  rbLink.setAttribute('tabindex', '0')
  rbLink.setAttribute('aria-label', 'Report a bug')
  rbLink.textContent = 'Report bug\u00A0\u2192'

  rbLink.addEventListener('click', () => {
    try {
      chrome.runtime.sendMessage({ action: 'openReportBugModal' })
    } catch {
      // Non-critical: message send failed (e.g., chrome API unavailable in test env).
    }
  })

  rbLink.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      rbLink.click()
    }
  })

  // Footer row — hwLink on the left, rbLink on the right
  const footerRow = document.createElement('div')
  footerRow.className = 'footer-row'
  footerRow.appendChild(hwLink)
  footerRow.appendChild(rbLink)

  tooltip.appendChild(phrase)
  tooltip.appendChild(chip)
  tooltip.appendChild(tiltRow)
  tooltip.appendChild(reason)
  tooltip.appendChild(separator)
  tooltip.appendChild(footerRow)

  shadow.appendChild(style)
  shadow.appendChild(tooltip)

  return { tooltip, phrase, chipIcon, chipLabel, chipSeverity, tiltValue, reason }
}

// ---------------------------------------------------------------------------
// Public API — init / wire / destroy
// ---------------------------------------------------------------------------

export interface InitTooltipOptions {
  /**
   * Use 'open' shadow root mode for test environments (jsdom does not fully
   * support introspecting closed shadow roots). Production always uses 'closed'.
   */
  shadowMode?: ShadowRootMode
}

/**
 * Create the tooltip host element and shadow root once.
 * Must be called before any other tooltip functions.
 * Idempotent: a second call is a no-op if the host already exists.
 *
 * @param options.shadowMode - Override shadow root mode. Default: 'closed'.
 *   Pass 'open' in tests so the shadow root can be queried for assertions.
 */
export function initTooltip(options: InitTooltipOptions = {}): void {
  if (document.getElementById('sd-tooltip-host') !== null) {
    return
  }

  hostEl = document.createElement('div')
  hostEl.id = 'sd-tooltip-host'
  hostEl.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;pointer-events:none;z-index:2147483646;'

  // NOTE: mode:'closed' means hostEl.shadowRoot === null after this call.
  // Store the return value — it is the only way to access the shadow root.
  shadowRoot = hostEl.attachShadow({ mode: options.shadowMode ?? 'closed' })

  const refs = buildTooltipDOM(shadowRoot)
  tooltipEl = refs.tooltip
  phraseEl = refs.phrase
  chipIconEl = refs.chipIcon
  chipLabelEl = refs.chipLabel
  chipSeverityEl = refs.chipSeverity
  tiltValueEl = refs.tiltValue
  reasonEl = refs.reason

  document.body.appendChild(hostEl)

  // Wire tooltip's own mouseenter/mouseleave so cursor can travel from highlight
  // into the tooltip without triggering hide.
  tooltipEl.addEventListener('mouseenter', () => {
    clearTimeout(hideTimer ?? undefined)
    hideTimer = null
  })

  tooltipEl.addEventListener('mouseleave', () => {
    clearTimeout(showTimer ?? undefined)
    showTimer = null
    hideTimer = setTimeout(() => hideTooltip(), TOOLTIP_LEAVE_HIDE_DELAY_MS)
  })
}

/**
 * Wire mouseenter/mouseleave/focusin/focusout listeners on all matched spans.
 * Called once after injectHighlights() completes.
 * Also adds tabindex="0" to each span for keyboard accessibility.
 */
export function wireTooltipEvents(spans: AnchoredSpan[]): void {
  if (tooltipEl === null) {
    return
  }

  // Build a fast-lookup map from span ID → EvidenceSpan
  const spanMap = new Map<string, EvidenceSpan>()
  for (const anchored of spans) {
    if (anchored.status === 'matched') {
      spanMap.set(anchored.span.id, anchored.span)
    }
  }

  // Wire each DOM span element
  const spanEls = Array.from(document.querySelectorAll<HTMLElement>('[data-sd-id]'))
  for (const spanEl of spanEls) {
    const spanId = spanEl.dataset.sdId
    if (spanId === undefined) continue

    const evidence = spanMap.get(spanId)
    if (evidence === undefined) continue

    spanEl.setAttribute('tabindex', '0')

    const controller = new AbortController()
    const { signal } = controller
    listenerMap.set(spanEl, controller)

    spanEl.addEventListener('mouseenter', () => {
      if (currentAnchorEl !== null && currentAnchorEl !== spanEl) {
        hideTooltip(true)
      }
      clearTimeout(hideTimer ?? undefined)
      hideTimer = null
      clearTimeout(showTimer ?? undefined)
      showTimer = setTimeout(() => showTooltip(evidence, spanEl), 300)
    }, { signal })

    spanEl.addEventListener('mouseleave', () => {
      clearTimeout(showTimer ?? undefined)
      showTimer = null
      hideTimer = setTimeout(() => hideTooltip(), SPAN_LEAVE_HIDE_DELAY_MS)
    }, { signal })

    spanEl.addEventListener('focusin', () => {
      clearTimeout(showTimer ?? undefined)
      clearTimeout(hideTimer ?? undefined)
      showTooltip(evidence, spanEl)
    }, { signal })

    spanEl.addEventListener('focusout', () => {
      hideTooltip(true)
    }, { signal })
  }

  // Document-level Escape key handler
  docKeyController = new AbortController()
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideTooltip(true)
    }
  }, { signal: docKeyController.signal })

  // MutationObserver: hide tooltip immediately if its anchor span is removed
  domObserver = new MutationObserver((mutations) => {
    if (currentAnchorEl === null) return
    for (const mutation of mutations) {
      for (const removed of Array.from(mutation.removedNodes)) {
        if (removed === currentAnchorEl || (removed instanceof Element && removed.contains(currentAnchorEl))) {
          hideTooltip(true)
          return
        }
      }
    }
  })
  domObserver.observe(document.body, { childList: true, subtree: true })
}

/**
 * Remove the tooltip host from DOM and clean up all event listeners.
 * Safe to call when nothing has been initialized (no-op).
 */
export function destroyTooltip(): void {
  hideTooltip(true)

  // Abort all span-level listeners — WeakMap doesn't have forEach so we use
  // document querySelectorAll to find spans and abort their controllers.
  const spanEls = Array.from(document.querySelectorAll<HTMLElement>('[data-sd-id]'))
  for (const spanEl of spanEls) {
    const controller = listenerMap.get(spanEl)
    if (controller !== undefined) {
      controller.abort()
    }
  }

  // Abort document keydown listener
  docKeyController?.abort()
  docKeyController = null

  // Stop MutationObserver
  domObserver?.disconnect()
  domObserver = null

  // Remove host element
  document.getElementById('sd-tooltip-host')?.remove()

  // Reset module-level state
  shadowRoot = null
  hostEl = null
  tooltipEl = null
  phraseEl = null
  chipIconEl = null
  chipLabelEl = null
  chipSeverityEl = null
  tiltValueEl = null
  reasonEl = null
  currentAnchorEl = null
  showTimer = null
  hideTimer = null
}

// ---------------------------------------------------------------------------
// Internal — populate / position / show / hide
// ---------------------------------------------------------------------------

function populateTooltip(span: EvidenceSpan): void {
  if (
    phraseEl === null ||
    chipIconEl === null ||
    chipLabelEl === null ||
    chipSeverityEl === null ||
    tiltValueEl === null ||
    reasonEl === null ||
    tooltipEl === null
  ) {
    return
  }

  // Phrase row — use textContent (never innerHTML) for XSS safety
  phraseEl.textContent = span.text
  phraseEl.style.borderLeftColor = CATEGORY_ACCENT[span.category]

  // Chip icon + label
  chipIconEl.textContent = CATEGORY_GLYPH[span.category]
  chipIconEl.style.color = CATEGORY_ACCENT[span.category]

  chipLabelEl.textContent = CATEGORY_DISPLAY[span.category]
  chipLabelEl.style.color = CATEGORY_ACCENT[span.category]

  // Severity — capitalize first letter
  chipSeverityEl.textContent =
    span.severity.charAt(0).toUpperCase() + span.severity.slice(1)

  // Tilt
  const { glyph, label, isHighSignal } = TILT_MAP[span.tilt]
  tiltValueEl.textContent = `${glyph} ${label}`
  tiltValueEl.style.color = isHighSignal ? '#ba1a1a' : '#45474c'

  // Reason
  reasonEl.textContent = span.reason

  // Tooltip ID for aria-describedby
  tooltipEl.id = `sd-tooltip-${span.id}`
}

function positionTooltip(anchorEl: HTMLElement): void {
  if (tooltipEl === null) return

  const rect = anchorEl.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  const TOOLTIP_WIDTH = 340
  const GAP = 8
  const EDGE = 8

  // Measure tooltip height using visibility:hidden trick so it can be measured
  // before being fully displayed.
  tooltipEl.style.visibility = 'hidden'
  tooltipEl.style.display = 'block'
  const tooltipHeight = tooltipEl.offsetHeight
  tooltipEl.style.visibility = ''

  // Preferred: above the span
  let top = rect.top - tooltipHeight - GAP
  let left = rect.left

  // Overflow top → flip below
  if (top < EDGE) {
    top = rect.bottom + GAP
  }

  // Overflow right
  if (left + TOOLTIP_WIDTH > vw - EDGE) {
    left = vw - TOOLTIP_WIDTH - EDGE
  }

  // Overflow bottom (flipped case)
  if (top + tooltipHeight > vh - EDGE) {
    top = vh - tooltipHeight - EDGE
  }

  // Clamp left to minimum edge
  if (left < EDGE) {
    left = EDGE
  }

  tooltipEl.style.top = `${top}px`
  tooltipEl.style.left = `${left}px`
}

function showTooltip(span: EvidenceSpan, anchorEl: HTMLElement): void {
  if (tooltipEl === null) return

  populateTooltip(span)
  syncFontSizeToAnchor(anchorEl)
  tooltipEl.style.display = 'block'
  tooltipEl.classList.remove('hiding')
  positionTooltip(anchorEl)
  anchorEl.setAttribute('aria-describedby', tooltipEl.id)
  currentAnchorEl = anchorEl
}

// Match the tooltip's base font-size to the article's body text so the tooltip
// doesn't feel like a tiny badge on sites with large serif body text (NYT,
// Medium, etc). Clamped so the tooltip stays usable on unusually small or
// large article fonts.
function syncFontSizeToAnchor(anchorEl: HTMLElement): void {
  if (hostEl === null) return
  const computed = parseFloat(getComputedStyle(anchorEl).fontSize)
  if (!Number.isFinite(computed) || computed <= 0) return
  const clamped = Math.max(14, Math.min(20, computed))
  hostEl.style.fontSize = `${clamped}px`
}

function hideTooltip(immediate = false): void {
  if (tooltipEl === null) return

  if (immediate) {
    tooltipEl.style.display = 'none'
    tooltipEl.classList.remove('hiding')
    if (currentAnchorEl !== null) {
      currentAnchorEl.removeAttribute('aria-describedby')
    }
    currentAnchorEl = null
    return
  }

  // Animated hide: add 'hiding' class, then after animation completes (120ms)
  // set display:none and clear state.
  tooltipEl.classList.add('hiding')
  setTimeout(() => {
    if (tooltipEl !== null) {
      tooltipEl.style.display = 'none'
      tooltipEl.classList.remove('hiding')
    }
    if (currentAnchorEl !== null) {
      currentAnchorEl.removeAttribute('aria-describedby')
      currentAnchorEl = null
    }
  }, 120)
}
