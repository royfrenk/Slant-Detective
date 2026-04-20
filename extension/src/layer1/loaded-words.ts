import { stemToken, matchesBiasWord } from './stemmer'
import type { Hit, LoadedWordsResult, StemmedLexicon } from '../shared/types'

export function countLoadedWords(text: string, lexicon: StemmedLexicon): LoadedWordsResult {
  // Regex created per-call to avoid stale lastIndex state from the `g` flag
  const tokenRegex = /\b[a-z]{3,}\b/gi
  const hits: Hit[] = []

  for (const match of text.matchAll(tokenRegex)) {
    const surface = match[0]
    if (matchesBiasWord(surface, lexicon)) {
      hits.push({
        surface,
        stemmed: stemToken(surface),
        offset: match.index as number,
        length: surface.length,
      })
    }
  }

  const uniqueSurfaces = [...new Set(hits.map((h) => h.surface.toLowerCase()))].sort()

  return { hits, uniqueSurfaces, count: hits.length }
}
