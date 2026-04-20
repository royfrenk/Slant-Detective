import React from 'react';
import ErrorStateCard from './error-state-card';

interface ExtractionFailedCardProps {
  onRetry: () => void;
}

export default function ExtractionFailedCard({ onRetry }: ExtractionFailedCardProps): React.JSX.Element {
  return (
    <ErrorStateCard
      accentColor="tertiary"
      glyph="⚠"
      glyphColorClass="text-tertiary"
      title="Couldn't read this page"
      body="This page may not be a standard article, or its layout isn't supported yet. Try reloading, or check that the page has finished loading."
      cta={{
        label: 'Try again',
        variant: 'secondary',
        onClick: onRetry,
        ariaLabel: 'Try again — re-analyze this page',
      }}
      role="alert"
      ariaLabel="Content extraction failed"
    />
  );
}
