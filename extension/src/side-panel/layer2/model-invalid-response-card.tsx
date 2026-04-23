import React, { useState, useEffect } from 'react';
import ErrorStateCard from '../error-state-card';
import { ACTIVE_PROVIDER_KEY } from '../../shared/storage-keys';

interface ModelInvalidResponseCardProps {
  onRetry: () => void;
}

const PROVIDER_LABEL: Record<string, string> = {
  anthropic: 'Claude',
  openai: 'OpenAI',
  gemini: 'Gemini',
};

export default function ModelInvalidResponseCard({
  onRetry,
}: ModelInvalidResponseCardProps): React.JSX.Element {
  const [providerLabel, setProviderLabel] = useState<string>('the model');

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get([ACTIVE_PROVIDER_KEY], (result) => {
        const id = (result[ACTIVE_PROVIDER_KEY] as string | undefined) ?? 'anthropic';
        setProviderLabel(PROVIDER_LABEL[id] ?? 'the model');
      });
    }
  }, []);

  return (
    <ErrorStateCard
      accentColor="tertiary"
      glyph="⚠"
      glyphColorClass="text-tertiary"
      title="Couldn't parse the analysis"
      body={`${providerLabel} returned a response we couldn't read. This usually clears up on a retry.`}
      cta={{
        label: 'Try again',
        variant: 'secondary',
        onClick: onRetry,
        ariaLabel: 'Try again — retry analysis',
      }}
      role="alert"
      ariaLabel="Model returned an invalid response"
    />
  );
}
