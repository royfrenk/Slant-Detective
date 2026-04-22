import React from 'react'

export type InputState = 'idle' | 'success' | 'error' | 'disabled'

interface ApiKeyInputProps {
  id: string
  value: string
  onChange: (value: string) => void
  state: InputState
  disabled: boolean
  placeholder?: string
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  onPaste?: (e: React.ClipboardEvent<HTMLInputElement>) => void
}

function borderClass(state: InputState): string {
  switch (state) {
    case 'success':
      return 'border-2 border-primary-fixed'
    case 'error':
      return 'border-2 border-tertiary'
    case 'disabled':
      return 'border border-outline bg-surface-variant opacity-70 cursor-not-allowed'
    default:
      return 'border border-outline'
  }
}

export default function ApiKeyInput({
  id,
  value,
  onChange,
  state,
  disabled,
  placeholder = 'sk-ant-api03-...',
  onKeyDown,
  onPaste,
}: ApiKeyInputProps): React.JSX.Element {
  return (
    <input
      id={id}
      type="password"
      autoComplete="off"
      spellCheck={false}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      aria-invalid={state === 'error' ? 'true' : 'false'}
      aria-describedby="api-key-feedback"
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      className={[
        'w-full h-11 rounded-md px-3 text-[0.875rem] text-on-surface',
        'placeholder:text-on-surface-variant bg-surface',
        'focus:outline-none focus:border-2 focus:border-primary',
        borderClass(state),
      ].join(' ')}
    />
  )
}
