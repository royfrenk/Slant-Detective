/**
 * eval/rubric-driver.mjs — Node.js Anthropic caller + response validator
 *
 * Runs in Node.js (>=18 native fetch). Does NOT use the browser-only header
 * `anthropic-dangerous-direct-browser-access`.
 *
 * ─── INLINE DUPLICATES ───────────────────────────────────────────────────────
 *
 * validateRubricResponse() is duplicated from:
 *   extension/src/service-worker/response-validator.ts
 * Keep in sync when the validator changes.
 *
 * buildPrompt() is duplicated from:
 *   extension/src/service-worker/rubric-prompt.ts
 * __RUBRIC_VERSION__ (Vite define) is replaced by the RUBRIC_VERSION constant.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Constants ───────────────────────────────────────────────────────────────

export const RUBRIC_VERSION = 'v1.0'
const MODEL = 'claude-haiku-4-5-20251001'
const MAX_TOKENS = 1024   // Sentences are short; 2048 is wasteful here
const API_URL = 'https://api.anthropic.com/v1/messages'
const MAX_BODY_WORDS = 4000

// ─── Validator (duplicated from response-validator.ts) ────────────────────────

export class RubricValidationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'RubricValidationError'
  }
}

const VALID_DIRECTIONS = new Set(['left', 'left-center', 'center', 'right-center', 'right', 'mixed'])
const VALID_SEVERITIES = new Set(['low', 'medium', 'high'])
const VALID_CATEGORIES = new Set(['loaded_language', 'framing', 'headline_slant', 'source_mix'])
const VALID_DIMENSIONS = new Set(['word_choice', 'framing', 'headline_slant', 'source_mix'])
const VALID_TILTS = new Set(['left', 'right', 'mixed', 'unclear'])

function normaliseForSearch(s) {
  return s
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2013/g, '-')
    .replace(/\u2014/g, '--')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function spanTextInBody(spanText, body) {
  const text = spanText.trim()
  if (!text) return false
  if (body.includes(text)) return true
  return normaliseForSearch(body).includes(normaliseForSearch(text))
}

function assertString(val, field) {
  if (typeof val !== 'string' || val.trim() === '') {
    throw new RubricValidationError(`Missing or empty field: ${field}`)
  }
  return val
}

function assertNumber(val, field, min, max) {
  if (typeof val !== 'number' || !isFinite(val) || val < min || val > max) {
    throw new RubricValidationError(
      `Field "${field}" must be a number between ${min} and ${max}, got: ${String(val)}`
    )
  }
  return val
}

function assertInSet(val, field, validSet) {
  if (typeof val !== 'string' || !validSet.has(val)) {
    throw new RubricValidationError(`Field "${field}" has invalid value: ${String(val)}`)
  }
  return val
}

function stripCodeFences(raw) {
  return raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
}

function parseRawInput(raw) {
  if (typeof raw === 'string') {
    const cleaned = stripCodeFences(raw)
    try {
      const parsed = JSON.parse(cleaned)
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new RubricValidationError('Parsed JSON is not an object')
      }
      return parsed
    } catch (err) {
      if (err instanceof RubricValidationError) throw err
      throw new RubricValidationError(`Invalid JSON: ${String(err)}`)
    }
  }
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    return raw
  }
  throw new RubricValidationError(`Expected string or object, got: ${typeof raw}`)
}

function validateDimensions(raw) {
  if (typeof raw !== 'object' || raw === null) {
    throw new RubricValidationError('Missing or invalid "dimensions" field')
  }
  const dims = raw
  const keys = ['word_choice', 'framing', 'headline_slant', 'source_mix']
  const result = {}
  for (const key of keys) {
    const dim = dims[key]
    if (typeof dim !== 'object' || dim === null) {
      throw new RubricValidationError(`Missing dimension: ${key}`)
    }
    const score = assertNumber(dim['score'], `dimensions.${key}.score`, 0, 10)
    const direction = VALID_DIRECTIONS.has(String(dim['direction'] ?? ''))
      ? dim['direction']
      : undefined
    const confidence =
      typeof dim['confidence'] === 'number' && dim['confidence'] >= 0 && dim['confidence'] <= 1
        ? dim['confidence']
        : undefined
    result[key] = {
      score,
      ...(direction !== undefined && { direction }),
      ...(confidence !== undefined && { confidence }),
    }
  }
  return result
}

function validateSpan(raw, index) {
  if (typeof raw !== 'object' || raw === null) {
    throw new RubricValidationError(`Span at index ${index} is not an object`)
  }
  // In Node.js context we don't have crypto.randomUUID on older versions — use fallback
  const id =
    typeof raw['id'] === 'string' && raw['id'].trim() !== ''
      ? raw['id']
      : Math.random().toString(36).slice(2)

  const text = assertString(raw['text'], `spans[${index}].text`)
  const reason = assertString(raw['reason'], `spans[${index}].reason`)
  const offset_start = typeof raw['offset_start'] === 'number' ? raw['offset_start'] : 0
  const offset_end = typeof raw['offset_end'] === 'number' ? raw['offset_end'] : 0
  const rawCategory = raw['category'] === 'word_choice' ? 'loaded_language' : raw['category']
  const category = assertInSet(rawCategory, `spans[${index}].category`, VALID_CATEGORIES)
  const severity = assertInSet(raw['severity'], `spans[${index}].severity`, VALID_SEVERITIES)
  const tilt = assertInSet(raw['tilt'], `spans[${index}].tilt`, VALID_TILTS)
  const dimension = assertInSet(raw['dimension'], `spans[${index}].dimension`, VALID_DIMENSIONS)

  return { id, text, offset_start, offset_end, category, severity, tilt, reason, dimension }
}

/**
 * Validate and coerce an unknown LLM response into a typed RubricResponse.
 * Throws RubricValidationError on any missing or invalid field.
 * Strips markdown code fences if the input is a string.
 *
 * Duplicated from extension/src/service-worker/response-validator.ts
 * Keep in sync when the validator changes.
 *
 * @param {unknown} raw
 * @param {string} [body]
 * @returns {object}
 */
