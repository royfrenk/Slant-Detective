/**
 * Percentile lookup utilities for score context labels.
 *
 * The distribution array contains one score value per corpus article (100 entries),
 * sorted ascending. Binary search finds the percentile rank of a given score.
 *
 * SD-041 will extend this to prefer per-site empirical curves when available.
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
