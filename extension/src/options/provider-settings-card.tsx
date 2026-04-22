import React, { useState, useEffect, useCallback } from 'react'
import { PROVIDERS_KEY, ACTIVE_PROVIDER_KEY, ANTHROPIC_API_KEY } from '../shared/storage-keys'
import { getProvider } from '../service-worker/providers/index'
import type { ProviderId } from '../service-worker/providers/types'
import ProviderTabGroup, { type ProviderTab } from './provider-tab-group'
import KeyInputSubsection from './key-input-subsection'
import ModelSelectorSubsection, { type ModelConfig } from './model-selector-subsection'
import TestAndSaveButton from './test-and-save-button'
import InlineFeedback, { type FeedbackState } from './inline-feedback'
import { bump } from '../service-worker/telemetry'
import type { InputState } from './api-key-input'

// ─────────────────────────────────────────────────────────────
// Provider metadata — UI labels, placeholders, models
// ─────────────────────────────────────────────────────────────

interface ProviderMeta {
  id: ProviderId
  label: string
  placeholder: string
  prefixLen: number
  models: ModelConfig[]
  defaultModel: string
}

const PROVIDER_META: ProviderMeta[] = [
  {
    id: 'anthropic',
    label: 'Anthropic',
    placeholder: 'sk-ant-api03-...',
    prefixLen: 14,
    defaultModel: 'claude-haiku-4-5-20251001',
    models: [
      { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5', descriptor: 'Faster, cheaper — recommended' },
      { id: 'claude-sonnet-4-6-20251001', label: 'Sonnet 4.6', descriptor: 'Slower, higher quality' },
    ],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    placeholder: 'sk-...',
    prefixLen: 3,
    defaultModel: 'gpt-5-mini',
    models: [
      { id: 'gpt-5-mini', label: 'gpt-5-mini', descriptor: 'Faster, cheaper — recommended' },
      { id: 'gpt-5', label: 'gpt-5', descriptor: 'Slower, higher quality' },
    ],
  },
  {
    id: 'gemini',
    label: 'Gemini',
    placeholder: 'AIza...',
    prefixLen: 4,
    defaultModel: 'gemini-2.5-flash',
    models: [
      { id: 'gemini-2.5-flash', label: 'gemini-2.5-flash', descriptor: 'Faster, cheaper — recommended' },
      { id: 'gemini-2.5-pro', label: 'gemini-2.5-pro', descriptor: 'Slower, higher quality' },
    ],
  },
]

const PROVIDER_IDS: ProviderId[] = PROVIDER_META.map((p) => p.id)

function getProviderMeta(id: ProviderId): ProviderMeta {
  return PROVIDER_META.find((p) => p.id === id) ?? PROVIDER_META[0]
}

// ─────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────

function maskedKey(key: string, prefixLen: number): string {
  return `${key.slice(0, prefixLen)}${'•'.repeat(20)}`
}

// macOS "smart dashes" silently replaces -- with — on paste, corrupting API keys.
// Also strip any other non-ASCII printable chars that paste can introduce.
function normalizeKey(raw: string): string {
  return raw
    .replace(/\u2014/g, '--') // em-dash → two hyphens
    .replace(/\u2013/g, '-')  // en-dash → hyphen
    .replace(/[^\x20-\x7E]/g, '') // strip non-printable-ASCII
    .trim()
}

// ─────────────────────────────────────────────────────────────
// Storage types
// ─────────────────────────────────────────────────────────────

interface ProviderStorageEntry {
  key: string
  model: string
}

interface ProvidersStorageMap {
  anthropic?: ProviderStorageEntry
  openai?: ProviderStorageEntry
  gemini?: ProviderStorageEntry
}

// ─────────────────────────────────────────────────────────────
// Per-provider state
// ─────────────────────────────────────────────────────────────

interface PerProviderState {
  inputValue: string
  hasStoredKey: boolean
  isDirty: boolean
  selectedModel: string
}

function defaultPerProviderState(meta: ProviderMeta): PerProviderState {
  return {
    inputValue: '',
    hasStoredKey: false,
    isDirty: false,
    selectedModel: meta.defaultModel,
  }
}

type ProviderStateMap = Record<ProviderId, PerProviderState>

function buildInitialProviderState(): ProviderStateMap {
  const state: Partial<ProviderStateMap> = {}
  for (const meta of PROVIDER_META) {
    state[meta.id] = defaultPerProviderState(meta)
  }
  return state as ProviderStateMap
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export default function ProviderSettingsCard(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<ProviderId>('anthropic')
  const [activeProvider, setActiveProvider] = useState<ProviderId>('anthropic')
  const [providerState, setProviderState] = useState<ProviderStateMap>(buildInitialProviderState)
  const [isLoading, setIsLoading] = useState(false)
  const [feedbackState, setFeedbackState] = useState<FeedbackState>('idle')
  const [errorCode, setErrorCode] = useState<number | null>(null)

  // ── Mount: read storage and populate state ──────────────────
  useEffect(() => {
    chrome.storage.local.get(
      [PROVIDERS_KEY, ACTIVE_PROVIDER_KEY, ANTHROPIC_API_KEY],
      (result) => {
        let providers = (result[PROVIDERS_KEY] as ProvidersStorageMap | undefined) ?? {}
        const storedActive = result[ACTIVE_PROVIDER_KEY] as ProviderId | undefined

        // Alpha migration: promote legacy anthropicApiKey → providers.anthropic.key
        const legacyKey = result[ANTHROPIC_API_KEY] as string | undefined
        if (legacyKey && !providers.anthropic?.key) {
          const promoted: ProvidersStorageMap = {
            ...providers,
            anthropic: { key: legacyKey, model: 'claude-haiku-4-5-20251001' },
          }
          chrome.storage.local.set(
            { [PROVIDERS_KEY]: promoted, [ACTIVE_PROVIDER_KEY]: 'anthropic' },
            () => {
              // Non-critical: migration failure leaves legacy key in place and user sees empty state;
              // they can re-enter the key. No user-visible feedback path available at mount.
              void chrome.runtime.lastError
            },
          )
          providers = promoted
        }

        // Build per-provider state from storage
        const updated = buildInitialProviderState()
        for (const meta of PROVIDER_META) {
          const entry = providers[meta.id as keyof ProvidersStorageMap]
          if (entry?.key) {
            updated[meta.id] = {
              inputValue: maskedKey(entry.key, meta.prefixLen),
              hasStoredKey: true,
              isDirty: false,
              selectedModel: entry.model ?? meta.defaultModel,
            }
          }
        }

        setProviderState(updated)

        // Set active tab: stored activeProvider → first provider with a key → 'anthropic'
        if (storedActive && PROVIDER_IDS.includes(storedActive)) {
          setActiveTab(storedActive)
          setActiveProvider(storedActive)
        } else {
          const firstWithKey = PROVIDER_META.find(
            (m) => providers[m.id as keyof ProvidersStorageMap]?.key,
          )
          if (firstWithKey) {
            setActiveTab(firstWithKey.id)
            setActiveProvider(firstWithKey.id)
          }
        }
      },
    )
  }, [])

  // ── Tab switch ───────────────────────────────────────────────
  function handleTabChange(id: string): void {
    const newTab = id as ProviderId
    setActiveTab(newTab)
    setFeedbackState('idle')
    setErrorCode(null)

    // If this tab has a saved key, promote it to active provider for analysis.
    // Saving a new key in a different tab will override this later.
    if (providerState[newTab].hasStoredKey) {
      chrome.storage.local.set({ [ACTIVE_PROVIDER_KEY]: newTab }, () => {
        if (!chrome.runtime.lastError) setActiveProvider(newTab)
      })
    }
  }

  // ── Remove key ───────────────────────────────────────────────
  async function handleRemoveKey(): Promise<void> {
    if (!current.hasStoredKey) return
    const meta = getProviderMeta(activeTab)
    const confirmed = window.confirm(
      `Remove your ${meta.label} API key? This cannot be undone — you'll need to paste it again to use Layer 2 analysis with ${meta.label}.`,
    )
    if (!confirmed) return

    const existing = await new Promise<Record<string, unknown>>((resolve) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chrome.storage.local.get([PROVIDERS_KEY, ACTIVE_PROVIDER_KEY] as any, resolve)
    })
    const existingProviders = (existing[PROVIDERS_KEY] as ProvidersStorageMap | undefined) ?? {}
    const updated: ProvidersStorageMap = { ...existingProviders }
    delete updated[activeTab]

    // If we removed the active provider, pick another provider that still has a key.
    const storedActive = existing[ACTIVE_PROVIDER_KEY] as ProviderId | undefined
    const writes: Record<string, unknown> = { [PROVIDERS_KEY]: updated }
    let nextActive: ProviderId | null = null
    if (storedActive === activeTab) {
      const fallback = PROVIDER_META.find(
        (m) => m.id !== activeTab && updated[m.id as keyof ProvidersStorageMap]?.key,
      )
      nextActive = fallback?.id ?? null
      if (nextActive !== null) writes[ACTIVE_PROVIDER_KEY] = nextActive
    }

    await new Promise<void>((resolve) => {
      chrome.storage.local.set(writes, () => {
        if (chrome.runtime.lastError) {
          setFeedbackState('error')
        }
        resolve()
      })
    })
    // If we cleared the active provider entirely, remove the storage key too.
    if (storedActive === activeTab && nextActive === null) {
      await new Promise<void>((resolve) => {
        chrome.storage.local.remove(ACTIVE_PROVIDER_KEY, () => resolve())
      })
    }

    setProviderState((prev) => ({
      ...prev,
      [activeTab]: defaultPerProviderState(meta),
    }))
    if (nextActive !== null) setActiveProvider(nextActive)
    setFeedbackState('idle')
    setErrorCode(null)
  }

  // ── Input change ─────────────────────────────────────────────
  function handleChange(value: string): void {
    setProviderState((prev) => ({
      ...prev,
      [activeTab]: { ...prev[activeTab], inputValue: value, isDirty: true },
    }))
    setFeedbackState('idle')
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>): void {
    e.preventDefault()
    const normalized = normalizeKey(e.clipboardData.getData('text/plain'))
    setProviderState((prev) => ({
      ...prev,
      [activeTab]: { ...prev[activeTab], inputValue: normalized, isDirty: true },
    }))
    setFeedbackState('idle')
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter' && !isButtonDisabled) {
      void handleSubmit()
    }
  }

  // ── Model change ─────────────────────────────────────────────
  function handleModelSelect(modelId: string): void {
    setProviderState((prev) => ({
      ...prev,
      [activeTab]: { ...prev[activeTab], selectedModel: modelId, isDirty: true },
    }))
    setFeedbackState('idle')
  }

  // ── Button state ─────────────────────────────────────────────
  const current = providerState[activeTab]

  const isButtonDisabled: boolean = (() => {
    if (isLoading) return true
    if (!current.inputValue.trim()) return true
    if (current.hasStoredKey && !current.isDirty) return true
    return false
  })()

  function inputState(): InputState {
    if (isLoading) return 'disabled'
    if (feedbackState === 'success') return 'success'
    if (feedbackState === 'error') return 'error'
    return 'idle'
  }

  // ── Submit ───────────────────────────────────────────────────
  const handleSubmit = useCallback(async (): Promise<void> => {
    const trimmed = normalizeKey(current.inputValue)
    if (!trimmed) return
    if (isLoading) return
    if (current.hasStoredKey && !current.isDirty) return

    // Guard: masking bullets indicate user hasn't replaced the stored key display.
    if (trimmed.includes('•')) {
      setFeedbackState('error')
      setErrorCode(0)
      return
    }

    setIsLoading(true)
    setFeedbackState('idle')
    setErrorCode(null)

    const meta = getProviderMeta(activeTab)
    const testResult = await getProvider(activeTab).validateKey(trimmed)

    if (testResult.status === 'ok') {
      await persistKey(trimmed, meta.id, current.selectedModel)
      void bump('key_saved')
      setFeedbackState('success')
      setProviderState((prev) => ({
        ...prev,
        [activeTab]: { ...prev[activeTab], hasStoredKey: true, isDirty: false },
      }))
    } else if (testResult.status === 'invalid') {
      void bump('key_rejected')
      setFeedbackState('error')
      setErrorCode(testResult.code)
    } else {
      // reachable-unverified OR network-error — save key, show warning.
      // Spec §8c + SD-017 audit: offline/rate-limited users keep a working key.
      await persistKey(trimmed, meta.id, current.selectedModel)
      void bump('key_saved')
      setFeedbackState('warning')
      setProviderState((prev) => ({
        ...prev,
        [activeTab]: { ...prev[activeTab], hasStoredKey: true, isDirty: false },
      }))
    }

    setIsLoading(false)
  }, [activeTab, current, isLoading])

  async function persistKey(key: string, providerId: ProviderId, model: string): Promise<void> {
    const existing = await new Promise<Record<string, unknown>>((resolve) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chrome.storage.local.get([PROVIDERS_KEY] as any, resolve)
    })
    const existingProviders = (existing[PROVIDERS_KEY] as ProvidersStorageMap | undefined) ?? {}
    const updated: ProvidersStorageMap = {
      ...existingProviders,
      [providerId]: { key, model },
    }
    await new Promise<void>((resolve) => {
      chrome.storage.local.set(
        { [PROVIDERS_KEY]: updated, [ACTIVE_PROVIDER_KEY]: providerId },
        () => {
          if (chrome.runtime.lastError) {
            // User-visible: surface via error feedback state; no console log per hygiene rules.
            setFeedbackState('error')
          } else {
            setActiveProvider(providerId)
          }
          resolve()
        },
      )
    })
  }

  // ── Derived ──────────────────────────────────────────────────
  const activeMeta = getProviderMeta(activeTab)

  const tabs: ProviderTab[] = PROVIDER_META.map((m) => ({
    id: m.id,
    label: m.label,
    disabled: false, // All shown; runtime error acceptable for unregistered providers before SD-033/034
    ...(m.id === 'anthropic' && {
      badge: {
        text: 'RECOMMENDED',
        variant: 'recommended',
      } as const,
    }),
    ...(m.id === 'openai' && {
      badge: {
        text: 'NOT RECOMMENDED',
        variant: 'warning',
        tooltip:
          'Lower accuracy in our parity eval (κ 0.32 vs 0.58 baseline). Use Anthropic or Gemini for more reliable Layer 2 analysis.',
      } as const,
    }),
  }))

  const anyProviderHasKey = PROVIDER_IDS.some((id) => providerState[id].hasStoredKey)

  return (
    <div className="bg-surface rounded-[10px] p-6 shadow-ambient w-full">
      <ProviderTabGroup
        tabs={tabs}
        activeId={activeTab}
        onTabChange={handleTabChange}
      />

      {anyProviderHasKey && (
        <div
          role="status"
          aria-live="polite"
          className="mt-4 flex items-center gap-2 text-[0.75rem] text-on-surface-variant"
        >
          <span aria-hidden="true" className="text-primary-fixed">●</span>
          <span>
            Analyses use your <span className="font-semibold text-on-surface">{getProviderMeta(activeProvider).label}</span> key. Click another tab with a saved key to switch.
          </span>
        </div>
      )}

      {activeTab === 'openai' && (
        <div
          role="note"
          aria-label="OpenAI accuracy warning"
          className="mt-4 flex items-start gap-3 rounded-md border border-outline bg-surface-variant px-4 py-3"
        >
          <span aria-hidden="true" className="text-[1.5rem] leading-none mt-[1px] text-on-tertiary-container">⚠</span>
          <p className="m-0 text-[1.125rem] leading-snug text-on-surface">
            <span className="font-semibold">OpenAI scored low on accuracy</span> in our model parity test.
            For more reliable Layer 2 analysis, use Anthropic or Gemini.
          </p>
        </div>
      )}

      <div id="provider-panel">
        <KeyInputSubsection
          providerId={activeTab}
          inputValue={current.inputValue}
          inputState={inputState()}
          disabled={isLoading}
          onChange={handleChange}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          placeholder={activeMeta.placeholder}
        />

        <ModelSelectorSubsection
          models={activeMeta.models}
          selectedModelId={current.selectedModel}
          onModelSelect={handleModelSelect}
        />
      </div>

      <TestAndSaveButton
        isLoading={isLoading}
        isDisabled={isButtonDisabled}
        onClick={() => void handleSubmit()}
      />

      {current.hasStoredKey && !current.isDirty && (
        <button
          type="button"
          disabled={isLoading}
          onClick={() => void handleRemoveKey()}
          aria-label={`Remove saved ${activeMeta.label} key`}
          className={[
            'w-full h-10 rounded-md mt-2',
            'text-[0.8125rem] font-semibold text-on-surface-variant',
            'bg-transparent border border-outline',
            'hover:text-tertiary hover:border-tertiary',
            'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
            isLoading ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer',
          ].join(' ')}
        >
          Remove {activeMeta.label} key
        </button>
      )}

      <InlineFeedback
        state={feedbackState}
        errorCode={errorCode}
        provider={activeTab}
      />
    </div>
  )
}
