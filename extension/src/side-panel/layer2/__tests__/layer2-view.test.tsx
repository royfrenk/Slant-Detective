import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RubricResponse, Layer1Signals, RubricSpan, RubricDimensions } from '../../../shared/types';
import DirectionChip from '../direction-chip';
import OverallScoreCard from '../overall-score-card';
import DimensionBreakdown from '../dimension-breakdown';
import EvidenceList from '../evidence-list';
import EvidenceItem from '../evidence-item';
import Layer2SkeletonView from '../layer2-skeleton-view';
import Layer2View from '../layer2-view';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const mockDimensions: RubricDimensions = {
  word_choice: { score: 7, direction: 'right' },
  framing: { score: 5, direction: 'left' },
  headline_slant: { score: 4, direction: 'left-center' },
  source_mix: { score: 3, direction: 'center' },
};

const mockSpan: RubricSpan = {
  id: 'span-1',
  text: 'radical overhaul',
  offset_start: 10,
  offset_end: 25,
  category: 'loaded_language',
  severity: 'high',
  tilt: 'right',
  reason: 'Emotionally loaded language.',
  dimension: 'word_choice',
};

const mockRubricResponse: RubricResponse = {
  rubric_version: '1.0',
  overall: {
    intensity: 7.2,
    direction: 'right-center',
    confidence: 0.82,
  },
  dimensions: mockDimensions,
  spans: [mockSpan],
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

// ─── DirectionChip ─────────────────────────────────────────────────────────

describe('DirectionChip', () => {
  it('renders Left direction with correct aria-label', () => {
    render(<DirectionChip direction="left" />);
    expect(screen.getByText('← Left')).toBeInTheDocument();
    expect(screen.getByLabelText(/Lean direction: ← Left/)).toBeInTheDocument();
  });

  it('renders Left-Center direction', () => {
    render(<DirectionChip direction="left-center" />);
    expect(screen.getByText('← Left-Center')).toBeInTheDocument();
  });

  it('renders Center direction', () => {
    render(<DirectionChip direction="center" />);
    expect(screen.getByText('– Center')).toBeInTheDocument();
  });

  it('renders Right-Center direction', () => {
    render(<DirectionChip direction="right-center" />);
    expect(screen.getByText('Right-Center →')).toBeInTheDocument();
  });

  it('renders Right direction', () => {
    render(<DirectionChip direction="right" />);
    expect(screen.getByText('Right →')).toBeInTheDocument();
  });

  it('renders Mixed direction', () => {
    render(<DirectionChip direction="mixed" />);
    expect(screen.getByText('~ Mixed')).toBeInTheDocument();
  });
});

// ─── OverallScoreCard ────────────────────────────────────────────────────────

describe('OverallScoreCard', () => {
  it('renders integer score without decimal for round values', () => {
    render(<OverallScoreCard score={7.0} direction="center" confidence={0.9} />);
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('renders one decimal place for non-round values', () => {
    render(<OverallScoreCard score={7.2} direction="right-center" confidence={0.82} />);
    expect(screen.getByText('7.2')).toBeInTheDocument();
  });

  it('renders score=0 as "0"', () => {
    render(<OverallScoreCard score={0} direction="mixed" confidence={0.5} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('renders confidence percentage', () => {
    render(<OverallScoreCard score={7.2} direction="right-center" confidence={0.82} />);
    expect(screen.getByText('82% confident')).toBeInTheDocument();
  });

  it('renders direction chip', () => {
    render(<OverallScoreCard score={7.2} direction="right-center" confidence={0.82} />);
    expect(screen.getByText('Right-Center →')).toBeInTheDocument();
  });

  it('has role="region" with correct aria-label', () => {
    render(<OverallScoreCard score={5} direction="center" confidence={0.75} />);
    expect(screen.getByRole('region', { name: 'Overall bias score' })).toBeInTheDocument();
  });

  it('score element has correct aria-label', () => {
    render(<OverallScoreCard score={7.2} direction="right-center" confidence={0.82} />);
    expect(screen.getByLabelText('Bias score: 7.2 out of 10')).toBeInTheDocument();
  });
});

// ─── DimensionBreakdown ──────────────────────────────────────────────────────

describe('DimensionBreakdown', () => {
  it('renders all four dimensions', () => {
    render(<DimensionBreakdown dims={mockDimensions} />);
    expect(screen.getByText('WORD CHOICE')).toBeInTheDocument();
    expect(screen.getByText('FRAMING')).toBeInTheDocument();
    expect(screen.getByText('HEADLINE SLANT')).toBeInTheDocument();
    expect(screen.getByText('SOURCE MIX')).toBeInTheDocument();
  });

  it('renders dimensions in canonical order', () => {
    render(<DimensionBreakdown dims={mockDimensions} />);
    const groups = screen.getAllByRole('group');
    expect(groups[0]).toHaveAttribute('aria-label', expect.stringContaining('WORD CHOICE'));
    expect(groups[1]).toHaveAttribute('aria-label', expect.stringContaining('FRAMING'));
    expect(groups[2]).toHaveAttribute('aria-label', expect.stringContaining('HEADLINE SLANT'));
    expect(groups[3]).toHaveAttribute('aria-label', expect.stringContaining('SOURCE MIX'));
  });

  it('renders direction chips per dimension when direction is provided', () => {
    render(<DimensionBreakdown dims={mockDimensions} />);
    // WORD CHOICE has direction 'right'
    expect(screen.getByText('Right →')).toBeInTheDocument();
    // FRAMING has direction 'left'
    expect(screen.getByText('← Left')).toBeInTheDocument();
  });

  it('block count for score=0 renders all unfilled blocks', () => {
    const zerodDims: RubricDimensions = {
      word_choice: { score: 0 },
      framing: { score: 0 },
      headline_slant: { score: 0 },
      source_mix: { score: 0 },
    };
    render(<DimensionBreakdown dims={zerodDims} />);
    // No blocks should have fill classes — just check no errors
    expect(screen.getByRole('region', { name: 'Dimension breakdown' })).toBeInTheDocument();
  });

  it('has role="region" with correct aria-label', () => {
    render(<DimensionBreakdown dims={mockDimensions} />);
    expect(screen.getByRole('region', { name: 'Dimension breakdown' })).toBeInTheDocument();
  });
});

// ─── EvidenceList ─────────────────────────────────────────────────────────────

describe('EvidenceList', () => {
  it('renders empty state when items=[]', () => {
    render(<EvidenceList items={[]} />);
    expect(screen.getByText('No specific evidence flagged.')).toBeInTheDocument();
  });

  it('renders evidence items when provided', () => {
    render(<EvidenceList items={[mockSpan]} />);
    expect(screen.getByText(/radical overhaul/)).toBeInTheDocument();
  });

  it('sorts high severity before medium before low', () => {
    const items: RubricSpan[] = [
      { ...mockSpan, id: 'low-1', severity: 'low', text: 'low text' },
      { ...mockSpan, id: 'high-1', severity: 'high', text: 'high text' },
      { ...mockSpan, id: 'med-1', severity: 'medium', text: 'medium text' },
    ];
    render(<EvidenceList items={items} />);
    const listItems = screen.getAllByRole('listitem');
    // High should appear before medium, medium before low
    const highIndex = listItems.findIndex((el) => el.getAttribute('id') === 'high-1');
    const medIndex = listItems.findIndex((el) => el.getAttribute('id') === 'med-1');
    const lowIndex = listItems.findIndex((el) => el.getAttribute('id') === 'low-1');
    expect(highIndex).toBeLessThan(medIndex);
    expect(medIndex).toBeLessThan(lowIndex);
  });

  it('sorts word_choice before framing within same severity', () => {
    const items: RubricSpan[] = [
      { ...mockSpan, id: 'framing-1', category: 'framing', severity: 'high', text: 'framing text' },
      { ...mockSpan, id: 'wc-1', category: 'loaded_language', severity: 'high', text: 'word choice text' },
    ];
    render(<EvidenceList items={items} />);
    const listItems = screen.getAllByRole('listitem');
    const wcIndex = listItems.findIndex((el) => el.getAttribute('id') === 'wc-1');
    const framingIndex = listItems.findIndex((el) => el.getAttribute('id') === 'framing-1');
    expect(wcIndex).toBeLessThan(framingIndex);
  });

  it('caps at 15 items and shows overflow indicator', () => {
    const items: RubricSpan[] = Array.from({ length: 20 }, (_, i) => ({
      ...mockSpan,
      id: `span-${i}`,
      text: `evidence ${i}`,
    }));
    render(<EvidenceList items={items} />);
    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(15);
    expect(screen.getByText('+ 5 more')).toBeInTheDocument();
  });

  it('has role="region" with correct aria-label', () => {
    render(<EvidenceList items={[]} />);
    expect(screen.getByRole('region', { name: 'Bias evidence' })).toBeInTheDocument();
  });
});

// ─── EvidenceItem ─────────────────────────────────────────────────────────────

describe('EvidenceItem', () => {
  const onTooltipToggle = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders category glyph', () => {
    render(
      <EvidenceItem item={mockSpan} isTooltipOpen={false} onTooltipToggle={onTooltipToggle} />,
    );
    expect(screen.getByText('⚠')).toBeInTheDocument();
  });

  it('renders category label', () => {
    render(
      <EvidenceItem item={mockSpan} isTooltipOpen={false} onTooltipToggle={onTooltipToggle} />,
    );
    expect(screen.getByText('LOADED LANGUAGE')).toBeInTheDocument();
  });

  it('renders severity badge', () => {
    render(
      <EvidenceItem item={mockSpan} isTooltipOpen={false} onTooltipToggle={onTooltipToggle} />,
    );
    expect(screen.getByText('HIGH')).toBeInTheDocument();
  });

  it('renders text snippet', () => {
    render(
      <EvidenceItem item={mockSpan} isTooltipOpen={false} onTooltipToggle={onTooltipToggle} />,
    );
    expect(screen.getByText(/radical overhaul/)).toBeInTheDocument();
  });

  it('calls onTooltipToggle with item id on click', async () => {
    const user = userEvent.setup();
    render(
      <EvidenceItem item={mockSpan} isTooltipOpen={false} onTooltipToggle={onTooltipToggle} />,
    );
    const container = screen.getByRole('listitem').firstChild as HTMLElement;
    await user.click(container);
    expect(onTooltipToggle).toHaveBeenCalledWith(mockSpan.id);
  });

  it('renders framing glyph ◈ for framing category', () => {
    const framingSpan: RubricSpan = { ...mockSpan, id: 'framing-1', category: 'framing' };
    render(
      <EvidenceItem item={framingSpan} isTooltipOpen={false} onTooltipToggle={onTooltipToggle} />,
    );
    expect(screen.getByText('◈')).toBeInTheDocument();
  });

  it('renders ✎ glyph for headline_slant category', () => {
    const headlineSpan: RubricSpan = { ...mockSpan, id: 'hl-1', category: 'headline_slant' };
    render(
      <EvidenceItem item={headlineSpan} isTooltipOpen={false} onTooltipToggle={onTooltipToggle} />,
    );
    expect(screen.getByText('✎')).toBeInTheDocument();
  });

  it('renders " glyph for source_mix category', () => {
    const sourceSpan: RubricSpan = { ...mockSpan, id: 'src-1', category: 'source_mix' };
    render(
      <EvidenceItem item={sourceSpan} isTooltipOpen={false} onTooltipToggle={onTooltipToggle} />,
    );
    expect(screen.getByText('"')).toBeInTheDocument();
  });

  it('has id attribute matching item.id', () => {
    render(
      <EvidenceItem item={mockSpan} isTooltipOpen={false} onTooltipToggle={onTooltipToggle} />,
    );
    expect(screen.getByRole('listitem')).toHaveAttribute('id', mockSpan.id);
  });
});

// ─── Layer2SkeletonView ───────────────────────────────────────────────────────

describe('Layer2SkeletonView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('renders shimmer blocks', () => {
    render(<Layer2SkeletonView />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  });

  it('does not show progress text initially', () => {
    render(<Layer2SkeletonView />);
    expect(screen.queryByText('Analyzing with Claude…')).not.toBeInTheDocument();
  });

  it('shows progress text after 1000ms', async () => {
    render(<Layer2SkeletonView />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText('Analyzing with Claude…')).toBeInTheDocument();
  });

  it('has correct aria-label', () => {
    render(<Layer2SkeletonView />);
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      'Running in-depth analysis on this article…',
    );
  });
});

// ─── Layer2View ──────────────────────────────────────────────────────────────

describe('Layer2View', () => {
  it('renders full view when wordCount >= 400', () => {
    render(<Layer2View result={mockRubricResponse} layer1Signals={mockLayer1Signals} />);
    expect(screen.getByRole('region', { name: 'Overall bias score' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Dimension breakdown' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Bias evidence' })).toBeInTheDocument();
  });

  it('renders TooShortCardL2 when wordCount < 400', () => {
    const shortSignals: Layer1Signals = { ...mockLayer1Signals, wordCount: 399 };
    render(<Layer2View result={mockRubricResponse} layer1Signals={shortSignals} />);
    expect(screen.getByRole('region', { name: 'Article too short' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Overall bias score' })).not.toBeInTheDocument();
  });

  it('renders SourceStrip with domain', () => {
    render(<Layer2View result={mockRubricResponse} layer1Signals={mockLayer1Signals} />);
    expect(screen.getByRole('region', { name: 'Source information' })).toBeInTheDocument();
    expect(screen.getByText('example.com')).toBeInTheDocument();
  });

  it('renders FooterNav', () => {
    render(<Layer2View result={mockRubricResponse} layer1Signals={mockLayer1Signals} />);
    expect(screen.getByRole('navigation', { name: 'Extension pages' })).toBeInTheDocument();
  });
});
