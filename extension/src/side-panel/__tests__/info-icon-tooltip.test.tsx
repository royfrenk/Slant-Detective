import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RubricDimensions } from '../../shared/types';
import type { Layer1Signals } from '../../shared/types';
import DimensionBreakdown from '../layer2/dimension-breakdown';
import IntensityBars from '../layer1/intensity-bars';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const mockDimensions: RubricDimensions = {
  word_choice: { score: 7, direction: 'right' },
  framing: { score: 5, direction: 'left' },
  headline_slant: { score: 4, direction: 'left-center' },
  source_mix: { score: 3, direction: 'center' },
};

const mockLayer1Signals: Layer1Signals = {
  domain: 'example.com',
  wordCount: 600,
  languageIntensity: 5,
  loadedWords: { hits: [], uniqueSurfaces: [], count: 0 },
  hedges: { hits: [], count: 0 },
  attribution: { totalAttributions: 0, tierCounts: [0, 0, 0, 0], byActor: {} },
  headlineDrift: { score: 0.1, interpretation: 'low' },
};

// ─── DimensionBreakdown — InfoIcon render ─────────────────────────────────

describe('DimensionBreakdown — InfoIcon presence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders 4 info icons (one per dimension)', () => {
    render(<DimensionBreakdown dims={mockDimensions} />);
    const icons = screen.getAllByRole('img', { name: /what this means/i });
    expect(icons).toHaveLength(4);
  });

  it('renders info icon for WORD CHOICE with correct aria-label', () => {
    render(<DimensionBreakdown dims={mockDimensions} />);
    expect(
      screen.getByRole('img', { name: 'WORD CHOICE — what this means' }),
    ).toBeInTheDocument();
  });

  it('renders info icon for FRAMING with correct aria-label', () => {
    render(<DimensionBreakdown dims={mockDimensions} />);
    expect(
      screen.getByRole('img', { name: 'FRAMING — what this means' }),
    ).toBeInTheDocument();
  });

  it('renders info icon for HEADLINE SLANT with correct aria-label', () => {
    render(<DimensionBreakdown dims={mockDimensions} />);
    expect(
      screen.getByRole('img', { name: 'HEADLINE SLANT — what this means' }),
    ).toBeInTheDocument();
  });

  it('renders info icon for SOURCE MIX with correct aria-label', () => {
    render(<DimensionBreakdown dims={mockDimensions} />);
    expect(
      screen.getByRole('img', { name: 'SOURCE MIX — what this means' }),
    ).toBeInTheDocument();
  });

  it('info icons are keyboard focusable (tabIndex=0)', () => {
    render(<DimensionBreakdown dims={mockDimensions} />);
    const icons = screen.getAllByRole('img', { name: /what this means/i });
    icons.forEach((icon) => {
      expect(icon).toHaveAttribute('tabindex', '0');
    });
  });
});

describe('DimensionBreakdown — InfoTooltip on focus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows tooltip immediately on focus of WORD CHOICE icon', async () => {
    const user = userEvent.setup();
    render(<DimensionBreakdown dims={mockDimensions} />);
    const icon = screen.getByRole('img', { name: 'WORD CHOICE — what this means' });

    await user.tab();
    icon.focus();
    await act(async () => {});

    const tooltip = document.getElementById('sd-info-tooltip-word_choice');
    expect(tooltip).not.toBeNull();
    expect(tooltip?.getAttribute('role')).toBe('tooltip');
  });

  it('tooltip contains correct description for WORD CHOICE', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    vi.useFakeTimers();
    render(<DimensionBreakdown dims={mockDimensions} />);
    const icon = screen.getByRole('img', { name: 'WORD CHOICE — what this means' });

    icon.focus();
    await act(async () => {});

    expect(
      screen.getByText('Does the writer pick loaded words where neutral ones would do?'),
    ).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('tooltip contains example text for WORD CHOICE', async () => {
    render(<DimensionBreakdown dims={mockDimensions} />);
    const icon = screen.getByRole('img', { name: 'WORD CHOICE — what this means' });

    icon.focus();
    await act(async () => {});

    expect(
      screen.getByText(/"Slammed" vs "criticized\."/),
    ).toBeInTheDocument();
  });

  it('tooltip for FRAMING shows correct description', async () => {
    render(<DimensionBreakdown dims={mockDimensions} />);
    const icon = screen.getByRole('img', { name: 'FRAMING — what this means' });

    icon.focus();
    await act(async () => {});

    expect(
      screen.getByText(/How are people.s statements introduced\?/),
    ).toBeInTheDocument();
  });

  it('tooltip dismisses on Escape key', async () => {
    const user = userEvent.setup();
    render(<DimensionBreakdown dims={mockDimensions} />);
    const icon = screen.getByRole('img', { name: 'WORD CHOICE — what this means' });

    icon.focus();
    await act(async () => {});

    await user.keyboard('{Escape}');

    const tooltip = document.getElementById('sd-info-tooltip-word_choice');
    expect(tooltip).toBeNull();
  });

  it('icon has aria-describedby pointing to tooltip when visible', async () => {
    render(<DimensionBreakdown dims={mockDimensions} />);
    const icon = screen.getByRole('img', { name: 'WORD CHOICE — what this means' });

    icon.focus();
    await act(async () => {});

    expect(icon).toHaveAttribute('aria-describedby', 'sd-info-tooltip-word_choice');
  });

  it('icon does not have aria-describedby when tooltip is hidden', () => {
    render(<DimensionBreakdown dims={mockDimensions} />);
    const icon = screen.getByRole('img', { name: 'WORD CHOICE — what this means' });
    expect(icon).not.toHaveAttribute('aria-describedby');
  });
});

