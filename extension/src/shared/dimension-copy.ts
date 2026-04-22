// ---------------------------------------------------------------------------
// Shared dimension and Layer 1 signal copy
// Single source of truth consumed by:
//   - extension/src/pages/how-we-measure-page.tsx
//   - extension/src/side-panel/layer2/dimension-breakdown.tsx
//   - extension/src/side-panel/layer1/intensity-bars.tsx
//   - extension/src/welcome/welcome.tsx (SD-043)
// ---------------------------------------------------------------------------

export interface DimensionCopy {
  key: string;
  label: string;
  glyph: string;
  description: string;
  example?: string;
  accentBorderClass: string;
  accentTextClass: string;
}

export interface Layer1SignalCopy {
  key: string;
  label: string;
  definition: string;
}

// Palette mirrors side-panel/layer2/dimension-breakdown.tsx so the explainer
// page and welcome page use the same color language as the actual rubric readout.
export const DIMENSIONS: readonly DimensionCopy[] = [
  {
    key: 'word_choice',
    label: 'WORD CHOICE',
    glyph: '⚠',
    description: 'Does the writer pick loaded words where neutral ones would do?',
    example: '"Slammed" vs "criticized." "Regime" vs "government." Small swaps that steer how you feel.',
    accentBorderClass: 'border-dim-word-choice',
    accentTextClass: 'text-dim-word-choice',
  },
  {
    key: 'framing',
    label: 'FRAMING',
    glyph: '◈',
    description: 'How are people’s statements introduced?',
    example: '"She said..." lands very differently from "She admitted..." or "She claimed..." We read the verbs.',
    accentBorderClass: 'border-dim-framing',
    accentTextClass: 'text-dim-framing',
  },
  {
    key: 'headline_slant',
    label: 'HEADLINE SLANT',
    glyph: '✎',
    description: 'Does the headline match what the article actually says?',
    example: 'Or is it pumped up, toned down, or pointing somewhere the story never quite goes?',
    accentBorderClass: 'border-primary-fixed',
    accentTextClass: 'text-primary-fixed',
  },
  {
    key: 'source_mix',
    label: 'SOURCE MIX',
    glyph: '“',
    description: 'Does the article quote a range of voices, or lean on one side?',
    example: 'A one-source story reads differently from a five-source one, even when both sound confident.',
    accentBorderClass: 'border-slate-chip',
    accentTextClass: 'text-slate-chip',
  },
] as const;

// Layer 1 signal tooltip copy — approved copy from SD-042-design.md.
export const LAYER1_SIGNALS: readonly Layer1SignalCopy[] = [
  {
    key: 'language_intensity',
    label: 'Language intensity',
    definition: 'Measures how often the writer uses emotionally charged or loaded words instead of neutral ones.',
  },
  {
    key: 'headline_drift',
    label: 'Headline drift',
    definition: 'Measures how far the headline strays from what the article body actually reports.',
  },
  {
    key: 'attribution_skew',
    label: 'Attribution skew',
    definition: 'Measures whether quoted sources are introduced with neutral verbs (“said”) or charged ones (“admitted”, “blasted”).',
  },
] as const;
