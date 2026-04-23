import React, { useState, useEffect } from 'react';
import ErrorStateCard from '../error-state-card';
import { ACTIVE_PROVIDER_KEY } from '../../shared/storage-keys';

interface LLMTimeoutCardProps {
  onRetry: () => void;
}

const PROVIDER_LABEL: Record<string, string> = {
  anthropic: 'Claude',
  openai: 'OpenAI',
  gemini: 'Gemini',
};

export default function LLMTimeoutCard({ onRetry }: LLMTimeoutCardProps): React.JSX.Element {
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
      title="Analysis is taking too long"
      body={`The request to ${providerLabel} timed out. This is usually a temporary network issue. Your API key is fine.`}
      cta={{
        label: 'Try again',
        variant: 'secondary',
        onClick: onRetry,
        ariaLabel: 'Try again — retry analysis',
      }}
      role="alert"
      ariaLabel="Analysis timed out"
    />
  );
}
