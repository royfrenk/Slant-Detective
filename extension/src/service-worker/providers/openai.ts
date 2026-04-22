// OpenAI Chat Completions provider implementing LLMProvider.
// Model IDs verified against live OpenAI catalog on 2026-04-20:
//   gpt-5-mini (2025-08-07) — default, cost-efficient
//   gpt-5       (2025-08-07) — higher capability option
// OpenAI allows direct browser calls for user-supplied keys — no CORS header needed.
//
// API note: gpt-5+ models require max_completion_tokens (not max_tokens).
// max_tokens was deprecated for newer reasoning models. Using max_completion_tokens
// is accepted by both older and newer models per OpenAI docs.

import type { LLMProvider, ProviderCompleteInput, ApiKeyTestResult } from './types'
import { ProviderApiError } from './types'

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions'

interface OpenAIResponseBody {
  choices: Array<{ message: { content: string } }>
}

export class OpenAIProvider implements LLMProvider {
  readonly id = 'openai' as const
  // First entry = default model. Both verified against live catalog on 2026-04-20.
  readonly modelIds: readonly string[] = ['gpt-5-mini', 'gpt-5']

  async validateKey(key: string): Promise<ApiKeyTestResult> {
    try {
      const response = await fetch(OPENAI_CHAT_URL, {
        method: 'POST',
        signal: AbortSignal.timeout(30_000),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: this.modelIds[0],
          max_completion_tokens: 10,
          messages: [{ role: 'user', content: 'hi' }],
        }),
      })

      if (response.ok) {
        return { status: 'ok' }
      }

      if (response.status === 401) {
        return { status: 'invalid', code: 401 }
      }

      // 400 = format error (malformed key), 403 = forbidden — both count as invalid.
      if (response.status === 400 || response.status === 403) {
        return { status: 'invalid', code: response.status }
      }

      // 429, 500, etc. — request reached OpenAI; key format likely valid.
      return { status: 'reachable-unverified' }
    } catch {
      // Connection failed or timed out — never reached OpenAI.
      return { status: 'network-error' }
    }
  }

  async complete(input: ProviderCompleteInput, apiKey: string): Promise<unknown> {
    const response = await fetch(OPENAI_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: input.model,
        max_completion_tokens: input.maxTokens,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: input.system },
          { role: 'user', content: input.user },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    })

    if (!response.ok) {
      throw new ProviderApiError(response.status, `HTTP ${response.status}`)
    }

    return response.json()
  }

  extractText(response: unknown): string {
    const r = response as OpenAIResponseBody
    return r.choices[0]?.message.content ?? ''
  }
}
