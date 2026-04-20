import React, { useRef, useCallback } from 'react';
import type { RubricCategory, RubricSeverity, RubricSpan } from '../../shared/types';
import EvidenceTooltip from './evidence-tooltip';

interface CategoryConfig {
  readonly glyph: string;
  readonly accentClass: string;
  readonly glyphClass: string;
  readonly labelClass: string;
  readonly label: string;
}

const CATEGORY_CONFIG: Record<RubricCategory, CategoryConfig> = {
  loaded_language: {
    glyph: '⚠',
    accentClass: 'border-dim-word-choice',
    glyphClass: 'text-dim-word-choice',
    labelClass: 'text-dim-word-choice',
    label: 'LOADED LANGUAGE',
  },
  framing: {
    glyph: '◈',
    accentClass: 'border-dim-framing',
    glyphClass: 'text-dim-framing',
    labelClass: 'text-dim-framing',
    label: 'FRAMING',
  },
  headline_slant: {
    glyph: '✎',
    accentClass: 'border-primary-fixed',
    glyphClass: 'text-primary-fixed',
    labelClass: 'text-primary-fixed',
    label: 'HEADLINE SLANT',
  },
  source_mix: {
    glyph: '"',
    accentClass: 'border-slate-chip',
    glyphClass: 'text-slate-chip',
    labelClass: 'text-slate-chip',
    label: 'SOURCE MIX',
  },
};

interface SeverityBadgeStyle {
  readonly bg: string;
  readonly text: string;
  readonly label: string;
}

const SEVERITY_STYLES: Record<RubricSeverity, SeverityBadgeStyle> = {
  high: { bg: '#fee2e2', text: '#991b1b', label: 'HIGH' },
  medium: { bg: '#fef9c3', text: '#854d0e', label: 'MED' },
  low: { bg: '#f0fdf4', text: '#166534', label: 'LOW' },
};

const HOVER_DELAY_MS = 200;
const HIDE_GRACE_MS = 150;

interface EvidenceItemProps {
  item: RubricSpan;
  isTooltipOpen: boolean;
  onTooltipToggle: (id: string | null) => void;
}

export default function EvidenceItem({
  item,
  isTooltipOpen,
  onTooltipToggle,
}: EvidenceItemProps): React.JSX.Element {
  const catConfig = CATEGORY_CONFIG[item.category] ?? CATEGORY_CONFIG.loaded_language;
  const sevStyle = SEVERITY_STYLES[item.severity] ?? SEVERITY_STYLES.low;
  const containerRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipId = `tooltip-${item.id}`;

  const handleToggle = useCallback(() => {
    onTooltipToggle(isTooltipOpen ? null : item.id);
  }, [item.id, isTooltipOpen, onTooltipToggle]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleToggle();
      }
    },
    [handleToggle],
  );

  const cancelHideTimer = useCallback(() => {
    if (hideTimerRef.current != null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    cancelHideTimer();
    hideTimerRef.current = setTimeout(() => {
      onTooltipToggle(null);
      hideTimerRef.current = null;
    }, HIDE_GRACE_MS);
  }, [cancelHideTimer, onTooltipToggle]);

  const handleMouseEnter = useCallback(() => {
    cancelHideTimer();
    hoverTimerRef.current = setTimeout(() => {
      if (!isTooltipOpen) {
        onTooltipToggle(item.id);
      }
    }, HOVER_DELAY_MS);
  }, [item.id, isTooltipOpen, onTooltipToggle, cancelHideTimer]);

  // Grace-period close lets the cursor cross the gap between the card and the
  // portal-rendered tooltip without losing the tooltip. If the cursor lands on
  // the tooltip before HIDE_GRACE_MS, the tooltip cancels the hide timer.
  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current != null) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    if (isTooltipOpen) {
      scheduleHide();
    }
  }, [isTooltipOpen, scheduleHide]);

  const getAnchorRect = (): DOMRect | null => {
    return containerRef.current?.getBoundingClientRect() ?? null;
  };

  const snippet = item.text.length > 120 ? item.text.slice(0, 120) + '…' : item.text;
  const ariaLabel = `${catConfig.label}, ${sevStyle.label}: ${item.text}`;

  return (
    <div
      id={item.id}
      role="listitem"
      aria-label={ariaLabel}
      aria-describedby={isTooltipOpen ? tooltipId : undefined}
    >
      <div
        ref={containerRef}
        tabIndex={0}
        className={`bg-surface-variant rounded-[6px] py-[10px] px-3 flex flex-col gap-1 border-l-4 ${catConfig.accentClass} cursor-pointer focus:outline-[2px] focus:outline-primary focus:outline-offset-2`}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        title={item.text}
      >
        <div className="flex items-center gap-[6px]">
          <span aria-hidden="true" className={`text-[0.75rem] ${catConfig.glyphClass}`}>
            {catConfig.glyph}
          </span>
          <span className={`text-[0.625rem] font-semibold uppercase tracking-[0.06em] ${catConfig.labelClass}`}>
            {catConfig.label}
          </span>
          <span
            className="rounded-full py-[3px] px-[6px] text-[0.5625rem] font-semibold uppercase"
            style={{ backgroundColor: sevStyle.bg, color: sevStyle.text }}
          >
            {sevStyle.label}
          </span>
        </div>
        <p
          className="text-[0.75rem] text-on-surface overflow-hidden"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {snippet}
        </p>
      </div>
      {isTooltipOpen && (
        <EvidenceTooltip
          id={tooltipId}
          item={item}
          anchorRect={getAnchorRect()}
          onDismiss={() => onTooltipToggle(null)}
          onMouseEnter={cancelHideTimer}
          onMouseLeave={scheduleHide}
        />
      )}
    </div>
  );
}
