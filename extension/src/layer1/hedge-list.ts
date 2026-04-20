/**
 * Curated hedge-word/phrase list for Layer 1 epistemic-hedging detection.
 *
 * Source: Hyland, K. (2005). Metadiscourse: Exploring Interaction in Writing.
 *         Continuum, London/New York. (Hedge taxonomy, pp. 52–53)
 *
 * Categories covered:
 *   - Epistemic adverbs (single-word markers of uncertain source or degree)
 *   - Modal hedges (modal auxiliaries used hedgingly)
 *   - Multi-word modals (phrasal constructions that hedge attribution/certainty)
 *   - Approximators (degree + frequency hedges)
 *
 * Ordering: sorted longest-first so the alternation regex matches the most
 * specific phrase before any prefix it shares with a shorter hedge.
 * e.g. "may have" matches before "may" for the string "may have done".
 */

const HEDGE_PHRASES_UNSORTED: string[] = [
  // Multi-word modals (must come before their constituent single words)
  'is thought to',
  'is believed to',
  'is considered to',
  'is said to',
  'appears to',
  'seems to',
  'tends to',
  'may have',
  'might have',
  'could have',
  'would have',
  'should have',

  // Epistemic adverbs
  'apparently',
  'arguably',
  'conceivably',
  'likely',
  'possibly',
  'presumably',
  'probably',
  'purportedly',
  'reportedly',
  'seemingly',
  'supposedly',
  'uncertain',
  'unlikely',
  'allegedly',
  'ostensibly',

  // Modal hedges (single-word)
  'could',
  'might',
  'would',
  'should',
  'may',
  'can',

  // Approximators
  'approximately',
  'generally',
  'somewhat',
  'usually',
  'roughly',
  'almost',
  'around',
  'often',
  'about',
  'some',
];

/**
 * Hedge phrases sorted longest-first to ensure multi-word phrases are tried
 * before their shorter prefixes in the alternation regex.
 */
export const HEDGE_PHRASES: string[] = [...HEDGE_PHRASES_UNSORTED].sort(
  (a, b) => b.length - a.length,
);
