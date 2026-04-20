export type ApiKeyTestResult =
  | { status: 'ok' }
  | { status: 'invalid'; code: 401 | 403 }
  | { status: 'reachable-unverified' }  // HTTP response received but not 200/401/403
  | { status: 'network-error' }          // no response (connection failed, timeout)

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages'

export async function validateApiKey(key: string): Promise<ApiKeyTestResult> {
  try {
    const response = await fetch(ANTHROPIC_MESSAGES_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(30_000),
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
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
