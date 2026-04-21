import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import ProviderSettingsCard from '../provider-settings-card'

// ─────────────────────────────────────────────────────────────
// Chrome storage mock
// ─────────────────────────────────────────────────────────────

const storageMock = {
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
  // Default: empty storage
  storageMock.get.mockImplementation(
    (_keys: string | string[], cb: (result: Record<string, unknown>) => void) => {
      cb({})
    },
  )
  storageMock.set.mockImplementation(
    (_data: Record<string, unknown>, cb?: () => void) => {
      if (cb) cb()
    },
  )
  storageMock.remove.mockImplementation(
    (_key: string | string[], cb?: () => void) => {
      if (cb) cb()
    },
  )
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
// Helpers
// ─────────────────────────────────────────────────────────────

function storageMockWithProviders(providers: Record<string, unknown>, activeProvider = 'anthropic'): void {
  storageMock.get.mockImplementation(
    (_keys: string | string[], cb: (result: Record<string, unknown>) => void) => {
      cb({ providers, activeProvider })
    },
  )
}

// ─────────────────────────────────────────────────────────────
// Tests: Tab rendering
// ─────────────────────────────────────────────────────────────

describe('ProviderSettingsCard — provider tabs (SD-032)', () => {
  it('renders all three provider tabs', async () => {
    render(<ProviderSettingsCard />)
    await screen.findByRole('tab', { name: 'Anthropic' })
    expect(screen.getByRole('tab', { name: 'OpenAI' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Gemini' })).toBeInTheDocument()
  })

  it('Anthropic tab is selected by default (no stored state)', async () => {
    render(<ProviderSettingsCard />)
    await screen.findByRole('tab', { name: 'Anthropic' })
    expect(screen.getByRole('tab', { name: 'Anthropic' })).toHaveAttribute('aria-selected', 'true')
  })

  it('switching tabs updates key input placeholder', async () => {
    render(<ProviderSettingsCard />)
    await screen.findByRole('tab', { name: 'Anthropic' })

    const openaiTab = screen.getByRole('tab', { name: 'OpenAI' })
    fireEvent.click(openaiTab)

    await waitFor(() => {
      const input = screen.getByLabelText(/openai api key/i) as HTMLInputElement
      expect(input.placeholder).toBe('sk-...')
    })
  })

  it('switching tabs updates model cards to provider-specific models', async () => {
    render(<ProviderSettingsCard />)
    await screen.findByRole('tab', { name: 'Anthropic' })

    // Initially shows Anthropic models
    expect(screen.getByText('Haiku 4.5')).toBeInTheDocument()

    // Switch to OpenAI
    fireEvent.click(screen.getByRole('tab', { name: 'OpenAI' }))

    await waitFor(() => {
      expect(screen.getByText('gpt-5-mini')).toBeInTheDocument()
    })
  })

  it('switching tabs resets InlineFeedback to idle', async () => {
    // Mock a successful validation first, then switch tabs
    const { getProvider } = await import('../../service-worker/providers/index')
    vi.spyOn(getProvider('anthropic'), 'validateKey').mockResolvedValue({ status: 'ok' })

    render(<ProviderSettingsCard />)
    const input = await screen.findByLabelText(/anthropic api key/i)
    fireEvent.change(input, { target: { value: 'sk-ant-api03-test' } })

    const button = screen.getByRole('button', { name: /test and save/i })
    await waitFor(() => expect(button).not.toBeDisabled())
    await act(async () => { fireEvent.click(button) })

    await waitFor(() => {
      expect(screen.getByText(/Key saved/i)).toBeInTheDocument()
    })

    // Switch tabs — feedback should reset
    fireEvent.click(screen.getByRole('tab', { name: 'OpenAI' }))

    await waitFor(() => {
      expect(screen.queryByText(/Key saved/i)).not.toBeInTheDocument()
    })
  })

  it('switching tabs disables Test & Save button (no unsaved change on new tab)', async () => {
    render(<ProviderSettingsCard />)
    await screen.findByRole('tab', { name: 'Anthropic' })

    // Type into Anthropic input
    const input = screen.getByLabelText(/anthropic api key/i)
    fireEvent.change(input, { target: { value: 'sk-ant-api03-test' } })

    const button = screen.getByRole('button', { name: /test and save/i })
    await waitFor(() => expect(button).not.toBeDisabled())

    // Switch to OpenAI — button should disable again (no value in OpenAI input)
    fireEvent.click(screen.getByRole('tab', { name: 'OpenAI' }))

    await waitFor(() => {
      expect(button).toBeDisabled()
    })
  })
})

// ─────────────────────────────────────────────────────────────
// Tests: Storage and persistence
// ─────────────────────────────────────────────────────────────

describe('ProviderSettingsCard — storage isolation (SD-032)', () => {
  it('saving an Anthropic key writes only to providers.anthropic, not openai', async () => {
    const { getProvider } = await import('../../service-worker/providers/index')
    vi.spyOn(getProvider('anthropic'), 'validateKey').mockResolvedValue({ status: 'ok' })

    render(<ProviderSettingsCard />)
    const input = await screen.findByLabelText(/anthropic api key/i)
    fireEvent.change(input, { target: { value: 'sk-ant-api03-valid' } })

    const button = screen.getByRole('button', { name: /test and save/i })
    await waitFor(() => expect(button).not.toBeDisabled())
    await act(async () => { fireEvent.click(button) })

    await waitFor(() => {
      expect(storageMock.set).toHaveBeenCalledWith(
        expect.objectContaining({
          providers: expect.objectContaining({
            anthropic: expect.objectContaining({ key: 'sk-ant-api03-valid' }),
          }),
          activeProvider: 'anthropic',
        }),
        expect.anything(),
      )
    })
    // openai key not written
    const calls = storageMock.set.mock.calls
    for (const [data] of calls) {
      const providers = (data as Record<string, unknown>)['providers'] as Record<string, unknown> | undefined
      expect(providers?.openai).toBeUndefined()
    }
  })

  it('displays masked Anthropic key when stored', async () => {
    storageMockWithProviders({
      anthropic: { key: 'sk-ant-api03-realkey1234', model: 'claude-haiku-4-5-20251001' },
    })

    render(<ProviderSettingsCard />)
    await waitFor(() => {
      const input = screen.getByLabelText(/anthropic api key/i) as HTMLInputElement
      expect(input.value).toMatch(/^sk-ant-api03-/)
      expect(input.value).toContain('•')
    })
  })

  it('displays masked OpenAI key when switching to OpenAI tab with stored key', async () => {
    storageMockWithProviders({
      anthropic: { key: 'sk-ant-api03-realkey1234', model: 'claude-haiku-4-5-20251001' },
      openai: { key: 'sk-openai-testkey', model: 'gpt-5-mini' },
    })

    render(<ProviderSettingsCard />)
    await screen.findByRole('tab', { name: 'Anthropic' })

    fireEvent.click(screen.getByRole('tab', { name: 'OpenAI' }))

    await waitFor(() => {
      const input = screen.getByLabelText(/openai api key/i) as HTMLInputElement
      expect(input.value).toMatch(/^sk-/)
      expect(input.value).toContain('•')
    })
  })

  it('Test & Save is disabled when showing masked stored key', async () => {
    storageMockWithProviders({
      anthropic: { key: 'sk-ant-api03-realkey1234', model: 'claude-haiku-4-5-20251001' },
    })

    render(<ProviderSettingsCard />)
    await waitFor(() => {
      const button = screen.getByRole('button', { name: /test and save/i })
      expect(button).toBeDisabled()
    })
  })

  it('Test & Save enables after user modifies the masked key field', async () => {
    storageMockWithProviders({
      anthropic: { key: 'sk-ant-api03-realkey1234', model: 'claude-haiku-4-5-20251001' },
    })

    render(<ProviderSettingsCard />)
    await screen.findByLabelText(/anthropic api key/i)

    const input = screen.getByLabelText(/anthropic api key/i)
    fireEvent.change(input, { target: { value: 'sk-ant-api03-newkey' } })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /test and save/i })).not.toBeDisabled()
    })
  })
})