export function validateRubricResponse(raw, body) {
  const obj = parseRawInput(raw)

  const rubric_version = assertString(obj['rubric_version'], 'rubric_version')

  const overallRaw = obj['overall']
  if (typeof overallRaw !== 'object' || overallRaw === null) {
    throw new RubricValidationError('Missing or invalid "overall" field')
  }
  const intensity = assertNumber(overallRaw['intensity'], 'overall.intensity', 0, 10)
  const direction = assertInSet(overallRaw['direction'], 'overall.direction', VALID_DIRECTIONS)
  const confidence = assertNumber(overallRaw['confidence'], 'overall.confidence', 0, 1)

  const dimensions = validateDimensions(obj['dimensions'])

  if (!Array.isArray(obj['spans'])) {
    throw new RubricValidationError('Missing or invalid "spans" field — expected an array')
  }
  let spans = obj['spans'].map((s, i) => validateSpan(s, i))

  if (body) {
    spans = spans.filter((span) => spanTextInBody(span.text, body))
  }

  // Enforce max 4-word limit
  spans = spans.filter((span) => span.text.trim().split(/\s+/).filter(Boolean).length <= 4)

  return {
    rubric_version,
    overall: { intensity, direction, confidence },
    dimensions,
    spans,
  }
}

// ─── Prompt builder (duplicated from rubric-prompt.ts) ────────────────────────

const PUBLICATION_SUFFIX_RE = /\s*[-–|]\s*[^-–|]+$/

