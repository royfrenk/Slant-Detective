import type { PhraseHit } from '../shared/types'

export const PHRASE_WEIGHT = 3

export function countLoadedPhrases(text: string, phrases: string[]): PhraseHit[] {
  const normalized = text.toLowerCase().replace(/\s+/g, ' ')
  return phrases.flatMap(phrase => {
    const hits: PhraseHit[] = []
    let idx = normalized.indexOf(phrase)
    while (idx !== -1) {
      hits.push({ phrase, offset: idx, length: phrase.length })
      idx = normalized.indexOf(phrase, idx + 1)
    }
    return hits
  })
}
