import type {
  RubricResponse,
  RubricDirection,
  SpanTilt,
  RubricDimensions,
  RubricSpan,
  RubricCategory,
  RubricSeverity,
} from '../shared/types'

export class RubricValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RubricValidationError'
  }
}

const VALID_DIRECTIONS = new Set<string>(['left', 'left-center', 'center', 'right-center', 'right', 'mixed'])
const VALID_SEVERITIES = new Set<string>(['low', 'medium', 'high'])
const VALID_CATEGORIES = new Set<string>(['loaded_language', 'framing', 'headline_slant', 'source_mix'])
const VALID_DIMENSIONS = new Set<string>(['word_choice', 'framing', 'headline_slant', 'source_mix'])
const VALID_TILTS = new Set<string>(['left', 'right', 'mixed', 'unclear'])

// Normalise typographic characters so curly/straight quote variants both match.
function normaliseForSearch(s: string): string {
  return s
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2013/g, '-')
    .replace(/\u2014/g, '--')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function spanTextInBody(spanText: string, body: string): boolean {
  const text = spanText.trim()
  if (!text) return false
  if (body.includes(text)) return true
  return normaliseForSearch(body).includes(normaliseForSearch(text))
}

function assertString(val: unknown, field: string): string {
  if (typeof val !== 'string' || val.trim() === '') {
    throw new RubricValidationError(`Missing or empty field: ${field}`)
  }
  return val
}

function assertNumber(val: unknown, field: string, min: number, max: number): number {
  if (typeof val !== 'number' || !isFinite(val) || val < min || val > max) {
    throw new RubricValidationError(`Field "${field}" must be a number between ${min} and ${max}, got: ${String(val)}`)
  }
  return val
}

function assertInSet(val: unknown, field: string, validSet: Set<string>): string {
  if (typeof val !== 'string' || !validSet.has(val)) {
    throw new RubricValidationError(`Field "${field}" has invalid value: ${String(val)}`)
  }
  return val
}

function stripCodeFences(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
}

function parseRawInput(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'string') {
    const cleaned = stripCodeFences(raw)
    try {
      const parsed: unknown = JSON.parse(cleaned)
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new RubricValidationError('Parsed JSON is not an object')
      }
      return parsed as Record<string, unknown>
    } catch (err) {
      if (err instanceof RubricValidationError) throw err
      throw new RubricValidationError(`Invalid JSON: ${String(err)}`)
    }
  }
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    return raw as Record<string, unknown>
  }
  throw new RubricValidationError(`Expected string or object, got: ${typeof raw}`)
}

function validateDimensions(raw: unknown): RubricDimensions {
  if (typeof raw !== 'object' || raw === null) {
    throw new RubricValidationError('Missing or invalid "dimensions" field')
  }
  const dims = raw as Record<string, unknown>
  const keys = ['word_choice', 'framing', 'headline_slant', 'source_mix'] as const

  const result = {} as RubricDimensions
  for (const key of keys) {
    const dim = dims[key]
    if (typeof dim !== 'object' || dim === null) {
      throw new RubricValidationError(`Missing dimension: ${key}`)
    }
    const d = dim as Record<string, unknown>
    const score = assertNumber(d['score'], `dimensions.${key}.score`, 0, 10)
    const direction = VALID_DIRECTIONS.has(String(d['direction'] ?? ''))
      ? (d['direction'] as RubricDirection)
      : undefined
    const confidence = typeof d['confidence'] === 'number' && d['confidence'] >= 0 && d['confidence'] <= 1
      ? d['confidence']
      : undefined
    result[key] = { score, ...(direction !== undefined && { direction }), ...(confidence !== undefined && { confidence }) }
  }
  return result
}

function validateSpan(raw: unknown, index: number): RubricSpan {
  if (typeof raw !== 'object' || raw === null) {
    throw new RubricValidationError(`Span at index ${index} is not an object`)
  }
  const s = raw as Record<string, unknown>

  const id = typeof s['id'] === 'string' && s['id'].trim() !== ''
    ? s['id']
    : crypto.randomUUID()

  const text = assertString(s['text'], `spans[${index}].text`)
  const reason = assertString(s['reason'], `spans[${index}].reason`)
  const offset_start = typeof s['offset_start'] === 'number' ? s['offset_start'] : 0
  const offset_end = typeof s['offset_end'] === 'number' ? s['offset_end'] : 0
  const category = assertInSet(s['category'], `spans[${index}].category`, VALID_CATEGORIES) as RubricCategory
  const severity = assertInSet(s['severity'], `spans[${index}].severity`, VALID_SEVERITIES) as RubricSeverity
  const tilt = assertInSet(s['tilt'], `spans[${index}].tilt`, VALID_TILTS) as SpanTilt
  const dimension = assertInSet(s['dimension'], `spans[${index}].dimension`, VALID_DIMENSIONS) as keyof RubricDimensions

  return { id, text, offset_start, offset_end, category, severity, tilt, reason, dimension }
}

/**
 * Validate and coerce an unknown LLM response into a typed RubricResponse.
 * Throws RubricValidationError on any missing or invalid field.
 * Strips markdown code fences if the input is a string.
 *
 * @param body  When provided, spans whose text cannot be found in the article
 *              body are silently dropped. This prevents highlighting at the wrong
 *              DOM position when the LLM paraphrases instead of quoting verbatim.
 */
export function validateRubricResponse(raw: unknown, body?: string): RubricResponse {
  const obj = parseRawInput(raw)

  const rubric_version = assertString(obj['rubric_version'], 'rubric_version')

  const overallRaw = obj['overall']
  if (typeof overallRaw !== 'object' || overallRaw === null) {
    throw new RubricValidationError('Missing or invalid "overall" field')
  }
  const o = overallRaw as Record<string, unknown>
  const intensity = assertNumber(o['intensity'], 'overall.intensity', 0, 10)
  const direction = assertInSet(o['direction'], 'overall.direction', VALID_DIRECTIONS) as RubricDirection
  const confidence = assertNumber(o['confidence'], 'overall.confidence', 0, 1)

  const dimensions = validateDimensions(obj['dimensions'])

  if (!Array.isArray(obj['spans'])) {
    throw new RubricValidationError('Missing or invalid "spans" field — expected an array')
  }
  let spans: RubricSpan[] = (obj['spans'] as unknown[]).map((s, i) => validateSpan(s, i))

  // Drop spans whose text can't be found in the article body — these are LLM
  // paraphrases/hallucinations that would produce wrong DOM highlights.
  if (body) {
    spans = spans.filter((span) => spanTextInBody(span.text, body))
  }

  // Enforce max 4-word limit regardless of prompt compliance — LLM sometimes
  // returns full clauses or sentences instead of the targeted word/phrase.
  spans = spans.filter((span) => span.text.trim().split(/\s+/).filter(Boolean).length <= 4)

  return {
    rubric_version,
    overall: { intensity, direction, confidence },
    dimensions,
    spans,
  }
}
