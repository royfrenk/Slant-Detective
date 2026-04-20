// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Chrome mock
// ---------------------------------------------------------------------------

const sendMessageMock = vi.fn().mockResolvedValue(undefined);
const addListenerMock = vi.fn();
const removeListenerMock = vi.fn();

vi.stubGlobal('chrome', {
  runtime: {
    sendMessage: sendMessageMock,
    onMessage: {
      addListener: addListenerMock,
      removeListener: removeListenerMock,
    },
  },
});

// Import after stubbing globals so the module picks up the mock.
import { wireHighlightSync, unwireHighlightSync } from '../highlight-sync';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeHighlightSpan(spanId: string): HTMLElement {
  const span = document.createElement('span');
  span.setAttribute('data-sd-id', spanId);
  span.textContent = 'test text';
  document.body.appendChild(span);
  return span;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('wireHighlightSync', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    // Ensure a clean state before each test.
    unwireHighlightSync();
  });

  afterEach(() => {
    unwireHighlightSync();
  });

  it('sends highlight_hover message on mouseover of [data-sd-id] span', () => {
    const span = makeHighlightSpan('span-1');
    wireHighlightSync();

    span.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true }));

    expect(sendMessageMock).toHaveBeenCalledWith({
      action: 'highlight_hover',
      spanId: 'span-1',
    });
  });

  it('sends highlight_click message on click of [data-sd-id] span', () => {
    const span = makeHighlightSpan('span-2');
    wireHighlightSync();

    span.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(sendMessageMock).toHaveBeenCalledWith({
      action: 'highlight_click',
      spanId: 'span-2',
    });
  });

  it('does not send message when clicking outside a [data-sd-id] span', () => {
    wireHighlightSync();
    const div = document.createElement('div');
    document.body.appendChild(div);

    div.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(sendMessageMock).not.toHaveBeenCalled();
  });

  it('is idempotent — double-init does not double-attach listeners', () => {
    const span = makeHighlightSpan('span-3');
    wireHighlightSync();
    wireHighlightSync(); // second call should be a no-op

    span.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    // Should only fire once, not twice.
    expect(sendMessageMock).toHaveBeenCalledTimes(1);
  });

  it('registers chrome.runtime.onMessage listener', () => {
    wireHighlightSync();
    expect(addListenerMock).toHaveBeenCalledTimes(1);
  });
});

describe('unwireHighlightSync', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    unwireHighlightSync();
  });

  it('stops sending messages after teardown', () => {
    const span = makeHighlightSpan('span-4');
    wireHighlightSync();
    unwireHighlightSync();

    span.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(sendMessageMock).not.toHaveBeenCalled();
  });

  it('removes chrome.runtime.onMessage listener', () => {
    wireHighlightSync();
    vi.clearAllMocks();
    unwireHighlightSync();

    expect(removeListenerMock).toHaveBeenCalledTimes(1);
  });

  it('allows wireHighlightSync to re-attach after teardown', () => {
    const span = makeHighlightSpan('span-5');
    wireHighlightSync();
    unwireHighlightSync();
    vi.clearAllMocks();

    wireHighlightSync();
    span.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(sendMessageMock).toHaveBeenCalledWith({
      action: 'highlight_click',
      spanId: 'span-5',
    });
  });
});

describe('incomingHandler (pulse_highlight via registered listener)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    unwireHighlightSync();
  });

  afterEach(() => {
    unwireHighlightSync();
  });

  function getRegisteredListener(): (msg: unknown) => boolean {
    wireHighlightSync();
    return addListenerMock.mock.calls[0][0] as (msg: unknown) => boolean;
  }

  it('adds is-pulsing-highlight class to matching span', () => {
    const span = makeHighlightSpan('pulse-1');
    span.scrollIntoView = vi.fn();
    const listener = getRegisteredListener();

    listener({ action: 'pulse_highlight', spanId: 'pulse-1' });

    expect(span.classList.contains('is-pulsing-highlight')).toBe(true);
  });

  it('calls scrollIntoView on matching span', () => {
    const span = makeHighlightSpan('pulse-2');
    const scrollMock = vi.fn();
    span.scrollIntoView = scrollMock;
    const listener = getRegisteredListener();

    listener({ action: 'pulse_highlight', spanId: 'pulse-2' });

    expect(scrollMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
  });

  it('removes is-pulsing-highlight class on animationend', () => {
    const span = makeHighlightSpan('pulse-3');
    span.scrollIntoView = vi.fn();
    const listener = getRegisteredListener();

    listener({ action: 'pulse_highlight', spanId: 'pulse-3' });
    expect(span.classList.contains('is-pulsing-highlight')).toBe(true);

    span.dispatchEvent(new Event('animationend'));
    expect(span.classList.contains('is-pulsing-highlight')).toBe(false);
  });

  it('does not throw when no matching span exists', () => {
    const listener = getRegisteredListener();
    expect(() => listener({ action: 'pulse_highlight', spanId: 'nonexistent-id' })).not.toThrow();
  });

  it('sets scrollMarginTop on matching span', () => {
    const span = makeHighlightSpan('pulse-4');
    span.scrollIntoView = vi.fn();
    const listener = getRegisteredListener();

    listener({ action: 'pulse_highlight', spanId: 'pulse-4' });

    expect(span.style.scrollMarginTop).toMatch(/\d+px/);
  });

  it('ignores messages with unknown action', () => {
    const span = makeHighlightSpan('pulse-5');
    span.scrollIntoView = vi.fn();
    const listener = getRegisteredListener();

    listener({ action: 'unknown_action', spanId: 'pulse-5' });

    expect(span.classList.contains('is-pulsing-highlight')).toBe(false);
  });
});
