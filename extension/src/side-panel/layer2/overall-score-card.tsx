import React from 'react';
import type { RubricDirection } from '../../shared/types';
import DirectionChip from './direction-chip';

function formatScore(score: number): string {
  const rounded = Math.round(score * 10) / 10;
  return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1);
}

interface OverallScoreCardProps {
  score: number;
  direction: RubricDirection;
  confidence: number;
}

export default function OverallScoreCard({
  score,
  direction,
  confidence,
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
          className="text-[0.75rem] text-on-surface-variant"
          aria-label={`Confidence: ${confidencePct} percent`}
        >
          {confidencePct}% confident
        </span>
      </div>
    </div>
  );
}
