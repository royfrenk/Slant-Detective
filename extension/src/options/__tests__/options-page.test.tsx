/**
 * SD-032: options-page.test.tsx migrated from ApiKeyCard → ProviderSettingsCard
 *
 * Core behaviors are now tested via ProviderSettingsCard (the replacement). These
 * tests cover the same scenarios described in the original spec:
 * - Button disabled on empty input
 * - Button enables when user types
 * - Loading state during validation
 * - HTTP 200 → success feedback + storage write
 * - HTTP 401 → error feedback + no storage write
 * - reachable-unverified → warning + storage write
 * - network-error → warning + storage write (spec §8c / SD-017 audit — offline users keep a working key)
 * - Masked key displayed when key stored; button disabled until modified
 * - Em-dash normalization on paste
 * - Non-ASCII stripping on paste
 *
 * Provider-switching and per-provider isolation tests live in
 * provider-settings-card.test.tsx to avoid duplication.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import ProviderSettingsCard from '../provider-settings-card'
import * as providerIndex from '../../service-worker/providers/index'

// ─────────────────────────────────────────────────────────────
// Chrome storage mock
// ─────────────────────────────────────────────────────────────

const storageMock = {
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
}

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'

beforeEach(() => {
  vi.clearAllMocks()
  storageMock.get.mockImplementation((_key: string | string[], cb: (result: Record<string, unknown>) => void) => {
    cb({})
  })
  storageMock.set.mockImplementation((_data: Record<string, unknown>, cb?: () => void) => {
    if (cb) cb()
  })
  storageMock.remove.mockImplementation((_key: string | string[], cb?: () => void) => {
    if (cb) cb()
  })
  globalThis.chrome = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(globalThis.chrome as any),
    storage: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      local: storageMock as any,
    },
  }
})

// ─────────────────────────────────────────────────────────────
// ProviderSettingsCard behavioral tests (migrated from ApiKeyCard)
// ─────────────────────────────────────────────────────────────

describe('ProviderSettingsCard (options-page behavioral tests)', () => {
  it('button is disabled when input is empty (no stored key)', async () => {
    render(<ProviderSettingsCard />)
    const button = await screen.findByRole('button', { name: /test and save/i })
    expect(button).toBeDisabled()
  })

  it('enables button when user types in the input', async () => {
    render(<ProviderSettingsCard />)
    const input = await screen.findByLabelText(/anthropic api key/i)
    const button = screen.getByRole('button', { name: /test and save/i })

    fireEvent.change(input, { target: { value: 'sk-ant-test-key' } })

    await waitFor(() => expect(button).not.toBeDisabled())
  })

  it('shows loading state while validating', async () => {
    let resolveValidation!: (value: { status: 'ok' }) => void
    vi.spyOn(providerIndex.getProvider('anthropic'), 'validateKey').mockReturnValue(
      new Promise<{ status: 'ok' }>((resolve) => { resolveValidation = resolve }),
    )

    render(<ProviderSettingsCard />)
    const input = await screen.findByLabelText(/anthropic api key/i)
    const button = screen.getByRole('button', { name: /test and save/i })

    fireEvent.change(input, { target: { value: 'sk-ant-test' } })
    await waitFor(() => expect(button).not.toBeDisabled())

    await act(async () => { fireEvent.click(button) })

    expect(screen.getByText('Validating…')).toBeInTheDocument()
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')

    await act(async () => { resolveValidation({ status: 'ok' }) })
  })

  it('shows success feedback and writes to storage on HTTP 200', async () => {
    vi.spyOn(providerIndex.getProvider('anthropic'), 'validateKey').mockResolvedValue({ status: 'ok' })

    render(<ProviderSettingsCard />)
    const input = await screen.findByLabelText(/anthropic api key/i)
    fireEvent.change(input, { target: { value: 'sk-ant-valid' } })

    const button = screen.getByRole('button', { name: /test and save/i })
    await waitFor(() => expect(button).not.toBeDisabled())

    await act(async () => { fireEvent.click(button) })

    await waitFor(() => {
      expect(screen.getByText(/Key saved\. Layer 2 analysis is now active\./i)).toBeInTheDocument()
    })
    // Written to new providers schema
    expect(storageMock.set).toHaveBeenCalledWith(
      expect.objectContaining({
        providers: expect.objectContaining({
          anthropic: { key: 'sk-ant-valid', model: DEFAULT_MODEL },
        }),
        activeProvider: 'anthropic',
      }),
      expect.anything(),
    )
  })

  it('shows error feedback on 401 and does NOT write to storage', async () => {
    vi.spyOn(providerIndex.getProvider('anthropic'), 'validateKey').mockResolvedValue({ status: 'invalid', code: 401 })

    render(<ProviderSettingsCard />)
    const input = await screen.findByLabelText(/anthropic api key/i)
    fireEvent.change(input, { target: { value: 'sk-ant-bad' } })

    const button = screen.getByRole('button', { name: /test and save/i })
    await waitFor(() => expect(button).not.toBeDisabled())

    await act(async () => { fireEvent.click(button) })

    await waitFor(() => {
      expect(screen.getByText(/Invalid key/i)).toBeInTheDocument()
    })
    expect(storageMock.set).not.toHaveBeenCalled()
  })

  it('shows warning and writes to storage on reachable-unverified', async () => {
    vi.spyOn(providerIndex.getProvider('anthropic'), 'validateKey').mockResolvedValue({ status: 'reachable-unverified' })

    render(<ProviderSettingsCard />)
    const input = await screen.findByLabelText(/anthropic api key/i)
    fireEvent.change(input, { target: { value: 'sk-ant-maybe' } })

    const button = screen.getByRole('button', { name: /test and save/i })
    await waitFor(() => expect(button).not.toBeDisabled())

    await act(async () => { fireEvent.click(button) })

    await waitFor(() => {
      expect(screen.getByText(/Couldn't reach Anthropic to validate/i)).toBeInTheDocument()
    })
    expect(storageMock.set).toHaveBeenCalledWith(
      expect.objectContaining({
        providers: expect.objectContaining({
          anthropic: { key: 'sk-ant-maybe', model: DEFAULT_MODEL },
        }),
        activeProvider: 'anthropic',
      }),
      expect.anything(),
    )
  })

  it('shows warning AND writes to storage on true network error (spec §8c — offline users keep a working key)', async () => {
    vi.spyOn(providerIndex.getProvider('anthropic'), 'validateKey').mockResolvedValue({ status: 'network-error' })

    render(<ProviderSettingsCard />)
    const input = await screen.findByLabelText(/anthropic api key/i)
    fireEvent.change(input, { target: { value: 'sk-ant-offline' } })

    const button = screen.getByRole('button', { name: /test and save/i })
    await waitFor(() => expect(button).not.toBeDisabled())

    await act(async () => { fireEvent.click(button) })

    await waitFor(() => {
      expect(screen.getByText(/Couldn't reach Anthropic to validate/i)).toBeInTheDocument()
    })
    expect(storageMock.set).toHaveBeenCalled()
  })

  it('displays masked key when a key is already stored', async () => {
    storageMock.get.mockImplementation((_key: string | string[], cb: (result: Record<string, unknown>) => void) => {
      cb({ providers: { anthropic: { key: 'sk-ant-api03-realkey1234', model: DEFAULT_MODEL } }, activeProvider: 'anthropic' })
    })

    render(<ProviderSettingsCard />)

    await waitFor(() => {
      const input = screen.getByLabelText(/anthropic api key/i) as HTMLInputElement
      expect(input.value).toMatch(/^sk-ant-api03-/)
      expect(input.value).toContain('•')
    })
  })

  it('normalizes em-dash to -- on paste so macOS smart-dashes cannot corrupt the key', async () => {
    render(<ProviderSettingsCard />)
    const input = await screen.findByLabelText(/anthropic api key/i)

    fireEvent.paste(input, {
      clipboardData: { getData: () => 'sk-ant-api03-test\u2014VDtN' },
    })

    await waitFor(() => {
      expect((input as HTMLInputElement).value).toBe('sk-ant-api03-test--VDtN')
    })
  })

  it('strips non-ASCII characters on paste', async () => {
    render(<ProviderSettingsCard />)
    const input = await screen.findByLabelText(/anthropic api key/i)

    fireEvent.paste(input, {
      clipboardData: { getData: () => 'sk-ant-\u200B\u00A0test' },
    })

    await waitFor(() => {
      expect((input as HTMLInputElement).value).toBe('sk-ant-test')
    })
  })

  it('button stays disabled until user modifies the masked stored key', async () => {
    storageMock.get.mockImplementation((_key: string | string[], cb: (result: Record<string, unknown>) => void) => {
      cb({ providers: { anthropic: { key: 'sk-ant-api03-realkey1234', model: DEFAULT_MODEL } }, activeProvider: 'anthropic' })
    })

    render(<ProviderSettingsCard />)

    await waitFor(() => {
      const button = screen.getByRole('button', { name: /test and save/i })
      expect(button).toBeDisabled()
    })

    const input = screen.getByLabelText(/anthropic api key/i)
    fireEvent.change(input, { target: { value: 'sk-ant-api03-newkey' } })

    await waitFor(() => {
      const button = screen.getByRole('button', { name: /test and save/i })
      expect(button).not.toBeDisabled()
    })
  })
})
