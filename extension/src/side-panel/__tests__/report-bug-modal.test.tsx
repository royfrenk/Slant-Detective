import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReportBugModal from '../report-bug-modal';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderModal(overrides: Partial<React.ComponentProps<typeof ReportBugModal>> = {}) {
  const onClose = vi.fn();
  const result = render(
    <ReportBugModal
      initialUrl="https://example.com/x"
      screenshotDataUrl="data:image/png;base64,abc"
      onClose={onClose}
      {...overrides}
    />,
  );
  return { ...result, onClose };
}

function getSendButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: /send/i }) as HTMLButtonElement;
}

function getIncludeUrlToggle(): HTMLElement {
  return screen.getByRole('switch', { name: 'Include page URL' });
}

function getIncludeScreenshotToggle(): HTMLElement {
  return screen.getByRole('switch', { name: 'Include screenshot' });
}

function getDescriptionTextarea(): HTMLTextAreaElement {
  return screen.getByRole('textbox', { name: /what went wrong/i }) as HTMLTextAreaElement;
}

// ---------------------------------------------------------------------------
// Reset timers and fetch mock between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// H.5 — Send enabled / disabled logic
// ---------------------------------------------------------------------------

describe('ReportBugModal — Send enabled/disabled (SD-038 H.5)', () => {
  it('Send is enabled by default (both toggles ON, empty textarea — at least URL included)', () => {
    renderModal();
    const sendBtn = getSendButton();
    // Default state: includeUrl=true, includeScreenshot=true → not disabled
    expect(sendBtn).not.toBeDisabled();
    expect(sendBtn.getAttribute('aria-disabled')).toBe('false');
  });

  it('Send is aria-disabled when both toggles are OFF and textarea is empty', async () => {
    const user = userEvent.setup();
    renderModal();

    // Turn off URL toggle
    await user.click(getIncludeUrlToggle());
    // Turn off screenshot toggle
    await user.click(getIncludeScreenshotToggle());

    const sendBtn = getSendButton();
    expect(sendBtn).toBeDisabled();
    expect(sendBtn.getAttribute('aria-disabled')).toBe('true');
  });

  it('Send is re-enabled when textarea has content (both toggles OFF)', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(getIncludeUrlToggle());
    await user.click(getIncludeScreenshotToggle());

    const textarea = getDescriptionTextarea();
    await user.type(textarea, 'bug text here');

    const sendBtn = getSendButton();
    expect(sendBtn).not.toBeDisabled();
    expect(sendBtn.getAttribute('aria-disabled')).toBe('false');
  });

  it('Send is re-enabled when URL toggle is turned back ON', async () => {
    const user = userEvent.setup();
    renderModal();

    // Turn both off
    await user.click(getIncludeUrlToggle());
    await user.click(getIncludeScreenshotToggle());

    // Turn URL back on
    await user.click(getIncludeUrlToggle());

    const sendBtn = getSendButton();
    expect(sendBtn).not.toBeDisabled();
    expect(sendBtn.getAttribute('aria-disabled')).toBe('false');
  });
});

// ---------------------------------------------------------------------------
// H.6 — Char counter and maxLength
// ---------------------------------------------------------------------------

describe('ReportBugModal — Char counter (SD-038 H.6)', () => {
  it('char counter starts at "0 / 500"', () => {
    renderModal();
    expect(screen.getByText('0 / 500')).toBeInTheDocument();
  });

  it('char counter increments as user types', async () => {
    const user = userEvent.setup();
    renderModal();

    const textarea = getDescriptionTextarea();
    await user.type(textarea, 'hello');

    expect(screen.getByText('5 / 500')).toBeInTheDocument();
  });

  it('textarea has maxLength={500}', () => {
    renderModal();
    const textarea = getDescriptionTextarea();
    expect(textarea.maxLength).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// H.7 — fetch mock: sendState transitions
// ---------------------------------------------------------------------------

describe('ReportBugModal — sendState transitions (SD-038 H.7)', () => {
  it('204 response → sendState=success; onClose called after ~1500ms', async () => {
    vi.useFakeTimers();

    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 204 });

    const { onClose } = renderModal();

    // Use fireEvent (synchronous) so the click fires without waiting on userEvent internals
    await act(async () => {
      fireEvent.click(getSendButton());
      // Drain microtasks so the fetch mock resolves and setState('success') runs
      await Promise.resolve();
      await Promise.resolve();
    });

    // success state — button shows "✓ Sent"
    expect(screen.getByRole('button', { name: /sent/i })).toBeInTheDocument();

    // onClose not yet called (needs 1500ms)
    expect(onClose).not.toHaveBeenCalled();

    // Advance timers past SUCCESS_CLOSE_DELAY_MS
    await act(async () => {
      vi.advanceTimersByTime(1_500);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('429 response → inline rate-limit error shown; Send re-enabled', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 429 });

    renderModal();

    await act(async () => {
      fireEvent.click(getSendButton());
      await Promise.resolve();
    });

    expect(
      screen.getByText(/too many reports/i),
    ).toBeInTheDocument();

    // Send button should be re-enabled after error
    const sendBtn = getSendButton();
    expect(sendBtn).not.toBeDisabled();
  });

  it('500 response → generic inline error shown; Send re-enabled', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

    renderModal();

    await act(async () => {
      fireEvent.click(getSendButton());
      await Promise.resolve();
    });

    expect(
      screen.getByText(/couldn.t send/i),
    ).toBeInTheDocument();

    const sendBtn = getSendButton();
    expect(sendBtn).not.toBeDisabled();
  });
});
