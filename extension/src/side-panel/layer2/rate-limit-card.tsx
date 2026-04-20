import React from 'react';
import ErrorStateCard from '../error-state-card';

interface RateLimitCardProps {
  onRetry: () => void;
}

function openAnthropicConsole(): void {
  // Non-critical: if the tab can't open (permissions revoked), silently degrade — link is advisory.
  chrome.tabs.create({ url: 'https://console.anthropic.com' }).catch(() => {});
}

const rateLimitBody = (
  <>
    {"Anthropic's API has rate-limited this key for now. Wait a minute, then try again. If this keeps happening, check your usage limits in the "}
    <span
      role="link"
      tabIndex={0}
      aria-label="Anthropic Console — opens in new tab"
      className="text-primary-fixed underline-offset-2 hover:underline cursor-pointer"
      onClick={openAnthropicConsole}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          openAnthropicConsole();
        }
      }}
    >
      Anthropic Console
    </span>
    {'.'}
  </>
);

export default function RateLimitCard({ onRetry }: RateLimitCardProps): React.JSX.Element {
  return (
    <ErrorStateCard
      accentColor="tertiary"
      glyph="⚠"
      glyphColorClass="text-tertiary"
      title="Too many requests right now"
      body={rateLimitBody}
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
