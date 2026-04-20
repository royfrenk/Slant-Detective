import React from 'react';
import ErrorStateCard from '../error-state-card';

interface TooShortCardL2Props {
  wordCount: number;
}

export default function TooShortCardL2({ wordCount }: TooShortCardL2Props): React.JSX.Element {
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