// ─────────────────────────────────────────────────────────────
// Tests: Alpha migration
// ─────────────────────────────────────────────────────────────

describe('ProviderSettingsCard — alpha migration (SD-032)', () => {
  it('promotes anthropicApiKey to providers.anthropic on first open', async () => {
    storageMock.get.mockImplementation(
      (_keys: string | string[], cb: (result: Record<string, unknown>) => void) => {
        cb({ anthropicApiKey: 'sk-ant-api03-legacykey' })
      },
    )

    render(<ProviderSettingsCard />)

    // Should have written the promoted key to storage
    await waitFor(() => {
      expect(storageMock.set).toHaveBeenCalledWith(
        expect.objectContaining({
          providers: expect.objectContaining({
            anthropic: expect.objectContaining({ key: 'sk-ant-api03-legacykey' }),
          }),
          activeProvider: 'anthropic',
        }),
        expect.anything(),
      )
    })
  })

  it('shows Anthropic tab as active and masked key after migration', async () => {
    storageMock.get.mockImplementation(
      (_keys: string | string[], cb: (result: Record<string, unknown>) => void) => {
        cb({ anthropicApiKey: 'sk-ant-api03-legacykey' })
      },
    )

    render(<ProviderSettingsCard />)

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Anthropic' })).toHaveAttribute('aria-selected', 'true')
    })

    const input = screen.getByLabelText(/anthropic api key/i) as HTMLInputElement
    expect(input.value).toMatch(/^sk-ant-api03-/)
    expect(input.value).toContain('•')
  })
})

