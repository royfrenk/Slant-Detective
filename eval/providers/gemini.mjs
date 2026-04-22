/**
 * eval/providers/gemini.mjs — Google Gemini generateContent provider driver
 *
 * ─── INLINE DUPLICATES ───────────────────────────────────────────────────────
 *
 * validateRubricResponse() is duplicated from:
 *   extension/src/service-worker/response-validator.ts
 *
 * The rubric instructions are a placeholder variant based on the Anthropic prompt in:
 *   extension/src/service-worker/rubric-prompt.ts
 *
 * SYNC REQUIRED: Re-sync this prompt against the finalized SD-034 implementation
 * in extension/src/service-worker/providers/ before the Wave 3 parity run.
 * SD-034 may adjust how the system instruction is structured vs. the user turn.
 * Canonical source: extension/src/service-worker/rubric-prompt.ts
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Provider identity ────────────────────────────────────────────────────────

export const id = 'gemini'
export const DEFAULT_MODEL = 'gemini-2.5-flash'

const ENV_VAR = 'GEMINI_API_KEY'
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
// gemini-2.5-flash is a reasoning model; 1024 is too small for full rubric JSON.
// Use 8192 to avoid truncation — actual rubric output is ~300-800 tokens.
const MAX_TOKENS = 8192
const MAX_BODY_WORDS = 4000

/**
 * Pricing constants (as of 2026-04-20, gemini-2.5-flash).
 * Gemini has a free tier (60 req/min, 1,500 req/day) that covers small evals.
 * SD-034 will verify via live curl and may correct these.
 * Update when Google changes pricing.
 */
export const input_price_per_million = 0.15
export const output_price_per_million = 0.60

export const RUBRIC_VERSION = 'rubric_v1.0-gemini'

// ─── Named error for safety filter ───────────────────────────────────────────

export class GeminiSafetyError extends Error {
  constructor(message) {
    super(message)
    this.name = 'GeminiSafetyError'
  }
}

// ─── Validator (duplicated from response-validator.ts) ────────────────────────