const PROMPT_TEMPLATE = `You are a media-bias analyst. Analyze the following news article for political bias across four dimensions. Return ONLY a JSON object — no explanation, no markdown, no code fences.

Article:
---
{ARTICLE_TITLE}

{ARTICLE_BODY}
---

Return this exact JSON structure:
{
  "rubric_version": "{RUBRIC_VERSION}",
  "overall": {
    "intensity": <0-10 where 0=no bias, 10=extreme bias>,
    "direction": <"left"|"center"|"right">,
    "confidence": <0.0-1.0>
  },
  "dimensions": {
    "word_choice": { "score": <0-10> },
    "framing": { "score": <0-10> },
    "headline_slant": { "score": <0-10> },
    "source_mix": { "score": <0-10> }
  },
  "spans": [
    {
      "id": "<uuid-v4>",
      "text": "<the specific biased word or short phrase — 1 to 4 words, copied character-for-character from the article body>",
      "offset_start": <character offset of text in body>,
      "offset_end": <character offset of text in body>,
      "category": <"loaded_language"|"framing"|"headline_slant"|"source_mix">,
      "severity": <"low"|"medium"|"high">,
      "tilt": <"left"|"right"|"mixed"|"unclear">,
      "reason": "<one sentence explaining why this specific word or phrase signals bias — include context from the surrounding sentence>",
      "dimension": <"word_choice"|"framing"|"headline_slant"|"source_mix">
    }
  ]
}

Dimension definitions:
- word_choice: Loaded, charged, or emotionally weighted word choices that favour one political side.
- framing: How the story is structured — which angle is emphasised, what is omitted, whose perspective leads.
- headline_slant: Whether the headline exaggerates, misleads, or carries more ideological charge than the body supports.
- source_mix: Balance of attributed sources. Neutral verbs (said, stated) = unbiased; mild-negative verbs (claimed, alleged) = mild negative framing; strong-negative verbs (admitted, conceded) = strong negative framing.

Rules:
- spans array MUST contain at least 1 item for biased articles (overall.intensity > 2)
- text is the OFFENDING WORD OR PHRASE — 1 word preferred; up to 3 words when the bias is in a multi-word phrase (e.g. "radical left agenda", "Hamas-led militants"); 4 words absolute maximum
- text MUST be copied character-for-character from the article body
- Do not copy phrases, clauses, or sentences into text — put surrounding context in reason instead
- Do NOT create spans for text inside direct quotations from named sources (text enclosed in quotation marks attributed to a person, e.g. "...", said Name). Focus on editorial language, not source statements.
- offset_start and offset_end are character offsets of that exact word in the body text (not the title)
- Do NOT reference the publication name, domain, or brand in your reasoning
- Analyze the text content only — treat the article as anonymous`

function truncateToWords(text, maxWords) {
  const words = text.split(/\s+/)
  if (words.length <= maxWords) return text
  return words.slice(0, maxWords).join(' ')
}

function stripPublicationSuffix(title) {
  return title.replace(PUBLICATION_SUFFIX_RE, '').trim()
}

/**
 * Build the rubric prompt for a single sentence (treated as minimal article body).
 *
 * @param {string} text - The sentence text
 * @returns {string} - The prompt string
 */
function buildPrompt(text) {
  const title = '[Sentence-level evaluation]'
  const body = truncateToWords(text, MAX_BODY_WORDS)
  const cleanTitle = stripPublicationSuffix(title)

  return PROMPT_TEMPLATE
    .replace('{ARTICLE_TITLE}', cleanTitle)
    .replace('{ARTICLE_BODY}', body)
    .replaceAll('{RUBRIC_VERSION}', RUBRIC_VERSION)
}

// ─── Anthropic API caller ─────────────────────────────────────────────────────

/**
 * Score a single text using the rubric.
 *
 * @param {string} text
 * @param {string} apiKey
 * @returns {Promise<object>} - Validated RubricResponse
 */
export async function scoreText(text, apiKey) {
  const body = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [{ role: 'user', content: buildPrompt(text) }],
  }

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`)
  }

  const json = await res.json()
  const rawText = json.content?.[0]?.text
  if (typeof rawText !== 'string') throw new Error('Unexpected Anthropic response shape')

  return validateRubricResponse(rawText, text)
}

// ─── Concurrency-limited batch runner ────────────────────────────────────────

/**
 * Score a batch of sentences with a concurrency limit.
 * Returns results in the same order as inputs.
 * Each item is either a validated RubricResponse or an Error.
 *
 * @param {string[]} sentences
 * @param {string} apiKey
 * @param {number} concurrency
 * @param {(n: number) => void} [onProgress] - Called after each sentence completes
 * @returns {Promise<Array<object | Error>>}
 */
export async function scoreBatch(sentences, apiKey, concurrency, onProgress) {
  const results = new Array(sentences.length)
  const queue = sentences.map((text, i) => ({ text, i }))
  let queueIdx = 0
  let running = 0
  let completed = 0

  return new Promise((resolve, reject) => {
    const tryNext = () => {
      while (running < concurrency && queueIdx < queue.length) {
        const { text, i } = queue[queueIdx++]
        running++

        scoreText(text, apiKey)
          .then((response) => {
            results[i] = response
          })
          .catch((err) => {
            results[i] = err instanceof Error ? err : new Error(String(err))
          })
          .finally(() => {
            running--
            completed++
            if (onProgress) onProgress(completed)
            if (completed === sentences.length) {
              resolve(results)
            } else {
              tryNext()
            }
          })
      }
    }

    if (sentences.length === 0) {
      resolve(results)
      return
    }

    tryNext()
  })
}
