import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { LLMProvider, ProviderCompleteInput } from '../src/service-worker/providers/types'
import { ProviderApiError } from '../src/service-worker/providers/types'

// Mock dependencies before importing the module under test
vi.mock('../src/service-worker/cache', () => ({
  buildCacheKey: vi.fn().mockResolvedValue('sd_cache_test-key'),
  getCachedResult: vi.fn().mockResolvedValue(null),
  setCachedResult: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../src/service-worker/rubric-prompt', () => ({
  getRubricPrompt: vi.fn().mockReturnValue({
    system: 'You are a media-bias analyst. Return ONLY a JSON object',
    user: '{ARTICLE_TITLE}\n\n{ARTICLE_BODY}',
    version: 'rubric_v1.0',
  }),
  fillUserTemplate: vi.fn().mockReturnValue('Test article\n\ntest body'),
  RUBRIC_MODEL: 'claude-haiku-4-5-20251001',
  MAX_TOKENS: 2048,
}))

import { runLayer2Analysis } from '../src/service-worker/layer2-pipeline'
import { buildCacheKey, getCachedResult, setCachedResult } from '../src/service-worker/cache'
import { getRubricPrompt } from '../src/service-worker/rubric-prompt'
import { RubricValidationError } from '../src/service-worker/response-validator'
import type { RubricResponse } from '../src/shared/types'

// Cast mocks for type-safe usage
const mockGetCachedResult = getCachedResult as ReturnType<typeof vi.fn>
const mockSetCachedResult = setCachedResult as ReturnType<typeof vi.fn>
const mockBuildCacheKey = buildCacheKey as ReturnType<typeof vi.fn>
const mockGetRubricPrompt = getRubricPrompt as ReturnType<typeof vi.fn>

// ---------------------------------------------------------------------------
// Mock LLMProvider
// ---------------------------------------------------------------------------

