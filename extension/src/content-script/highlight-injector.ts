import type { EvidenceSpan, AnchoredSpan } from '../shared/types'

// ---------------------------------------------------------------------------
// Category mappings
// ---------------------------------------------------------------------------

/**
 * Map EvidenceSpan.category (snake_case) to data-sd-category attribute value
 * (kebab-case).
 */
export function categoryToAttr(category: EvidenceSpan['category']): string {
  const map: Record<EvidenceSpan['category'], string> = {
    word_choice: 'loaded-language',
    framing: 'framing',
    headline_slant: 'headline-slant',
    source_mix: 'source-mix',
  }
  return map[category]
}

/**
 * Map EvidenceSpan.category to a lowercase human-readable display name.
 * Used in aria-label construction.
 */
export function categoryToLabel(category: EvidenceSpan['category']): string {
  const map: Record<EvidenceSpan['category'], string> = {
    word_choice: 'loaded language',
    framing: 'framing',
    headline_slant: 'headline slant',
    source_mix: 'source mix',
  }
  return map[category]
}

// ---------------------------------------------------------------------------
// Module-level state (reset by cleanupHighlights)
// ---------------------------------------------------------------------------

let injectedSpans: HTMLElement[] = []
let styleTag: HTMLStyleElement | null = null
let articleRoot: Element | null = null

// ---------------------------------------------------------------------------
// Article root selection (same priority chain as anchor.ts)
// ---------------------------------------------------------------------------

function getArticleRoot(): Element {
  // The [data-sd-injected] marker only needs to be a common ancestor of the
  // injected highlight spans — the precise root doesn't affect correctness,
  // only CSS scoping. Prefer explicit body containers, then the <article>
  // with the most direct paragraphs (best proxy for "story body" over
  // "comments wrapper" on sites like AP News that nest comments in <article>).
  const explicit =
    document.querySelector('[itemprop="articleBody"]') ??
    document.querySelector('[data-testid="article-body"]') ??
    document.querySelector('[class*="article-body"]') ??
    document.querySelector('[class*="story-body"]') ??
    document.querySelector('[class*="post-content"]')
  if (explicit !== null) return explicit

  const articles = Array.from(document.querySelectorAll('article'))
  if (articles.length > 0) {
    return articles.reduce((best, curr) => {
      const bestPs = best.querySelectorAll(':scope > p, :scope > div > p').length
      const currPs = curr.querySelectorAll(':scope > p, :scope > div > p').length
      return currPs > bestPs ? curr : best
    })
  }
  return document.querySelector('[role="main"]') ?? document.querySelector('main') ?? document.body
}

// ---------------------------------------------------------------------------
// Stylesheet content
// ---------------------------------------------------------------------------

