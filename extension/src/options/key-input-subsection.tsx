import React from 'react'
import ApiKeyInput, { type InputState } from './api-key-input'
import HowToGetAKeyLink from './how-to-get-a-key-link'
import type { ProviderId } from '../service-worker/providers/types'

const SECTION_LABEL: Record<ProviderId, string> = {
  anthropic: 'Anthropic API Key',
  openai: 'OpenAI API Key',
  gemini: 'Gemini API Key',
}

interface KeyInputSubsectionProps {
  providerId: ProviderId
  inputValue: string
  inputState: InputState
  disabled: boolean
  onChange: (value: string) => void
  onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  placeholder: string
}

export default function KeyInputSubsection({
  providerId,
  inputValue,
  inputState,
  disabled,
  onChange,
  onPaste,
  onKeyDown,
  placeholder,
}: KeyInputSubsectionProps): React.JSX.Element {
  const labelText = SECTION_LABEL[providerId]

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between mb-[10px]">
        <label
          htmlFor="api-key-input"
          className="text-[0.625rem] font-bold uppercase tracking-[0.1em] text-on-surface-variant"
        >
          {labelText}
        </label>
        <HowToGetAKeyLink provider={providerId} />
      </div>
      <ApiKeyInput
        id="api-key-input"
        value={inputValue}
        onChange={onChange}
        state={inputState}
        disabled={disabled}
        placeholder={placeholder}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
      />
    </div>
  )
}
