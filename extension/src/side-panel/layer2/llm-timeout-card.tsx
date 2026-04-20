import React from 'react';
import ErrorStateCard from '../error-state-card';

interface LLMTimeoutCardProps {
  onRetry: () => void;
}

export default function LLMTimeoutCard({ onRetry }: LLMTimeoutCardProps): React.JSX.Element {
  return (
    <ErrorStateCard
      accentColor="tertiary"
      glyph="⚠"
      glyphColorClass="text-tertiary"
      title="Analysis is taking too long"
      body="The request to Claude timed out. This is usually a temporary network issue. Your API key is fine."
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
