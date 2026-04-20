import React from 'react';
import ErrorStateCard from '../error-state-card';

export default function ContentFilteredCard(): React.JSX.Element {
  return (
    <ErrorStateCard
      accentColor="outline"
      glyph="⊘"
      glyphColorClass="text-on-surface-variant"
      title="Article filtered by provider"
      body="The AI provider blocked this article's content for safety reasons. Try switching to a different model or provider in Settings."
      cta={{
        label: 'Open Settings',
        variant: 'secondary',
        onClick: () => { chrome.runtime.openOptionsPage(); },
        ariaLabel: 'Open Settings to change model or provider',
      }}
      role="alert"
      ariaLabel="Content filtered by provider"
    />
  );
}
