import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OpenAIProvider } from '../openai'
import { ProviderApiError } from '../types'

const provider = new OpenAIProvider()

function makeResponse(status: number, body: unknown = null): Response {
  return new Response(
    body !== null ? JSON.stringify(body) : null,
    { status },
  )
}

const VALID_OPENAI_RESPONSE = {
  choices: [{ message: { content: '{"ok":true}' } }],
}

// ---------------------------------------------------------------------------
// validateKey
// ---------------------------------------------------------------------------

describe('OpenAIProvider.validateKey', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns { status: ok } on HTTP 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse(200, VALID_OPENAI_RESPONSE)))
    const result = await provider.validateKey('sk-proj-valid')
    expect(result).toEqual({ status: 'ok' })
  })

  it('returns { status: invalid, code: 401 } on HTTP 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse(401, 'Unauthorized')))
    const result = await provider.validateKey('sk-fake')
    expect(result).toEqual({ status: 'invalid', code: 401 })
  })

  it('returns { status: invalid, code: 403 } on HTTP 403', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse(403, 'Forbidden')))
    const result = await provider.validateKey('sk-revoked')
    expect(result).toEqual({ status: 'invalid', code: 403 })
  })

  it('returns { status: reachable-unverified } on HTTP 429', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse(429, 'Rate limited')))
    const result = await provider.validateKey('sk-proj-test')
    expect(result).toEqual({ status: 'reachable-unverified' })
  })

  it('returns { status: network-error } on TypeError (network failure)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const result = await provider.validateKey('sk-proj-test')
    expect(result).toEqual({ status: 'network-error' })
  })
})

// ---------------------------------------------------------------------------
// complete
// ---------------------------------------------------------------------------

describe('OpenAIProvider.complete', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('calls the correct OpenAI chat completions URL', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(makeResponse(200, VALID_OPENAI_RESPONSE))
    vi.stubGlobal('fetch', fetchSpy)

    await provider.complete(
      { system: 'sys', user: 'usr', model: 'gpt-5-mini', maxTokens: 10 },
      'sk-proj-test',
    )

    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.openai.com/v1/chat/completions')
  })

  it('sends Authorization: Bearer header (NOT x-api-key)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(makeResponse(200, VALID_OPENAI_RESPONSE))
    vi.stubGlobal('fetch', fetchSpy)

    await provider.complete(
      { system: 'sys', user: 'usr', model: 'gpt-5-mini', maxTokens: 10 },
      'sk-proj-mykey',
    )

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer sk-proj-mykey')
    expect(headers['x-api-key']).toBeUndefined()
  })

  it('sends response_format: { type: "json_object" } in body', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(makeResponse(200, VALID_OPENAI_RESPONSE))
    vi.stubGlobal('fetch', fetchSpy)

    await provider.complete(
      { system: 'sys', user: 'usr', model: 'gpt-5-mini', maxTokens: 10 },
      'sk-proj-test',
    )

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string) as Record<string, unknown>
    expect(body['response_format']).toEqual({ type: 'json_object' })
  })

  it('sends messages with system and user roles', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(makeResponse(200, VALID_OPENAI_RESPONSE))
    vi.stubGlobal('fetch', fetchSpy)

    await provider.complete(
      { system: 'system content', user: 'user content', model: 'gpt-5-mini', maxTokens: 10 },
      'sk-proj-test',
    )

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string) as Record<string, unknown>
    const messages = body['messages'] as Array<{ role: string; content: string }>
    expect(messages[0]).toEqual({ role: 'system', content: 'system content' })
    expect(messages[1]).toEqual({ role: 'user', content: 'user content' })
  })

  it('uses max_completion_tokens (not max_tokens) for gpt-5+ model compatibility', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(makeResponse(200, VALID_OPENAI_RESPONSE))
    vi.stubGlobal('fetch', fetchSpy)

    await provider.complete(
      { system: 'sys', user: 'usr', model: 'gpt-5-mini', maxTokens: 2048 },
      'sk-proj-test',
    )

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string) as Record<string, unknown>
    expect(body['max_completion_tokens']).toBe(2048)
    expect(body['max_tokens']).toBeUndefined()
  })

  it('uses the model from input (not a hardcoded constant)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(makeResponse(200, VALID_OPENAI_RESPONSE))
    vi.stubGlobal('fetch', fetchSpy)

    await provider.complete(
      { system: 'sys', user: 'usr', model: 'gpt-5', maxTokens: 10 },
      'sk-proj-test',
    )

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string) as Record<string, unknown>
    expect(body['model']).toBe('gpt-5')
  })

  it('throws ProviderApiError on non-200 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse(401, 'Unauthorized')))

    await expect(
      provider.complete(
        { system: 'sys', user: 'usr', model: 'gpt-5-mini', maxTokens: 10 },
        'sk-fake',
      ),
    ).rejects.toThrow(ProviderApiError)
  })

  it('ProviderApiError carries the HTTP status code', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse(429, 'Rate limited')))

    let caught: ProviderApiError | undefined
    try {
      await provider.complete(
        { system: 'sys', user: 'usr', model: 'gpt-5-mini', maxTokens: 10 },
        'sk-proj-test',
      )
    } catch (err) {
      caught = err as ProviderApiError
    }

    expect(caught).toBeInstanceOf(ProviderApiError)
    expect(caught?.statusCode).toBe(429)
  })

  it('has AbortSignal.timeout(45_000) on the fetch call', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(makeResponse(200, VALID_OPENAI_RESPONSE))
    vi.stubGlobal('fetch', fetchSpy)
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout')

    await provider.complete(
      { system: 'sys', user: 'usr', model: 'gpt-5-mini', maxTokens: 10 },
      'sk-proj-test',
    )

    expect(timeoutSpy).toHaveBeenCalledWith(45_000)
  })

  it('propagates network errors (TypeError) without wrapping', async () => {
    const networkError = new TypeError('Failed to fetch')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(networkError))

    await expect(
      provider.complete(
        { system: 'sys', user: 'usr', model: 'gpt-5-mini', maxTokens: 10 },
        'sk-proj-test',
      ),
    ).rejects.toBe(networkError)
  })
})

// ---------------------------------------------------------------------------
// extractText
// ---------------------------------------------------------------------------

describe('OpenAIProvider.extractText', () => {
  it('returns choices[0].message.content', () => {
    const response = { choices: [{ message: { content: 'hello world' } }] }
    expect(provider.extractText(response)).toBe('hello world')
  })

  it('returns empty string when choices array is empty', () => {
    const response = { choices: [] }
    expect(provider.extractText(response)).toBe('')
  })
})

// ---------------------------------------------------------------------------
// Provider metadata
// ---------------------------------------------------------------------------

describe('OpenAIProvider metadata', () => {
  it('has id = "openai"', () => {
    expect(provider.id).toBe('openai')
  })

  it('has gpt-5-mini as first modelId (default)', () => {
    expect(provider.modelIds[0]).toBe('gpt-5-mini')
  })

  it('has gpt-5 as second modelId', () => {
    expect(provider.modelIds[1]).toBe('gpt-5')
  })
})
