import React, { useState, useEffect } from 'react';
import { PROVIDERS_KEY, ACTIVE_PROVIDER_KEY } from '../../shared/storage-keys';

interface ShimmerBlockProps {
  height: string;
}

function ShimmerBlock({ height }: ShimmerBlockProps): React.JSX.Element {
  return (
    <div
      aria-hidden="true"
      className={`relative overflow-hidden bg-surface-variant rounded-[10px] w-full ${height}`}
    >
      <div className="absolute inset-0 motion-safe:animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </div>
  );
}

const PROGRESS_DELAY_MS = 1000;

// Display name for the loader — "Anthropic → Claude" because users know the model brand,
// not the company; "OpenAI" and "Gemini" use their own brand names.
const PROVIDER_LOADER_LABEL: Record<string, string> = {
  anthropic: 'Claude',
  openai: 'OpenAI',
  gemini: 'Gemini',
};

export default function Layer2SkeletonView(): React.JSX.Element {
  const [showProgress, setShowProgress] = useState(false);
  const [providerLabel, setProviderLabel] = useState<string>('Claude');

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowProgress(true);
    }, PROGRESS_DELAY_MS);

    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get([PROVIDERS_KEY, ACTIVE_PROVIDER_KEY], (result) => {
        const id = (result[ACTIVE_PROVIDER_KEY] as string | undefined) ?? 'anthropic';
        const label = PROVIDER_LOADER_LABEL[id] ?? 'Claude';
        setProviderLabel(label);
      });
    }

    return () => {
      clearTimeout(timer);
    };
  }, []);

  const loaderText = `Analyzing with ${providerLabel}…`;

  return (
    <div
      role="status"
      aria-label="Analyzing article with full rubric…"
      aria-busy="true"
      data-testid="layer2-skeleton"
      className="flex flex-col gap-2"
    >
      {/* Source strip placeholder */}
      <ShimmerBlock height="h-[48px]" />
      {/* Overall score card placeholder */}
      <ShimmerBlock height="h-[96px]" />
      {/* Dimension breakdown placeholder */}
      <ShimmerBlock height="h-[128px]" />
      {/* Evidence item placeholders */}
      <ShimmerBlock height="h-[52px]" />
      <ShimmerBlock height="h-[52px]" />
      <ShimmerBlock height="h-[52px]" />
      {showProgress && (
        <p className="text-[0.875rem] font-medium text-on-surface-variant text-center mt-3">
          {loaderText}
        </p>
      )}
    </div>
  );
}
