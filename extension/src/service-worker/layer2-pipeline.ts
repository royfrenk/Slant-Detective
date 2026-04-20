import type { RubricResponse } from '../shared/types'
import { callAnthropicMessages, AnthropicApiError } from './anthropic-client'
import { buildRubricPrompt } from './rubric-prompt'
import { validateRubricResponse, RubricValidationError } from './response-validator'
import { buildCacheKey, getCachedResult, setCachedResult } from './cache'

export interface Layer2Input {
  title: string
  body: string
  canonicalUrl: string
  rubricVersion: string
}

async function fetchAndValidate(
  title: string,
  body: string,
  apiKey: string,
): Promise<RubricResponse> {
  const requestBody = buildRubricPrompt({ title, body, word_count: body.split(/\s+/).length })
  const apiResponse = await callAnthropicMessages(apiKey, requestBody)
  const rawText = apiResponse.content[0]?.text ?? ''
  return validateRubricResponse(rawText, body)
}

/**
 * Orchestrate Layer 2 analysis:
 * 1. Check cache — return immediately on hit
 * 2. Call Anthropic API on miss
 * 3. Validate response; retry once on RubricValidationError
 * 4. Cache the valid result and return it
 *
 * Throws: AnthropicApiError, RubricValidationError, or network error
 */
export async function runLayer2Analysis(
  input: Layer2Input,
  apiKey: string,
): Promise<RubricResponse> {
  const cacheKey = await buildCacheKey(input.canonicalUrl, input.body, input.rubricVersion)

  const cached = await getCachedResult(cacheKey)
  if (cached !== null) return cached

  let rubricResponse: RubricResponse
  try {
    rubricResponse = await fetchAndValidate(input.title, input.body, apiKey)
  } catch (err) {
    if (err instanceof RubricValidationError) {
      // Single retry on validation failure
      rubricResponse = await fetchAndValidate(input.title, input.body, apiKey)
    } else if (err instanceof AnthropicApiError) {
      throw err
    } else {
      throw err
    }
  }

  await setCachedResult(cacheKey, rubricResponse)
  return rubricResponse
}
