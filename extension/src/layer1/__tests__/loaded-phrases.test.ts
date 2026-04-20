import { describe, it, expect } from 'vitest'
import { countLoadedPhrases, PHRASE_WEIGHT } from '../loaded-phrases'

describe('countLoadedPhrases() — edge cases', () => {
  it('returns empty array for empty text', () => {
    const result = countLoadedPhrases('', ['islamization of', 'open borders'])
    expect(result).toEqual([])
  })

  it('returns empty array when phrase is not present', () => {
    const result = countLoadedPhrases(
      'The Islamic Republic of Iran issued a statement.',
      ['islamization of'],
    )
    expect(result).toEqual([])
  })
})

describe('countLoadedPhrases() — matching', () => {
  it('returns correct phrase, offset, and length for a single match', () => {
    const text = 'Critics warned about the islamization of Europe in the article.'
    const result = countLoadedPhrases(text, ['islamization of'])
    expect(result).toHaveLength(1)
    expect(result[0].phrase).toBe('islamization of')
    expect(result[0].length).toBe('islamization of'.length)
    expect(text.toLowerCase().slice(result[0].offset, result[0].offset + result[0].length)).toBe(
      'islamization of',
    )
  })

  it('returns multiple PhraseHit entries with correct offsets for repeated phrase', () => {
    const text = 'open borders policy and open borders advocates'
    const result = countLoadedPhrases(text, ['open borders'])
    expect(result).toHaveLength(2)
    expect(result[0].phrase).toBe('open borders')
    expect(result[1].phrase).toBe('open borders')
    expect(result[0].offset).toBeLessThan(result[1].offset)
    expect(text.slice(result[0].offset, result[0].offset + result[0].length)).toBe('open borders')
    expect(text.slice(result[1].offset, result[1].offset + result[1].length)).toBe('open borders')
  })

  it('matches phrase regardless of original text case', () => {
    const text = 'They fear the Islamization Of Europe spreading.'
    const result = countLoadedPhrases(text, ['islamization of'])
    expect(result).toHaveLength(1)
    expect(result[0].phrase).toBe('islamization of')
  })

  it('matches phrase when text has multiple consecutive spaces', () => {
    const text = 'open  borders  policy is debated.'
    const result = countLoadedPhrases(text, ['open borders'])
    expect(result).toHaveLength(1)
    expect(result[0].phrase).toBe('open borders')
  })

  it('does not match "Islamic Republic of Iran" against phrase "islamization of"', () => {
    const text = 'The Islamic Republic of Iran held elections.'
    const result = countLoadedPhrases(text, ['islamization of'])
    expect(result).toHaveLength(0)
  })
})

describe('PHRASE_WEIGHT', () => {
  it('is exported and equals 3', () => {
    expect(PHRASE_WEIGHT).toBe(3)
  })
})

describe('countLoadedPhrases() — performance', () => {
  it('completes in < 100ms on a 5000-word text with 200 phrases', () => {
    const sentence =
      'The government announced a new initiative to support economic growth and stability. '
    const longText = sentence.repeat(65)

    const phrases = Array.from({ length: 200 }, (_, i) => `phrase number ${i + 1}`)

    const start = performance.now()
    countLoadedPhrases(longText, phrases)
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(100)
  })
})
