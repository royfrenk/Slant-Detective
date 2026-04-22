import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GeminiProvider, GeminiSafetyError } from '../gemini'
import { ProviderApiError } from '../types'

const provider = new GeminiProvider()

function makeResponse(status: number, body: unknown = null): Response {
  return new Response(
    body !== null ? JSON.stringify(body) : null,
    { status },
  )
}

const VALID_GEMINI_RESPONSE = {
  candidates: [
    {
      content: { parts: [{ text: '{"ok":true}' }] },
      finishReason: 'STOP',
    },
  ],
}

// ---------------------------------------------------------------------------
// validateKey
// ---------------------------------------------------------------------------

describe('GeminiProvider.validateKey', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns { status: ok } on HTTP 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse(200, VALID_GEMINI_RESPONSE)))
    const result = await provider.validateKey('AIzaValidKey')
    expect(result).toEqual({ status: 'ok' })
  })

  it('returns { status: invalid, code: 400 } on HTTP 400 with "API key not valid" body', async () => {
    const body = { error: { code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT' } }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse(400, body)))
    const result = await provider.validateKey('AIzaInvalid')
    expect(result).toEqual({ status: 'invalid', code: 400 })
  })

  it('returns { status: invalid, code: 403 } on HTTP 403', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse(403, { error: { message: 'Forbidden' } })))
    const result = await provider.validateKey('AIzaRevoked')
    expect(result).toEqual({ status: 'invalid', code: 403 })
  })

  it('returns { status: network-error } on TypeError (network failure)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const result = await provider.validateKey('AIzaTest')
    expect(result).toEqual({ status: 'network-error' })
  })

  it('returns { status: reachable-unverified } on HTTP 429', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse(429, { error: { message: 'Rate limited' } })))
    const result = await provider.validateKey('AIzaTest')
    expect(result).toEqual({ status: 'reachable-unverified' })
  })
})

// ---------------------------------------------------------------------------
// complete
// ---------------------------------------------------------------------------

