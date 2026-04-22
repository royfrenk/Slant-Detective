/**
 * SD-041: Unit tests for emitScoreSample telemetry function.
 *
 * Tests the toggle gate, eTLD+1 derivation, payload structure,
 * and silent no-op behaviour. Does not hit the real Worker.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { emitScoreSample } from '../telemetry'
import { TELEMETRY_ENABLED } from '../../shared/storage-keys'
import { TELEMETRY_SCORE_SAMPLE_URL } from '../../shared/telemetry-constants'

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_PARAMS = {
  pageUrl: 'https://www.nytimes.com/article/foo',
  overall: 7,
  word_choice: 4,
  framing: 6,
  headline_slant: 5,
  source_mix: 3,
  direction: 'right' as const,
  provider: 'anthropic',
  rubric_version: 'v1.1',
}

function makeStorageGet(telemetryEnabled: boolean | undefined) {
  return vi.fn((_keys: string | string[] | Record<string, unknown>) => {
    return Promise.resolve({ [TELEMETRY_ENABLED]: telemetryEnabled })
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('emitScoreSample', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 204 }),
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('telemetry toggle gate', () => {
    it('does NOT emit when telemetry is explicitly disabled', async () => {
      ;(chrome.storage.local.get as ReturnType<typeof vi.fn>).mockImplementationOnce(
        makeStorageGet(false),
      )
      await emitScoreSample(VALID_PARAMS)
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('emits when telemetry is explicitly enabled', async () => {
      ;(chrome.storage.local.get as ReturnType<typeof vi.fn>).mockImplementationOnce(
        makeStorageGet(true),
      )
      await emitScoreSample(VALID_PARAMS)
      expect(fetchSpy).toHaveBeenCalledOnce()
    })

    it('emits when telemetry is undefined (treat as enabled, default ON)', async () => {
      ;(chrome.storage.local.get as ReturnType<typeof vi.fn>).mockImplementationOnce(
        makeStorageGet(undefined),
      )
      await emitScoreSample(VALID_PARAMS)
      expect(fetchSpy).toHaveBeenCalledOnce()
    })
  })

  describe('payload structure', () => {
    beforeEach(() => {
      ;(chrome.storage.local.get as ReturnType<typeof vi.fn>).mockImplementation(
        makeStorageGet(true),
      )
    })

    it('posts to the correct score-sample endpoint', async () => {
      await emitScoreSample(VALID_PARAMS)
      expect(fetchSpy).toHaveBeenCalledWith(
        TELEMETRY_SCORE_SAMPLE_URL,
        expect.objectContaining({ method: 'POST' }),
      )
    })

    it('sets Content-Type to application/json', async () => {
      await emitScoreSample(VALID_PARAMS)
      const callArgs = fetchSpy.mock.calls[0] as [string, RequestInit]
      const headers = callArgs[1].headers as Record<string, string>
      expect(headers['Content-Type']).toBe('application/json')
    })

    it('sends exactly 9 fields in the JSON body — no extras', async () => {
      await emitScoreSample(VALID_PARAMS)
      const callArgs = fetchSpy.mock.calls[0] as [string, RequestInit]
      const body = JSON.parse(callArgs[1].body as string) as Record<string, unknown>

      const EXPECTED_KEYS = [
        'event', 'domain_etld1', 'overall', 'word_choice', 'framing',
        'headline_slant', 'source_mix', 'direction', 'provider', 'rubric_version',
      ]
      expect(Object.keys(body).sort()).toEqual(EXPECTED_KEYS.sort())
    })

    it('sets event to "score_sample"', async () => {
      await emitScoreSample(VALID_PARAMS)
      const body = JSON.parse(
        (fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string,
      ) as Record<string, unknown>
      expect(body['event']).toBe('score_sample')
    })

    it('derives domain_etld1 from pageUrl — strips www. and path', async () => {
      await emitScoreSample(VALID_PARAMS)
      const body = JSON.parse(
        (fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string,
      ) as Record<string, unknown>
      // www.nytimes.com → nytimes.com
      expect(body['domain_etld1']).toBe('nytimes.com')
    })

    it('correctly handles co.uk two-part TLD', async () => {
      ;(chrome.storage.local.get as ReturnType<typeof vi.fn>).mockImplementation(
        makeStorageGet(true),
      )
      await emitScoreSample({ ...VALID_PARAMS, pageUrl: 'https://www.bbc.co.uk/news/article' })
      const body = JSON.parse(
        (fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string,
      ) as Record<string, unknown>
      expect(body['domain_etld1']).toBe('bbc.co.uk')
    })

    it('maps Substack subdomains to substack.com', async () => {
      ;(chrome.storage.local.get as ReturnType<typeof vi.fn>).mockImplementation(
        makeStorageGet(true),
      )
      await emitScoreSample({
        ...VALID_PARAMS,
        pageUrl: 'https://personal-blog.substack.com/p/post',
      })
      const body = JSON.parse(
        (fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string,
      ) as Record<string, unknown>
      expect(body['domain_etld1']).toBe('substack.com')
    })

    it('passes score fields through unmodified', async () => {
      await emitScoreSample(VALID_PARAMS)
      const body = JSON.parse(
        (fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string,
      ) as Record<string, unknown>
      expect(body['overall']).toBe(7)
      expect(body['word_choice']).toBe(4)
      expect(body['framing']).toBe(6)
      expect(body['headline_slant']).toBe(5)
      expect(body['source_mix']).toBe(3)
    })

    it('passes direction, provider, rubric_version through unmodified', async () => {
      await emitScoreSample(VALID_PARAMS)
      const body = JSON.parse(
        (fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string,
      ) as Record<string, unknown>
      expect(body['direction']).toBe('right')
      expect(body['provider']).toBe('anthropic')
      expect(body['rubric_version']).toBe('v1.1')
    })

    it('does NOT include raw pageUrl in the payload', async () => {
      await emitScoreSample(VALID_PARAMS)
      const body = JSON.parse(
        (fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string,
      ) as Record<string, unknown>
      expect(body).not.toHaveProperty('pageUrl')
      expect(body).not.toHaveProperty('url')
      // Confirm raw URL is not present anywhere in the serialised body
      const bodyStr = JSON.stringify(body)
      expect(bodyStr).not.toContain('/article/foo')
    })
  })

  describe('silent no-op cases', () => {
    beforeEach(() => {
      ;(chrome.storage.local.get as ReturnType<typeof vi.fn>).mockImplementation(
        makeStorageGet(true),
      )
    })

    it('does NOT emit when pageUrl resolves to localhost', async () => {
      await emitScoreSample({ ...VALID_PARAMS, pageUrl: 'http://localhost:3000/page' })
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('does NOT emit when pageUrl is an IP address', async () => {
      await emitScoreSample({ ...VALID_PARAMS, pageUrl: 'http://192.168.1.1/page' })
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('does NOT emit when pageUrl is empty string', async () => {
      await emitScoreSample({ ...VALID_PARAMS, pageUrl: '' })
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('swallows network errors silently', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('Network failure'))
      // Should not throw
      await expect(emitScoreSample(VALID_PARAMS)).resolves.toBeUndefined()
    })

    it('swallows storage read errors silently', async () => {
      ;(chrome.storage.local.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Storage failure'),
      )
      await expect(emitScoreSample(VALID_PARAMS)).resolves.toBeUndefined()
    })
  })

  describe('openai and gemini rubric_version formats', () => {
    beforeEach(() => {
      ;(chrome.storage.local.get as ReturnType<typeof vi.fn>).mockImplementation(
        makeStorageGet(true),
      )
    })

    it('accepts rubric_v1.1-openai version format', async () => {
      await emitScoreSample({
        ...VALID_PARAMS,
        provider: 'openai',
        rubric_version: 'rubric_v1.1-openai',
      })
      const body = JSON.parse(
        (fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string,
      ) as Record<string, unknown>
      expect(body['rubric_version']).toBe('rubric_v1.1-openai')
    })

    it('accepts rubric_v1.1-gemini version format', async () => {
      await emitScoreSample({
        ...VALID_PARAMS,
        provider: 'gemini',
        rubric_version: 'rubric_v1.1-gemini',
      })
      const body = JSON.parse(
        (fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string,
      ) as Record<string, unknown>
      expect(body['rubric_version']).toBe('rubric_v1.1-gemini')
    })
  })
})
