import React, { useRef } from 'react';
import type { RubricDimensions, RubricDirection } from '../../shared/types';
import { DIMENSIONS } from '../../shared/dimension-copy';
import DirectionChip from './direction-chip';
import InfoIcon from '../info-icon';
import InfoTooltip, { useInfoTooltip } from '../info-tooltip';

const TOTAL_BLOCKS = 10;

interface DimensionConfig {
  readonly key: keyof RubricDimensions;
  readonly label: string;
  readonly glyph: string;
  readonly fillClass: string;
  readonly glyphClass: string;
}

const DIMENSION_CONFIG: readonly DimensionConfig[] = [
  {
    key: 'word_choice',
    label: 'WORD CHOICE',
    glyph: '⚠',
    fillClass: 'bg-dim-word-choice',
    glyphClass: 'text-dim-word-choice',
  },
  {
    key: 'framing',
    label: 'FRAMING',
    glyph: '◈',
    fillClass: 'bg-dim-framing',
    glyphClass: 'text-dim-framing',
  },
  {
    key: 'headline_slant',
    label: 'HEADLINE SLANT',
    glyph: '✎',
    fillClass: 'bg-primary-fixed',
    glyphClass: 'text-primary-fixed',
  },
  {
    key: 'source_mix',
    label: 'SOURCE MIX',
    glyph: '"',
    fillClass: 'bg-slate-chip',
    glyphClass: 'text-slate-chip',
  },
];

function filledBlockCount(score: number): number {
  return Math.round(Math.max(0, Math.min(TOTAL_BLOCKS, score)));
}

interface BlockMeterProps {
  score: number;
  fillClass: string;
}

function BlockMeter({ score, fillClass }: BlockMeterProps): React.JSX.Element {
  const filled = filledBlockCount(score);
  const blocks = Array.from({ length: TOTAL_BLOCKS }, (_, i) => i);

  return (
    <div className="flex gap-[2px]" aria-hidden="true">
      {blocks.map((i) => (
        <div
          key={i}
          className={`w-3 h-4 rounded-[0.0625rem] ${i < filled ? fillClass : 'bg-surface-variant'}`}
        />
      ))}
    </div>
  );
}

interface DimensionRowProps {
  config: DimensionConfig;
  score: number;
  direction?: RubricDirection;
}

function DimensionRow({ config, score, direction }: DimensionRowProps): React.JSX.Element {
  const ariaLabel = direction
    ? `${config.label}: score ${score.toFixed(0)} out of 10, ${direction}`
    : `${config.label}: score ${score.toFixed(0)} out of 10`;

  const iconRef = useRef<HTMLSpanElement>(null);
  const tooltip = useInfoTooltip();
  const tooltipId = `sd-info-tooltip-${config.key}`;

  const dimensionCopy = DIMENSIONS.find((d) => d.key === config.key);

  function getIconRect(): DOMRect | null {
    return iconRef.current?.getBoundingClientRect() ?? null;
  }

  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-col gap-[6px]">
      <div className="flex items-center gap-1">
        <span className="text-[0.75rem] font-semibold text-primary uppercase">
          {config.label}
        </span>
        {dimensionCopy != null && (
          <span ref={iconRef}>
            <InfoIcon
              dimensionKey={config.key}
              ariaLabel={`${config.label} — what this means`}
              onMouseEnter={() => {
                const rect = getIconRect();
                if (rect != null) tooltip.handleIconMouseEnter(rect);
              }}
              onMouseLeave={tooltip.handleIconMouseLeave}
              onFocus={() => {
                const rect = getIconRect();
                if (rect != null) tooltip.handleIconFocus(rect);
              }}
              onBlur={tooltip.handleIconBlur}
              tooltipVisible={tooltip.tooltipVisible}
            />
          </span>
        )}
      </div>
      {tooltip.tooltipVisible && dimensionCopy != null && (
        <InfoTooltip
          id={tooltipId}
          description={dimensionCopy.description}
          example={dimensionCopy.example}
          anchorRect={tooltip.anchorRect}
          visible={tooltip.tooltipVisible}
          onMouseEnter={tooltip.handleTooltipMouseEnter}
          onMouseLeave={tooltip.handleTooltipMouseLeave}
          onDismiss={tooltip.handleDismiss}
        />
      )}
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className={`text-[0.75rem] ${config.glyphClass}`}>
          {config.glyph}
        </span>
        <BlockMeter score={score} fillClass={config.fillClass} />
        <span aria-hidden="true" className="text-[0.75rem] font-semibold text-primary ml-1">
          {score.toFixed(0)}
        </span>
        {direction != null && (
          <DirectionChip direction={direction} />
        )}
      </div>
    </div>
  );
}

interface DimensionBreakdownProps {
  dims: RubricDimensions;
}

export default function DimensionBreakdown({ dims }: DimensionBreakdownProps): React.JSX.Element {
  return (
    <div
      role="region"
      aria-label="Dimension breakdown"
      className="bg-surface rounded-[10px] shadow-ambient p-4"
    >
      <span className="text-[0.625rem] font-bold text-on-surface-variant uppercase tracking-[0.1em] block mb-1">
        DIMENSION BREAKDOWN
      </span>
      <div className="flex flex-col gap-3">
        {DIMENSION_CONFIG.map((config) => {
          const dim = dims[config.key];
          return (
            <DimensionRow
              key={config.key}
              config={config}
              score={dim.score}
              direction={dim.direction}
            />
          );
        })}
      </div>
    </div>
  );
}
