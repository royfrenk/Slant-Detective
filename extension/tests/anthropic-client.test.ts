import { describe, it, expect, vi, beforeEach } from 'vitest'
import { callAnthropicMessages, AnthropicApiError } from '../src/service-worker/anthropic-client'
import type { AnthropicRequestBody } from '../src/service-worker/anthropic-client'

const MINIMAL_BODY: AnthropicRequestBody = {
  model: 'claude-3-5-haiku-20241022',
  max_tokens: 10,
  messages: [{ role: 'user', content: 'Hello' }],
}

const VALID_RESPONSE = {
  content: [{ type: 'text' as const, text: '{"ok":true}' }],
}

function makeResponse(status: number, body: unknown = null): Response {
  return new Response(
    body !== null ? JSON.stringify(body) : null,
    { status },
  )
}

describe('callAnthropicMessages', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('calls the correct URL', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(makeResponse(200, VALID_RESPONSE))
    vi.stubGlobal('fetch', fetchSpy)

    await callAnthropicMessages('sk-ant-test', MINIMAL_BODY)

    expect(fetchSpy).toHaveBeenCalledOnce()
    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
  })

  it('sends x-api-key header with the provided key', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(makeResponse(200, VALID_RESPONSE))
    vi.stubGlobal('fetch', fetchSpy)

    await callAnthropicMessages('sk-ant-mykey', MINIMAL_BODY)

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers['x-api-key']).toBe('sk-ant-mykey')
  })

  it('sends anthropic-version header', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(makeResponse(200, VALID_RESPONSE))
    vi.stubGlobal('fetch', fetchSpy)

    await callAnthropicMessages('sk-ant-test', MINIMAL_BODY)

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers['anthropic-version']).toBe('2023-06-01')
  })

  it('returns parsed JSON response body on HTTP 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse(200, VALID_RESPONSE)))

    const result = await callAnthropicMessages('sk-ant-test', MINIMAL_BODY)

    expect(result).toEqual(VALID_RESPONSE)
  })

  it('throws AnthropicApiError with statusCode 401 on HTTP 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse(401, 'Unauthorized')))

    await expect(callAnthropicMessages('sk-ant-bad', MINIMAL_BODY)).rejects.toThrow(AnthropicApiError)

    try {
      await callAnthropicMessages('sk-ant-bad', MINIMAL_BODY)
    } catch (err) {
      expect(err).toBeInstanceOf(AnthropicApiError)
      expect((err as AnthropicApiError).statusCode).toBe(401)
    }
  })

  it('throws AnthropicApiError with statusCode 403 on HTTP 403', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse(403, 'Forbidden')))

    let caught: AnthropicApiError | undefined
    try {
      await callAnthropicMessages('sk-ant-revoked', MINIMAL_BODY)
    } catch (err) {
      caught = err as AnthropicApiError
    }

    expect(caught).toBeInstanceOf(AnthropicApiError)
    expect(caught?.statusCode).toBe(403)
  })

  it('throws AnthropicApiError with statusCode 429 on HTTP 429', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse(429, 'Rate limited')))

    let caught: AnthropicApiError | undefined
    try {
      await callAnthropicMessages('sk-ant-test', MINIMAL_BODY)
    } catch (err) {
      caught = err as AnthropicApiError
    }

    expect(caught).toBeInstanceOf(AnthropicApiError)
    expect(caught?.statusCode).toBe(429)
  })

  it('propagates network errors (TypeError) without wrapping', async () => {
    const networkError = new TypeError('Failed to fetch')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(networkError))

    await expect(callAnthropicMessages('sk-ant-test', MINIMAL_BODY)).rejects.toBe(networkError)
  })

  it('sends POST method with JSON body', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(makeResponse(200, VALID_RESPONSE))
    vi.stubGlobal('fetch', fetchSpy)

    await callAnthropicMessages('sk-ant-test', MINIMAL_BODY)

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual(MINIMAL_BODY)
  })
})
