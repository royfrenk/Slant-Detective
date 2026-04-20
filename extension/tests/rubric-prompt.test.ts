import { describe, it, expect, vi, beforeEach } from 'vitest'

// Inject __RUBRIC_VERSION__ global (normally provided by Vite's define plugin).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).__RUBRIC_VERSION__ = 'rubric_v1.0'

import { getRubricPrompt, fillUserTemplate } from '../src/service-worker/rubric-prompt'

describe('getRubricPrompt("anthropic")', () => {
  it('version is the injected rubric version', () => {
    const prompt = getRubricPrompt('anthropic')
    expect(prompt.version).toBe('rubric_v1.0')
  })

  it('system contains "analyst"', () => {
    const { system } = getRubricPrompt('anthropic')
    expect(system.toLowerCase()).toContain('analyst')
  })

  it('system contains "Return ONLY a JSON object" (required for OpenAI JSON mode)', () => {
    const { system } = getRubricPrompt('anthropic')
    expect(system).toContain('Return ONLY a JSON object')
  })

  it('user template contains {ARTICLE_TITLE} placeholder', () => {
    const { user } = getRubricPrompt('anthropic')
    expect(user).toContain('{ARTICLE_TITLE}')
  })

  it('user template contains {ARTICLE_BODY} placeholder', () => {
    const { user } = getRubricPrompt('anthropic')
    expect(user).toContain('{ARTICLE_BODY}')
  })

  it('system does NOT contain {ARTICLE_TITLE} (not in system prompt)', () => {
    const { system } = getRubricPrompt('anthropic')
    expect(system).not.toContain('{ARTICLE_TITLE}')
  })

  it('system does NOT contain {ARTICLE_BODY} (not in system prompt)', () => {
    const { system } = getRubricPrompt('anthropic')
    expect(system).not.toContain('{ARTICLE_BODY}')
  })

  it('user template does NOT contain {RUBRIC_VERSION} (resolved in system)', () => {
    const { user } = getRubricPrompt('anthropic')
    expect(user).not.toContain('{RUBRIC_VERSION}')
  })
})

describe('getRubricPrompt("openai")', () => {
  it('version is rubric_v1.0-openai', () => {
    const prompt = getRubricPrompt('openai')
    expect(prompt.version).toBe('rubric_v1.0-openai')
  })

  it('system contains "Return ONLY a JSON object" (activates OpenAI JSON mode)', () => {
    const { system } = getRubricPrompt('openai')
    expect(system).toContain('Return ONLY a JSON object')
  })

  it('system contains JSON-only directive suffix', () => {
    const { system } = getRubricPrompt('openai')
    expect(system).toContain('Respond with a JSON object only')
  })

  it('system does NOT contain {ARTICLE_TITLE} placeholder', () => {
    const { system } = getRubricPrompt('openai')
    expect(system).not.toContain('{ARTICLE_TITLE}')
  })

  it('system does NOT contain {ARTICLE_BODY} placeholder', () => {
    const { system } = getRubricPrompt('openai')
    expect(system).not.toContain('{ARTICLE_BODY}')
  })

  it('user template contains {ARTICLE_TITLE} placeholder', () => {
    const { user } = getRubricPrompt('openai')
    expect(user).toContain('{ARTICLE_TITLE}')
  })

  it('user template contains {ARTICLE_BODY} placeholder', () => {
    const { user } = getRubricPrompt('openai')
    expect(user).toContain('{ARTICLE_BODY}')
  })

  it('system does NOT contain the word "anthropic" (no provider-specific leakage)', () => {
    const { system } = getRubricPrompt('openai')
    expect(system.toLowerCase()).not.toContain('anthropic')
  })
})

describe('getRubricPrompt — unimplemented providers', () => {
  it('throws for "gemini" (SD-034 not yet implemented)', () => {
    expect(() => getRubricPrompt('gemini')).toThrow('Provider not yet implemented')
  })
})

describe('fillUserTemplate', () => {
  it('replaces {ARTICLE_TITLE} with the clean title', () => {
    const { user } = getRubricPrompt('anthropic')
    const filled = fillUserTemplate(user, { title: 'My Article - Publisher', body: 'body text', word_count: 10 })
    expect(filled).toContain('My Article')
    // Publication suffix stripped
    expect(filled).not.toContain('Publisher')
  })

  it('replaces {ARTICLE_BODY} with (truncated) body', () => {
    const { user } = getRubricPrompt('anthropic')
    const filled = fillUserTemplate(user, { title: 'Title', body: 'Some article body.', word_count: 4 })
    expect(filled).toContain('Some article body.')
  })
})

beforeEach(() => {
  vi.clearAllMocks()
})
