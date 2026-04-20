import { describe, it, expect } from 'vitest'
import { validateRubricResponse, RubricValidationError } from '../src/service-worker/response-validator'
import type { RubricResponse } from '../src/shared/types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeValidResponse(): RubricResponse {
  return {
    rubric_version: 'v1.0',
    overall: { intensity: 5, direction: 'right', confidence: 0.8 },
    dimensions: {
      word_choice: { score: 6 },
      framing: { score: 4 },
      headline_slant: { score: 7 },
      source_mix: { score: 3 },
    },
    spans: [
      {
        id: '1234',
        text: 'radical agenda',
        offset_start: 10,
        offset_end: 24,
        category: 'loaded_language',
        severity: 'high',
        tilt: 'right',
        reason: 'Loaded political term with strong negative connotation.',
        dimension: 'word_choice',
      },
    ],
  }
}

function makeValidResponseJson(): string {
  return JSON.stringify(makeValidResponse())
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('validateRubricResponse', () => {
  it('accepts a valid response object', () => {
    const result = validateRubricResponse(makeValidResponse())
    expect(result.rubric_version).toBe('v1.0')
    expect(result.overall.intensity).toBe(5)
    expect(result.spans).toHaveLength(1)
  })

  it('accepts a valid response JSON string', () => {
    const result = validateRubricResponse(makeValidResponseJson())
    expect(result.rubric_version).toBe('v1.0')
  })

  it('strips markdown code fences from JSON string', () => {
    const fenced = '```json\n' + makeValidResponseJson() + '\n```'
    const result = validateRubricResponse(fenced)
    expect(result.rubric_version).toBe('v1.0')
  })

  it('strips plain code fences (no language tag)', () => {
    const fenced = '```\n' + makeValidResponseJson() + '\n```'
    const result = validateRubricResponse(fenced)
    expect(result.overall.direction).toBe('right')
  })

  it('accepts a response with an empty spans array (low-bias article)', () => {
    const response = { ...makeValidResponse(), spans: [] }
    const result = validateRubricResponse(response)
    expect(result.spans).toHaveLength(0)
  })

  it('rejects missing rubric_version', () => {
    const response = makeValidResponse()
    const { rubric_version: _omit, ...rest } = response
    expect(() => validateRubricResponse(rest)).toThrow(RubricValidationError)
  })

  it('rejects empty rubric_version', () => {
    const response = { ...makeValidResponse(), rubric_version: '' }
    expect(() => validateRubricResponse(response)).toThrow(RubricValidationError)
  })

  it('rejects missing overall', () => {
    const response = makeValidResponse()
    const { overall: _omit, ...rest } = response
    expect(() => validateRubricResponse(rest)).toThrow(RubricValidationError)
  })

  it('rejects out-of-range overall.intensity (> 10)', () => {
    const response = { ...makeValidResponse(), overall: { ...makeValidResponse().overall, intensity: 11 } }
    expect(() => validateRubricResponse(response)).toThrow(RubricValidationError)
  })

  it('rejects out-of-range overall.intensity (< 0)', () => {
    const response = { ...makeValidResponse(), overall: { ...makeValidResponse().overall, intensity: -1 } }
    expect(() => validateRubricResponse(response)).toThrow(RubricValidationError)
  })

  it('rejects invalid overall.direction', () => {
    const response = {
      ...makeValidResponse(),
      overall: { ...makeValidResponse().overall, direction: 'sideways' as never },
    }
    expect(() => validateRubricResponse(response)).toThrow(RubricValidationError)
  })

  it('rejects missing dimensions', () => {
    const response = makeValidResponse()
    const { dimensions: _omit, ...rest } = response
    expect(() => validateRubricResponse(rest)).toThrow(RubricValidationError)
  })

  it('normalizes span category "word_choice" to "loaded_language" (LLM vocab confusion)', () => {
    const response = makeValidResponse()
    const confusedSpan = { ...response.spans[0], category: 'word_choice' as never }
    const result = validateRubricResponse({ ...response, spans: [confusedSpan] })
    expect(result.spans[0].category).toBe('loaded_language')
  })

  it('rejects a span with empty text', () => {
    const response = makeValidResponse()
    const badSpan = { ...response.spans[0], text: '' }
    expect(() => validateRubricResponse({ ...response, spans: [badSpan] })).toThrow(RubricValidationError)
  })

  it('rejects a span with missing text', () => {
    const response = makeValidResponse()
    const { text: _omit, ...badSpan } = response.spans[0]
    expect(() => validateRubricResponse({ ...response, spans: [badSpan] })).toThrow(RubricValidationError)
  })

  it('rejects a span with empty reason', () => {
    const response = makeValidResponse()
    const badSpan = { ...response.spans[0], reason: '' }
    expect(() => validateRubricResponse({ ...response, spans: [badSpan] })).toThrow(RubricValidationError)
  })

  it('rejects a span with missing reason', () => {
    const response = makeValidResponse()
    const { reason: _omit, ...badSpan } = response.spans[0]
    expect(() => validateRubricResponse({ ...response, spans: [badSpan] })).toThrow(RubricValidationError)
  })

  it('generates a UUID for span id when id is missing', () => {
    const response = makeValidResponse()
    const { id: _omit, ...spanWithoutId } = response.spans[0]
    const result = validateRubricResponse({ ...response, spans: [spanWithoutId] })
    expect(typeof result.spans[0].id).toBe('string')
    expect(result.spans[0].id.length).toBeGreaterThan(0)
  })

  it('rejects invalid JSON string', () => {
    expect(() => validateRubricResponse('not valid json {{')).toThrow(RubricValidationError)
  })

  it('rejects non-object, non-string input', () => {
    expect(() => validateRubricResponse(42)).toThrow(RubricValidationError)
    expect(() => validateRubricResponse(null)).toThrow(RubricValidationError)
    expect(() => validateRubricResponse([])).toThrow(RubricValidationError)
  })

  // ---------------------------------------------------------------------------
  // Body-based span filtering
  // ---------------------------------------------------------------------------

  it('keeps span when text is found verbatim in body', () => {
    const body = 'The radical agenda was pushed by the coalition.'
    const response = makeValidResponse() // span.text = 'radical agenda'
    const result = validateRubricResponse(response, body)
    expect(result.spans).toHaveLength(1)
  })

  it('drops span when text is NOT found in body (LLM paraphrase)', () => {
    const body = 'The progressive agenda was pushed by the coalition.'
    const response = makeValidResponse() // span.text = 'radical agenda' — not in body
    const result = validateRubricResponse(response, body)
    expect(result.spans).toHaveLength(0)
  })

  it('keeps span when text matches after quote normalisation', () => {
    // Body has curly quotes; LLM text has straight quotes
    const body = 'He called it \u201Cshort-term.\u201D'
    const response = makeValidResponse()
    const spanWithQuotes = { ...response.spans[0], text: '"short-term."' }
    const result = validateRubricResponse({ ...response, spans: [spanWithQuotes] }, body)
    expect(result.spans).toHaveLength(1)
  })

  it('keeps all spans when no body is provided', () => {
    const response = makeValidResponse()
    // text 'radical agenda' is not in this contrived body, but body is undefined → no filtering
    const result = validateRubricResponse(response)
    expect(result.spans).toHaveLength(1)
  })
})
