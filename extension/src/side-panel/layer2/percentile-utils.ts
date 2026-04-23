/**
 * Percentile lookup utilities for score context labels.
 *
 * The distribution array contains one score value per corpus article (sorted ascending).
 * Binary search finds the percentile rank of a given score.
 *
 * SD-040: static corpus distributions, 5-tier global copy.
 * SD-041: per-site copy variant ("more tilted than X% of {domain} articles").
 *
 * PUBLIC SIGNATURES STABLE: scoreToPercentile, percentileToLabel, getPercentileLabel
 * are unchanged. SD-041 adds getPercentileLabelForDomain (additive, non-breaking).
 */

export interface DistributionData {
  overall: number[]
  word_choice?: number[]
  framing?: number[]
  headline_slant?: number[]
  source_mix?: number[]
}

/**
 * Binary-search the sorted distribution array to find the percentile rank
 * of the given score (0–100). Returns a number 0–100.
 *
 * Percentile = proportion of corpus scores strictly less than the given score.
 */
export function scoreToPercentile(score: number, distribution: number[]): number {
  if (distribution.length === 0) return 50

  let lo = 0
  let hi = distribution.length

  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (distribution[mid] < score) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }

  return Math.round((lo / distribution.length) * 100)
}

/**
 * Map a percentile rank to a human-readable label.
 * Returns undefined when distribution is unavailable (callers should omit the row).
 */
export function percentileToLabel(percentile: number): string {
  if (percentile < 20) return 'less tilted than most articles'
  if (percentile < 40) return 'on the neutral end'
  if (percentile < 60) return 'typical for news articles'
  if (percentile < 80) return 'more tilted than most'
  return 'more tilted than 9 in 10 articles'
}

/**
 * Given a score and a sorted distribution array, return the human label.
 * Returns undefined when distribution is null/empty (caller should omit the row).
 */
export function getPercentileLabel(
  score: number,
  distribution: number[] | null | undefined,
): string | undefined {
  if (distribution == null || distribution.length === 0) return undefined
  const percentile = scoreToPercentile(score, distribution)
  return percentileToLabel(percentile)
}

/**
 * SD-041: Per-site copy variant.
 *
 * When a per-site empirical curve is available for the current article's domain,
 * returns "more tilted than X% of {domain} articles" using the numeric percentile.
 * Falls back to the global tier copy when domain is absent.
 *
 * @param score        - overall intensity score 0–10
 * @param distribution - sorted score array (per-site or global)
 * @param domain       - eTLD+1 domain string (e.g. "nytimes.com"), or undefined for global label
 */
export function getPercentileLabelForDomain(
  score: number,
  distribution: number[] | null | undefined,
  domain?: string,
): string | undefined {
  if (distribution == null || distribution.length === 0) return undefined
  const percentile = scoreToPercentile(score, distribution)

  if (domain) {
    // Per-site label: "more tilted than X% of nytimes.com articles"
    // Use the raw percentile number for precision in per-site context.
    return `more tilted than ${percentile}% of ${domain} articles`
  }

  return percentileToLabel(percentile)
}

/**
 * SD-056: Direct score-to-neutrality mapping for Layer 1's signal summary card.
 *
 * The corpus-based percentile lookup produced counterintuitive labels (a
 * displayed "7" paired with "on the neutral end"). Replaced with a linear
 * mapping that the user can read off the 0–10 score directly:
 *
 *   - score 0–4 → "more neutral than (10 - score) × 10 % of articles"
 *   - score 5   → median neutrality
 *   - score 6–10 → "less neutral than score × 10 % of articles"
 *
 * Extremes (0 and 10) are capped at 95% so the label never reads "100% of
 * articles," which is mathematically accurate under the linear model but
 * feels absolute in a way that a 0–10 score can't actually claim.
 */
export type Layer1NeutralityLabel =
  | { kind: 'comparative'; emphasis: 'more' | 'less'; percentage: number }
  | { kind: 'median' }

const EXTREME_PERCENTAGE_CAP = 95

export function getLayer1NeutralityLabel(score: number): Layer1NeutralityLabel {
  const rounded = Math.round(score)
  if (rounded === 5) return { kind: 'median' }
  if (rounded < 5) {
    return {
      kind: 'comparative',
      emphasis: 'more',
      percentage: Math.min(EXTREME_PERCENTAGE_CAP, (10 - rounded) * 10),
    }
  }
  return {
    kind: 'comparative',
    emphasis: 'less',
    percentage: Math.min(EXTREME_PERCENTAGE_CAP, rounded * 10),
  }
}
