import React from 'react';
import type { Layer1Signals } from '../../shared/types';

const TOTAL_BLOCKS = 10;

// Fill colors per signal — only hex values are inline-style (design-spec exact colors
// that have no Tailwind token equivalents except primary-fixed and on-tertiary-container).
// We reference the CSS custom properties set by Tailwind to avoid magic hex in JSX.

interface SignalBarConfig {
  readonly label: string;
  readonly glyph: string;
  readonly fillClass: string;  // Tailwind class for filled blocks
  readonly glyphClass: string; // Tailwind class for glyph color
}

const SIGNAL_BARS: readonly SignalBarConfig[] = [
  {
    label: 'Language intensity',
    glyph: '⚠',
    fillClass: 'bg-tertiary',
    glyphClass: 'text-tertiary',
  },
  {
    label: 'Headline drift',
    glyph: '✎',
    fillClass: 'bg-on-tertiary-container',
    glyphClass: 'text-on-tertiary-container',
  },
  {
    label: 'Attribution skew',
    glyph: '"',
    fillClass: 'bg-primary-fixed',
    glyphClass: 'text-primary-fixed',
  },
];

function filledBlockCount(score: number): number {
  return Math.round(Math.max(0, Math.min(TOTAL_BLOCKS, score)));
}

function attributionScore(signals: Layer1Signals): number {
  const { tierCounts } = signals.attribution;
  // Assertive (index 2) + assertive-plus (index 3) weighted double, then scaled
  return Math.min(10, (tierCounts[2] + tierCounts[3] * 2) * 2);
}

function headlineDriftScore(signals: Layer1Signals): number {
  const map: Record<string, number> = { low: 2, medium: 6, high: 10 };
  return map[signals.headlineDrift.interpretation] ?? 2;
}

interface ShimmerRowProps {
  height: string;
}

function ShimmerRow({ height }: ShimmerRowProps): React.JSX.Element {
  return (
    <div
      aria-hidden="true"
      className={`relative overflow-hidden bg-surface-variant rounded-[10px] ${height}`}
    >
      <div className="absolute inset-0 motion-safe:animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </div>
  );
}

interface BlockRowProps {
  score: number;
  filledClass: string;
  label: string;
}

function BlockRow({ score, filledClass, label }: BlockRowProps): React.JSX.Element {
  const filled = filledBlockCount(score);
  const blocks = Array.from({ length: TOTAL_BLOCKS }, (_, i) => i);

  return (
    <div className="flex items-center gap-[6px]">
      <div className="flex gap-[2px]" aria-hidden="true">
        {blocks.map((i) => (
          <div
            key={i}
            className={`w-3 h-4 rounded-[0.0625rem] ${i < filled ? filledClass : 'bg-surface-variant'}`}
          />
        ))}
      </div>
      <span
        className="text-[0.75rem] font-semibold text-primary"
        aria-hidden="true"
      >
        {score.toFixed(0)}
      </span>
      <span className="sr-only">{label}</span>
    </div>
  );
}

interface BarGroupProps {
  config: SignalBarConfig;
  score: number;
}

function BarGroup({ config, score }: BarGroupProps): React.JSX.Element {
  const ariaLabel = `${config.label}: ${score.toFixed(0)} out of 10`;

  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-col gap-[6px]">
      <div className="flex items-center gap-[6px]">
        <span aria-hidden="true" className={`text-[0.75rem] ${config.glyphClass}`}>
          {config.glyph}
        </span>
        <span className="text-[0.75rem] text-on-surface">
          {config.label}
        </span>
      </div>
      <BlockRow
        score={score}
        filledClass={config.fillClass}
        label={ariaLabel}
      />
    </div>
  );
}

interface IntensityBarsProps {
  signals: Layer1Signals;
  loading?: boolean;
}

export default function IntensityBars({ signals, loading = false }: IntensityBarsProps): React.JSX.Element {
  const scores = [
    signals.languageIntensity,
    headlineDriftScore(signals),
    attributionScore(signals),
  ];

  return (
    <div
      role="region"
      aria-label="Bias intensity signals"
      className="bg-surface rounded-[10px] shadow-ambient p-4"
    >
      {loading ? (
        <div className="flex flex-col gap-[14px]">
          <ShimmerRow height="h-[36px]" />
          <ShimmerRow height="h-[36px]" />
          <ShimmerRow height="h-[36px]" />
        </div>
      ) : (
        <div className="flex flex-col gap-[14px]">
          {SIGNAL_BARS.map((config, i) => (
            <BarGroup
              key={config.label}
              config={config}
              score={scores[i]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