describe('GeminiProvider.complete', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('builds URL without ?key= query param (key is in header only)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(makeResponse(200, VALID_GEMINI_RESPONSE))
    vi.stubGlobal('fetch', fetchSpy)

    await provider.complete(
      { system: 'sys', user: 'usr', model: 'gemini-2.5-flash', maxTokens: 10 },
      'AIzaTestKey',
    )

    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).not.toContain('?key=')
    expect(url).not.toContain('AIzaTestKey')
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent')
  })

  it('sends x-goog-api-key header with the API key', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(makeResponse(200, VALID_GEMINI_RESPONSE))
    vi.stubGlobal('fetch', fetchSpy)

    await provider.complete(
      { system: 'sys', user: 'usr', model: 'gemini-2.5-flash', maxTokens: 10 },
      'AIzaMySecretKey',
    )

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers['x-goog-api-key']).toBe('AIzaMySecretKey')
    expect(headers['Authorization']).toBeUndefined()
  })

  it('sends systemInstruction in request body (NOT inside contents)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(makeResponse(200, VALID_GEMINI_RESPONSE))
    vi.stubGlobal('fetch', fetchSpy)

    await provider.complete(
      { system: 'analyst instructions', user: 'article body', model: 'gemini-2.5-flash', maxTokens: 10 },
      'AIzaTest',
    )

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string) as Record<string, unknown>

    // systemInstruction at top level with parts array
    expect(body['systemInstruction']).toEqual({ parts: [{ text: 'analyst instructions' }] })

    // contents array should only have user role — NOT the system text
    const contents = body['contents'] as Array<{ role: string; parts: Array<{ text: string }> }>
    expect(contents).toHaveLength(1)
    expect(contents[0].role).toBe('user')
    expect(contents[0].parts[0].text).toBe('article body')
    expect(JSON.stringify(contents)).not.toContain('analyst instructions')
  })

  it('sends safetySettings with BLOCK_ONLY_HIGH for all 4 harm categories', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(makeResponse(200, VALID_GEMINI_RESPONSE))
    vi.stubGlobal('fetch', fetchSpy)

    await provider.complete(
      { system: 'sys', user: 'usr', model: 'gemini-2.5-flash', maxTokens: 10 },
      'AIzaTest',
    )

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string) as Record<string, unknown>
    const settings = body['safetySettings'] as Array<{ category: string; threshold: string }>

    expect(settings).toHaveLength(4)
    const categories = settings.map((s) => s.category)
    expect(categories).toContain('HARM_CATEGORY_HARASSMENT')
    expect(categories).toContain('HARM_CATEGORY_HATE_SPEECH')
    expect(categories).toContain('HARM_CATEGORY_SEXUALLY_EXPLICIT')
    expect(categories).toContain('HARM_CATEGORY_DANGEROUS_CONTENT')
    settings.forEach((s) => {
      expect(s.threshold).toBe('BLOCK_ONLY_HIGH')
    })
  })

  it('sends generationConfig.responseMimeType: "application/json"', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(makeResponse(200, VALID_GEMINI_RESPONSE))
    vi.stubGlobal('fetch', fetchSpy)

    await provider.complete(
      { system: 'sys', user: 'usr', model: 'gemini-2.5-flash', maxTokens: 10 },
      'AIzaTest',
    )

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string) as Record<string, unknown>
    const config = body['generationConfig'] as Record<string, unknown>
    expect(config['responseMimeType']).toBe('application/json')
  })

  it('throws GeminiSafetyError when finishReason is SAFETY (candidate-level block)', async () => {
    const safetyResponse = {
      candidates: [{ finishReason: 'SAFETY', safetyRatings: [] }],
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse(200, safetyResponse)))

    await expect(
      provider.complete(
        { system: 'sys', user: 'usr', model: 'gemini-2.5-flash', maxTokens: 10 },
        'AIzaTest',
      ),
    ).rejects.toBeInstanceOf(GeminiSafetyError)
  })

  it('throws GeminiSafetyError when promptFeedback.blockReason is SAFETY (prompt-level block, no candidates)', async () => {
    const promptBlockResponse = {
      candidates: [],
      promptFeedback: { blockReason: 'SAFETY' },
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse(200, promptBlockResponse)))

    await expect(
      provider.complete(
        { system: 'sys', user: 'usr', model: 'gemini-2.5-flash', maxTokens: 10 },
        'AIzaTest',
      ),
    ).rejects.toBeInstanceOf(GeminiSafetyError)
  })

  it('throws ProviderApiError on non-200 HTTP response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse(500, { error: { message: 'Server error' } })))

    await expect(
      provider.complete(
        { system: 'sys', user: 'usr', model: 'gemini-2.5-flash', maxTokens: 10 },
        'AIzaTest',
      ),
    ).rejects.toThrow(ProviderApiError)
  })

  it('ProviderApiError carries the HTTP status code', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse(429, { error: { message: 'Rate limited' } })))

    let caught: ProviderApiError | undefined
    try {
      await provider.complete(
        { system: 'sys', user: 'usr', model: 'gemini-2.5-flash', maxTokens: 10 },
        'AIzaTest',
      )
    } catch (err) {
      caught = err as ProviderApiError
    }

    expect(caught).toBeInstanceOf(ProviderApiError)
    expect(caught?.statusCode).toBe(429)
  })

  it('has AbortSignal.timeout(30_000) on the fetch call', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(makeResponse(200, VALID_GEMINI_RESPONSE))
    vi.stubGlobal('fetch', fetchSpy)
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout')

    await provider.complete(
      { system: 'sys', user: 'usr', model: 'gemini-2.5-flash', maxTokens: 10 },
      'AIzaTest',
    )

    expect(timeoutSpy).toHaveBeenCalledWith(30_000)
  })
})

// ---------------------------------------------------------------------------
// extractText
// ---------------------------------------------------------------------------

describe('GeminiProvider.extractText', () => {
  it('returns candidates[0].content.parts[0].text', () => {
    const response = {
      candidates: [
        { content: { parts: [{ text: 'hello world' }] }, finishReason: 'STOP' },
      ],
    }
    expect(provider.extractText(response)).toBe('hello world')
  })

  it('returns empty string when candidates array is empty', () => {
    const response = { candidates: [] }
    expect(provider.extractText(response)).toBe('')
  })

  it('returns empty string when candidates is undefined', () => {
    const response = { promptFeedback: { blockReason: 'OTHER' } }
    expect(provider.extractText(response)).toBe('')
  })
})

// ---------------------------------------------------------------------------
// Provider metadata
// ---------------------------------------------------------------------------

describe('GeminiProvider metadata', () => {
  it('has id = "gemini"', () => {
    expect(provider.id).toBe('gemini')
  })

  it('has gemini-2.5-flash as first modelId (default)', () => {
    expect(provider.modelIds[0]).toBe('gemini-2.5-flash')
  })

  it('has gemini-2.5-pro as second modelId', () => {
    expect(provider.modelIds[1]).toBe('gemini-2.5-pro')
  })
})
