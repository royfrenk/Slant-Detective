import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Welcome from '../welcome';

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Primary CTA ─────────────────────────────────────────────────────────────

describe('Welcome — primary CTA (SD-050)', () => {
  it('renders "Get in-depth analysis" as the primary CTA button', () => {
    render(<Welcome />);
    expect(
      screen.getByRole('button', { name: /Get in-depth analysis/i }),
    ).toBeInTheDocument();
  });

  it('primary button calls chrome.runtime.openOptionsPage on click', async () => {
    const user = userEvent.setup();
    render(<Welcome />);
    const btn = screen.getByRole('button', { name: /Get in-depth analysis/i });
    await user.click(btn);
    expect(chrome.runtime.openOptionsPage).toHaveBeenCalledOnce();
  });

  it('primary button has correct aria-label', () => {
    render(<Welcome />);
    expect(
      screen.getByRole('button', {
        name: 'Get in-depth analysis — open the Slant Detective options page to add an API key',
      }),
    ).toBeInTheDocument();
  });
});

// ─── Secondary CTA ───────────────────────────────────────────────────────────

describe('Welcome — secondary CTA (SD-050)', () => {
  it('renders "Use free mode" as a secondary button', () => {
    render(<Welcome />);
    expect(
      screen.getByRole('button', { name: /Use free mode/i }),
    ).toBeInTheDocument();
  });

  it('primary and secondary CTAs both present — two buttons total', () => {
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

// ─── "Why a key?" block ──────────────────────────────────────────────────────

describe('Welcome — "Why a key?" block (SD-050)', () => {
  it('renders the "Why a key?" heading', () => {
    render(<Welcome />);
    expect(screen.getByText('Why a key?')).toBeInTheDocument();
  });

  it('does NOT render the old "Why bring your own key?" heading', () => {
    render(<Welcome />);
    expect(screen.queryByText('Why bring your own key?')).toBeNull();
  });

  it('renders the rewritten explainer copy (marketing plan §2.6)', () => {
    render(<Welcome />);
    expect(
      screen.getByText(/The in-depth analysis — overall lean, four-dimension breakdown/),
    ).toBeInTheDocument();
  });

  it('names Anthropic, OpenAI, and Google in the "Why a key?" body (marketing plan §2.6)', () => {
    render(<Welcome />);
    // These now appear intentionally in the "Why a key?" block per SD-050.
    expect(screen.getByText(/Anthropic, OpenAI, or Google/)).toBeInTheDocument();
  });

  it('does not contain a hardcoded dollar-per-hundred figure', () => {
    render(<Welcome />);
    // SD-035 Wave 3 not yet complete — no hardcoded $/100
    expect(screen.queryByText(/\$.*per.*100/i)).toBeNull();
    expect(screen.queryByText(/\$.*\/100/i)).toBeNull();
  });
});

// ─── Privacy microcopy ────────────────────────────────────────────────────────

describe('Welcome — privacy microcopy (SD-050)', () => {
  it('renders the rewritten lock-icon privacy microcopy', () => {
    render(<Welcome />);
    expect(
      screen.getByText('Nothing leaves your browser without your key. No account. No tracking.'),
    ).toBeInTheDocument();
  });

  it('does NOT render the old "Nothing is uploaded" lock microcopy', () => {
    render(<Welcome />);
    expect(
      screen.queryByText(/Nothing is uploaded without your key/),
    ).toBeNull();
  });

  it('renders the rewritten CTA caption about free mode', () => {
    render(<Welcome />);
    expect(
      screen.getByText(/Free mode runs entirely in your browser/),
    ).toBeInTheDocument();
  });

  it('does NOT render the old "reduced signals" caption', () => {
    render(<Welcome />);
    expect(screen.queryByText(/reduced signals/)).toBeNull();
  });
});

// ─── Headline and structure ───────────────────────────────────────────────────

describe('Welcome — headline and page structure (SD-050)', () => {
  it('renders the rewritten H1 ("You\'re in. Here\'s what happens next.")', () => {
    render(<Welcome />);
    expect(
      screen.getByRole('heading', {
        name: "You're in. Here's what happens next.",
        level: 1,
      }),
    ).toBeInTheDocument();
  });

  it('does NOT render the old "Welcome to Slant Detective" H1', () => {
    render(<Welcome />);
    expect(
      screen.queryByRole('heading', { name: 'Welcome to Slant Detective', level: 1 }),
    ).toBeNull();
  });

  it('renders the rewritten sub-headline', () => {
    render(<Welcome />);
    expect(
      screen.getByText(
        'Click the toolbar icon on any news article. A side panel will open with the bias readout. No key needed to start.',
      ),
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

describe('Welcome — deprecated copy removed (SD-050)', () => {
  it('does not render the old "Add API key" button label', () => {
    render(<Welcome />);
    // Previous primary button was "Add API key" — replaced by "Get in-depth analysis"
    expect(screen.queryByRole('button', { name: /^Add API key$/ })).toBeNull();
  });

  it('does not render the old "Try it" button label', () => {
    render(<Welcome />);
    // Previous secondary button was "Try it" — replaced by "Use free mode"
    expect(screen.queryByRole('button', { name: /^Try it$/ })).toBeNull();
  });

  it('has exactly two buttons: primary and secondary', () => {
    render(<Welcome />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toHaveAttribute(
      'aria-label',
      'Get in-depth analysis — open the Slant Detective options page to add an API key',
    );
    expect(buttons[1]).toHaveAttribute(
      'aria-label',
      'Use free mode — close this tab and start using Slant Detective',
    );
  });
});

// ─── Firefox conditional sub-headline (SD-059) ────────────────────────────────

describe('Welcome — Firefox conditional sub-headline (SD-059)', () => {
  it('renders the Chrome sub-headline when sidebarAction is not defined (default mock)', () => {
    render(<Welcome />);
    expect(
      screen.getByText(
        'Click the toolbar icon on any news article. A side panel will open with the bias readout. No key needed to start.',
      ),
    ).toBeInTheDocument();
  });

  it('renders the Firefox sub-headline when sidebarAction is defined', () => {
    // Simulate Firefox environment by injecting sidebarAction onto the chrome mock.
    (globalThis.chrome as unknown as Record<string, unknown>).sidebarAction = {};
    render(<Welcome />);
    expect(
      screen.getByText(
        "On first install, right-click the Slant Detective icon → 'Pin to toolbar', then click it to toggle the sidebar.",
      ),
    ).toBeInTheDocument();

    // Clean up so other tests are unaffected.
    delete (globalThis.chrome as unknown as Record<string, unknown>).sidebarAction;
  });
});
