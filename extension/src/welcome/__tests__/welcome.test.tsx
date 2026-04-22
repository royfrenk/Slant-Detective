import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Welcome from '../welcome';

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Primary CTA ─────────────────────────────────────────────────────────────

describe('Welcome — primary CTA (SD-043)', () => {
  it('renders "Add API key" as the primary CTA button', () => {
    render(<Welcome />);
    expect(
      screen.getByRole('button', { name: /Add API key/i }),
    ).toBeInTheDocument();
  });

  it('"Add API key" button calls chrome.runtime.openOptionsPage on click', async () => {
    const user = userEvent.setup();
    render(<Welcome />);
    const btn = screen.getByRole('button', { name: /Add API key/i });
    await user.click(btn);
    expect(chrome.runtime.openOptionsPage).toHaveBeenCalledOnce();
  });

  it('"Add API key" button has correct aria-label', () => {
    render(<Welcome />);
    expect(
      screen.getByRole('button', { name: 'Add API key — open the Slant Detective options page' }),
    ).toBeInTheDocument();
  });
});

// ─── Secondary CTA ───────────────────────────────────────────────────────────

describe('Welcome — secondary CTA (SD-043)', () => {
  it('renders "Try it" as a secondary button', () => {
    render(<Welcome />);
    expect(
      screen.getByRole('button', { name: /Try it/i }),
    ).toBeInTheDocument();
  });

  it('"Try it" and "Add API key" both present — two buttons total', () => {
    render(<Welcome />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
  });
});

// ─── Dimension preview grid ───────────────────────────────────────────────────

describe('Welcome — dimension preview grid (SD-043)', () => {
  it('renders all 4 dimension chips', () => {
    render(<Welcome />);
    expect(screen.getByText('WORD CHOICE')).toBeInTheDocument();
    expect(screen.getByText('FRAMING')).toBeInTheDocument();
    expect(screen.getByText('HEADLINE SLANT')).toBeInTheDocument();
    expect(screen.getByText('SOURCE MIX')).toBeInTheDocument();
  });

  it('renders glyphs for all 4 dimensions', () => {
    render(<Welcome />);
    // Glyphs are aria-hidden spans inside the label row — use getAllByText with a
    // function matcher to handle the case where text is split across siblings.
    expect(screen.getByText((content, el) => el?.tagName === 'SPAN' && content === '⚠')).toBeInTheDocument();
    expect(screen.getByText((content, el) => el?.tagName === 'SPAN' && content === '◈')).toBeInTheDocument();
    expect(screen.getByText((content, el) => el?.tagName === 'SPAN' && content === '✎')).toBeInTheDocument();
    expect(screen.getByText((content, el) => el?.tagName === 'SPAN' && content === '“')).toBeInTheDocument();
  });

  it('renders WORD CHOICE description from shared module', () => {
    render(<Welcome />);
    expect(
      screen.getByText('Does the writer pick loaded words where neutral ones would do?'),
    ).toBeInTheDocument();
  });

  it('renders FRAMING description from shared module', () => {
    render(<Welcome />);
    expect(
      screen.getByText(/How are people.s statements introduced\?/),
    ).toBeInTheDocument();
  });

  it('renders HEADLINE SLANT description from shared module', () => {
    render(<Welcome />);
    expect(
      screen.getByText('Does the headline match what the article actually says?'),
    ).toBeInTheDocument();
  });

  it('renders SOURCE MIX description from shared module', () => {
    render(<Welcome />);
    expect(
      screen.getByText('Does the article quote a range of voices, or lean on one side?'),
    ).toBeInTheDocument();
  });
});

// ─── "Why bring your own key?" block ─────────────────────────────────────────

describe('Welcome — "Why bring your own key?" block (SD-043)', () => {
  it('renders the "Why bring your own key?" heading', () => {
    render(<Welcome />);
    expect(screen.getByText('Why bring your own key?')).toBeInTheDocument();
  });

  it('mentions Anthropic in the explainer', () => {
    render(<Welcome />);
    expect(screen.getByText(/Anthropic/)).toBeInTheDocument();
  });

  it('mentions OpenAI in the explainer', () => {
    render(<Welcome />);
    expect(screen.getByText(/OpenAI/)).toBeInTheDocument();
  });

  it('mentions Gemini in the explainer', () => {
    render(<Welcome />);
    expect(screen.getByText(/Gemini/)).toBeInTheDocument();
  });

  it('does not contain a hardcoded dollar-per-hundred figure', () => {
    render(<Welcome />);
    // SD-035 Wave 3 not yet complete — no hardcoded $/100
    expect(screen.queryByText(/\$.*per.*100/i)).toBeNull();
    expect(screen.queryByText(/\$.*\/100/i)).toBeNull();
  });
});

// ─── Privacy microcopy ────────────────────────────────────────────────────────

describe('Welcome — privacy microcopy (SD-043)', () => {
  it('renders the lock-icon privacy microcopy', () => {
    render(<Welcome />);
    expect(
      screen.getByText('Nothing is uploaded without your key. No account. No tracking.'),
    ).toBeInTheDocument();
  });

  it('renders the CTA caption about Try it running locally', () => {
    render(<Welcome />);
    expect(screen.getByText(/runs locally, reduced signals/)).toBeInTheDocument();
  });
});

// ─── Headline and structure ───────────────────────────────────────────────────

describe('Welcome — headline and page structure (SD-043)', () => {
  it('renders "Welcome to Slant Detective" as the H1', () => {
    render(<Welcome />);
    expect(
      screen.getByRole('heading', { name: 'Welcome to Slant Detective', level: 1 }),
    ).toBeInTheDocument();
  });

  it('renders the sub-headline', () => {
    render(<Welcome />);
    expect(
      screen.getByText('Per-article bias analysis — four dimensions, evidence-backed, privacy-first.'),
    ).toBeInTheDocument();
  });

  it('does NOT render old three-bullet structure', () => {
    render(<Welcome />);
    expect(screen.queryByText('Works immediately, no setup needed')).toBeNull();
    expect(screen.queryByText('Per-article bias analysis')).toBeNull();
  });
});

// ─── Footer nav ───────────────────────────────────────────────────────────────

describe('Welcome — footer nav quad unchanged (SD-043)', () => {
  it('renders footer nav with aria-label "Footer navigation"', () => {
    render(<Welcome />);
    expect(screen.getByRole('navigation', { name: 'Footer navigation' })).toBeInTheDocument();
  });

  it('footer has "How we measure" link', () => {
    render(<Welcome />);
    expect(screen.getByRole('link', { name: 'How we measure bias' })).toBeInTheDocument();
  });

  it('footer has "Privacy" link', () => {
    render(<Welcome />);
    expect(screen.getByRole('link', { name: 'Privacy policy' })).toBeInTheDocument();
  });

  it('footer has "Credits" link', () => {
    render(<Welcome />);
    expect(screen.getByRole('link', { name: 'Credits and attributions' })).toBeInTheDocument();
  });

  it('footer has "Feedback" link', () => {
    render(<Welcome />);
    expect(
      screen.getByRole('link', { name: 'Open Slant Detective feedback form in new tab' }),
    ).toBeInTheDocument();
  });
});

// ─── Deprecated copy check ───────────────────────────────────────────────────

describe('Welcome — deprecated copy removed (SD-043)', () => {
  it('does not render old "Add an API key later" bullet text', () => {
    render(<Welcome />);
    expect(
      screen.queryByText('Add an API key later — Anthropic, OpenAI, or Gemini'),
    ).not.toBeInTheDocument();
  });

  it('does not render old "Try it" as the only/primary button in old structure', () => {
    // "Try it" is still present but as a secondary, not a primary isolated button
    render(<Welcome />);
    const buttons = screen.getAllByRole('button');
    // There must be exactly 2 buttons: primary + secondary
    expect(buttons).toHaveLength(2);
    // Primary must be "Add API key"
    expect(buttons[0]).toHaveAttribute('aria-label', 'Add API key — open the Slant Detective options page');
  });
});
