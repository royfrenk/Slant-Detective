import React from 'react';
import ErrorStateCard from './error-state-card';

export default function NotANewsPageCard(): React.JSX.Element {
  return (
    <ErrorStateCard
      accentColor="outline"
      glyph="⊘"
      glyphColorClass="text-on-surface-variant"
      title="No News Detected"
      body="This page doesn't look like a news article — try opening a specific article and re-opening the panel."
      role="alert"
      ariaLabel="No news article detected"
    />
  );
}
