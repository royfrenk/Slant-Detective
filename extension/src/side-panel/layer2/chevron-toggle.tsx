import React from 'react';

interface ChevronToggleProps {
  isOpen: boolean;
  onToggle: () => void;
  ariaControls: string;
  ariaLabel: string;
}

/**
 * Icon-only chevron button for expand/collapse on dimension rows.
 * Chevron character rotates 90deg when open.
 *
 * Used by DimensionBreakdown dim rows (SD-040).
 * The full dim row is the interactive target in the parent; this button
 * serves as a focused affordance for keyboard/screen-reader users.
 */
export default function ChevronToggle({
  isOpen,
  onToggle,
  ariaControls,
  ariaLabel,
}: ChevronToggleProps): React.JSX.Element {
  // stopPropagation prevents the parent row's onClick from double-toggling state
  // when the user clicks the chevron directly (the row also listens for clicks).
  function handleClick(e: React.MouseEvent<HTMLButtonElement>): void {
    e.stopPropagation();
    onToggle();
  }

  return (
    <button
      type="button"
      aria-expanded={isOpen}
      aria-controls={ariaControls}
      aria-label={ariaLabel}
      onClick={handleClick}
      className={[
        'flex items-center justify-center',
        'w-5 h-5 rounded',
        'text-on-surface-variant text-[0.875rem]',
        'transition-transform duration-[160ms] ease-out',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        isOpen ? 'rotate-90' : 'rotate-0',
      ].join(' ')}
    >
      &#8250;
    </button>
  );
}
