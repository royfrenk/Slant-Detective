import { describe, it, expect } from 'vitest'
import { getProvider } from '../index'
import { AnthropicProvider } from '../anthropic'
import { OpenAIProvider } from '../openai'
import type { ProviderId } from '../types'

describe('getProvider factory', () => {
  it('returns an AnthropicProvider for "anthropic"', () => {
    const provider = getProvider('anthropic')
    expect(provider).toBeInstanceOf(AnthropicProvider)
    expect(provider.id).toBe('anthropic')
  })

  it('returns an OpenAIProvider for "openai"', () => {
    const provider = getProvider('openai')
    expect(provider).toBeInstanceOf(OpenAIProvider)
    expect(provider.id).toBe('openai')
  })

  it('throws for an unknown provider id', () => {
    expect(() => getProvider('unknown' as ProviderId)).toThrow('Unknown provider: unknown')
  })

  it('returns the same instance on repeated calls (singleton map)', () => {
    const a = getProvider('anthropic')
    const b = getProvider('anthropic')
    expect(a).toBe(b)
  })

  it('returns the same OpenAI instance on repeated calls (singleton map)', () => {
    const a = getProvider('openai')
    const b = getProvider('openai')
    expect(a).toBe(b)
  })
})
