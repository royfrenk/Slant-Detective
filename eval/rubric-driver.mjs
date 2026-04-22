/**
 * eval/rubric-driver.mjs — Orchestration layer for scoring sentences via a provider
 *
 * Delegates all API calls to the provider module from eval/providers/.
 * Supports Anthropic, OpenAI, and Gemini via the --provider CLI flag.
 *
 * The concurrency-limited batch runner and binary classification threshold
 * live here. Provider-specific HTTP logic lives in eval/providers/{name}.mjs.
 */

import { getProvider, getApiKey } from './providers/index.mjs'
import { GeminiSafetyError } from './providers/gemini.mjs'
import { validateRubricResponse, RubricValidationError } from './providers/anthropic.mjs'

// ─── Constants ───────────────────────────────────────────────────────────────

/** Re-exported so run.mjs can print a version header. */
export const RUBRIC_VERSION = 'v1.0'

/** Binary classification threshold: intensity > 4 → biased. */
const BIAS_THRESHOLD = 4

// ─── Score a single sentence ──────────────────────────────────────────────────

/**
 * Score a single text using the given provider.
 *
 * Returns a validated RubricResponse or throws on any error.
 * GeminiSafetyError is NOT caught here — the batch runner handles it.
 *
 * @param {string} text
 * @param {object} provider - Driver module from eval/providers/
 * @param {string} apiKey
 * @param {string} model
 * @returns {Promise<{ result: object, usage: { input_tokens: number, output_tokens: number } }>}
 */
async function scoreText(text, provider, apiKey, model) {
  const { text: rawText, usage } = await provider.complete(text, apiKey, model)
  const result = validateRubricResponse(rawText, text)
  return { result, usage }
}

// ─── Concurrency-limited batch runner ────────────────────────────────────────

/**
 * Score a batch of sentences with a concurrency limit.
 * Returns results in the same order as inputs.
 * Each item is either:
 *   { result: RubricResponse, usage: { input_tokens, output_tokens } }
 *   or an Error (includes GeminiSafetyError, counted separately by caller).
 *
 * Also returns token totals and safety_skipped count.
 *
 * @param {string[]} sentences
 * @param {object} provider - Driver module
 * @param {string} apiKey
 * @param {string} model
 * @param {number} concurrency
 * @param {(n: number) => void} [onProgress]
 * @returns {Promise<{
 *   results: Array<{ result: object, usage: object } | Error>,
 *   tokenTotals: { input_tokens: number, output_tokens: number },
 *   safety_skipped: number
 * }>}
 */
export async function scoreBatch(sentences, provider, apiKey, model, concurrency, onProgress) {
  const results = new Array(sentences.length)
  const queue = sentences.map((text, i) => ({ text, i }))
  let queueIdx = 0
  let running = 0
  let completed = 0
  const tokenTotals = { input_tokens: 0, output_tokens: 0 }
  let safety_skipped = 0

  return new Promise((resolve, reject) => {
    const tryNext = () => {
      while (running < concurrency && queueIdx < queue.length) {
        const { text, i } = queue[queueIdx++]
        running++

        scoreText(text, provider, apiKey, model)
          .then(({ result, usage }) => {
            results[i] = { result, usage }
            tokenTotals.input_tokens += usage.input_tokens
            tokenTotals.output_tokens += usage.output_tokens
          })
          .catch((err) => {
            const error = err instanceof Error ? err : new Error(String(err))
            results[i] = error
            if (error instanceof GeminiSafetyError) {
              safety_skipped++
            }
          })
          .finally(() => {
            running--
            completed++
            if (onProgress) onProgress(completed)
            if (completed === sentences.length) {
              resolve({ results, tokenTotals, safety_skipped })
            } else {
              tryNext()
            }
          })
      }
    }

    if (sentences.length === 0) {
      resolve({ results, tokenTotals, safety_skipped })
      return
    }

    tryNext()
  })
}

// ─── Classify result ──────────────────────────────────────────────────────────

/**
 * Apply the binary classification threshold to a validated RubricResponse.
 *
 * @param {object} rubricResult
 * @returns {'biased' | 'not-biased'}
 */
export function classifyResult(rubricResult) {
  return rubricResult.overall.intensity > BIAS_THRESHOLD ? 'biased' : 'not-biased'
}

// Re-export for backward compat with any code importing from rubric-driver
export { RubricValidationError }
