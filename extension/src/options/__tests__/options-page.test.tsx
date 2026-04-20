import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import ApiKeyCard from '../api-key-card'
import * as validateModule from '../validate-api-key'

// Extend chrome mock with storage.local
const storageMock = {
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
  storageMock.get.mockImplementation((_key: string, cb: (result: Record<string, unknown>) => void) => {
    cb({})
  })
  storageMock.set.mockImplementation((_data: Record<string, unknown>, cb?: () => void) => {
    if (cb) cb()
  })
  storageMock.remove.mockImplementation((_key: string, cb?: () => void) => {
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

describe('ApiKeyCard', () => {
  it('button is disabled when input is empty (no stored key)', async () => {
    render(<ApiKeyCard />)
    const button = await screen.findByRole('button', { name: /test and save/i })
    expect(button).toBeDisabled()
  })

  it('enables button when user types in the input', async () => {
    render(<ApiKeyCard />)
    const input = screen.getByLabelText(/anthropic api key/i)
    const button = screen.getByRole('button', { name: /test and save/i })

    fireEvent.change(input, { target: { value: 'sk-ant-test-key' } })

    await waitFor(() => expect(button).not.toBeDisabled())
  })

  it('shows loading state while validating', async () => {
    let resolveValidation!: (value: validateModule.ApiKeyTestResult) => void
    vi.spyOn(validateModule, 'validateApiKey').mockReturnValue(
      new Promise<validateModule.ApiKeyTestResult>((resolve) => { resolveValidation = resolve })
    )

    render(<ApiKeyCard />)
    const input = screen.getByLabelText(/anthropic api key/i)
    const button = screen.getByRole('button', { name: /test and save/i })

    fireEvent.change(input, { target: { value: 'sk-ant-test' } })
    await waitFor(() => expect(button).not.toBeDisabled())

    await act(async () => {
      fireEvent.click(button)
    })

    expect(screen.getByText('Validating…')).toBeInTheDocument()
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')

    await act(async () => { resolveValidation({ status: 'ok' }) })
  })

  it('shows success feedback and writes to storage on HTTP 200', async () => {
    vi.spyOn(validateModule, 'validateApiKey').mockResolvedValue({ status: 'ok' })

    render(<ApiKeyCard />)
    const input = screen.getByLabelText(/anthropic api key/i)
    fireEvent.change(input, { target: { value: 'sk-ant-valid' } })

    const button = screen.getByRole('button', { name: /test and save/i })
    await waitFor(() => expect(button).not.toBeDisabled())

    await act(async () => { fireEvent.click(button) })

    await waitFor(() => {
      expect(screen.getByText(/Key saved\. Layer 2 analysis is now active\./i)).toBeInTheDocument()
    })
    expect(storageMock.set).toHaveBeenCalledWith(
      expect.objectContaining({ anthropicApiKey: 'sk-ant-valid' }),
      expect.anything(),
    )
  })

  it('shows error feedback on 401 and does NOT write to storage', async () => {
    vi.spyOn(validateModule, 'validateApiKey').mockResolvedValue({ status: 'invalid', code: 401 })

    render(<ApiKeyCard />)
    const input = screen.getByLabelText(/anthropic api key/i)
    fireEvent.change(input, { target: { value: 'sk-ant-bad' } })

    const button = screen.getByRole('button', { name: /test and save/i })
    await waitFor(() => expect(button).not.toBeDisabled())

    await act(async () => { fireEvent.click(button) })

    await waitFor(() => {
      expect(screen.getByText(/Invalid key/i)).toBeInTheDocument()
    })
    expect(storageMock.set).not.toHaveBeenCalled()
  })

  it('shows warning and writes to storage on reachable-unverified (e.g. 429)', async () => {
    vi.spyOn(validateModule, 'validateApiKey').mockResolvedValue({ status: 'reachable-unverified' })

    render(<ApiKeyCard />)
    const input = screen.getByLabelText(/anthropic api key/i)
    fireEvent.change(input, { target: { value: 'sk-ant-maybe' } })

    const button = screen.getByRole('button', { name: /test and save/i })
    await waitFor(() => expect(button).not.toBeDisabled())

    await act(async () => { fireEvent.click(button) })

    await waitFor(() => {
      expect(screen.getByText(/Couldn't reach Anthropic/i)).toBeInTheDocument()
    })
    expect(storageMock.set).toHaveBeenCalledWith(
      expect.objectContaining({ anthropicApiKey: 'sk-ant-maybe' }),
      expect.anything(),
    )
  })

  it('shows warning and does NOT write to storage on true network error', async () => {
    vi.spyOn(validateModule, 'validateApiKey').mockResolvedValue({ status: 'network-error' })

    render(<ApiKeyCard />)
    const input = screen.getByLabelText(/anthropic api key/i)
    fireEvent.change(input, { target: { value: 'sk-ant-offline' } })

    const button = screen.getByRole('button', { name: /test and save/i })
    await waitFor(() => expect(button).not.toBeDisabled())

    await act(async () => { fireEvent.click(button) })

    await waitFor(() => {
      expect(screen.getByText(/Couldn't reach Anthropic/i)).toBeInTheDocument()
    })
    expect(storageMock.set).not.toHaveBeenCalled()
  })

  it('displays masked key when a key is already stored', async () => {
    storageMock.get.mockImplementation((_key: string, cb: (result: Record<string, unknown>) => void) => {
      cb({ anthropicApiKey: 'sk-ant-api03-realkey1234' })
    })

    render(<ApiKeyCard />)

    await waitFor(() => {
      const input = screen.getByLabelText(/anthropic api key/i) as HTMLInputElement
      expect(input.value).toMatch(/^sk-ant-api03-/)
      expect(input.value).toContain('•')
    })
  })

  it('normalizes em-dash to -- on paste so macOS smart-dashes cannot corrupt the key', async () => {
    vi.spyOn(validateModule, 'validateApiKey').mockResolvedValue({ status: 'ok' })

    render(<ApiKeyCard />)
    const input = screen.getByLabelText(/anthropic api key/i)

    fireEvent.paste(input, {
      clipboardData: { getData: () => 'sk-ant-api03-test\u2014VDtN' },
    })

    await waitFor(() => {
      expect((input as HTMLInputElement).value).toBe('sk-ant-api03-test--VDtN')
    })
  })

  it('strips non-ASCII characters on paste', async () => {
    vi.spyOn(validateModule, 'validateApiKey').mockResolvedValue({ status: 'ok' })

    render(<ApiKeyCard />)
    const input = screen.getByLabelText(/anthropic api key/i)

    fireEvent.paste(input, {
      clipboardData: { getData: () => 'sk-ant-\u200B\u00A0test' },
    })

    await waitFor(() => {
      expect((input as HTMLInputElement).value).toBe('sk-ant-test')
    })
  })

  it('button stays disabled until user modifies the masked stored key', async () => {
    storageMock.get.mockImplementation((_key: string, cb: (result: Record<string, unknown>) => void) => {
      cb({ anthropicApiKey: 'sk-ant-api03-realkey1234' })
    })

    render(<ApiKeyCard />)

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

  describe('Remove key', () => {
    it('hides the Remove key button when no key is stored', async () => {
      render(<ApiKeyCard />)
      await screen.findByRole('button', { name: /test and save/i })
      expect(screen.queryByRole('button', { name: /remove key/i })).not.toBeInTheDocument()
    })

    it('shows the Remove key button when a key is stored and input is untouched', async () => {
      storageMock.get.mockImplementation((_key: string, cb: (result: Record<string, unknown>) => void) => {
        cb({ anthropicApiKey: 'sk-ant-api03-stored' })
      })

      render(<ApiKeyCard />)

      await screen.findByRole('button', { name: /remove key/i })
    })

    it('hides the Remove key button while the input is dirty', async () => {
      storageMock.get.mockImplementation((_key: string, cb: (result: Record<string, unknown>) => void) => {
        cb({ anthropicApiKey: 'sk-ant-api03-stored' })
      })

      render(<ApiKeyCard />)
      await screen.findByRole('button', { name: /remove key/i })

      const input = screen.getByLabelText(/anthropic api key/i)
      fireEvent.change(input, { target: { value: 'sk-ant-api03-new' } })

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /remove key/i })).not.toBeInTheDocument()
      })
    })

    it('does nothing if the user cancels the confirm dialog', async () => {
      storageMock.get.mockImplementation((_key: string, cb: (result: Record<string, unknown>) => void) => {
        cb({ anthropicApiKey: 'sk-ant-api03-stored' })
      })
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

      render(<ApiKeyCard />)
      const removeBtn = await screen.findByRole('button', { name: /remove key/i })

      await act(async () => { fireEvent.click(removeBtn) })

      expect(confirmSpy).toHaveBeenCalledOnce()
      expect(storageMock.remove).not.toHaveBeenCalled()
      expect(screen.getByRole('button', { name: /remove key/i })).toBeInTheDocument()

      confirmSpy.mockRestore()
    })

    it('clears the stored key and resets the UI when confirmed', async () => {
      storageMock.get.mockImplementation((_key: string, cb: (result: Record<string, unknown>) => void) => {
        cb({ anthropicApiKey: 'sk-ant-api03-stored' })
      })
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

      render(<ApiKeyCard />)
      const removeBtn = await screen.findByRole('button', { name: /remove key/i })

      await act(async () => { fireEvent.click(removeBtn) })

      expect(storageMock.remove).toHaveBeenCalledWith('anthropicApiKey', expect.any(Function))

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /remove key/i })).not.toBeInTheDocument()
      })

      const input = screen.getByLabelText(/anthropic api key/i) as HTMLInputElement
      expect(input.value).toBe('')

      const saveBtn = screen.getByRole('button', { name: /test and save/i })
      expect(saveBtn).toBeDisabled()

      confirmSpy.mockRestore()
    })
  })
})
