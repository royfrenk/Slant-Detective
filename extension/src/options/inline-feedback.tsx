import React from 'react'
import type { ProviderId } from '../service-worker/providers/types'

export type FeedbackState = 'idle' | 'success' | 'error' | 'warning' | 'rate-limit'

interface InlineFeedbackProps {
  state: FeedbackState
  errorCode?: number | null
  provider?: ProviderId
}

interface FeedbackContent {
  icon: string
  iconClass: string
  primaryText: string
  secondaryText: string
  textClass: string
}

const PROVIDER_ERROR_PREFIX: Record<ProviderId, string> = {
  anthropic: 'sk-ant-...',
  openai: 'sk-...',
  gemini: 'AIza...',
}

const PROVIDER_CONSOLE_URL: Record<ProviderId, string> = {
  anthropic: 'console.anthropic.com',
  openai: 'platform.openai.com',
  gemini: 'aistudio.google.com',
}

const PROVIDER_DISPLAY_NAME: Record<ProviderId, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  gemini: 'Gemini',
}

function buildFeedbackMap(provider: ProviderId): Record<Exclude<FeedbackState, 'idle'>, FeedbackContent> {
  const prefix = PROVIDER_ERROR_PREFIX[provider]
  const consoleUrl = PROVIDER_CONSOLE_URL[provider]
  const displayName = PROVIDER_DISPLAY_NAME[provider]

  return {
    success: {
      icon: '✓',
      iconClass: 'text-primary-fixed',
      primaryText: 'Key saved. In-depth analysis is now active.',
      secondaryText: '',
      textClass: 'text-primary-fixed',
    },
    error: {
      icon: '✕',
      iconClass: 'text-tertiary',
      primaryText: `Invalid key. Check that you pasted the full ${prefix} value.`,
      secondaryText: `If your key was recently revoked, generate a new one at ${consoleUrl}.`,
      textClass: 'text-tertiary',
    },
    warning: {
      icon: '⚠',
      iconClass: 'text-on-tertiary-container',
      primaryText: `Couldn't reach ${displayName} to validate — key saved anyway.`,
      secondaryText: 'The in-depth analysis will confirm connectivity when you run your first analysis.',
      textClass: 'text-on-surface-variant',
    },
    // 429 rate-limit: key NOT saved, softer tone than error
    'rate-limit': {
      icon: '⚠',
      iconClass: 'text-on-tertiary-container',
      primaryText: 'Rate limited. Your key is probably valid — try again in a moment.',
      secondaryText: '',
      textClass: 'text-on-surface-variant',
    },
  }
}

export default function InlineFeedback({ state, errorCode, provider = 'anthropic' }: InlineFeedbackProps): React.JSX.Element {
  const isVisible = state !== 'idle'
  const feedbackMap = buildFeedbackMap(provider)
  const baseContent = isVisible ? feedbackMap[state] : null
  const content = baseContent !== null && state === 'error' && errorCode != null
    ? {
        ...baseContent,
        primaryText: errorCode === 0
          ? 'Key display is masked — paste your key again to replace it.'
          : baseContent.primaryText,
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
