import React, { useRef, useEffect } from 'react';
import type { RubricSpan } from '../../shared/types';
import EvidenceItem from './evidence-item';

interface EvidenceRowProps {
  item: RubricSpan;
  isActive: boolean;
  isPulsing: boolean;
  isTooltipOpen: boolean;
  onTooltipToggle: (id: string | null) => void;
  onSyncClick: (spanId: string) => void;
}

/**
 * SD-024: Wraps EvidenceItem with bidirectional sync state.
 *
 * Adds `is-active` and `is-pulsing` CSS classes, handles sync click
 * (sends evidence_click to SW), and scrolls itself into view when
 * activated or pulsed by a page-side event.
 */
export default function EvidenceRow({
  item,
  isActive,
  isPulsing,
  isTooltipOpen,
  onTooltipToggle,
  onSyncClick,
}: EvidenceRowProps): React.JSX.Element {
  const rowRef = useRef<HTMLDivElement>(null);

  // Scroll into view when this row becomes active or starts pulsing.
  // Guard with typeof check — jsdom does not implement scrollIntoView.
  useEffect(() => {
    if ((isActive || isPulsing) && rowRef.current) {
      if (typeof rowRef.current.scrollIntoView === 'function') {
        rowRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [isActive, isPulsing]);

  const syncClassNames = [
    isActive ? 'is-active' : '',
    isPulsing ? 'is-pulsing' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={rowRef}
      data-highlight-id={item.id}
      tabIndex={0}
      role="button"
      aria-pressed={isActive}
      className={syncClassNames || undefined}
      onClick={() => onSyncClick(item.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSyncClick(item.id);
        }
      }}
    >
      <EvidenceItem
        item={item}
        isTooltipOpen={isTooltipOpen}
        onTooltipToggle={onTooltipToggle}
      />
    </div>
  );
}
