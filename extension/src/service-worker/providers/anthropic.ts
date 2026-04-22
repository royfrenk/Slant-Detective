import type { LLMProvider, ProviderCompleteInput, ApiKeyTestResult } from './types'
import { ProviderApiError } from './types'

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION_HEADER = '2023-06-01'

interface AnthropicResponseBody {
  content: Array<{ type: 'text'; text: string }>
}

export class AnthropicProvider implements LLMProvider {
  readonly id = 'anthropic' as const
  readonly modelIds: readonly string[] = [
    'claude-haiku-4-5-20251001',
    'claude-opus-4-5-20251001',
  ]

  async validateKey(key: string): Promise<ApiKeyTestResult> {
    try {
      const response = await fetch(ANTHROPIC_MESSAGES_URL, {
        method: 'POST',
        signal: AbortSignal.timeout(30_000),
        headers: {
          'x-api-key': key,
          'anthropic-version': ANTHROPIC_VERSION_HEADER,
          'anthropic-dangerous-direct-browser-access': 'true',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }],
        }),
      })

      if (response.ok) {
        return { status: 'ok' }
      }

      if (response.status === 401 || response.status === 403) {
        return { status: 'invalid', code: response.status }
      }

      // Any other HTTP status (429, 500, 529…) means the request reached Anthropic —
      // the key format is plausibly correct even if we can't confirm it right now.
      return { status: 'reachable-unverified' }
    } catch {
      // Connection failed or timed out — never reached Anthropic.
      return { status: 'network-error' }
    }
  }

  async complete(input: ProviderCompleteInput, apiKey: string): Promise<unknown> {
    const response = await fetch(ANTHROPIC_MESSAGES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION_HEADER,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: input.model,
        max_tokens: input.maxTokens,
        system: input.system,
        messages: [{ role: 'user', content: input.user }],
      }),
      signal: AbortSignal.timeout(30_000),
    })

    if (!response.ok) {
      throw new ProviderApiError(response.status, `HTTP ${response.status}`)
    }

    return response.json()
  }

  extractText(response: unknown): string {
    const r = response as AnthropicResponseBody
    return r.content[0]?.text ?? ''
  }
}
