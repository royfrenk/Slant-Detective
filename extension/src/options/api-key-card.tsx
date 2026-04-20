import React, { useState, useEffect } from 'react'
import { ANTHROPIC_API_KEY } from '../shared/storage-keys'
import { validateApiKey } from './validate-api-key'
import ApiKeyInput, { type InputState } from './api-key-input'
import TestAndSaveButton from './test-and-save-button'
import InlineFeedback, { type FeedbackState } from './inline-feedback'

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
    chrome.storage.local.get(ANTHROPIC_API_KEY, (result) => {
      const stored = result[ANTHROPIC_API_KEY] as string | undefined
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

    const result = await validateApiKey(trimmed)

    if (result.status === 'ok') {
      chrome.storage.local.set({ [ANTHROPIC_API_KEY]: trimmed }, () => {})
      setFeedbackState('success')
      setHasStoredKey(true)
      setIsDirty(false)
    } else if (result.status === 'invalid') {
      setFeedbackState('error')
      setErrorCode(result.code)
    } else if (result.status === 'reachable-unverified') {
      // Request reached Anthropic but got an unexpected status (429, 500, etc.).
      // Key format is plausibly correct — save with a warning.
      chrome.storage.local.set({ [ANTHROPIC_API_KEY]: trimmed }, () => {})
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

      <InlineFeedback state={feedbackState} errorCode={errorCode} />
    </div>
  )
}
