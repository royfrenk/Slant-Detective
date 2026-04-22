import { describe, it, expect } from 'vitest'
import { scoreToPercentile, percentileToLabel, getPercentileLabel } from '../percentile-utils'

// ─── scoreToPercentile ───────────────────────────────────────────────────────

describe('scoreToPercentile', () => {
  it('returns 50 for empty distribution', () => {
    expect(scoreToPercentile(5, [])).toBe(50)
  })

  it('score below all values returns 0', () => {
    const dist = [3, 5, 7, 9]
    expect(scoreToPercentile(0, dist)).toBe(0)
  })

  it('score above all values returns 100', () => {
    const dist = [3, 5, 7, 9]
    expect(scoreToPercentile(10, dist)).toBe(100)
  })

  it('score equal to median returns 50 for even-length distribution', () => {
    const dist = [2, 4, 6, 8]
    // scoreToPercentile(6, [2,4,6,8]): lo after binary search = 2, percentile = 2/4 = 50
    expect(scoreToPercentile(6, dist)).toBe(50)
  })

  it('score at exact first element returns 0', () => {
    const dist = [3, 5, 7, 9]
    expect(scoreToPercentile(3, dist)).toBe(0)
  })

  it('score strictly between elements returns proportion of strictly lower values', () => {
    const dist = [2, 4, 6, 8, 10]
    // 5 is strictly greater than 2,4 but not 6,8,10 → lo = 2 → 2/5 = 40
    expect(scoreToPercentile(5, dist)).toBe(40)
  })

  it('returns integer percentile', () => {
    const dist = Array.from({ length: 100 }, (_, i) => i)
    const percentile = scoreToPercentile(50, dist)
    expect(Number.isInteger(percentile)).toBe(true)
  })

  it('single-element distribution: score below → 0, score at → 0, score above → 100', () => {
    expect(scoreToPercentile(2, [5])).toBe(0)
    expect(scoreToPercentile(5, [5])).toBe(0)
    expect(scoreToPercentile(7, [5])).toBe(100)
  })
})

// ─── percentileToLabel ───────────────────────────────────────────────────────

describe('percentileToLabel', () => {
  it('0th percentile → "less tilted than most articles"', () => {
    expect(percentileToLabel(0)).toBe('less tilted than most articles')
  })

  it('19th percentile → "less tilted than most articles"', () => {
    expect(percentileToLabel(19)).toBe('less tilted than most articles')
  })

  it('20th percentile → "on the neutral end"', () => {
    expect(percentileToLabel(20)).toBe('on the neutral end')
  })

  it('39th percentile → "on the neutral end"', () => {
    expect(percentileToLabel(39)).toBe('on the neutral end')
  })

  it('40th percentile → "typical for news articles"', () => {
    expect(percentileToLabel(40)).toBe('typical for news articles')
  })

  it('59th percentile → "typical for news articles"', () => {
    expect(percentileToLabel(59)).toBe('typical for news articles')
  })

  it('60th percentile → "more tilted than most"', () => {
    expect(percentileToLabel(60)).toBe('more tilted than most')
  })

  it('79th percentile → "more tilted than most"', () => {
    expect(percentileToLabel(79)).toBe('more tilted than most')
  })

  it('80th percentile → "more tilted than 9 in 10 articles"', () => {
    expect(percentileToLabel(80)).toBe('more tilted than 9 in 10 articles')
  })

  it('100th percentile → "more tilted than 9 in 10 articles"', () => {
    expect(percentileToLabel(100)).toBe('more tilted than 9 in 10 articles')
  })
})

// ─── getPercentileLabel ──────────────────────────────────────────────────────

describe('getPercentileLabel', () => {
  it('returns undefined for null distribution', () => {
    expect(getPercentileLabel(5, null)).toBeUndefined()
  })

  it('returns undefined for undefined distribution', () => {
    expect(getPercentileLabel(5, undefined)).toBeUndefined()
  })

  it('returns undefined for empty distribution', () => {
    // Empty distribution returns 50 from scoreToPercentile, so it IS defined
    // Actually: empty → scoreToPercentile returns 50 → "typical for news articles"
    // But getPercentileLabel guards: distribution.length === 0 → undefined
    expect(getPercentileLabel(5, [])).toBeUndefined()
  })

  it('returns a label string for a valid distribution + score', () => {
    const dist = Array.from({ length: 100 }, (_, i) => i * 0.1)
    const label = getPercentileLabel(5, dist)
    expect(typeof label).toBe('string')
    expect(label!.length).toBeGreaterThan(0)
  })

  it('high score on skewed distribution returns high-tier label', () => {
    // Distribution all low: [0,1,2,3,4,5,6,7,8,9] — score=10 hits 100th percentile
    const dist = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    expect(getPercentileLabel(10, dist)).toBe('more tilted than 9 in 10 articles')
  })
})
