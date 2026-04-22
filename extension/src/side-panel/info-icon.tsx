import React from 'react';

interface InfoIconProps {
  dimensionKey: string;
  ariaLabel: string;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onFocus: () => void;
  onBlur: () => void;
  tooltipVisible: boolean;
}

export default function InfoIcon({
  dimensionKey,
  ariaLabel,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  tooltipVisible,
}: InfoIconProps): React.JSX.Element {
  const tooltipId = `sd-info-tooltip-${dimensionKey}`;

  return (
    <span
      role="img"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-describedby={tooltipVisible ? tooltipId : undefined}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      style={{ cursor: 'default', display: 'inline-flex', alignItems: 'center' }}
      className={[
        'inline-flex items-center justify-center w-[14px] h-[14px] flex-shrink-0',
        'transition-colors duration-[120ms] ease-out',
        'rounded-full',
        'focus:outline focus:outline-[2px] focus:outline-primary focus:outline-offset-[2px]',
        tooltipVisible
          ? 'text-[#191c1e]'
          : 'text-[#45474c] hover:text-[#191c1e]',
      ].join(' ')}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle cx="7" cy="7" r="6.25" stroke="currentColor" strokeWidth="1.5" />
        <line x1="7" y1="6" x2="7" y2="10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="7" cy="3.75" r="0.875" fill="currentColor" />
      </svg>
    </span>
  );
}
