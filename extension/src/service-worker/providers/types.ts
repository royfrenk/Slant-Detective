// Provider abstraction types — shared by all LLM provider implementations.

export type ProviderId = 'anthropic' | 'openai' | 'gemini'

export interface ProviderCompleteInput {
  system: string
  user: string
  model: string
  maxTokens: number
}

/**
 * Result of a provider API-key validation attempt.
 * code 400 added for Gemini's invalid-key response shape.
 */
export type ApiKeyTestResult =
  | { status: 'ok' }
  | { status: 'invalid'; code: 400 | 401 | 403 }
  | { status: 'reachable-unverified' } // HTTP response received but not a recognised status
  | { status: 'network-error' }        // no response (connection failed, timeout)

/**
 * Single error class thrown by all providers for HTTP-level failures.
 * index.ts maps statusCode to message reasons (401/403 → invalid_api_key, 429 → rate_limited, …).
 */
export class ProviderApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message)
    this.name = 'ProviderApiError'
  }
}

export interface LLMProvider {
  readonly id: ProviderId
  readonly modelIds: readonly string[] // First entry = default model
  validateKey(key: string): Promise<ApiKeyTestResult>
  complete(input: ProviderCompleteInput, apiKey: string): Promise<unknown> // Raw provider response
  extractText(response: unknown): string // Pull text out of provider-specific shape
}
