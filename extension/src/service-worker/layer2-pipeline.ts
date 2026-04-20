import type { RubricResponse } from '../shared/types'
import type { LLMProvider } from './providers/types'
import { ProviderApiError } from './providers/types'
import { getRubricPrompt, fillUserTemplate, RUBRIC_MODEL, MAX_TOKENS } from './rubric-prompt'
import { validateRubricResponse, RubricValidationError } from './response-validator'
import { buildCacheKey, getCachedResult, setCachedResult } from './cache'

export interface Layer2Input {
  title: string
  body: string
  canonicalUrl: string
  rubricVersion: string
  provider: string
  model: string
}

async function fetchAndValidate(
  title: string,
  body: string,
  provider: LLMProvider,
  apiKey: string,
): Promise<RubricResponse> {
  const prompt = getRubricPrompt(provider.id)
  const userMessage = fillUserTemplate(prompt.user, {
    title,
    body,
    word_count: body.split(/\s+/).length,
  })
  const apiResponse = await provider.complete(
    {
      system: prompt.system,
      user: userMessage,
      model: RUBRIC_MODEL,
      maxTokens: MAX_TOKENS,
    },
    apiKey,
  )
  const rawText = provider.extractText(apiResponse)
  return validateRubricResponse(rawText, body)
}

/**
 * Orchestrate Layer 2 analysis:
 * 1. Check cache — return immediately on hit
 * 2. Call provider API on miss
 * 3. Validate response; retry once on RubricValidationError
 * 4. Cache the valid result and return it
 *
 * Throws: ProviderApiError, RubricValidationError, or network error
 */
export async function runLayer2Analysis(
  input: Layer2Input,
  provider: LLMProvider,
  apiKey: string,
): Promise<RubricResponse> {
  const cacheKey = await buildCacheKey(
    input.canonicalUrl,
    input.body,
    input.rubricVersion,
    input.provider,
    input.model,
  )

  const cached = await getCachedResult(cacheKey)
  if (cached !== null) return cached

  let rubricResponse: RubricResponse
  try {
    rubricResponse = await fetchAndValidate(input.title, input.body, provider, apiKey)
  } catch (err) {
    if (err instanceof RubricValidationError) {
      // Single retry on validation failure
      rubricResponse = await fetchAndValidate(input.title, input.body, provider, apiKey)
    } else if (err instanceof ProviderApiError) {
      throw err
    } else {
      throw err
    }
  }

  await setCachedResult(cacheKey, rubricResponse)
  return rubricResponse
}
