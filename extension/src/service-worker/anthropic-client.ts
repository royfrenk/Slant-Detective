const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION_HEADER = '2023-06-01'

export interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AnthropicRequestBody {
  model: string
  max_tokens: number
  messages: AnthropicMessage[]
  system?: string
}

export interface AnthropicResponseBody {
  content: Array<{ type: 'text'; text: string }>
}

export class AnthropicApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message)
    this.name = 'AnthropicApiError'
  }
}

/**
 * Thin typed wrapper around the Anthropic Messages API.
 * Throws AnthropicApiError on non-200 HTTP responses.
 * Re-throws network/abort errors as-is for caller to handle.
 */
export async function callAnthropicMessages(
  apiKey: string,
  body: AnthropicRequestBody,
): Promise<AnthropicResponseBody> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION_HEADER,
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  })

  if (!response.ok) {
    throw new AnthropicApiError(response.status, `HTTP ${response.status}`)
  }

  return response.json() as Promise<AnthropicResponseBody>
}
