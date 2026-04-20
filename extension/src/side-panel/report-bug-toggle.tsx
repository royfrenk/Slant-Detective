import React, { useCallback } from 'react';

interface ReportBugToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel: string;
  id?: string;
}

export default function ReportBugToggle({
  checked,
  onChange,
  ariaLabel,
  id,
}: ReportBugToggleProps): React.JSX.Element {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        onChange(!checked);
      }
    },
    [checked, onChange],
  );

  const trackClass = checked
    ? 'w-8 h-4 bg-[#091426] rounded-full relative cursor-pointer transition-colors'
    : 'w-8 h-4 bg-[#8f9097] rounded-full relative cursor-pointer transition-colors';

  const knobClass = checked
    ? 'w-3 h-3 bg-white rounded-full absolute right-[2px] top-[2px] transition-all'
    : 'w-3 h-3 bg-white rounded-full absolute left-[2px] top-[2px] transition-all';

  return (
    // 44x44 minimum touch target wrapper
    <div className="flex items-center justify-center min-w-[44px] min-h-[44px]">
      <div
        id={id}
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        tabIndex={0}
        className={trackClass}
        onClick={() => onChange(!checked)}
        onKeyDown={handleKeyDown}
      >
        <div className={knobClass} />
      </div>
    </div>
  );
}
