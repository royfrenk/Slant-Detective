import { describe, it, expect, vi, beforeEach } from 'vitest'
import { validateApiKey } from '../validate-api-key'

function makeResponse(status: number): Response {
  return new Response(null, { status })
}

describe('validateApiKey', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns { status: "ok" } on HTTP 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse(200)))

    const result = await validateApiKey('sk-ant-test')

    expect(result).toEqual({ status: 'ok' })
  })

  it('returns { status: "invalid", code: 401 } on HTTP 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse(401)))

    const result = await validateApiKey('sk-ant-bad')

    expect(result).toEqual({ status: 'invalid', code: 401 })
  })

  it('returns { status: "invalid", code: 403 } on HTTP 403', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse(403)))

    const result = await validateApiKey('sk-ant-revoked')

    expect(result).toEqual({ status: 'invalid', code: 403 })
  })

  it('returns { status: "network-error" } when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    const result = await validateApiKey('sk-ant-test')

    expect(result).toEqual({ status: 'network-error' })
  })

  it('returns { status: "reachable-unverified" } on HTTP 500', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse(500)))

    const result = await validateApiKey('sk-ant-test')

    expect(result).toEqual({ status: 'reachable-unverified' })
  })

  it('returns { status: "reachable-unverified" } on HTTP 429', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse(429)))

    const result = await validateApiKey('sk-ant-test')

    expect(result).toEqual({ status: 'reachable-unverified' })
  })

  it('sends correct URL and headers', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(makeResponse(200))
    vi.stubGlobal('fetch', fetchSpy)

    await validateApiKey('sk-ant-testkey')

    expect(fetchSpy).toHaveBeenCalledOnce()
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    const headers = init.headers as Record<string, string>
    expect(headers['x-api-key']).toBe('sk-ant-testkey')
    expect(headers['anthropic-version']).toBe('2023-06-01')
    expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true')
  })

  it('sends correct body with max_tokens: 1 and correct model', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(makeResponse(200))
    vi.stubGlobal('fetch', fetchSpy)

    await validateApiKey('sk-ant-testkey')

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string) as Record<string, unknown>
    expect(body['max_tokens']).toBe(1)
    expect(body['model']).toBe('claude-haiku-4-5-20251001')
  })
})
