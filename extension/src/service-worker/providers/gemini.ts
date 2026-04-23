// Gemini generateContent provider implementing LLMProvider.
// Auth: API key in x-goog-api-key request header (NOT a URL query param).
// Using the header avoids key leakage in proxy logs and Referer headers on redirects.
//
// Safety settings: BLOCK_ONLY_HIGH for all four harm categories — rubric needs
// to analyze articles about violence/extremism without being refused.
//
// Two SAFETY paths must both throw GeminiSafetyError:
//   1. candidates[0].finishReason === 'SAFETY'  — candidate-level block
//   2. promptFeedback.blockReason === 'SAFETY'   — prompt-level block (no candidates)

import type { LLMProvider, ProviderCompleteInput, ApiKeyTestResult } from './types'
import { ProviderApiError } from './types'

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'
const DEFAULT_MODEL = 'gemini-2.5-flash'

const SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HARASSMENT',       threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
]

/**
 * Thrown when Gemini blocks content via safety filters.
 * Covers both finishReason: 'SAFETY' (candidate-level) and
 * promptFeedback.blockReason: 'SAFETY' (prompt-level, no candidates).
 * Caller should map this to errorType: 'content_filtered' — NOT a retry.
 */
export class GeminiSafetyError extends Error {
  constructor() {
    super('Content filtered by Gemini safety settings')
    this.name = 'GeminiSafetyError'
  }
}

interface GeminiCandidate {
  content?: { parts?: Array<{ text?: string }> }
  finishReason?: string
}

interface GeminiResponseBody {
  candidates?: GeminiCandidate[]
  promptFeedback?: { blockReason?: string }
}

export class GeminiProvider implements LLMProvider {
  readonly id = 'gemini' as const
  // First entry = default model.
  readonly modelIds: readonly string[] = [DEFAULT_MODEL, 'gemini-2.5-pro']

  async validateKey(key: string): Promise<ApiKeyTestResult> {
    try {
      const url = `${GEMINI_BASE_URL}/${DEFAULT_MODEL}:generateContent`
      const response = await fetch(url, {
        method: 'POST',
        signal: AbortSignal.timeout(45_000),
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': key,
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
          generationConfig: { maxOutputTokens: 1 },
        }),
      })

      if (response.ok) {
        return { status: 'ok' }
      }

      // HTTP 400 with "API key not valid" is Gemini's invalid-key response.
      // Semantically an auth failure — map to invalid just like 401/403.
      if (response.status === 400) {
        const body = await response.json().catch(() => ({})) as { error?: { message?: string } }
        const msg = body?.error?.message ?? ''
        if (msg.toLowerCase().includes('api key not valid') || msg.toLowerCase().includes('invalid')) {
          return { status: 'invalid', code: 400 }
        }
        // 400 for other reasons (bad request shape) → reachable-unverified
        return { status: 'reachable-unverified' }
      }

      if (response.status === 403) {
        return { status: 'invalid', code: 403 }
      }

      // 429, 500, etc. — request reached Gemini; key format likely valid.
      return { status: 'reachable-unverified' }
    } catch {
      // Connection failed or timed out — never reached Gemini.
      return { status: 'network-error' }
    }
  }

  async complete(input: ProviderCompleteInput, apiKey: string): Promise<unknown> {
    const url = `${GEMINI_BASE_URL}/${input.model}:generateContent`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: input.system }] },
        contents: [{ role: 'user', parts: [{ text: input.user }] }],
        safetySettings: SAFETY_SETTINGS,
        generationConfig: {
          responseMimeType: 'application/json',
          maxOutputTokens: input.maxTokens,
          // thinkingBudget: 0 suppresses chain-of-thought tokens, cutting per-article cost ~40%.
          // Gemini 2.5 Flash passes SD-035 parity gate (κ 0.57) without thinking enabled.
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
      signal: AbortSignal.timeout(45_000),
    })

    if (!response.ok) {
      throw new ProviderApiError(response.status, `HTTP ${response.status}`)
    }

    const data = await response.json() as GeminiResponseBody

    // Prompt-level safety block: HTTP 200 with no candidates and promptFeedback.blockReason.
    // Must check this BEFORE the candidate-level check to avoid accessing candidates[0].
    if (data?.promptFeedback?.blockReason === 'SAFETY') {
      throw new GeminiSafetyError()
    }

    // Candidate-level safety block: finishReason is 'SAFETY'.
    if (data?.candidates?.[0]?.finishReason === 'SAFETY') {
      throw new GeminiSafetyError()
    }

    return data
  }

  extractText(response: unknown): string {
    const r = response as GeminiResponseBody
    return r.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  }
}