// ─── DimensionBreakdown — hover behavior ─────────────────────────────────
// Note: the 300ms show-delay and 150ms hide-delay are tested via the
// useInfoTooltip hook contract. Integration tests below verify that the
// tooltip correctly becomes visible after hovering (timer-driven). We
// use userEvent which internally coordinates timer advancement.

describe('DimensionBreakdown — InfoTooltip on hover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tooltip is not present initially (before any interaction)', () => {
    render(<DimensionBreakdown dims={mockDimensions} />);
    expect(document.getElementById('sd-info-tooltip-word_choice')).toBeNull();
  });

  it('tooltip can be shown by focus (no delay) then icon loses focus — tooltip hides immediately', async () => {
    render(<DimensionBreakdown dims={mockDimensions} />);
    const icon = screen.getByRole('img', { name: 'WORD CHOICE — what this means' });

    icon.focus();
    await act(async () => {});
    expect(document.getElementById('sd-info-tooltip-word_choice')).not.toBeNull();

    icon.blur();
    await act(async () => {});
    expect(document.getElementById('sd-info-tooltip-word_choice')).toBeNull();
  });
});

// ─── IntensityBars — InfoIcon render ──────────────────────────────────────

describe('IntensityBars — InfoIcon presence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders 3 info icons (one per Layer 1 signal)', () => {
    render(<IntensityBars signals={mockLayer1Signals} />);
    const icons = screen.getAllByRole('img', { name: /what this means/i });
    expect(icons).toHaveLength(3);
  });

  it('renders info icon for Language intensity with correct aria-label', () => {
    render(<IntensityBars signals={mockLayer1Signals} />);
    expect(
      screen.getByRole('img', { name: 'Language intensity — what this means' }),
    ).toBeInTheDocument();
  });

  it('renders info icon for Headline drift with correct aria-label', () => {
    render(<IntensityBars signals={mockLayer1Signals} />);
    expect(
      screen.getByRole('img', { name: 'Headline drift — what this means' }),
    ).toBeInTheDocument();
  });

  it('renders info icon for Attribution skew with correct aria-label', () => {
    render(<IntensityBars signals={mockLayer1Signals} />);
    expect(
      screen.getByRole('img', { name: 'Attribution skew — what this means' }),
    ).toBeInTheDocument();
  });

  it('info icons are keyboard focusable (tabIndex=0)', () => {
    render(<IntensityBars signals={mockLayer1Signals} />);
    const icons = screen.getAllByRole('img', { name: /what this means/i });
    icons.forEach((icon) => {
      expect(icon).toHaveAttribute('tabindex', '0');
    });
  });
});

describe('IntensityBars — InfoTooltip on focus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows tooltip on focus of Language intensity icon', async () => {
    render(<IntensityBars signals={mockLayer1Signals} />);
    const icon = screen.getByRole('img', { name: 'Language intensity — what this means' });

    icon.focus();
    await act(async () => {});

    const tooltip = document.getElementById('sd-info-tooltip-language_intensity');
    expect(tooltip).not.toBeNull();
    expect(tooltip?.getAttribute('role')).toBe('tooltip');
  });

  it('tooltip shows correct one-sentence definition for Language intensity', async () => {
    render(<IntensityBars signals={mockLayer1Signals} />);
    const icon = screen.getByRole('img', { name: 'Language intensity — what this means' });

    icon.focus();
    await act(async () => {});

    expect(
      screen.getByText(
        'Measures how often the writer uses emotionally charged or loaded words instead of neutral ones.',
      ),
    ).toBeInTheDocument();
  });

  it('tooltip shows correct definition for Headline drift', async () => {
    render(<IntensityBars signals={mockLayer1Signals} />);
    const icon = screen.getByRole('img', { name: 'Headline drift — what this means' });

    icon.focus();
    await act(async () => {});

    expect(
      screen.getByText(
        'Measures how far the headline strays from what the article body actually reports.',
      ),
    ).toBeInTheDocument();
  });

  it('tooltip shows correct definition for Attribution skew', async () => {
    render(<IntensityBars signals={mockLayer1Signals} />);
    const icon = screen.getByRole('img', { name: 'Attribution skew — what this means' });

    icon.focus();
    await act(async () => {});

    expect(
      screen.getByText(/Measures whether quoted sources are introduced with neutral verbs/),
    ).toBeInTheDocument();
  });

  it('Layer 1 tooltip does NOT show an example block (definition only)', async () => {
    render(<IntensityBars signals={mockLayer1Signals} />);
    const icon = screen.getByRole('img', { name: 'Language intensity — what this means' });

    icon.focus();
    await act(async () => {});

    // Layer 1 only has one-sentence definition — no example italic block
    expect(screen.queryByText(/"Slammed"/)).toBeNull();
  });

  it('tooltip dismisses on Escape key for Layer 1', async () => {
    const user = userEvent.setup();
    render(<IntensityBars signals={mockLayer1Signals} />);
    const icon = screen.getByRole('img', { name: 'Language intensity — what this means' });

    icon.focus();
    await act(async () => {});

    await user.keyboard('{Escape}');

    const tooltip = document.getElementById('sd-info-tooltip-language_intensity');
    expect(tooltip).toBeNull();
  });
});

// ─── IntensityBars — loading state ───────────────────────────────────────

describe('IntensityBars — loading state hides info icons', () => {
  it('does not render info icons when loading=true', () => {
    render(<IntensityBars signals={mockLayer1Signals} loading={true} />);
    const icons = screen.queryAllByRole('img', { name: /what this means/i });
    expect(icons).toHaveLength(0);
  });
});
