// Integration test for OpenAIProvider against the live OpenAI API.
// Skipped unless OPENAI_API_KEY is set in the environment.
// Per testing.md: external API integrations use real API calls, not mocks.

import { describe, it, expect } from 'vitest'
import { OpenAIProvider } from '../../src/service-worker/providers/openai'
import { validateRubricResponse } from '../../src/service-worker/response-validator'

// Inject __RUBRIC_VERSION__ global for rubric-prompt module.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).__RUBRIC_VERSION__ = 'rubric_v1.0'

import { getRubricPrompt, fillUserTemplate } from '../../src/service-worker/rubric-prompt'

const API_KEY = process.env['OPENAI_API_KEY']
const skip = !API_KEY

// Short fixture — no source domain per PRD's source-redaction guardrail.
const FIXTURE_ARTICLE = {
  title: 'Lawmakers Debate Infrastructure Spending Bill',
  body: 'Congressional leaders clashed Thursday over a proposed infrastructure bill that would allocate billions toward road and bridge repairs. Supporters argue the investment is long overdue while critics warn of deficit risks. The legislation faces a key procedural vote next week.',
  word_count: 46,
}

describe.skipIf(skip)('OpenAIProvider — live integration (requires OPENAI_API_KEY)', () => {
  const provider = new OpenAIProvider()

  it('validateKey returns { status: ok } for a valid key', async () => {
    const result = await provider.validateKey(API_KEY!)
    expect(result).toEqual({ status: 'ok' })
  })

  it('complete returns a valid rubric response for a short article fixture', async () => {
    const prompt = getRubricPrompt('openai')
    const userMessage = fillUserTemplate(prompt.user, FIXTURE_ARTICLE)

    const rawResponse = await provider.complete(
      {
        system: prompt.system,
        user: userMessage,
        model: provider.modelIds[0],
        maxTokens: 2048,
      },
      API_KEY!,
    )

    const text = provider.extractText(rawResponse)
    expect(text.length).toBeGreaterThan(0)

    // validateRubricResponse will throw RubricValidationError if the response
    // does not conform to the schema — this verifies schema compliance end-to-end.
    const rubricResponse = validateRubricResponse(text, FIXTURE_ARTICLE.body)
    expect(rubricResponse.rubric_version).toBe('rubric_v1.0-openai')
    expect(typeof rubricResponse.overall.intensity).toBe('number')
    expect(['left', 'center', 'right']).toContain(rubricResponse.overall.direction)
  }, 60_000) // 60s timeout for real API call
})