function makeMockProvider(): LLMProvider & {
  complete: ReturnType<typeof vi.fn>
  extractText: ReturnType<typeof vi.fn>
} {
  return {
    id: 'anthropic' as const,
    modelIds: ['claude-haiku-4-5-20251001'],
    validateKey: vi.fn(),
    complete: vi.fn(),
    extractText: vi.fn(),
  }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeValidRubricResponse(): RubricResponse {
  return {
    rubric_version: 'rubric_v1.0',
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

// An invalid response (missing rubric_version) that will fail validation
const INVALID_LLM_TEXT = '{"overall":{"intensity":5,"direction":"left","confidence":0.5},"dimensions":{"word_choice":{"score":5},"framing":{"score":5},"headline_slant":{"score":5},"source_mix":{"score":5}},"spans":[{"id":"x","text":"test","offset_start":0,"offset_end":4,"category":"framing","severity":"low","tilt":"left","reason":"test reason","dimension":"framing"}]}'

const TEST_INPUT = {
  title: 'Breaking News - Publisher Name',
  body: 'The article discusses partisan rhetoric and its effects on discourse.',
  canonicalUrl: 'https://example.com/article',
  rubricVersion: 'rubric_v1.0',
  provider: 'anthropic',
  model: 'claude-haiku-4-5-20251001',
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runLayer2Analysis', () => {
  let mockProvider: ReturnType<typeof makeMockProvider>

  beforeEach(() => {
    vi.clearAllMocks()
    mockProvider = makeMockProvider()
    mockBuildCacheKey.mockResolvedValue('sd_cache_test-key')
    mockGetCachedResult.mockResolvedValue(null)
    mockSetCachedResult.mockResolvedValue(undefined)
  })

  it('returns cached result without calling provider on cache hit', async () => {
    const cached = makeValidRubricResponse()
    mockGetCachedResult.mockResolvedValue(cached)

    const result = await runLayer2Analysis(TEST_INPUT, mockProvider, 'sk-ant-test')

    expect(result).toEqual(cached)
    expect(mockProvider.complete).not.toHaveBeenCalled()
    expect(mockSetCachedResult).not.toHaveBeenCalled()
  })

  it('calls provider.complete on cache miss', async () => {
    const validResponse = makeValidRubricResponse()
    mockProvider.complete.mockResolvedValue({ content: [{ type: 'text', text: JSON.stringify(validResponse) }] })
    mockProvider.extractText.mockReturnValue(JSON.stringify(validResponse))

    await runLayer2Analysis(TEST_INPUT, mockProvider, 'sk-ant-test')

    expect(mockProvider.complete).toHaveBeenCalledOnce()
  })

  it('caches the result after a successful provider call', async () => {
    const validResponse = makeValidRubricResponse()
    mockProvider.complete.mockResolvedValue({})
    mockProvider.extractText.mockReturnValue(JSON.stringify(validResponse))

    await runLayer2Analysis(TEST_INPUT, mockProvider, 'sk-ant-test')

    expect(mockSetCachedResult).toHaveBeenCalledOnce()
    expect(mockSetCachedResult).toHaveBeenCalledWith('sd_cache_test-key', validResponse)
  })

  it('retries exactly once on first validation failure and returns valid result', async () => {
    const validResponse = makeValidRubricResponse()
    mockProvider.complete.mockResolvedValue({})
    mockProvider.extractText
      .mockReturnValueOnce(INVALID_LLM_TEXT)
      .mockReturnValueOnce(JSON.stringify(validResponse))

    const result = await runLayer2Analysis(TEST_INPUT, mockProvider, 'sk-ant-test')

    expect(mockProvider.complete).toHaveBeenCalledTimes(2)
    expect(result).toEqual(validResponse)
  })

  it('throws RubricValidationError after two consecutive validation failures', async () => {
    mockProvider.complete.mockResolvedValue({})
    mockProvider.extractText.mockReturnValue(INVALID_LLM_TEXT)

    await expect(runLayer2Analysis(TEST_INPUT, mockProvider, 'sk-ant-test')).rejects.toThrow(RubricValidationError)
    expect(mockProvider.complete).toHaveBeenCalledTimes(2)
  })

  it('does not cache a result when validation fails both times', async () => {
    mockProvider.complete.mockResolvedValue({})
    mockProvider.extractText.mockReturnValue(INVALID_LLM_TEXT)

    await expect(runLayer2Analysis(TEST_INPUT, mockProvider, 'sk-ant-test')).rejects.toThrow()
    expect(mockSetCachedResult).not.toHaveBeenCalled()
  })

  it('builds the cache key using canonicalUrl, body, rubricVersion, provider, and model', async () => {
    const validResponse = makeValidRubricResponse()
    mockProvider.complete.mockResolvedValue({})
    mockProvider.extractText.mockReturnValue(JSON.stringify(validResponse))

    await runLayer2Analysis(TEST_INPUT, mockProvider, 'sk-ant-test')

    expect(mockBuildCacheKey).toHaveBeenCalledWith(
      TEST_INPUT.canonicalUrl,
      TEST_INPUT.body,
      TEST_INPUT.rubricVersion,
      TEST_INPUT.provider,
      TEST_INPUT.model,
    )
  })

  it('same article + different provider arg → different cache key args', async () => {
    const validResponse = makeValidRubricResponse()
    mockProvider.complete.mockResolvedValue({})
    mockProvider.extractText.mockReturnValue(JSON.stringify(validResponse))

    const inputOpenAI = { ...TEST_INPUT, provider: 'openai', model: 'gpt-4o-mini' }
    await runLayer2Analysis(inputOpenAI, mockProvider, 'sk-openai-test')

    expect(mockBuildCacheKey).toHaveBeenCalledWith(
      inputOpenAI.canonicalUrl,
      inputOpenAI.body,
      inputOpenAI.rubricVersion,
      'openai',
      'gpt-4o-mini',
    )
  })

  it('throws ProviderApiError without retrying', async () => {
    const apiError = new ProviderApiError(401, 'HTTP 401')
    mockProvider.complete.mockRejectedValue(apiError)

    await expect(runLayer2Analysis(TEST_INPUT, mockProvider, 'sk-ant-bad')).rejects.toThrow(ProviderApiError)
    // Only one attempt — no retry on API errors
    expect(mockProvider.complete).toHaveBeenCalledTimes(1)
  })

  it('calls getRubricPrompt with the provider id', async () => {
    const validResponse = makeValidRubricResponse()
    mockProvider.complete.mockResolvedValue({})
    mockProvider.extractText.mockReturnValue(JSON.stringify(validResponse))

    await runLayer2Analysis(TEST_INPUT, mockProvider, 'sk-ant-test')

    expect(mockGetRubricPrompt).toHaveBeenCalledWith('anthropic')
  })

  it('passes input.model to provider.complete (not a hardcoded constant)', async () => {
    const validResponse = makeValidRubricResponse()
    mockProvider.complete.mockResolvedValue({})
    mockProvider.extractText.mockReturnValue(JSON.stringify(validResponse))

    await runLayer2Analysis(TEST_INPUT, mockProvider, 'sk-ant-test')

    const completeCall = mockProvider.complete.mock.calls[0] as [{ model: string }, string]
    expect(completeCall[0].model).toBe(TEST_INPUT.model)
  })

  it('same article + different input.model → different model sent to provider', async () => {
    const validResponse = makeValidRubricResponse()
    mockProvider.complete.mockResolvedValue({})
    mockProvider.extractText.mockReturnValue(JSON.stringify(validResponse))

    const inputGpt = { ...TEST_INPUT, provider: 'openai', model: 'gpt-5-mini' }
    await runLayer2Analysis(inputGpt, mockProvider, 'sk-openai-test')

    const completeCall = mockProvider.complete.mock.calls[0] as [{ model: string }, string]
    expect(completeCall[0].model).toBe('gpt-5-mini')
  })
})
