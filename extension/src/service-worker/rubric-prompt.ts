import type { AnthropicRequestBody } from './anthropic-client'

export const RUBRIC_MODEL = 'claude-haiku-4-5-20251001'
export const MAX_TOKENS = 2048
export const MAX_BODY_WORDS = 4000

// Strip common publication suffixes: " - The New York Times", " | Fox News", etc.
const PUBLICATION_SUFFIX_RE = /\s*[-–|]\s*[^-–|]+$/

// Inline prompt template — avoids fetch() per request; versioned by file name.
// {ARTICLE_TITLE}, {ARTICLE_BODY}, and {RUBRIC_VERSION} are interpolated at call time.
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

export function buildRubricPrompt(article: ArticleForPrompt): AnthropicRequestBody {
  const cleanTitle = stripPublicationSuffix(article.title)
  const truncatedBody = truncateToWords(article.body, MAX_BODY_WORDS)
  const rubricVersion = __RUBRIC_VERSION__

  const userContent = PROMPT_TEMPLATE
    .replace('{ARTICLE_TITLE}', cleanTitle)
    .replace('{ARTICLE_BODY}', truncatedBody)
    .replaceAll('{RUBRIC_VERSION}', rubricVersion)

  return {
    model: RUBRIC_MODEL,
    max_tokens: MAX_TOKENS,
    messages: [
      { role: 'user', content: userContent },
    ],
  }
}
