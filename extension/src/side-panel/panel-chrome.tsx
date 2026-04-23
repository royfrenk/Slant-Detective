import React from "react";

interface PanelChromeProps {
  onReload?: () => void;
}

// Circular-arrow reload glyph. 14×14 matches the visual weight of the small
// wordmark alongside it — the button is deliberately low-emphasis.
function ReloadIcon(): React.JSX.Element {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M11.5 3.5A5 5 0 1 0 12 8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M11.7 1.8v2.1h-2.1"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export default function PanelChrome({ onReload }: PanelChromeProps): React.JSX.Element {
  return (
    <header className="bg-background shadow-chrome flex-shrink-0 pt-4 pr-4 pb-3 pl-4 flex items-center justify-between">
      <span
        className="font-bold text-primary text-xs tracking-wordmark"
        aria-label="Slant Detective"
      >
        SLANT DETECTIVE
      </span>
      {onReload != null && (
        <button
          type="button"
          onClick={onReload}
          aria-label="Reload analysis"
          title="Reload analysis"
          className="bg-transparent border-0 p-1 rounded cursor-pointer text-on-surface-variant hover:text-primary focus:outline focus:outline-2 focus:outline-primary focus:outline-offset-1 transition-colors"
        >
          <ReloadIcon />
        </button>
      )}
    </header>
  );
}
