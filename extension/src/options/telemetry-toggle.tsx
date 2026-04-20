/**
 * SD-030: Telemetry opt-out toggle
 *
 * Card frame matches ApiKeyCard exactly (same surface tier, shadow, radius, padding).
 * Toggle is a custom pill: 48×24 px, thumb 18px, animated 150ms.
 * Accessible: role="switch", aria-checked, keyboard-activatable.
 */
import React, { useState, useEffect } from 'react'
import { TELEMETRY_ENABLED } from '../shared/storage-keys'

const PRIVACY_URL = chrome.runtime.getURL('src/pages/privacy.html')

function Spinner(): React.JSX.Element {
  return (
    <span
      className="block w-[14px] h-[14px] rounded-full border-2 border-white border-t-transparent animate-spin"
      aria-hidden="true"
    />
  )
}

interface PillToggleProps {
  enabled: boolean
  saving: boolean
  onToggle: () => void
}

function PillToggle({ enabled, saving, onToggle }: PillToggleProps): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label="Share anonymous usage stats"
      onClick={onToggle}
      disabled={saving}
      className={[
        'relative flex items-center flex-shrink-0',
        'w-[48px] h-[24px] rounded-full',
        'transition-colors duration-150',
        'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1e293b] focus-visible:outline-offset-[3px]',
        saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        enabled ? 'bg-primary hover:brightness-90' : 'bg-outline hover:bg-surface-variant',
      ].join(' ')}
    >
      <span
        className={[
          'absolute flex items-center justify-center',
          'w-[18px] h-[18px] rounded-full bg-on-primary',
          'transition-transform duration-150',
          enabled ? 'translate-x-[27px]' : 'translate-x-[3px]',
        ].join(' ')}
      >
        {saving && <Spinner />}
      </span>
    </button>
  )
}

export default function TelemetryToggle(): React.JSX.Element {
  const [enabled, setEnabled] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    chrome.storage.local.get(TELEMETRY_ENABLED, (result) => {
      const stored = result[TELEMETRY_ENABLED] as boolean | undefined
      // Absent means onInstalled hasn't fired yet — default to true
      setEnabled(stored !== false)
    })
  }, [])

  async function handleToggle(): Promise<void> {
    const next = !enabled
    setSaving(true)
    try {
      await new Promise<void>((resolve, reject) => {
        chrome.storage.local.set({ [TELEMETRY_ENABLED]: next }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError)
          } else {
            resolve()
          }
        })
      })
      setEnabled(next)
    } catch {
      // Write failed — revert to previous state so UI stays consistent
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-surface rounded-[10px] p-6 shadow-ambient w-full">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-[0.875rem] font-semibold text-on-surface m-0">
            Share anonymous usage stats
          </p>
          <p className="text-[0.75rem] text-on-surface-variant mt-1 m-0">
            Daily aggregate counters only. No URLs, no article text, no user ID.{' '}
            <a
              href={PRIVACY_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Learn more about telemetry (opens Privacy page)"
              className="underline text-on-surface-variant"
            >
              Learn more
            </a>
          </p>
        </div>
        <PillToggle enabled={enabled} saving={saving} onToggle={() => void handleToggle()} />
      </div>
    </div>
  )
}
