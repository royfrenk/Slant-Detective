import type { LLMProvider, ProviderId } from './types'
import { AnthropicProvider } from './anthropic'

const PROVIDERS: Record<string, LLMProvider> = {
  anthropic: new AnthropicProvider(),
  // SD-033: openai will be added here
  // SD-034: gemini will be added here
}

/**
 * Return the LLMProvider for the given provider ID.
 * Throws if the provider is not registered (e.g., 'openai' before SD-033 lands).
 */
export function getProvider(id: ProviderId): LLMProvider {
  const provider = PROVIDERS[id]
  if (!provider) {
    throw new Error(`Unknown provider: ${id}`)
  }
  return provider
}
