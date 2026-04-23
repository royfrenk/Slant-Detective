import React from 'react';
import ErrorStateCard from './error-state-card';

interface NonEnglishCardProps {
  onRetry: () => void;
}

export default function NonEnglishCard({ onRetry }: NonEnglishCardProps): React.JSX.Element {
  function openHowWeMeasure(e: React.MouseEvent): void {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL('src/pages/how-we-measure.html') }).catch(() => {});
  }

  const body = (
    <>
      This page appears to be in another language — bias analysis requires English text.
      {' '}
      <a
        href={chrome.runtime.getURL('src/pages/how-we-measure.html')}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="How we measure (opens in new tab)"
        className="text-primary-fixed no-underline hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:rounded-sm"
        onClick={openHowWeMeasure}
      >
        How we measure →
      </a>
    </>
  );

  return (
    <ErrorStateCard
      accentColor="outline"
      glyph="⊘"
      glyphColorClass="text-on-surface-variant"
      title="Slant Detective only works in English"
      body={body}
      cta={{
        label: 'Try again',
        variant: 'secondary',
        onClick: onRetry,
        ariaLabel: 'Try again — re-analyze this page',
      }}
      role="alert"
      ariaLabel="Language not supported"
    />
  );
}
