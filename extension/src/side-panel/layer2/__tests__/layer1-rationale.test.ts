import { describe, it, expect } from 'vitest'
import { getLayer1OverallRationale, getLayer1DimRationale, getLayer1DimRationales } from '../layer1-rationale'
import type { Layer1Signals } from '../../../shared/types'

const baseSignals: Layer1Signals = {
  domain: 'example.com',
  wordCount: 600,
  languageIntensity: 5,
  loadedWords: {
    hits: [],
    uniqueSurfaces: ['radical', 'extremist', 'regime'],
    count: 18,
  },
  hedges: { hits: [], count: 0 },
  attribution: {
    totalAttributions: 15,
    tierCounts: [3, 3, 5, 4],
    byActor: {},
  },
  headlineDrift: { score: 0.45, interpretation: 'medium' },
}

// ─── getLayer1OverallRationale ────────────────────────────────────────────────

describe('getLayer1OverallRationale', () => {
  it('includes loaded word count', () => {
    const rationale = getLayer1OverallRationale(baseSignals)
    expect(rationale).toContain('18')
  })

  it('describes a moderate headline without exposing the "drift" term', () => {
    const rationale = getLayer1OverallRationale(baseSignals)
    expect(rationale).toContain('The headline pushes a bit past the article.')
    expect(rationale).not.toMatch(/headline drift/i)
  })

  it('describes attribution without exposing "assertiveness" jargon', () => {
    const rationale = getLayer1OverallRationale(baseSignals)
    expect(rationale).toContain('charged reporting verbs')
    expect(rationale).not.toMatch(/assertiveness/i)
  })

  it('ends with a period', () => {
    const rationale = getLayer1OverallRationale(baseSignals)
    expect(rationale.endsWith('.')).toBe(true)
  })

  it('uses "word" singular when count=1', () => {
    const signals = { ...baseSignals, loadedWords: { ...baseSignals.loadedWords, count: 1 } }
    const rationale = getLayer1OverallRationale(signals)
    expect(rationale).toContain('Found 1 loaded word.')
  })

  it('uses "words" plural when count>1', () => {
    const rationale = getLayer1OverallRationale(baseSignals)
    expect(rationale).toContain('Found 18 loaded words.')
  })

  it('says "no loaded words detected" when count=0', () => {
    const signals = { ...baseSignals, loadedWords: { hits: [], uniqueSurfaces: [], count: 0 } }
    const rationale = getLayer1OverallRationale(signals)
    expect(rationale).toContain('No loaded words detected.')
  })

  it('low headline drift → "stays close to"', () => {
    const signals = { ...baseSignals, headlineDrift: { score: 0.1, interpretation: 'low' as const } }
    const rationale = getLayer1OverallRationale(signals)
    expect(rationale).toContain("The headline stays close to the article's tone.")
  })

  it('high headline drift → "pushes well past"', () => {
    const signals = { ...baseSignals, headlineDrift: { score: 0.9, interpretation: 'high' as const } }
    const rationale = getLayer1OverallRationale(signals)
    expect(rationale).toContain('The headline pushes well past the article.')
  })

  it('low attribution → "mostly use neutral"', () => {
    const signals = {
      ...baseSignals,
      attribution: { totalAttributions: 10, tierCounts: [7, 2, 1, 0] as [number, number, number, number], byActor: {} },
    }
    const rationale = getLayer1OverallRationale(signals)
    expect(rationale).toContain('Quotes mostly use neutral reporting verbs.')
  })

  it('high attribution → "often use charged"', () => {
    const signals = {
      ...baseSignals,
      attribution: { totalAttributions: 10, tierCounts: [1, 1, 5, 3] as [number, number, number, number], byActor: {} },
    }
    const rationale = getLayer1OverallRationale(signals)
    expect(rationale).toContain('Quotes often use charged reporting verbs.')
  })
})

// ─── getLayer1DimRationale ────────────────────────────────────────────────────

describe('getLayer1DimRationale — word_choice', () => {
  it('includes count', () => {
    const r = getLayer1DimRationale('word_choice', baseSignals)
    expect(r).toContain('18')
  })

  it('includes up to 3 example words', () => {
    const r = getLayer1DimRationale('word_choice', baseSignals)
    expect(r).toContain('radical')
  })

  it('returns "No BABE-flagged words found." when count=0', () => {
    const signals = { ...baseSignals, loadedWords: { hits: [], uniqueSurfaces: [], count: 0 } }
    expect(getLayer1DimRationale('word_choice', signals)).toBe('No BABE-flagged words found.')
  })
})

describe('getLayer1DimRationale — framing', () => {
  it('includes assertive count and total', () => {
    const r = getLayer1DimRationale('framing', baseSignals)
    expect(r).toContain('15')
    expect(r).toContain('9') // tierCounts[2]+[3] = 5+4 = 9
  })
})

describe('getLayer1DimRationale — headline_slant', () => {
  it('includes cosine distance', () => {
    const r = getLayer1DimRationale('headline_slant', baseSignals)
    expect(r).toContain('0.45')
  })

  it('includes tier label', () => {
    const r = getLayer1DimRationale('headline_slant', baseSignals)
    expect(r).toContain('moderate')
  })
})

describe('getLayer1DimRationale — source_mix', () => {
  it('includes total attributions', () => {
    const r = getLayer1DimRationale('source_mix', baseSignals)
    expect(r).toContain('15')
  })

  it('includes evaluative verb count', () => {
    const r = getLayer1DimRationale('source_mix', baseSignals)
    expect(r).toContain('9') // tierCounts[2]+[3] = 5+4 = 9
  })
})

// ─── getLayer1DimRationales ───────────────────────────────────────────────────

describe('getLayer1DimRationales', () => {
  it('returns all four dimension keys', () => {
    const rationales = getLayer1DimRationales(baseSignals)
    expect(Object.keys(rationales)).toEqual(
      expect.arrayContaining(['word_choice', 'framing', 'headline_slant', 'source_mix']),
    )
  })

  it('each value is a non-empty string', () => {
    const rationales = getLayer1DimRationales(baseSignals)
    for (const val of Object.values(rationales)) {
      expect(typeof val).toBe('string')
      expect(val.length).toBeGreaterThan(0)
    }
  })
})
