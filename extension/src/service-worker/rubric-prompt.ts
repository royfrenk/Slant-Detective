// Single source of truth for all rubric prompts. See getRubricPrompt(providerId).
import type { ProviderId } from './providers/types'

export const RUBRIC_MODEL = 'claude-haiku-4-5-20251001'
export const MAX_TOKENS = 2048
export const MAX_BODY_WORDS = 4000

// Strip common publication suffixes: " - The New York Times", " | Fox News", etc.
const PUBLICATION_SUFFIX_RE = /\s*[-–|]\s*[^-–|]+$/

// System prompt: analyst instructions + JSON schema + output constraint.
// The "Return ONLY a JSON object" line must appear here for OpenAI JSON mode compatibility.
const SYSTEM_PROMPT = `You are a media-bias analyst. Analyze the following news article for political bias across four dimensions. Return ONLY a JSON object — no explanation, no markdown, no code fences.

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

// User template — placeholders filled by the caller at request time.
// {ARTICLE_TITLE} and {ARTICLE_BODY} are the only placeholders here.
const USER_TEMPLATE = `Article:
---
{ARTICLE_TITLE}

{ARTICLE_BODY}
---`

export interface RubricPrompt {
  system: string
  user: string    // Template with {ARTICLE_TITLE} and {ARTICLE_BODY} placeholders
  version: string // Cache-key segment; provider-specific suffix added by SD-033/034
}

export interface ArticleForPrompt {
  title: string
  body: string
  word_count: number
}

function truncateToWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/)
  if (words.length <= maxWords) return text
  return words.slice(0, maxWords).join(' ')
}

function stripPublicationSuffix(title: string): string {
  return title.replace(PUBLICATION_SUFFIX_RE, '').trim()
}

/**
 * Return the rubric prompt descriptor for the given provider.
 * system: fully resolved instruction block (no article placeholders).
 * user: template string with {ARTICLE_TITLE} and {ARTICLE_BODY} that the caller fills.
 * version: provider-specific rubric version string used in buildCacheKey.
 *
 * OpenAI (SD-033) and Gemini (SD-034) will add their own branches here.
 */
export function getRubricPrompt(providerId: ProviderId): RubricPrompt {
  const rubricVersion = __RUBRIC_VERSION__

  if (providerId === 'anthropic') {
    const system = SYSTEM_PROMPT.replaceAll('{RUBRIC_VERSION}', rubricVersion)
    return {
      system,
      user: USER_TEMPLATE,
      version: rubricVersion,
    }
  }

  // SD-033 / SD-034 will replace these stubs.
  throw new Error(`Provider not yet implemented: ${providerId}`)
}

/**
 * Build the filled user message for the given article.
 * Strips publication suffix from title; truncates body to MAX_BODY_WORDS.
 */
export function fillUserTemplate(template: string, article: ArticleForPrompt): string {
  const cleanTitle = stripPublicationSuffix(article.title)
  const truncatedBody = truncateToWords(article.body, MAX_BODY_WORDS)
  return template
    .replace('{ARTICLE_TITLE}', cleanTitle)
    .replace('{ARTICLE_BODY}', truncatedBody)
}
