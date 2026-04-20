import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AnthropicProvider } from '../anthropic'
import { ProviderApiError } from '../types'

const provider = new AnthropicProvider()

function makeResponse(status: number, body: unknown = null): Response {
  return new Response(
    body !== null ? JSON.stringify(body) : null,
    { status },
  )
}

const VALID_ANTHROPIC_RESPONSE = {
  content: [{ type: 'text' as const, text: '{"ok":true}' }],
}

// ---------------------------------------------------------------------------
// validateKey
// ---------------------------------------------------------------------------

describe('AnthropicProvider.validateKey', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns { status: ok } on HTTP 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse(200, {})))
    const result = await provider.validateKey('sk-ant-valid')
    expect(result).toEqual({ status: 'ok' })
  })

  it('returns { status: invalid, code: 401 } on HTTP 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse(401, 'Unauthorized')))
    const result = await provider.validateKey('sk-ant-bad')
    expect(result).toEqual({ status: 'invalid', code: 401 })
  })

  it('returns { status: invalid, code: 403 } on HTTP 403', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse(403, 'Forbidden')))
    const result = await provider.validateKey('sk-ant-revoked')
    expect(result).toEqual({ status: 'invalid', code: 403 })
  })

  it('returns { status: reachable-unverified } on HTTP 429', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse(429, 'Rate limited')))
    const result = await provider.validateKey('sk-ant-test')
    expect(result).toEqual({ status: 'reachable-unverified' })
  })

  it('returns { status: network-error } on TypeError (network failure)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const result = await provider.validateKey('sk-ant-test')
    expect(result).toEqual({ status: 'network-error' })
  })
})

// ---------------------------------------------------------------------------
// complete
// ---------------------------------------------------------------------------

describe('AnthropicProvider.complete', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('calls the correct Anthropic messages URL', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(makeResponse(200, VALID_ANTHROPIC_RESPONSE))
    vi.stubGlobal('fetch', fetchSpy)

    await provider.complete(
      { system: 'sys', user: 'usr', model: 'claude-haiku-4-5-20251001', maxTokens: 10 },
      'sk-ant-test',
    )

    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
  })

  it('sends x-api-key header (NOT Authorization: Bearer)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(makeResponse(200, VALID_ANTHROPIC_RESPONSE))
    vi.stubGlobal('fetch', fetchSpy)

    await provider.complete(
      { system: 'sys', user: 'usr', model: 'claude-haiku-4-5-20251001', maxTokens: 10 },
      'sk-ant-mykey',
    )

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers['x-api-key']).toBe('sk-ant-mykey')
    expect(headers['Authorization']).toBeUndefined()
  })

  it('sends anthropic-version header', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(makeResponse(200, VALID_ANTHROPIC_RESPONSE))
    vi.stubGlobal('fetch', fetchSpy)

    await provider.complete(
      { system: 'sys', user: 'usr', model: 'claude-haiku-4-5-20251001', maxTokens: 10 },
      'sk-ant-test',
    )

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers['anthropic-version']).toBe('2023-06-01')
  })

  it('throws ProviderApiError on non-200 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse(401, 'Unauthorized')))

    await expect(
      provider.complete(
        { system: 'sys', user: 'usr', model: 'claude-haiku-4-5-20251001', maxTokens: 10 },
        'sk-ant-bad',
      ),
    ).rejects.toThrow(ProviderApiError)
  })

  it('ProviderApiError carries the HTTP status code', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse(429, 'Rate limited')))

    let caught: ProviderApiError | undefined
    try {
      await provider.complete(
        { system: 'sys', user: 'usr', model: 'claude-haiku-4-5-20251001', maxTokens: 10 },
        'sk-ant-test',
      )
    } catch (err) {
      caught = err as ProviderApiError
    }

    expect(caught).toBeInstanceOf(ProviderApiError)
    expect(caught?.statusCode).toBe(429)
  })

  it('sends POST method with JSON body', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(makeResponse(200, VALID_ANTHROPIC_RESPONSE))
    vi.stubGlobal('fetch', fetchSpy)

    await provider.complete(
      { system: 'sys', user: 'usr', model: 'claude-haiku-4-5-20251001', maxTokens: 10 },
      'sk-ant-test',
    )

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('POST')
    const parsed = JSON.parse(init.body as string) as Record<string, unknown>
    expect(parsed['model']).toBe('claude-haiku-4-5-20251001')
    expect(parsed['system']).toBe('sys')
  })

  it('propagates network errors (TypeError) without wrapping', async () => {
    const networkError = new TypeError('Failed to fetch')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(networkError))

    await expect(
      provider.complete(
        { system: 'sys', user: 'usr', model: 'claude-haiku-4-5-20251001', maxTokens: 10 },
        'sk-ant-test',
      ),
    ).rejects.toBe(networkError)
  })
})

// ---------------------------------------------------------------------------
// extractText
// ---------------------------------------------------------------------------

describe('AnthropicProvider.extractText', () => {
  it('returns the text from the first content item', () => {
    const response = { content: [{ type: 'text', text: 'hello world' }] }
    expect(provider.extractText(response)).toBe('hello world')
  })

  it('returns empty string when content array is empty', () => {
    const response = { content: [] }
    expect(provider.extractText(response)).toBe('')
  })
})

// ---------------------------------------------------------------------------
// Provider metadata
// ---------------------------------------------------------------------------

describe('AnthropicProvider metadata', () => {
  it('has id = "anthropic"', () => {
    expect(provider.id).toBe('anthropic')
  })

  it('has claude-haiku-4-5-20251001 as first modelId (default)', () => {
    expect(provider.modelIds[0]).toBe('claude-haiku-4-5-20251001')
  })
})
