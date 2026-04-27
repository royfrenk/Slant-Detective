import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReviewPromptCard from '../review-prompt-card';
import { LAYER2_SUCCESS_COUNT, REVIEW_PROMPT_SHOWN } from '../../../shared/storage-keys';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockStorage(count: number, shown: boolean): void {
  (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockImplementation(
    (_keys: unknown, cb?: (result: Record<string, unknown>) => void) => {
      cb?.({ [LAYER2_SUCCESS_COUNT]: count, [REVIEW_PROMPT_SHOWN]: shown });
      return undefined;
    },
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ReviewPromptCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Simulate Chrome environment: runtime.id present, no sidebarAction.
    (globalThis.chrome as unknown as Record<string, unknown>).runtime = {
      ...(globalThis.chrome.runtime as object),
      id: 'test-extension-id',
    };
    // Ensure sidebarAction is absent so getReviewUrl() returns a Chrome URL.
    delete (globalThis.chrome as unknown as Record<string, unknown>).sidebarAction;
  });

  it('renders nothing when count is below threshold (count=4, shown=false)', () => {
    mockStorage(4, false);
    const { container } = render(<ReviewPromptCard />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the card when count equals threshold (count=5, shown=false)', async () => {
    mockStorage(5, false);
    render(<ReviewPromptCard />);

    expect(await screen.findByRole('region', { name: /Enjoying Slant Detective/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Enjoying Slant Detective?' })).toBeInTheDocument();
    expect(screen.getByText(/Leave a quick review on the Chrome Web Store/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Leave a review/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Not now/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss review prompt' })).toBeInTheDocument();
  });

  it('renders nothing when count is above threshold but prompt already shown (count=10, shown=true)', () => {
    mockStorage(10, true);
    const { container } = render(<ReviewPromptCard />);
    expect(container.firstChild).toBeNull();
  });

  it('clicking primary CTA opens the review URL and sets the shown flag', async () => {
    mockStorage(5, false);
    render(<ReviewPromptCard />);

    const primaryBtn = await screen.findByRole('button', { name: /Leave a review on the Chrome Web Store/i });
    await userEvent.click(primaryBtn);

    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: 'https://chromewebstore.google.com/detail/test-extension-id/reviews',
    });
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ [REVIEW_PROMPT_SHOWN]: true });
    // Card should no longer be visible after dismiss.
    expect(screen.queryByRole('region', { name: /Enjoying Slant Detective/i })).not.toBeInTheDocument();
  });

  it('clicking "Not now" sets the shown flag and hides the card without opening a tab', async () => {
    mockStorage(5, false);
    render(<ReviewPromptCard />);

    const notNowBtn = await screen.findByRole('button', { name: /Not now/i });
    await userEvent.click(notNowBtn);

    expect(chrome.tabs.create).not.toHaveBeenCalled();
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ [REVIEW_PROMPT_SHOWN]: true });
    expect(screen.queryByRole('region', { name: /Enjoying Slant Detective/i })).not.toBeInTheDocument();
  });

  it('clicking × sets the shown flag and hides the card', async () => {
    mockStorage(5, false);
    render(<ReviewPromptCard />);

    const closeBtn = await screen.findByRole('button', { name: 'Dismiss review prompt' });
    await userEvent.click(closeBtn);

    expect(chrome.tabs.create).not.toHaveBeenCalled();
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ [REVIEW_PROMPT_SHOWN]: true });
    expect(screen.queryByRole('region', { name: /Enjoying Slant Detective/i })).not.toBeInTheDocument();
  });

  it('renders nothing on Firefox (sidebarAction present → URL is null)', () => {
    // Simulate Firefox by adding sidebarAction to the chrome object.
    (globalThis.chrome as unknown as Record<string, unknown>).sidebarAction = {};
    mockStorage(10, false);

    const { container } = render(<ReviewPromptCard />);
    expect(container.firstChild).toBeNull();

    // Clean up Firefox simulation.
    delete (globalThis.chrome as unknown as Record<string, unknown>).sidebarAction;
  });

  it('close button has correct aria-label for accessibility', async () => {
    mockStorage(5, false);
    render(<ReviewPromptCard />);

    const closeBtn = await screen.findByRole('button', { name: 'Dismiss review prompt' });
    expect(closeBtn).toHaveAttribute('aria-label', 'Dismiss review prompt');
  });
});

// ─── afterEach cleanup ────────────────────────────────────────────────────────

afterEach(() => {
  // Remove sidebarAction if a test left it behind.
  delete (globalThis.chrome as unknown as Record<string, unknown>).sidebarAction;
});
