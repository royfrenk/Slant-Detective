import React, { useState, useEffect } from 'react'
import { PROVIDERS_KEY, ACTIVE_PROVIDER_KEY } from '../shared/storage-keys'
import { validateApiKey } from './validate-api-key'
import ApiKeyInput, { type InputState } from './api-key-input'
import TestAndSaveButton from './test-and-save-button'
import InlineFeedback, { type FeedbackState } from './inline-feedback'
import { bump } from '../service-worker/telemetry'

interface ProviderConfig {
  key: string
  model: string
}
interface ProvidersConfig {
  anthropic?: ProviderConfig
  openai?: ProviderConfig
  gemini?: ProviderConfig
}

const DEFAULT_ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001'

function maskedKey(key: string): string {
  return `${key.slice(0, 14)}${'•'.repeat(20)}`
}

// macOS "smart dashes" silently replaces -- with — on paste, corrupting API keys.
// Also strip any other non-ASCII printable chars that paste can introduce.
function normalizeKey(raw: string): string {
  return raw
    .replace(/\u2014/g, '--') // em-dash → two hyphens
    .replace(/\u2013/g, '-')  // en-dash → hyphen
    .replace(/[^\x20-\x7E]/g, '') // strip non-printable-ASCII and non-ASCII unicode
    .trim()
}

export default function ApiKeyCard(): React.JSX.Element {
  const [inputValue, setInputValue] = useState('')
  const [hasStoredKey, setHasStoredKey] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [feedbackState, setFeedbackState] = useState<FeedbackState>('idle')
  const [errorCode, setErrorCode] = useState<number | null>(null)

  useEffect(() => {
    chrome.storage.local.get(PROVIDERS_KEY, (result) => {
      const providers = result[PROVIDERS_KEY] as ProvidersConfig | undefined
      const stored = providers?.anthropic?.key
      if (stored) {
        setInputValue(maskedKey(stored))
        setHasStoredKey(true)
      }
    })
  }, [])

  function handleChange(value: string): void {
    setInputValue(value)
    setIsDirty(true)
  }

  async function handleSubmit(): Promise<void> {
    const trimmed = normalizeKey(inputValue)
    if (!trimmed || isButtonDisabled()) return

    setIsLoading(true)
    setFeedbackState('idle')
    setErrorCode(null)

    // Guard: masking bullets indicate the user hasn't replaced the stored key display.
    if (trimmed.includes('•')) {
      setFeedbackState('error')
      setErrorCode(0)
      setIsLoading(false)
      return
    }

    const testResult = await validateApiKey(trimmed)

    if (testResult.status === 'ok') {
      // Read existing providers config to avoid overwriting other providers.
      const existing = await new Promise<Record<string, unknown>>((resolve) => {
        chrome.storage.local.get(PROVIDERS_KEY, resolve)
      })
      const existingProviders = (existing[PROVIDERS_KEY] as ProvidersConfig | undefined) ?? {}
      const updated: ProvidersConfig = {
        ...existingProviders,
        anthropic: { key: trimmed, model: DEFAULT_ANTHROPIC_MODEL },
      }
      chrome.storage.local.set(
        {
          [PROVIDERS_KEY]: updated,
          [ACTIVE_PROVIDER_KEY]: 'anthropic',
        },
        () => {},
      )
      void bump('key_saved')
      setFeedbackState('success')
      setHasStoredKey(true)
      setIsDirty(false)
    } else if (testResult.status === 'invalid') {
      void bump('key_rejected')
      setFeedbackState('error')
      setErrorCode(testResult.code)
    } else if (testResult.status === 'reachable-unverified') {
      // Request reached Anthropic but got an unexpected status (429, 500, etc.).
      // Key format is plausibly correct — save with a warning.
      const existing = await new Promise<Record<string, unknown>>((resolve) => {
        chrome.storage.local.get(PROVIDERS_KEY, resolve)
      })
      const existingProviders = (existing[PROVIDERS_KEY] as ProvidersConfig | undefined) ?? {}
      const updated: ProvidersConfig = {
        ...existingProviders,
        anthropic: { key: trimmed, model: DEFAULT_ANTHROPIC_MODEL },
      }
      chrome.storage.local.set(
        {
          [PROVIDERS_KEY]: updated,
          [ACTIVE_PROVIDER_KEY]: 'anthropic',
        },
        () => {},
      )
      void bump('key_saved')
      setFeedbackState('warning')
      setHasStoredKey(true)
      setIsDirty(false)
    } else {
      // network-error: request never reached Anthropic — do not save
      setFeedbackState('warning')
    }

    setIsLoading(false)
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>): void {
    e.preventDefault()
    const raw = e.clipboardData.getData('text/plain')
    setInputValue(normalizeKey(raw))
    setIsDirty(true)
  }

  function handleRemove(): void {
    const confirmed = window.confirm(
      'Remove your saved API key? The extension will revert to Layer 1 (in-browser) analysis only.',
    )
    if (!confirmed) return

    chrome.storage.local.get(PROVIDERS_KEY, (result) => {
      const providers = (result[PROVIDERS_KEY] as ProvidersConfig | undefined) ?? {}
      // Remove anthropic key from providers object (immutably).
      const { anthropic: _removed, ...rest } = providers
      const hasOtherProvider = Object.keys(rest).length > 0

      if (hasOtherProvider) {
        chrome.storage.local.set({ [PROVIDERS_KEY]: rest }, () => {})
      } else {
        chrome.storage.local.remove([PROVIDERS_KEY, ACTIVE_PROVIDER_KEY], () => {})
      }

      setInputValue('')
      setHasStoredKey(false)
      setIsDirty(false)
      setFeedbackState('idle')
      setErrorCode(null)
    })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter' && !isButtonDisabled()) {
      void handleSubmit()
    }
  }

  function isButtonDisabled(): boolean {
    if (isLoading) return true
    const trimmed = inputValue.trim()
    if (!trimmed) return true
    if (hasStoredKey && !isDirty) return true
    return false
  }

  function inputState(): InputState {
    if (isLoading) return 'disabled'
    if (feedbackState === 'success') return 'success'
    if (feedbackState === 'error') return 'error'
    return 'idle'
  }

  return (
    <div className="bg-surface rounded-[10px] p-6 shadow-ambient mt-6 w-full">
      <label
        htmlFor="api-key-input"
        className="block text-[0.625rem] font-bold uppercase tracking-[0.1em] text-on-surface-variant mb-[10px]"
      >
        Anthropic API key
      </label>

      <ApiKeyInput
        id="api-key-input"
        value={inputValue}
        onChange={handleChange}
        state={inputState()}
        disabled={isLoading}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
      />

      <TestAndSaveButton
        isLoading={isLoading}
        isDisabled={isButtonDisabled()}
        onClick={() => void handleSubmit()}
      />

      {hasStoredKey && !isDirty && (
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={handleRemove}
            className="text-[0.75rem] text-on-surface-variant underline-offset-2 hover:text-primary hover:underline focus:outline-[2px] focus:outline-primary focus:outline-offset-1 rounded"
          >
            Remove key
          </button>
        </div>
      )}

      <InlineFeedback state={feedbackState} errorCode={errorCode} />
    </div>
  )
}
