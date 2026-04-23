import React, { useState, useEffect } from 'react';
import ErrorStateCard from '../error-state-card';
import { ACTIVE_PROVIDER_KEY } from '../../shared/storage-keys';

interface RateLimitCardProps {
  onRetry: () => void;
}

const PROVIDER_LABEL: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  gemini: 'Gemini',
};

const PROVIDER_CONSOLE: Record<string, { label: string; url: string }> = {
  anthropic: { label: 'Anthropic Console', url: 'https://console.anthropic.com' },
  openai: { label: 'OpenAI dashboard', url: 'https://platform.openai.com/account/usage' },
  gemini: { label: 'Google AI Studio', url: 'https://aistudio.google.com/app/apikey' },
};

const DEFAULT_CONSOLE = { label: 'your provider dashboard', url: '' };

export default function RateLimitCard({ onRetry }: RateLimitCardProps): React.JSX.Element {
  const [providerLabel, setProviderLabel] = useState<string>('the provider');
  const [consoleInfo, setConsoleInfo] = useState<{ label: string; url: string }>(DEFAULT_CONSOLE);

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get([ACTIVE_PROVIDER_KEY], (result) => {
        const id = (result[ACTIVE_PROVIDER_KEY] as string | undefined) ?? 'anthropic';
        setProviderLabel(PROVIDER_LABEL[id] ?? 'the provider');
        setConsoleInfo(PROVIDER_CONSOLE[id] ?? DEFAULT_CONSOLE);
      });
    }
  }, []);

  function openConsole(): void {
    if (consoleInfo.url === '') return;
    chrome.tabs.create({ url: consoleInfo.url }).catch(() => {});
  }

  const body = (
    <>
      {`${providerLabel}'s API has rate-limited this key for now. Wait a minute, then try again. If this keeps happening, check your usage limits in the `}
      {consoleInfo.url !== '' ? (
        <span
          role="link"
          tabIndex={0}
          aria-label={`${consoleInfo.label} — opens in new tab`}
          className="text-primary-fixed underline-offset-2 hover:underline cursor-pointer"
          onClick={openConsole}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              openConsole();
            }
          }}
        >
          {consoleInfo.label}
        </span>
      ) : (
        <span>{consoleInfo.label}</span>
      )}
      {'.'}
    </>
  );

  return (
    <ErrorStateCard
      accentColor="tertiary"
      glyph="⚠"
      glyphColorClass="text-tertiary"
      title="Too many requests right now"
      body={body}
      cta={{
        label: 'Try again',
        variant: 'secondary',
        onClick: onRetry,
        ariaLabel: 'Try again — retry analysis',
      }}
      role="alert"
      ariaLabel="Rate limit reached"
    />
  );
}
