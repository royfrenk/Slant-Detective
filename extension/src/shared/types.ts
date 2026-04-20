export type ExtractionResult =
  | { ok: true; title: string; body: string; word_count: number; offsets: { start: number; end: number }[] }
  | { ok: false; error: 'extraction_failed' };

// --- Layer 1 signal types ---

export interface Hit {
  surface: string
  stemmed: string
  offset: number
  length: number
}

export interface LoadedWordsResult {
  hits: Hit[]
  uniqueSurfaces: string[]
  count: number
}

export interface PhraseHit {
  phrase: string
  offset: number
  length: number
}

export interface HedgeResult {
  hits: Hit[]
  count: number
}

export type LadderTier = 'neutral' | 'soft' | 'assertive' | 'assertive-plus'

export interface AttributionReport {
  totalAttributions: number
  tierCounts: [number, number, number, number]  // [neutral, soft, assertive, assertive-plus]
  byActor: Record<string, number>
}

export interface HeadlineDrift {
  score: number           // cosine distance 0–1
  interpretation: 'low' | 'medium' | 'high'
}

// Worker message types for embedding-worker.ts postMessage contract
export type EmbedRequest = {
  type: 'embed'
  id: string
  titleText: string
  bodyText: string
}

export type EmbedResponse =
  | { type: 'result'; id: string; score: number }
  | { type: 'error'; id: string; message: string }

// Panel-facing Layer 1 signals DTO — pre-computed scores ready for rendering.
// Raw signal types (LoadedWordsResult, AttributionReport, HeadlineDrift) are
// carried so components can access chip surfaces, tier counts, and interpretation.
export interface Layer1Signals {
  domain: string
  wordCount: number
  languageIntensity: number   // 0–10, pre-computed from loadedWords.count
  loadedWords: LoadedWordsResult
  hedges: HedgeResult
  attribution: AttributionReport
  headlineDrift: HeadlineDrift
}

export type StemmedLexicon = Set<string>

// --- Layer 2 evidence span types ---

export interface EvidenceSpan {
  id: string
  text: string
  start: number
  end: number
  category: 'word_choice' | 'framing' | 'headline_slant' | 'source_mix'
  severity: 'low' | 'medium' | 'high'
  tilt: 'left' | 'right' | 'mixed' | 'unclear'
  reason: string
}

export type AnchoredSpan =
  | { span: EvidenceSpan; domRanges: Range[]; status: 'matched' }
  | { span: EvidenceSpan; domRanges: []; status: 'unmatched' }

// --- Layer 2 rubric types ---

export type RubricDirection = 'left' | 'left-center' | 'center' | 'right-center' | 'right' | 'mixed'
export type SpanTilt = 'left' | 'right' | 'mixed' | 'unclear'
export type RubricSeverity = 'low' | 'medium' | 'high'
export type RubricCategory =
  | 'loaded_language'
  | 'framing'
  | 'headline_slant'
  | 'source_mix'

export interface RubricSpan {
  id: string
  text: string          // quoted text from article — must be non-empty
  offset_start: number
  offset_end: number
  category: RubricCategory
  severity: RubricSeverity
  tilt: SpanTilt
  reason: string        // one sentence — must be non-empty
  dimension: keyof RubricDimensions
}

export interface RubricDimension {
  score: number         // 0–10
  direction?: RubricDirection
  confidence?: number   // 0–1
}

export interface RubricDimensions {
  word_choice: RubricDimension
  framing: RubricDimension
  headline_slant: RubricDimension
  source_mix: RubricDimension
}

export interface RubricOverall {
  intensity: number     // 0–10
  direction: RubricDirection
  confidence: number    // 0–1
}

export interface RubricResponse {
  rubric_version: string
  overall: RubricOverall
  dimensions: RubricDimensions
  spans: RubricSpan[]
}

export interface CacheEntry {
  result: RubricResponse
  cachedAt: number       // Unix timestamp ms (Date.now())
  lastAccessedAt: number // Unix timestamp ms; updated on every hit
}