class RubricValidationError extends Error {
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
  const keys = ['word_choice', 'framing', 'headline_slant', 'source_mix']
  const result = {}
  for (const key of keys) {
    const dim = raw[key]
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
 *
 * Duplicated from extension/src/service-worker/response-validator.ts
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

  spans = spans.filter((span) => span.text.trim().split(/\s+/).filter(Boolean).length <= 4)

  return {
    rubric_version,
    overall: { intensity, direction, confidence },
    dimensions,
    spans,
  }
}

// ─── Prompt builder ───────────────────────────────────────────────────────────
//
// PLACEHOLDER: The rubric content mirrors the base Anthropic prompt.
// The systemInstruction carries the analyst role + rubric rules.
// The user turn carries the article content.
// SD-034 may restructure this split. Re-sync before the Wave 3 parity run.
// Canonical source: extension/src/service-worker/rubric-prompt.ts

const PUBLICATION_SUFFIX_RE = /\s*[-–|]\s*[^-–|]+$/

const SYSTEM_INSTRUCTION = `You are a media-bias analyst. Analyze news articles for political bias across four dimensions. Return ONLY a JSON object — no explanation, no markdown, no code fences.

Return this exact JSON structure:
{
  "rubric_version": "${RUBRIC_VERSION}",
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

const SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
]

function truncateToWords(text, maxWords) {
  const words = text.split(/\s+/)
  if (words.length <= maxWords) return text
  return words.slice(0, maxWords).join(' ')
}

function stripPublicationSuffix(title) {
  return title.replace(PUBLICATION_SUFFIX_RE, '').trim()
}

/**
 * Build the user-turn content for a single text (sentence-level evaluation).
 *
 * @param {string} text
 * @returns {string}
 */
function buildUserContent(text) {
  const title = '[Sentence-level evaluation]'
  const body = truncateToWords(text, MAX_BODY_WORDS)
  const cleanTitle = stripPublicationSuffix(title)
  return `Article:\n---\n${cleanTitle}\n\n${body}\n---`
}

// ─── API key validation ───────────────────────────────────────────────────────

/**
 * @param {string} apiKey
 */
export function validateKey(apiKey) {
  if (typeof apiKey !== 'string' || apiKey.trim() === '') {
    throw new Error(`${ENV_VAR} is missing or empty`)
  }
}

// ─── Token usage ──────────────────────────────────────────────────────────────

/**
 * Normalise Gemini's usage metadata to the harness-internal shape.
 *
 * Gemini returns: { usageMetadata: { promptTokenCount, candidatesTokenCount, totalTokenCount } }
 *
 * @param {object} apiResponse - Raw JSON response from Gemini
 * @returns {{ input_tokens: number, output_tokens: number }}
 */
export function parseTokenUsage(apiResponse) {
  const meta = apiResponse?.usageMetadata ?? {}
  return {
    input_tokens: typeof meta.promptTokenCount === 'number' ? meta.promptTokenCount : 0,
    output_tokens: typeof meta.candidatesTokenCount === 'number' ? meta.candidatesTokenCount : 0,
  }
}

// ─── Response text extractor ──────────────────────────────────────────────────

/**
 * Extract the text content from a Gemini API response.
 * Throws GeminiSafetyError if the candidate was blocked by the safety filter.
 * Exported for unit-testing without a live API call.
 *
 * @param {object} apiResponse - Raw JSON response from Gemini
 * @returns {string}
 */
export function extractText(apiResponse) {
  // Handle prompt-level safety block (response has no candidates at all)
  const promptFeedback = apiResponse?.promptFeedback
  if (promptFeedback?.blockReason === 'SAFETY') {
    throw new GeminiSafetyError(
      'Gemini blocked this prompt due to safety filters (promptFeedback.blockReason: SAFETY)'
    )
  }

  const candidate = apiResponse?.candidates?.[0]
  if (!candidate) {
    throw new Error('Unexpected Gemini response shape: no candidates')
  }

  // Handle candidate-level safety block (candidate generated but truncated/blocked)
  if (candidate.finishReason === 'SAFETY') {
    throw new GeminiSafetyError(
      'Gemini blocked this sentence due to safety filters (finishReason: SAFETY)'
    )
  }

  const text = candidate?.content?.parts?.[0]?.text
  if (typeof text !== 'string') {
    throw new Error('Unexpected Gemini response shape: missing candidates[0].content.parts[0].text')
  }
  return text
}

// ─── HTTP caller ──────────────────────────────────────────────────────────────

/**
 * Call the Gemini generateContent API and return parsed text + token usage.
 *
 * The rubric instructions are placed in systemInstruction.parts[].text.
 * Safety settings are set to BLOCK_ONLY_HIGH for all harm categories.
 * Some BABE sentences describe extremist language — GeminiSafetyError is thrown
 * when finishReason === 'SAFETY'. The caller counts these as skipped sentences.
 *
 * @param {string} text - Sentence to score
 * @param {string} apiKey
 * @param {string} [model]
 * @returns {Promise<{ text: string, usage: { input_tokens: number, output_tokens: number } }>}
 */
export async function complete(text, apiKey, model = DEFAULT_MODEL) {
  const url = `${API_BASE}/${model}:generateContent`

  const requestBody = {
    systemInstruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: buildUserContent(text) }],
      },
    ],
    generationConfig: {
      maxOutputTokens: MAX_TOKENS,
      // thinkingBudget: 0 suppresses chain-of-thought tokens to match production behavior.
      // Without thinking, output tokens drop from ~418 to ~120, cutting eval cost ~40%.
      thinkingConfig: { thinkingBudget: 0 },
    },
    safetySettings: SAFETY_SETTINGS,
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify(requestBody),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`)
  }

  const json = await res.json()
  return { text: extractText(json), usage: parseTokenUsage(json) }
}
