import { describe, it, expect, beforeAll } from 'vitest'
import { countLoadedWords } from '../loaded-words'
import { buildStemmedLexicon } from '../lexicon'
import type { StemmedLexicon } from '../../shared/types'

// ---------------------------------------------------------------------------
// Test lexicon — a small set of known BABE words so tests never depend on
// the real babe-lexicon.json file.
// ---------------------------------------------------------------------------

const KNOWN_BIAS_WORDS = ['alleged', 'claimed', 'biased', 'radical', 'partisan', 'extreme']

let lexicon: StemmedLexicon

beforeAll(() => {
  lexicon = buildStemmedLexicon(KNOWN_BIAS_WORDS)
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('countLoadedWords() — edge cases', () => {
  it('returns empty result for empty text', () => {
    const result = countLoadedWords('', lexicon)
    expect(result).toEqual({ hits: [], uniqueSurfaces: [], count: 0 })
  })

  it('returns count 0 for text with no bias words', () => {
    const result = countLoadedWords(
      'The government announced a new program to support local communities.',
      lexicon,
    )
    expect(result.count).toBe(0)
    expect(result.hits).toHaveLength(0)
    expect(result.uniqueSurfaces).toHaveLength(0)
  })

  it('returns count 0 for text with only tokens shorter than 3 characters', () => {
    const result = countLoadedWords('He is an ox at it', lexicon)
    expect(result.count).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Basic matching
// ---------------------------------------------------------------------------

describe('countLoadedWords() — basic matching', () => {
  it('detects a single known bias word', () => {
    const text = 'The alleged perpetrator was questioned by police.'
    const result = countLoadedWords(text, lexicon)
    expect(result.count).toBe(1)
    expect(result.hits[0].surface.toLowerCase()).toBe('alleged')
    expect(result.uniqueSurfaces).toContain('alleged')
  })

  it('detects multiple distinct bias words', () => {
    const text = 'The radical senator made a partisan claim that was alleged by critics.'
    const result = countLoadedWords(text, lexicon)
    expect(result.count).toBeGreaterThanOrEqual(3)
    expect(result.uniqueSurfaces).toContain('radical')
    expect(result.uniqueSurfaces).toContain('partisan')
    expect(result.uniqueSurfaces).toContain('alleged')
  })
})

// ---------------------------------------------------------------------------
// Offset correctness
// ---------------------------------------------------------------------------

describe('countLoadedWords() — offset round-trip', () => {
  it('reconstructs every surface form from its offset and length', () => {
    const text =
      'Officials alleged that the radical group made an extreme and partisan statement.'
    const result = countLoadedWords(text, lexicon)

    expect(result.count).toBeGreaterThan(0)

    for (const hit of result.hits) {
      const reconstructed = text.slice(hit.offset, hit.offset + hit.length)
      expect(reconstructed).toBe(hit.surface)
    }
  })

  it('offset is correct when the bias word appears mid-sentence', () => {
    const prefix = 'The committee found that the report was '
    const word = 'biased'
    const text = `${prefix}${word} against the minority.`
    const expectedOffset = prefix.length

    const result = countLoadedWords(text, lexicon)

    expect(result.count).toBe(1)
    expect(result.hits[0].offset).toBe(expectedOffset)
    expect(text.slice(result.hits[0].offset, result.hits[0].offset + result.hits[0].length)).toBe(
      word,
    )
  })
})

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

describe('countLoadedWords() — deduplication', () => {
  it('counts every occurrence but deduplicates uniqueSurfaces', () => {
    const text = 'The radical idea was radical in theory and radical in practice. Radical.'
    const result = countLoadedWords(text, lexicon)

    expect(result.count).toBe(4)
    expect(result.hits).toHaveLength(4)
    expect(result.uniqueSurfaces).toHaveLength(1)
    expect(result.uniqueSurfaces[0]).toBe('radical')
  })

  it('treats different bias words as separate entries in uniqueSurfaces', () => {
    const text = 'The alleged radical made extreme and partisan claims.'
    const result = countLoadedWords(text, lexicon)

    expect(result.uniqueSurfaces.length).toBeGreaterThanOrEqual(3)
  })
})

// ---------------------------------------------------------------------------
// Case insensitivity
// ---------------------------------------------------------------------------

describe('countLoadedWords() — case insensitivity', () => {
  it('"Alleged" (capitalised) is matched the same as "alleged"', () => {
    const text1 = 'Alleged misconduct was reported.'
    const text2 = 'alleged misconduct was reported.'
    const r1 = countLoadedWords(text1, lexicon)
    const r2 = countLoadedWords(text2, lexicon)

    expect(r1.count).toBe(1)
    expect(r2.count).toBe(1)
    expect(r1.uniqueSurfaces).toEqual(r2.uniqueSurfaces)
  })

  it('ALLEGED (all-caps) is also matched and stored lowercase in uniqueSurfaces', () => {
    const result = countLoadedWords('ALLEGED fraud was investigated.', lexicon)
    expect(result.count).toBe(1)
    expect(result.uniqueSurfaces).toContain('alleged')
  })

  it('mixed-case duplicates collapse to one uniqueSurface entry', () => {
    // "Alleged" and "alleged" are two occurrences of the same surface form.
    // "reported" is not in the lexicon, so count must be exactly 2.
    const text = 'The Alleged source reported alleged findings.'
    const result = countLoadedWords(text, lexicon)

    expect(result.count).toBe(2)
    expect(result.uniqueSurfaces.filter((s) => s === 'alleged')).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// Synthetic article (~1000 words, 20 planted bias-word tokens)
// ---------------------------------------------------------------------------

describe('countLoadedWords() — synthetic article', () => {
  /**
   * Build a ~1000-word article body.  We plant exactly 20 bias-word tokens
   * drawn from KNOWN_BIAS_WORDS at fixed positions so the expected count is
   * deterministic regardless of filler content.
   */
  function makeSyntheticArticle(): { text: string; plantedCount: number } {
    const filler =
      'The official statement noted that several community groups participated in the discussion. ' +
      'Representatives from various organizations were present at the meeting. ' +
      'The committee reviewed the submitted documents carefully before making a recommendation. '

    // Repeat filler to get close to 1000 words (~13 repeats × ~25 words = ~325 words per block)
    const block = filler.repeat(5)   // ~375 words per block
    const blocks = [block, block, block] // ~1125 words total

    // Plant 20 bias-word tokens (use 4 distinct words × 5 occurrences each)
    const planted = [
      'alleged', 'radical', 'partisan', 'extreme',
      'alleged', 'radical', 'partisan', 'extreme',
      'alleged', 'radical', 'partisan', 'extreme',
      'alleged', 'radical', 'partisan', 'extreme',
      'alleged', 'radical', 'partisan', 'extreme',
    ]

    // Interleave bias words after each block
    const parts: string[] = []
    for (let i = 0; i < blocks.length; i++) {
      parts.push(blocks[i])
      // Plant several bias words between blocks
      const chunkStart = i * 6
      const chunk = planted.slice(chunkStart, Math.min(chunkStart + 6, planted.length))
      if (chunk.length > 0) {
        parts.push(chunk.join(' ') + '. ')
      }
    }
    // Append any remaining bias words
    const remaining = planted.slice(blocks.length * 6)
    if (remaining.length > 0) {
      parts.push(remaining.join(' ') + '. ')
    }

    const text = parts.join('\n')
    return { text, plantedCount: 20 }
  }

  it('returns count equal to the number of planted bias words (20)', () => {
    const { text, plantedCount } = makeSyntheticArticle()
    const result = countLoadedWords(text, lexicon)
    // Allow ±1 tolerance as stated in the acceptance criteria
    expect(Math.abs(result.count - plantedCount)).toBeLessThanOrEqual(1)
  })

  it('offset round-trip holds for every hit in the synthetic article', () => {
    const { text } = makeSyntheticArticle()
    const result = countLoadedWords(text, lexicon)

    for (const hit of result.hits) {
      const reconstructed = text.slice(hit.offset, hit.offset + hit.length)
      expect(reconstructed).toBe(hit.surface)
    }
  })
})

// ---------------------------------------------------------------------------
// Performance
// ---------------------------------------------------------------------------

describe('countLoadedWords() — performance', () => {
  it('processes a 1000+ word article in < 100ms', () => {
    const sentence =
      'The journalist reported that several sources confirmed the findings about this important matter. '
    // ~1400 words
    const longText = sentence.repeat(120) + 'The alleged radical partisan made an extreme claim.'

    const start = performance.now()
    const result = countLoadedWords(longText, lexicon)
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(100)
    expect(result.count).toBeGreaterThan(0) // sanity: planted bias words found
  })
})
