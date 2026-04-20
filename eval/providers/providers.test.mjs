/**
 * eval/providers/providers.test.mjs — Unit tests for the provider drivers
 *
 * Run with: node --test eval/providers/providers.test.mjs
 * Or via:   npm run test:providers
 *
 * All tests use mock response fixtures — no live API calls.
 * Tests are isolated: no file I/O, no network, no env var side-effects.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { extractText as openaiExtractText, parseTokenUsage as openaiParseTokenUsage } from './openai.mjs'
import { extractText as geminiExtractText, parseTokenUsage as geminiParseTokenUsage, GeminiSafetyError } from './gemini.mjs'
import { getProvider } from './index.mjs'

// ─── Mock fixtures ────────────────────────────────────────────────────────────

/** @returns {object} Well-formed OpenAI Chat Completions response */
function makeOpenAIResponse(content = '{"rubric_version":"rubric_v1.0-openai"}') {
  return {
    id: 'chatcmpl-abc123',
    object: 'chat.completion',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: 1200,
      completion_tokens: 350,
      total_tokens: 1550,
    },
  }
}

/** @returns {object} Well-formed Gemini generateContent response */
function makeGeminiResponse(text = '{"rubric_version":"rubric_v1.0-gemini"}', finishReason = 'STOP') {
  return {
    candidates: [
      {
        content: {
          parts: [{ text }],
          role: 'model',
        },
        finishReason,
        index: 0,
      },
    ],
    usageMetadata: {
      promptTokenCount: 2100,
      candidatesTokenCount: 410,
      totalTokenCount: 2510,
    },
  }
}

/** @returns {object} Gemini response with finishReason: SAFETY */
function makeGeminiSafetyResponse() {
  return {
    candidates: [
      {
        finishReason: 'SAFETY',
        index: 0,
        safetyRatings: [
          { category: 'HARM_CATEGORY_HATE_SPEECH', probability: 'HIGH', blocked: true },
        ],
      },
    ],
    usageMetadata: {
      promptTokenCount: 2100,
      candidatesTokenCount: 0,
      totalTokenCount: 2100,
    },
  }
}

// ─── Test 6.1: OpenAI extractText returns correct string ─────────────────────

test('openai: extractText returns content string from well-formed response', () => {
  const expectedContent = '{"rubric_version":"rubric_v1.0-openai","overall":{"intensity":3}}'
  const response = makeOpenAIResponse(expectedContent)
  const result = openaiExtractText(response)
  assert.strictEqual(result, expectedContent)
})

// ─── Test 6.2: Gemini extractText returns correct string ─────────────────────

test('gemini: extractText returns text string from well-formed response', () => {
  const expectedText = '{"rubric_version":"rubric_v1.0-gemini","overall":{"intensity":2}}'
  const response = makeGeminiResponse(expectedText)
  const result = geminiExtractText(response)
  assert.strictEqual(result, expectedText)
})

// ─── Test 6.3: Gemini SAFETY finishReason throws GeminiSafetyError ───────────

test('gemini: extractText throws GeminiSafetyError when finishReason is SAFETY', () => {
  const response = makeGeminiSafetyResponse()
  assert.throws(
    () => geminiExtractText(response),
    (err) => {
      // Must be a GeminiSafetyError specifically, not a generic Error
      assert.ok(err instanceof GeminiSafetyError, `Expected GeminiSafetyError, got ${err.constructor.name}`)
      assert.strictEqual(err.name, 'GeminiSafetyError')
      return true
    }
  )
})

// ─── Test 6.4: OpenAI token normalisation ────────────────────────────────────

test('openai: parseTokenUsage normalises prompt_tokens/completion_tokens to input_tokens/output_tokens', () => {
  const response = makeOpenAIResponse()
  // response.usage = { prompt_tokens: 1200, completion_tokens: 350, total_tokens: 1550 }
  const usage = openaiParseTokenUsage(response)
  assert.deepStrictEqual(usage, { input_tokens: 1200, output_tokens: 350 })
})

// ─── Test 6.5: Gemini token normalisation ────────────────────────────────────

test('gemini: parseTokenUsage normalises promptTokenCount/candidatesTokenCount to input_tokens/output_tokens', () => {
  const response = makeGeminiResponse()
  // response.usageMetadata = { promptTokenCount: 2100, candidatesTokenCount: 410 }
  const usage = geminiParseTokenUsage(response)
  assert.deepStrictEqual(usage, { input_tokens: 2100, output_tokens: 410 })
})

// ─── Test 6.6: getProvider throws named error for invalid provider ────────────

test('getProvider: throws a named error listing valid provider names when given an invalid name', () => {
  assert.throws(
    () => getProvider('invalid-provider'),
    (err) => {
      assert.strictEqual(err.name, 'ProviderError')
      // Error message must mention the invalid name and list valid providers
      assert.ok(err.message.includes('invalid-provider'), `Message missing the bad name: ${err.message}`)
      assert.ok(err.message.includes('anthropic'), `Message missing 'anthropic': ${err.message}`)
      assert.ok(err.message.includes('openai'), `Message missing 'openai': ${err.message}`)
      assert.ok(err.message.includes('gemini'), `Message missing 'gemini': ${err.message}`)
      return true
    }
  )
})

// ─── Bonus: getProvider returns the correct driver module ─────────────────────

test('getProvider: returns driver with correct id for each valid provider name', () => {
  for (const name of ['anthropic', 'openai', 'gemini']) {
    const driver = getProvider(name)
    assert.ok(driver, `getProvider('${name}') returned falsy`)
    assert.strictEqual(driver.id, name, `driver.id mismatch for '${name}'`)
  }
})
