import type { StemmedLexicon } from '../shared/types';
import { stemToken } from './stemmer';

/**
 * Build a set of Porter-stemmed forms from a raw word list.
 *
 * Called once at startup with the `entries` array from babe-lexicon.json.
 * Returns a Set that allows O(1) per-token lookup via matchesBiasWord().
 *
 * No side effects at module load time — the caller owns lexicon lifecycle.
 */
export function buildStemmedLexicon(words: string[]): StemmedLexicon {
  return new Set(words.map(stemToken));
}
