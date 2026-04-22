/**
 * Signal-derived rationale templates for Layer 1 (no API key path).
 *
 * Generates one-sentence explanations from deterministic Layer 1 signals.
 * Format: capsule summary leading with the most concrete number available.
 *
 * SD-040
 */
import type { Layer1Signals } from '../../shared/types'

type InterpretationTier = 'low' | 'moderate' | 'high'

function mapHeadlineTier(interpretation: 'low' | 'medium' | 'high'): InterpretationTier {
  if (interpretation === 'high') return 'high'
  if (interpretation === 'medium') return 'moderate'
  return 'low'
}

function attributionTierLabel(signals: Layer1Signals): InterpretationTier {
  const { tierCounts, totalAttributions } = signals.attribution
  if (totalAttributions === 0) return 'low'
  const assertiveCount = tierCounts[2] + tierCounts[3]
  const ratio = assertiveCount / totalAttributions
  if (ratio >= 0.5) return 'high'
  if (ratio >= 0.25) return 'moderate'
  return 'low'
}

/**
 * Generate overall Layer 1 rationale.
 * Three short plain-English sentences: loaded-word count, headline-vs-body tone,
 * reporting-verb charge. No jargon exposed to the reader.
 */
export function getLayer1OverallRationale(signals: Layer1Signals): string {
  const loaded = signals.loadedWords.count
  const drift = mapHeadlineTier(signals.headlineDrift.interpretation)
  const attribution = attributionTierLabel(signals)

  const countPhrase =
    loaded === 0
      ? 'No loaded words detected.'
      : `Found ${loaded} loaded ${loaded === 1 ? 'word' : 'words'}.`

  const driftPhrase =
    drift === 'low'
      ? "The headline stays close to the article's tone."
      : drift === 'moderate'
        ? 'The headline pushes a bit past the article.'
        : 'The headline pushes well past the article.'

  const attributionPhrase =
    attribution === 'low'
      ? 'Quotes mostly use neutral reporting verbs.'
      : attribution === 'moderate'
        ? 'Quotes use a mix of neutral and charged reporting verbs.'
        : 'Quotes often use charged reporting verbs.'

  return `${countPhrase} ${driftPhrase} ${attributionPhrase}`
}

/**
 * Generate per-dim Layer 1 rationale sentences.
 */
export function getLayer1DimRationale(
  dimKey: 'word_choice' | 'framing' | 'headline_slant' | 'source_mix',
  signals: Layer1Signals,
): string {
  switch (dimKey) {
    case 'word_choice': {
      const count = signals.loadedWords.count
      const tops = signals.loadedWords.uniqueSurfaces.slice(0, 3)
      if (count === 0) return 'No BABE-flagged words found.'
      const examples = tops.length > 0 ? `: '${tops.join("', '")}'` : ''
      return `${count} BABE-flagged ${count === 1 ? 'word' : 'words'} found${examples}.`
    }
    case 'framing': {
      const { tierCounts, totalAttributions } = signals.attribution
      const assertive = tierCounts[2] + tierCounts[3]
      return `Attribution assertiveness: ${attributionTierLabel(signals)} (${assertive} of ${totalAttributions} attributions use charged verbs).`
    }
    case 'headline_slant': {
      const tier = mapHeadlineTier(signals.headlineDrift.interpretation)
      const dist = signals.headlineDrift.score.toFixed(2)
      return `Headline drift vs. body: ${tier} (cosine distance ${dist}).`
    }
    case 'source_mix': {
      const { totalAttributions, tierCounts } = signals.attribution
      const evaluative = tierCounts[2] + tierCounts[3]
      return `Source attribution: ${totalAttributions} attributions; ${evaluative} use evaluative verbs.`
    }
  }
}

/**
 * Build a full map of per-dim Layer 1 rationale sentences.
 */
export function getLayer1DimRationales(
  signals: Layer1Signals,
): Record<'word_choice' | 'framing' | 'headline_slant' | 'source_mix', string> {
  return {
    word_choice: getLayer1DimRationale('word_choice', signals),
    framing: getLayer1DimRationale('framing', signals),
    headline_slant: getLayer1DimRationale('headline_slant', signals),
    source_mix: getLayer1DimRationale('source_mix', signals),
  }
}
