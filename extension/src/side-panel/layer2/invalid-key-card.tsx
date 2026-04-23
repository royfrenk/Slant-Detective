import React, { useState, useEffect } from 'react';
import ErrorStateCard from '../error-state-card';
import { ACTIVE_PROVIDER_KEY } from '../../shared/storage-keys';

const PROVIDER_LABEL: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  gemini: 'Gemini',
};

export default function InvalidKeyCard(): React.JSX.Element {
  const [providerLabel, setProviderLabel] = useState<string>('provider');

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get([ACTIVE_PROVIDER_KEY], (result) => {
        const id = (result[ACTIVE_PROVIDER_KEY] as string | undefined) ?? 'anthropic';
        setProviderLabel(PROVIDER_LABEL[id] ?? 'provider');
      });
    }
  }, []);

  return (
    <ErrorStateCard
      accentColor="tertiary"
      glyph="⚠"
      glyphColorClass="text-tertiary"
      title="API key not recognized"
      body={`Your ${providerLabel} API key wasn't accepted. It may have been revoked or entered incorrectly. Open Settings to update it.`}
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
