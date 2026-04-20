import React from 'react'

export type FeedbackState = 'idle' | 'success' | 'error' | 'warning'

interface InlineFeedbackProps {
  state: FeedbackState
  errorCode?: number | null
}

interface FeedbackContent {
  icon: string
  iconClass: string
  primaryText: string
  secondaryText: string
  textClass: string
}

const FEEDBACK_MAP: Record<Exclude<FeedbackState, 'idle'>, FeedbackContent> = {
  success: {
    icon: '✓',
    iconClass: 'text-primary-fixed',
    primaryText: 'Key saved. Layer 2 analysis is now active.',
    secondaryText: '',
    textClass: 'text-primary-fixed',
  },
  error: {
    icon: '✕',
    iconClass: 'text-tertiary',
    primaryText: 'Invalid key. Check that you pasted the full sk-ant-... value.',
    secondaryText: 'If your key was recently revoked, generate a new one at console.anthropic.com.',
    textClass: 'text-tertiary',
  },
  warning: {
    icon: '⚠',
    iconClass: 'text-on-tertiary-container',
    primaryText: "Couldn't reach Anthropic to validate — key saved anyway.",
    secondaryText: 'Layer 2 will confirm connectivity when you run your first analysis.',
    textClass: 'text-on-surface-variant',
  },
}

export default function InlineFeedback({ state, errorCode }: InlineFeedbackProps): React.JSX.Element {
  const isVisible = state !== 'idle'
  const baseContent = isVisible ? FEEDBACK_MAP[state] : null
  const content = baseContent !== null && state === 'error' && errorCode != null
    ? {
        ...baseContent,
        primaryText: errorCode === 0
          ? 'Key display is masked — paste your key again to replace it.'
          : `${baseContent.primaryText} (HTTP ${errorCode})`,
      }
    : baseContent

  return (
    <div
      id="api-key-feedback"
      role="status"
      aria-live="polite"
      className={[
        'mt-3 flex items-start gap-2 text-[0.75rem]',
        'transition-all duration-200 ease-out',
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1 pointer-events-none',
      ].join(' ')}
    >
      {content !== null && (
        <>
          <span aria-hidden="true" className={`text-[1rem] leading-none mt-[1px] ${content.iconClass}`}>
            {content.icon}
          </span>
          <div className={content.textClass}>
            <p className="m-0">{content.primaryText}</p>
            {content.secondaryText && (
              <p className="m-0 mt-1">{content.secondaryText}</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