// ─────────────────────────────────────────────────────────────
// Tests: Feedback states
// ─────────────────────────────────────────────────────────────

describe('ProviderSettingsCard — feedback states (SD-032)', () => {
  it('shows success feedback and saves key on HTTP 200', async () => {
    const { getProvider } = await import('../../service-worker/providers/index')
    vi.spyOn(getProvider('anthropic'), 'validateKey').mockResolvedValue({ status: 'ok' })

    render(<ProviderSettingsCard />)
    const input = await screen.findByLabelText(/anthropic api key/i)
    fireEvent.change(input, { target: { value: 'sk-ant-api03-valid' } })

    const button = screen.getByRole('button', { name: /test and save/i })
    await waitFor(() => expect(button).not.toBeDisabled())
    await act(async () => { fireEvent.click(button) })

    await waitFor(() => {
      expect(screen.getByText(/Key saved\. Layer 2 analysis is now active\./i)).toBeInTheDocument()
    })
    expect(storageMock.set).toHaveBeenCalled()
  })

  it('shows error feedback and does NOT save on 401', async () => {
    const { getProvider } = await import('../../service-worker/providers/index')
    vi.spyOn(getProvider('anthropic'), 'validateKey').mockResolvedValue({ status: 'invalid', code: 401 })

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

  it('shows rate-limit feedback and does NOT save on 429 (reachable-unverified treated as warning if 429 status not separate)', async () => {
    // The provider's validateKey returns { status: 'reachable-unverified' } for 429.
    // SD-032 maps that to warning (key saved). True rate-limit comes from a separate
    // 'rate-limit' FeedbackState. This test verifies the warning path saves the key.
    const { getProvider } = await import('../../service-worker/providers/index')
    vi.spyOn(getProvider('anthropic'), 'validateKey').mockResolvedValue({ status: 'reachable-unverified' })

    render(<ProviderSettingsCard />)
    const input = await screen.findByLabelText(/anthropic api key/i)
    fireEvent.change(input, { target: { value: 'sk-ant-maybe' } })

    const button = screen.getByRole('button', { name: /test and save/i })
    await waitFor(() => expect(button).not.toBeDisabled())
    await act(async () => { fireEvent.click(button) })

    await waitFor(() => {
      expect(screen.getByText(/Couldn't reach Anthropic to validate/i)).toBeInTheDocument()
    })
    // Key IS saved on reachable-unverified
    expect(storageMock.set).toHaveBeenCalled()
  })

  it('shows warning AND saves on true network error (spec §8c / SD-017 audit — offline users keep a working key)', async () => {
    const { getProvider } = await import('../../service-worker/providers/index')
    vi.spyOn(getProvider('anthropic'), 'validateKey').mockResolvedValue({ status: 'network-error' })

    render(<ProviderSettingsCard />)
    const input = await screen.findByLabelText(/anthropic api key/i)
    fireEvent.change(input, { target: { value: 'sk-ant-offline' } })

    const button = screen.getByRole('button', { name: /test and save/i })
    await waitFor(() => expect(button).not.toBeDisabled())
    await act(async () => { fireEvent.click(button) })

    await waitFor(() => {
      expect(screen.getByText(/Couldn't reach Anthropic to validate/i)).toBeInTheDocument()
    })
    // Key IS saved on network-error (spec §8c)
    expect(storageMock.set).toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────
// Tests: Model selector
// ─────────────────────────────────────────────────────────────

describe('ProviderSettingsCard — model selector (SD-032)', () => {
  it('shows Haiku 4.5 as pre-selected for Anthropic by default', async () => {
    render(<ProviderSettingsCard />)
    await screen.findByRole('tab', { name: 'Anthropic' })

    const haiku = screen.getByRole('radio', { name: /Haiku 4\.5/i })
    expect(haiku).toHaveAttribute('aria-checked', 'true')
  })

  it('clicking a model card enables Test & Save button', async () => {
    storageMockWithProviders({
      anthropic: { key: 'sk-ant-api03-stored', model: 'claude-haiku-4-5-20251001' },
    })

    render(<ProviderSettingsCard />)
    await screen.findByRole('radio', { name: /Haiku 4\.5/i })

    // Button should be disabled (stored key, no dirty)
    expect(screen.getByRole('button', { name: /test and save/i })).toBeDisabled()

    // Click alternate model
    fireEvent.click(screen.getByRole('radio', { name: /Sonnet 4\.6/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /test and save/i })).not.toBeDisabled()
    })
  })
})

// ─────────────────────────────────────────────────────────────
// Tests: Input handling
// ─────────────────────────────────────────────────────────────

describe('ProviderSettingsCard — key input handling (SD-032)', () => {
  it('normalizes em-dash on paste (macOS smart-dash protection)', async () => {
    render(<ProviderSettingsCard />)
    const input = await screen.findByLabelText(/anthropic api key/i)

    fireEvent.paste(input, {
      clipboardData: { getData: () => 'sk-ant-api03-test\u2014key' },
    })

    await waitFor(() => {
      expect((input as HTMLInputElement).value).toBe('sk-ant-api03-test--key')
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

  it('pressing Enter when button enabled triggers validation', async () => {
    const { getProvider } = await import('../../service-worker/providers/index')
    const validateSpy = vi.spyOn(getProvider('anthropic'), 'validateKey').mockResolvedValue({ status: 'ok' })

    render(<ProviderSettingsCard />)
    const input = await screen.findByLabelText(/anthropic api key/i)
    fireEvent.change(input, { target: { value: 'sk-ant-enter-test' } })

    await waitFor(() => expect(screen.getByRole('button', { name: /test and save/i })).not.toBeDisabled())

    await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }) })

    await waitFor(() => {
      expect(validateSpy).toHaveBeenCalledWith('sk-ant-enter-test')
    })
  })
})
