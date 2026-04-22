import React from 'react';

interface RationalePanelProps {
  text: string | undefined;
  id: string;
  /**
   * When true, the panel renders with a CSS grid-rows animation (expand/collapse).
   * When false (default), the panel renders inline without animation — used for
   * the overall card where rationale is always visible.
   */
  animated?: boolean;
  isOpen?: boolean;
  marginTop?: 'mt-1' | 'mt-2';
}

/**
 * Rationale panel sub-component.
 *
 * Reused by overall-score-card (always visible, no animation) and
 * dimension-breakdown (animated expand/collapse behind chevron).
 *
 * Renders null when text is undefined/empty — callers should hide the
 * chevron affordance when this would render null.
 *
 * Animation technique: CSS grid-template-rows 0fr -> 1fr (avoids JS height
 * measurement). Inner div has overflow:hidden.
 *
 * SD-040
 */
export default function RationalePanel({
  text,
  id,
  animated = false,
  isOpen = true,
  marginTop = 'mt-2',
}: RationalePanelProps): React.JSX.Element | null {
  if (text == null || text.trim() === '') return null;

  if (!animated) {
    return (
      <div
        id={id}
        role="region"
        aria-label="Score rationale"
        className={`bg-surface-variant rounded-[6px] p-3 ${marginTop}`}
      >
        <p className="text-[0.75rem] font-normal text-on-surface leading-[1.5] m-0">
          {text}
        </p>
      </div>
    );
  }

  return (
    <div
      id={id}
      role="region"
      aria-live="polite"
      className={`grid transition-[grid-template-rows] duration-[160ms] ease-out ${marginTop} ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
    >
      <div className="overflow-hidden">
        <div className="bg-surface-variant rounded-[6px] p-3">
          <p className="text-[0.75rem] font-normal text-on-surface leading-[1.5] m-0">
            {text}
          </p>
        </div>
      </div>
    </div>
  );
}
