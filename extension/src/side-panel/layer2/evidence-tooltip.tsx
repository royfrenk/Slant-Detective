import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import type { RubricSpan } from '../../shared/types';

const NARROW_PANEL_BREAKPOINT = 400;

function openHowWeMeasure(): void {
  chrome.tabs.create({ url: chrome.runtime.getURL('how-we-measure.html') }).catch(() => {});
}

interface EvidenceTooltipProps {
  id: string;
  item: RubricSpan;
  anchorRect: DOMRect | null;
  onDismiss: () => void;
}

export default function EvidenceTooltip({
  id,
  item,
  anchorRect,
  onDismiss,
}: EvidenceTooltipProps): React.JSX.Element | null {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const linkRef = useRef<HTMLSpanElement>(null);
  const isNarrow = window.innerWidth <= NARROW_PANEL_BREAKPOINT;

  // Dismiss on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        onDismiss();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onDismiss]);

  // Dismiss on click outside
  useEffect(() => {
    function handleMouseDown(e: MouseEvent): void {
      if (tooltipRef.current != null && !tooltipRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [onDismiss]);

  // Focus "How we measure" link on mount for keyboard users. preventScroll
  // avoids a re-layout loop when the tooltip is partially off-screen: default
  // focus() triggers scrollIntoView on ancestors, which can move the anchor
  // out from under the cursor and cause flicker.
  useEffect(() => {
    linkRef.current?.focus({ preventScroll: true });
  }, []);

  // Flip the tooltip above the anchor when there is not enough room below.
  // Heuristic height covers the typical 4-line tooltip (phrase + metadata +
  // reason + link). Uses translateY(-100%) so the tooltip's bottom edge sits
  // 4px above the anchor top without needing a post-mount measurement.
  const TOOLTIP_MIN_ROOM_BELOW = 200;
  const flipAbove =
    anchorRect != null &&
    window.innerHeight - anchorRect.bottom < TOOLTIP_MIN_ROOM_BELOW;

  const positionStyle: React.CSSProperties = isNarrow
    ? { position: 'fixed', bottom: 0, left: 0, right: 0, maxWidth: '100%', borderRadius: '10px 10px 0 0' }
    : anchorRect != null
      ? {
          position: 'fixed',
          top: flipAbove ? anchorRect.top - 4 : anchorRect.bottom + 4,
          left: Math.max(8, anchorRect.left),
          maxWidth: '240px',
          transform: flipAbove ? 'translateY(-100%)' : undefined,
        }
      : { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', maxWidth: '240px' };

  const categoryLabel = item.category.replace(/_/g, ' ').toUpperCase();
  const severityLabel = item.severity.toUpperCase();
  const tiltLabel = item.tilt.charAt(0).toUpperCase() + item.tilt.slice(1);

  const tooltip = (
    <div
      ref={tooltipRef}
      id={id}
      role="tooltip"
      className="bg-surface shadow-ambient p-3 z-50 motion-safe:animate-none"
      style={{ ...positionStyle, boxShadow: '0 12px 32px -4px rgba(25, 28, 30, 0.08)', borderRadius: positionStyle.borderRadius ?? '10px' }}
    >
      <div className="flex flex-col gap-[6px]">
        <p className="text-[0.75rem] text-on-surface font-medium leading-[1.4]">
          {item.text}
        </p>
        <p className="text-[0.625rem] text-on-surface-variant">
          <span className="font-semibold">{categoryLabel}</span>
          {' · '}
          <span>{severityLabel}</span>
        </p>
        <p className="text-[0.625rem] text-on-surface-variant">
          Tilt: <span className="font-medium">{tiltLabel}</span>
        </p>
        <p className="text-[0.625rem] text-on-surface-variant leading-[1.5]">
          {item.reason}
        </p>
        <span
          ref={linkRef}
          role="link"
          tabIndex={0}
          aria-label="How we measure — opens in new tab"
          className="text-[0.625rem] text-primary-fixed underline-offset-2 hover:underline cursor-pointer focus:outline-[2px] focus:outline-primary focus:outline-offset-1"
          onClick={openHowWeMeasure}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              openHowWeMeasure();
            }
          }}
        >
          How we measure
        </span>
      </div>
    </div>
  );

  return ReactDOM.createPortal(tooltip, document.body);
}
