import React from 'react';
import ErrorStateCard from '../error-state-card';

interface TooShortCardProps {
  wordCount: number;
}

export default function TooShortCard({ wordCount }: TooShortCardProps): React.JSX.Element {
  return (
    <ErrorStateCard
      accentColor="outline"
      glyph="✎"
      glyphColorClass="text-on-surface-variant"
      title="Article too short to analyze"
      body={`Bias signals need at least 400 words to be reliable. This article has approximately ${wordCount} words.`}
      role="region"
      ariaLabel="Article too short"
      ariaLive="polite"
    />
  );
}