function buildStylesheet(): string {
  return `
[data-sd-injected] [data-sd-category="loaded-language"] {
  color: #6d28d9;
  background-color: rgba(109, 40, 217, 0.07);
  text-decoration: underline dotted;
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
  border-radius: 2px;
  padding: 0 1px;
  cursor: default;
}
[data-sd-injected] [data-sd-category="loaded-language"][data-sd-severity="high"] {
  background-color: rgba(109, 40, 217, 0.20);
}
[data-sd-injected] [data-sd-category="framing"] {
  color: #e96666;
  background-color: rgba(233, 102, 102, 0.07);
  text-decoration: underline dotted;
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
  border-radius: 2px;
  padding: 0 1px;
  cursor: default;
}
[data-sd-injected] [data-sd-category="framing"][data-sd-severity="high"] {
  background-color: rgba(233, 102, 102, 0.20);
}
[data-sd-injected] [data-sd-category="headline-slant"] {
  color: #f5a623;
  background-color: rgba(245, 166, 35, 0.07);
  text-decoration: underline dotted;
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
  border-radius: 2px;
  padding: 0 1px;
  cursor: default;
}
[data-sd-injected] [data-sd-category="headline-slant"][data-sd-severity="high"] {
  background-color: rgba(245, 166, 35, 0.20);
}
[data-sd-injected] [data-sd-category="source-mix"] {
  color: #00668a;
  background-color: rgba(0, 102, 138, 0.07);
  text-decoration: underline dotted;
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
  border-radius: 2px;
  padding: 0 1px;
  cursor: default;
}
[data-sd-injected] [data-sd-category="source-mix"][data-sd-severity="high"] {
  background-color: rgba(0, 102, 138, 0.20);
}
/* Medium severity: warm amber/yellow across all categories (warning tier) */
[data-sd-injected] [data-sd-severity="medium"] {
  background-color: rgba(234, 179, 8, 0.28);
}
/* SD-024 sync states — pre-injected so SD-024 only needs to toggle a class */
[data-sd-id].is-pulsing-highlight {
  animation: sd-page-pulse 600ms ease-in-out forwards;
}
@keyframes sd-page-pulse {
  0%   { filter: brightness(1.0); }
  25%  { filter: brightness(1.35); }
  40%  { filter: brightness(1.35); }
  100% { filter: brightness(1.0); }
}
@media (prefers-reduced-motion: reduce) {
  [data-sd-id].is-pulsing-highlight {
    animation: none;
    outline: 2px solid currentColor;
    outline-offset: 2px;
  }
}
`.trim()
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Inject highlight spans for all matched AnchoredSpans.
 *
 * NOT idempotent — caller must call cleanupHighlights() first if re-running.
 * If no spans have status 'matched', does nothing (no <style> tag injected).
 */
export function injectHighlights(anchored: AnchoredSpan[]): void {
  const matched = anchored.filter((a): a is AnchoredSpan & { status: 'matched' } =>
    a.status === 'matched',
  )

  if (matched.length === 0) {
    return
  }

  // Determine and mark the article root before any span wrapping (design
  // constraint: styles must be present before spans are injected to avoid
  // a flash of unstyled content).
  articleRoot = getArticleRoot()
  articleRoot.setAttribute('data-sd-injected', 'true')

  // Inject the stylesheet into <head> before span wrapping begins.
  const style = document.createElement('style')
  style.id = 'sd-highlight-styles'
  style.textContent = buildStylesheet()
  document.head.appendChild(style)
  styleTag = style

  for (const anchoredSpan of matched) {
    for (const range of anchoredSpan.domRanges) {
      const span = document.createElement('span')
      span.dataset.sdCategory = categoryToAttr(anchoredSpan.span.category)
      span.dataset.sdId = anchoredSpan.span.id
      span.dataset.sdSeverity = anchoredSpan.span.severity
      span.setAttribute('role', 'mark')
      span.setAttribute(
        'aria-label',
        `${anchoredSpan.span.text}, flagged as ${categoryToLabel(anchoredSpan.span.category)}`,
      )

      try {
        range.surroundContents(span)
        injectedSpans = [...injectedSpans, span]
      } catch {
        // Range straddles a partially-selected element node — skip this range
        // rather than aborting the entire injection pass. SD-022 pre-splits
        // most such cases; this catch is a last-resort guard.
      }
    }
  }
}

/**
 * Remove all injected highlight <span> wrappers and the <style> tag.
 * Safe to call when nothing has been injected (no-op).
 */
export function cleanupHighlights(): void {
  if (articleRoot !== null) {
    articleRoot.removeAttribute('data-sd-injected')
    articleRoot = null
  }

  if (styleTag !== null && styleTag.parentNode !== null) {
    styleTag.parentNode.removeChild(styleTag)
    styleTag = null
  }

  for (const span of injectedSpans) {
    if (span.parentNode !== null) {
      // `span.childNodes` is a live NodeList. Converting to Array before
      // spread is required because replaceWith() moves nodes out of the
      // NodeList as it processes them, which would cause a live iteration
      // to skip nodes. Array.from() takes a snapshot of the current children.
      span.replaceWith(...Array.from(span.childNodes))
    }
  }

  injectedSpans = []
}
