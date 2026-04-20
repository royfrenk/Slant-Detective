import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InvalidKeyCard from '../invalid-key-card';
import LLMTimeoutCard from '../llm-timeout-card';
import RateLimitCard from '../rate-limit-card';
import TooShortCardL2 from '../too-short-card-l2';

// ─────────────────────────────────────────────────────────────────────────────
// InvalidKeyCard
// ─────────────────────────────────────────────────────────────────────────────

describe('InvalidKeyCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the correct title', () => {
    render(<InvalidKeyCard />);
    expect(screen.getByRole('heading', { name: 'API key not recognized' })).toBeInTheDocument();
  });

  it('renders the correct body text', () => {
    render(<InvalidKeyCard />);
    expect(
      screen.getByText(
        "Your Anthropic API key wasn't accepted. It may have been revoked or entered incorrectly. Open Settings to update it.",
      ),
    ).toBeInTheDocument();
  });

  it('has role="alert"', () => {
    render(<InvalidKeyCard />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('"Open Settings" button calls chrome.runtime.openOptionsPage', async () => {
    const user = userEvent.setup();
    render(<InvalidKeyCard />);
    const button = screen.getByRole('button', { name: 'Open Settings to update your API key' });
    await user.click(button);
    expect(chrome.runtime.openOptionsPage).toHaveBeenCalledOnce();
  });

  it('"Open Settings" button has correct aria-label', () => {
    render(<InvalidKeyCard />);
    expect(
      screen.getByRole('button', { name: 'Open Settings to update your API key' }),
    ).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LLMTimeoutCard
// ─────────────────────────────────────────────────────────────────────────────

describe('LLMTimeoutCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the correct title', () => {
    const onRetry = vi.fn();
    render(<LLMTimeoutCard onRetry={onRetry} />);
    expect(screen.getByRole('heading', { name: 'Analysis is taking too long' })).toBeInTheDocument();
  });

  it('renders the correct body text', () => {
    const onRetry = vi.fn();
    render(<LLMTimeoutCard onRetry={onRetry} />);
    expect(
      screen.getByText(
        'The request to Claude timed out. This is usually a temporary network issue. Your API key is fine.',
      ),
    ).toBeInTheDocument();
  });

  it('has role="alert"', () => {
    const onRetry = vi.fn();
    render(<LLMTimeoutCard onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('"Try again" button calls onRetry', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<LLMTimeoutCard onRetry={onRetry} />);
    const button = screen.getByRole('button', { name: 'Try again — retry analysis' });
    await user.click(button);
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RateLimitCard
// ─────────────────────────────────────────────────────────────────────────────

describe('RateLimitCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the correct title', () => {
    const onRetry = vi.fn();
    render(<RateLimitCard onRetry={onRetry} />);
    expect(screen.getByRole('heading', { name: 'Too many requests right now' })).toBeInTheDocument();
  });

  it('renders body text including rate-limit message', () => {
    const onRetry = vi.fn();
    render(<RateLimitCard onRetry={onRetry} />);
    expect(screen.getByText(/rate-limited this key for now/)).toBeInTheDocument();
  });

  it('has role="alert"', () => {
    const onRetry = vi.fn();
    render(<RateLimitCard onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('"Try again" button calls onRetry', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<RateLimitCard onRetry={onRetry} />);
    const button = screen.getByRole('button', { name: 'Try again — retry analysis' });
    await user.click(button);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('"Anthropic Console" inline link has correct aria-label', () => {
    const onRetry = vi.fn();
    render(<RateLimitCard onRetry={onRetry} />);
    expect(
      screen.getByRole('link', { name: 'Anthropic Console — opens in new tab' }),
    ).toBeInTheDocument();
  });

  it('"Anthropic Console" click calls chrome.tabs.create with correct URL', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<RateLimitCard onRetry={onRetry} />);
    const link = screen.getByRole('link', { name: 'Anthropic Console — opens in new tab' });
    await user.click(link);
    expect(chrome.tabs.create).toHaveBeenCalledWith({ url: 'https://console.anthropic.com' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TooShortCardL2
// ─────────────────────────────────────────────────────────────────────────────

describe('TooShortCardL2', () => {
  it('renders the correct title', () => {
    render(<TooShortCardL2 wordCount={120} />);
    expect(
      screen.getByRole('heading', { name: 'Article too short to analyze' }),
    ).toBeInTheDocument();
  });

  it('renders body with correct word count', () => {
    render(<TooShortCardL2 wordCount={42} />);
    expect(
      screen.getByText(
        'Bias signals need at least 400 words to be reliable. This article has approximately 42 words.',
      ),
    ).toBeInTheDocument();
  });

  it('has role="region"', () => {
    render(<TooShortCardL2 wordCount={100} />);
    expect(screen.getByRole('region', { name: 'Article too short' })).toBeInTheDocument();
  });

  it('has aria-live="polite"', () => {
    render(<TooShortCardL2 wordCount={100} />);
    const card = screen.getByRole('region', { name: 'Article too short' });
    expect(card).toHaveAttribute('aria-live', 'polite');
  });

  it('renders the ✎ glyph', () => {
    render(<TooShortCardL2 wordCount={100} />);
    expect(screen.getByText('✎')).toBeInTheDocument();
  });

  it('does not render a button (no CTA)', () => {
    render(<TooShortCardL2 wordCount={100} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('does not render UpsellRow', () => {
    render(<TooShortCardL2 wordCount={100} />);
    // UpsellRow would contain "Unlock full analysis"
    expect(screen.queryByText(/Unlock full analysis/)).toBeNull();
  });
});
