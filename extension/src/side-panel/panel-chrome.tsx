import React from "react";

export default function PanelChrome(): React.JSX.Element {
  return (
    <header className="bg-background shadow-chrome flex-shrink-0 pt-4 pr-4 pb-3 pl-4">
      <span
        className="font-bold text-primary text-xs tracking-wordmark"
        aria-label="Slant Detective"
      >
        SLANT DETECTIVE
      </span>
    </header>
  );
}
