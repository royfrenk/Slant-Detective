import React, { useState } from 'react';
import type { RubricCategory, RubricSeverity, RubricSpan } from '../../shared/types';
import EvidenceRow from './evidence-row';
import { useHighlightSync } from '../hooks/use-highlight-sync';

const EVIDENCE_DISPLAY_CAP = 15;

const SEVERITY_ORDER: Record<RubricSeverity, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const CATEGORY_ORDER: Record<RubricCategory, number> = {
  loaded_language: 0,
  framing: 1,
  headline_slant: 2,
  source_mix: 3,
};

function sortEvidence(items: readonly RubricSpan[]): RubricSpan[] {
  return [...items].sort((a, b) => {
    const severityDiff =
      (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3);
    if (severityDiff !== 0) return severityDiff;
    return (CATEGORY_ORDER[a.category] ?? 4) - (CATEGORY_ORDER[b.category] ?? 4);
  });
}

interface EvidenceListProps {
  items: RubricSpan[];
}

export default function EvidenceList({ items }: EvidenceListProps): React.JSX.Element {
  const [activeTooltipId, setActiveTooltipId] = useState<string | null>(null);
  const { activeSpanId, pulsingSpanId, onEvidenceClick } = useHighlightSync();

  const sorted = sortEvidence(items);
  const capped = sorted.slice(0, EVIDENCE_DISPLAY_CAP);
  const overflowCount = Math.max(0, sorted.length - EVIDENCE_DISPLAY_CAP);

  return (
    <div
      role="region"
      aria-label="Bias evidence"
      className="bg-surface rounded-[10px] shadow-ambient p-4"
    >
      <span className="text-[0.625rem] font-bold text-on-surface-variant uppercase tracking-[0.1em] block mb-2">
        EVIDENCE
      </span>

      {capped.length === 0 ? (
        <p className="text-[0.75rem] text-on-surface-variant italic">
          No specific evidence flagged.
        </p>
      ) : (
        <div role="list" className="flex flex-col gap-2 overflow-y-auto">
          {capped.map((item) => (
            <EvidenceRow
              key={item.id}
              item={item}
              isActive={activeSpanId === item.id}
              isPulsing={pulsingSpanId === item.id}
              isTooltipOpen={activeTooltipId === item.id}
              onTooltipToggle={setActiveTooltipId}
              onSyncClick={onEvidenceClick}
            />
          ))}
        </div>
      )}

      {overflowCount > 0 && (
        <p
          className="text-[0.625rem] text-on-surface-variant mt-1"
          aria-live="off"
        >
          + {overflowCount} more
        </p>
      )}
    </div>
  );
}
