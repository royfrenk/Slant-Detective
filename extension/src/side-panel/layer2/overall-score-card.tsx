import React from 'react';
import type { RubricDirection } from '../../shared/types';
import DirectionChip from './direction-chip';
import RationalePanel from './rationale-panel';

function formatScore(score: number): string {
  const rounded = Math.round(score * 10) / 10;
  return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1);
}

interface OverallScoreCardProps {
  score: number;
  direction: RubricDirection;
  confidence: number;
  /** SD-040: percentile label text, e.g. "more tilted than most". Omitted when undefined. */
  percentileLabel?: string;
  /** SD-040: rationale text. Always visible inline (no chevron). Omitted when undefined. */
  rationale?: string;
}

export default function OverallScoreCard({
  score,
  direction,
  confidence,
  percentileLabel,
  rationale,
}: OverallScoreCardProps): React.JSX.Element {
  const scoreLabel = formatScore(score);
  const confidencePct = Math.round(confidence * 100);

  return (
    <div
      role="region"
      aria-label="Overall bias score"
      className="bg-surface rounded-[10px] shadow-ambient p-4 flex flex-col gap-2"
    >
      <span className="text-[0.625rem] font-bold text-on-surface-variant uppercase tracking-[0.1em]">
        BIAS SCORE
      </span>
      <span
        className="text-[2.25rem] font-black text-primary leading-none"
        aria-label={`Bias score: ${scoreLabel} out of 10`}
      >
        {scoreLabel}
      </span>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <DirectionChip direction={direction} />
        <span
          className="text-[0.625rem] text-on-surface-variant"
          aria-label={`Confidence: ${confidencePct} percent`}
        >
          {confidencePct}% confident
        </span>
      </div>
      {percentileLabel != null && (
        <p className="text-[0.75rem] font-normal text-on-surface-variant leading-tight m-0">
          {percentileLabel}
        </p>
      )}
      <RationalePanel
        text={rationale}
        id="overall-rationale-panel"
        animated={false}
        marginTop="mt-2"
      />
    </div>
  );
}
