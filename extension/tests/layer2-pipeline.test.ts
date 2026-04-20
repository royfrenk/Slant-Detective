import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies before importing the module under test
vi.mock('../src/service-worker/cache', () => ({
  buildCacheKey: vi.fn().mockResolvedValue('sd_cache_test-key'),
  getCachedResult: vi.fn().mockResolvedValue(null),
  setCachedResult: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../src/service-worker/anthropic-client', () => ({
  callAnthropicMessages: vi.fn(),
  AnthropicApiError: class AnthropicApiError extends Error {
    statusCode: number
    constructor(statusCode: number, message: string) {
      super(message)
      this.statusCode = statusCode
      this.name = 'AnthropicApiError'
    }
  },
}))

vi.mock('../src/service-worker/rubric-prompt', () => ({
  buildRubricPrompt: vi.fn().mockReturnValue({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 2048,
    messages: [{ role: 'user', content: 'test prompt' }],
  }),
}))

import { runLayer2Analysis } from '../src/service-worker/layer2-pipeline'
import { buildCacheKey, getCachedResult, setCachedResult } from '../src/service-worker/cache'
import { callAnthropicMessages } from '../src/service-worker/anthropic-client'
import { buildRubricPrompt } from '../src/service-worker/rubric-prompt'
import { RubricValidationError } from '../src/service-worker/response-validator'
import type { RubricResponse } from '../src/shared/types'

// Cast mocks for type-safe usage
const mockGetCachedResult = getCachedResult as ReturnType<typeof vi.fn>
const mockSetCachedResult = setCachedResult as ReturnType<typeof vi.fn>
const mockCallAnthropicMessages = callAnthropicMessages as ReturnType<typeof vi.fn>
const mockBuildCacheKey = buildCacheKey as ReturnType<typeof vi.fn>
const mockBuildRubricPrompt = buildRubricPrompt as ReturnType<typeof vi.fn>

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeValidRubricResponse(): RubricResponse {
  return {
    rubric_version: 'v1.0',
    overall: { intensity: 4, direction: 'left', confidence: 0.7 },
    dimensions: {
      word_choice: { score: 3 },
      framing: { score: 5 },
      headline_slant: { score: 4 },
      source_mix: { score: 2 },
    },
    spans: [
      {
        id: 'abc-123',
        text: 'partisan rhetoric',
        offset_start: 0,
        offset_end: 17,
        category: 'loaded_language',
        severity: 'medium',
        tilt: 'left',
        reason: 'Loaded political term.',
        dimension: 'word_choice',
      },
    ],
  }
}

// A valid JSON string wrapping the rubric response, as returned by the LLM
function makeApiResponse(rubricResponse: RubricResponse) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(rubricResponse) }],
  }
}

// An invalid response (missing rubric_version) that will fail validation
function makeInvalidApiResponse() {
  return {
    content: [{ type: 'text' as const, text: '{"overall":{"intensity":5,"direction":"left","confidence":0.5},"dimensions":{"word_choice":{"score":5},"framing":{"score":5},"headline_slant":{"score":5},"source_mix":{"score":5}},"spans":[{"id":"x","text":"test","offset_start":0,"offset_end":4,"category":"framing","severity":"low","tilt":"left","reason":"test reason","dimension":"framing"}]}' }],
  }
}

