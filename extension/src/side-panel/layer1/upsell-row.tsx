import React from 'react';

export default function UpsellRow(): React.JSX.Element {
  return (
    <div className="bg-surface-variant rounded-[10px] p-4">
      <p className="text-[0.75rem] text-on-surface mb-[10px]">
        Add API key for per-article tilt + evidence reasons
      </p>
      <button
        type="button"
        aria-label="Unlock full analysis — configure your Anthropic API key"
        onClick={() => chrome.runtime.openOptionsPage()}
        className="w-full h-9 rounded-md text-[0.75rem] font-semibold text-on-primary cursor-pointer border-0
          bg-gradient-to-br from-primary to-primary-container hover:brightness-96 active:brightness-92"
      >
        Unlock full analysis →
      </button>
    </div>
  );
}
