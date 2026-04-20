// SD-024: Page ↔ Panel bidirectional sync — content script side.
//
// Responsibilities:
//   • Listen for mouseover/click on [data-sd-id] spans (event delegation) and
//     relay highlight_hover / highlight_click messages to the SW for forwarding.
//   • Receive pulse_highlight messages from the SW and apply DOM class changes.
//   • Idempotent init/teardown via AbortController and module-level guard.

let ctrl: AbortController | null = null;
let initialized = false;

// ---------------------------------------------------------------------------
// Sticky-header offset helper
// ---------------------------------------------------------------------------

function getStickyHeaderHeight(): number {
  const fixed = Array.from(document.querySelectorAll<Element>('*')).filter((el) => {
    const style = getComputedStyle(el);
    return (
      (style.position === 'fixed' || style.position === 'sticky') &&
      el.getBoundingClientRect().top < 10
    );
  });
  return fixed.reduce((max, el) => Math.max(max, el.getBoundingClientRect().bottom), 0);
}

// ---------------------------------------------------------------------------
// Incoming handler — evidence_click from SW (forwarded from panel)
// Registered via addListener so it can be removed by removeListener on teardown.
// ---------------------------------------------------------------------------

function incomingHandler(msg: unknown): boolean {
  if (typeof msg !== 'object' || msg === null) return false;
  const m = msg as Record<string, unknown>;
  if (m['action'] !== 'pulse_highlight') return false;
  const spanId = m['spanId'] as string | undefined;
  if (!spanId) return false;

  const highlight = document.querySelector<HTMLElement>(`[data-sd-id="${spanId}"]`);
  if (!highlight) return false;

  // Apply sticky-header scroll margin before scrolling.
  highlight.style.scrollMarginTop = `${getStickyHeaderHeight() + 8}px`;

  // Force reflow to restart animation if already mid-animation.
  highlight.classList.remove('is-pulsing-highlight');
  void highlight.offsetWidth;
  highlight.classList.add('is-pulsing-highlight');

  highlight.addEventListener(
    'animationend',
    () => { highlight.classList.remove('is-pulsing-highlight'); },
    { once: true },
  );

  highlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return false;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Attach delegated mouseover/click listeners to all [data-sd-id] spans and
 * register the incoming pulse_highlight message handler.
 * Idempotent — safe to call multiple times; only the first call attaches.
 */
export function wireHighlightSync(): void {
  if (initialized) return;
  initialized = true;

  ctrl = new AbortController();
  const { signal } = ctrl;

  // Delegated mouseover — detect when pointer enters a [data-sd-id] span.
  document.addEventListener(
    'mouseover',
    (e) => {
      const span = (e.target as Element).closest?.('[data-sd-id]');
      if (!span) return;
      const spanId = span.getAttribute('data-sd-id');
      if (!spanId) return;
      // Non-critical: SW may not be ready; panel may not be open.
      chrome.runtime.sendMessage({ action: 'highlight_hover', spanId }).catch(() => {});
    },
    { capture: true, signal },
  );

  // Delegated click.
  document.addEventListener(
    'click',
    (e) => {
      const span = (e.target as Element).closest?.('[data-sd-id]');
      if (!span) return;
      const spanId = span.getAttribute('data-sd-id');
      if (!spanId) return;
      chrome.runtime.sendMessage({ action: 'highlight_click', spanId }).catch(() => {});
    },
    { capture: true, signal },
  );

  chrome.runtime.onMessage.addListener(incomingHandler);
}

/**
 * Remove all sync listeners. Safe to call before wireHighlightSync() (no-op).
 */
export function unwireHighlightSync(): void {
  if (ctrl !== null) {
    ctrl.abort();
    ctrl = null;
  }
  chrome.runtime.onMessage.removeListener(incomingHandler);
  initialized = false;
}

