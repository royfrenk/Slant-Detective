import React from 'react';
import ErrorStateCard from '../error-state-card';

export default function InvalidKeyCard(): React.JSX.Element {
  return (
    <ErrorStateCard
      accentColor="tertiary"
      glyph="⚠"
      glyphColorClass="text-tertiary"
      title="API key not recognized"
      body="Your Anthropic API key wasn't accepted. It may have been revoked or entered incorrectly. Open Settings to update it."
      cta={{
        label: 'Open Settings',
        variant: 'primary',
        onClick: () => { chrome.runtime.openOptionsPage(); },
        ariaLabel: 'Open Settings to update your API key',
      }}
      role="alert"
      ariaLabel="API key not recognized"
    />
  );
}