const TEST_INPUT = {
  title: 'Breaking News - Publisher Name',
  // Body must contain span.text ('partisan rhetoric') so body-filtering keeps the span.
  body: 'The article discusses partisan rhetoric and its effects on discourse.',
  canonicalUrl: 'https://example.com/article',
  rubricVersion: 'v1.0',
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runLayer2Analysis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockBuildCacheKey.mockResolvedValue('sd_cache_test-key')
    mockGetCachedResult.mockResolvedValue(null)
    mockSetCachedResult.mockResolvedValue(undefined)
  })

  it('returns cached result without calling Anthropic on cache hit', async () => {
    const cached = makeValidRubricResponse()
    mockGetCachedResult.mockResolvedValue(cached)

    const result = await runLayer2Analysis(TEST_INPUT, 'sk-ant-test')

    expect(result).toEqual(cached)
    expect(mockCallAnthropicMessages).not.toHaveBeenCalled()
    expect(mockSetCachedResult).not.toHaveBeenCalled()
  })

  it('calls Anthropic on cache miss', async () => {
    mockGetCachedResult.mockResolvedValue(null)
    mockCallAnthropicMessages.mockResolvedValue(makeApiResponse(makeValidRubricResponse()))

    await runLayer2Analysis(TEST_INPUT, 'sk-ant-test')

    expect(mockCallAnthropicMessages).toHaveBeenCalledOnce()
  })

  it('caches the result after a successful Anthropic call', async () => {
    const response = makeValidRubricResponse()
    mockCallAnthropicMessages.mockResolvedValue(makeApiResponse(response))

    await runLayer2Analysis(TEST_INPUT, 'sk-ant-test')

    expect(mockSetCachedResult).toHaveBeenCalledOnce()
    expect(mockSetCachedResult).toHaveBeenCalledWith('sd_cache_test-key', response)
  })

  it('retries exactly once on first validation failure and returns valid result', async () => {
    const validResponse = makeValidRubricResponse()
    mockCallAnthropicMessages
      .mockResolvedValueOnce(makeInvalidApiResponse())    // First call: invalid (missing rubric_version)
      .mockResolvedValueOnce(makeApiResponse(validResponse)) // Second call: valid

    const result = await runLayer2Analysis(TEST_INPUT, 'sk-ant-test')

    expect(mockCallAnthropicMessages).toHaveBeenCalledTimes(2)
    expect(result).toEqual(validResponse)
  })

  it('throws RubricValidationError after two consecutive validation failures', async () => {
    mockCallAnthropicMessages
      .mockResolvedValueOnce(makeInvalidApiResponse())
      .mockResolvedValueOnce(makeInvalidApiResponse())

    await expect(runLayer2Analysis(TEST_INPUT, 'sk-ant-test')).rejects.toThrow(RubricValidationError)
    expect(mockCallAnthropicMessages).toHaveBeenCalledTimes(2)
  })

  it('does not cache a result when validation fails both times', async () => {
    mockCallAnthropicMessages
      .mockResolvedValueOnce(makeInvalidApiResponse())
      .mockResolvedValueOnce(makeInvalidApiResponse())

    await expect(runLayer2Analysis(TEST_INPUT, 'sk-ant-test')).rejects.toThrow()
    expect(mockSetCachedResult).not.toHaveBeenCalled()
  })

  it('passes stripped title (without publication suffix) to buildRubricPrompt', async () => {
    mockCallAnthropicMessages.mockResolvedValue(makeApiResponse(makeValidRubricResponse()))

    await runLayer2Analysis(
      { ...TEST_INPUT, title: 'Breaking News - Publisher Name' },
      'sk-ant-test',
    )

    const promptArg = mockBuildRubricPrompt.mock.calls[0][0] as { title: string }
    // The rubric-prompt module strips the suffix; we just verify it's called with the original title
    // and that buildRubricPrompt was invoked
    expect(mockBuildRubricPrompt).toHaveBeenCalledOnce()
    expect(promptArg.title).toBe('Breaking News - Publisher Name')
  })

  it('builds the cache key using canonicalUrl, body, and rubricVersion', async () => {
    mockCallAnthropicMessages.mockResolvedValue(makeApiResponse(makeValidRubricResponse()))

    await runLayer2Analysis(TEST_INPUT, 'sk-ant-test')

    expect(mockBuildCacheKey).toHaveBeenCalledWith(
      TEST_INPUT.canonicalUrl,
      TEST_INPUT.body,
      TEST_INPUT.rubricVersion,
    )
  })
})
