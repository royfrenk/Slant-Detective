import React from 'react';
import ErrorStateCard from './error-state-card';

interface NotANewsPageCardProps {
  onRetry: () => void;
}

export default function NotANewsPageCard({ onRetry }: NotANewsPageCardProps): React.JSX.Element {
  return (
    <ErrorStateCard
      accentColor="outline"
      glyph="⊘"
      glyphColorClass="text-on-surface-variant"
      title="No News Detected"
      body="This page doesn't look like a news article — try opening a specific article and re-opening the panel."
      cta={{
        label: 'Try again',
        variant: 'secondary',
        onClick: onRetry,
        ariaLabel: 'Try again — re-analyze this page',
      }}
      role="alert"
      ariaLabel="No news article detected"
    />
  );
}
