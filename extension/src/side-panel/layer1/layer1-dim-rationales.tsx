import React, { useState } from 'react';
import type { Layer1Signals } from '../../shared/types';
import ChevronToggle from '../layer2/chevron-toggle';
import RationalePanel from '../layer2/rationale-panel';
import { getLayer1DimRationales } from '../layer2/layer1-rationale';

type DimKey = 'word_choice' | 'framing' | 'headline_slant' | 'source_mix';

interface DimRationaleRowConfig {
  readonly key: DimKey;
  readonly label: string;
  readonly glyph: string;
  readonly glyphClass: string;
}

const DIM_ROWS: readonly DimRationaleRowConfig[] = [
  { key: 'word_choice',    label: 'Word choice',    glyph: '⚠', glyphClass: 'text-dim-word-choice' },
  { key: 'framing',        label: 'Framing',        glyph: '◈', glyphClass: 'text-dim-framing' },
  { key: 'headline_slant', label: 'Headline slant', glyph: '✎', glyphClass: 'text-primary-fixed' },
  { key: 'source_mix',     label: 'Source mix',     glyph: '"', glyphClass: 'text-slate-chip' },
];

interface DimRationaleRowProps {
  config: DimRationaleRowConfig;
  rationale: string;
}

function DimRationaleRow({ config, rationale }: DimRationaleRowProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const rationaleId = `layer1-dim-rationale-${config.key}`;
  const chevronAriaLabel = isOpen
    ? `Hide signal rationale for ${config.label}`
    : `Show signal rationale for ${config.label}`;

  function handleToggle(): void {
    setIsOpen((prev) => !prev);
  }

  return (
    <div className="flex flex-col gap-[4px]">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={handleToggle}
      >
        <div className="flex items-center gap-[6px]">
          <span aria-hidden="true" className={`text-[0.75rem] ${config.glyphClass}`}>
            {config.glyph}
          </span>
          <span className="text-[0.75rem] text-on-surface">
            {config.label}
          </span>
        </div>
        <ChevronToggle
          isOpen={isOpen}
          onToggle={handleToggle}
          ariaControls={rationaleId}
          ariaLabel={chevronAriaLabel}
        />
      </div>
      <RationalePanel
        text={rationale}
        id={rationaleId}
        animated={true}
        isOpen={isOpen}
        marginTop="mt-1"
      />
    </div>
  );
}

interface Layer1DimRationalesProps {
  signals: Layer1Signals;
}

/**
 * Lists signal-derived rationale for all 4 rubric dimensions on the Layer 1 surface.
 * Each row has a chevron that expands to show the rationale string.
 *
 * SD-040
 */
export default function Layer1DimRationales({ signals }: Layer1DimRationalesProps): React.JSX.Element {
  const rationales = getLayer1DimRationales(signals);

  return (
    <div
      role="region"
      aria-label="Dimension signal rationale"
      className="bg-surface rounded-[10px] shadow-ambient p-4"
    >
      <span className="text-[0.625rem] font-bold text-on-surface-variant uppercase tracking-[0.1em] block mb-2">
        DIMENSION SIGNALS
      </span>
      <div className="flex flex-col gap-3">
        {DIM_ROWS.map((config) => (
          <DimRationaleRow
            key={config.key}
            config={config}
            rationale={rationales[config.key]}
          />
        ))}
      </div>
    </div>
  );
}
