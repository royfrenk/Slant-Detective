import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHighlightSync } from '../use-highlight-sync';

// ---------------------------------------------------------------------------
// Chrome mock helpers
// ---------------------------------------------------------------------------

// Capture the listener so tests can trigger messages directly.
type MessageListener = (message: unknown) => boolean | void;
let capturedListener: MessageListener | null = null;

beforeEach(() => {
  capturedListener = null;
  vi.clearAllMocks();

  // Override setup.ts mock to capture the listener for this test file.
  (globalThis as Record<string, unknown>).chrome = {
    runtime: {
      sendMessage: vi.fn().mockResolvedValue(undefined),
      onMessage: {
        addListener: vi.fn((fn: MessageListener) => { capturedListener = fn; }),
        removeListener: vi.fn(),
      },
    },
    storage: {
      local: {
        get: vi.fn((_keys: unknown, cb: (r: Record<string, unknown>) => void) => cb({})),
      },
      onChanged: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
  };
});

function emitMessage(message: unknown): void {
  if (capturedListener) capturedListener(message);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useHighlightSync', () => {
  it('initialises with null state', () => {
    const { result } = renderHook(() => useHighlightSync());
    expect(result.current.activeSpanId).toBeNull();
    expect(result.current.pulsingSpanId).toBeNull();
  });

  it('sets pulsingSpanId on highlight_hover message', () => {
    const { result } = renderHook(() => useHighlightSync());

    act(() => { emitMessage({ action: 'highlight_hover', spanId: 'span-1' }); });

    expect(result.current.pulsingSpanId).toBe('span-1');
  });

  it('clears pulsingSpanId after 400ms', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useHighlightSync());

    act(() => { emitMessage({ action: 'highlight_hover', spanId: 'span-1' }); });
    expect(result.current.pulsingSpanId).toBe('span-1');

    act(() => { vi.advanceTimersByTime(400); });
    expect(result.current.pulsingSpanId).toBeNull();

    vi.useRealTimers();
  });

  it('replaces pulsingSpanId on rapid hover — only last span pulses', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useHighlightSync());

    act(() => { emitMessage({ action: 'highlight_hover', spanId: 'span-1' }); });
    act(() => { emitMessage({ action: 'highlight_hover', spanId: 'span-2' }); });

    expect(result.current.pulsingSpanId).toBe('span-2');

    // After 400ms both timers should have fired — but only span-2 was active.
    act(() => { vi.advanceTimersByTime(400); });
    expect(result.current.pulsingSpanId).toBeNull();

    vi.useRealTimers();
  });

  it('sets activeSpanId on highlight_click message', () => {
    const { result } = renderHook(() => useHighlightSync());

    act(() => { emitMessage({ action: 'highlight_click', spanId: 'span-3' }); });

    expect(result.current.activeSpanId).toBe('span-3');
  });

  it('replaces activeSpanId when a new highlight_click arrives', () => {
    const { result } = renderHook(() => useHighlightSync());

    act(() => { emitMessage({ action: 'highlight_click', spanId: 'span-3' }); });
    act(() => { emitMessage({ action: 'highlight_click', spanId: 'span-4' }); });

    expect(result.current.activeSpanId).toBe('span-4');
  });

  it('onEvidenceClick sets activeSpanId and calls sendMessage', () => {
    const { result } = renderHook(() => useHighlightSync());

    act(() => { result.current.onEvidenceClick('span-5'); });

    expect(result.current.activeSpanId).toBe('span-5');
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      action: 'evidence_click',
      spanId: 'span-5',
    });
  });

  it('clears activeSpanId on Escape key', () => {
    const { result } = renderHook(() => useHighlightSync());

    act(() => { emitMessage({ action: 'highlight_click', spanId: 'span-6' }); });
    expect(result.current.activeSpanId).toBe('span-6');

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(result.current.activeSpanId).toBeNull();
  });

  it('does not clear activeSpanId on non-Escape key', () => {
    const { result } = renderHook(() => useHighlightSync());

    act(() => { emitMessage({ action: 'highlight_click', spanId: 'span-7' }); });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    });

    expect(result.current.activeSpanId).toBe('span-7');
  });

  it('removes onMessage listener on unmount', () => {
    const { unmount } = renderHook(() => useHighlightSync());
    unmount();

    expect(chrome.runtime.onMessage.removeListener).toHaveBeenCalledTimes(1);
  });

  it('ignores unrelated message actions', () => {
    const { result } = renderHook(() => useHighlightSync());

    act(() => { emitMessage({ action: 'analyzed', payload: {} }); });

    expect(result.current.activeSpanId).toBeNull();
    expect(result.current.pulsingSpanId).toBeNull();
  });
});

afterEach(() => {
  vi.useRealTimers();
});
