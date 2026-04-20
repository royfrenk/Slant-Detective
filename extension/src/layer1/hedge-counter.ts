import type { HedgeResult, Hit } from '../shared/types';
import { HEDGE_PHRASES } from './hedge-list';

/**
 * Escape a string for safe use inside a RegExp alternation.
 * Only characters that have special meaning in regex need escaping.
 */
function escapeRegex(phrase: string): string {
  return phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Single compiled regex built once at module load from the sorted hedge list.
 * Phrases are sorted longest-first in hedge-list.ts, so multi-word phrases
 * win over any shorter phrase that shares a prefix.
 *
 * Word-boundary anchors (\b) prevent partial-word matches on embedded text,
 * e.g. "obviously" does not match "some" inside it.
 */
const HEDGE_REGEX = new RegExp(
  `\\b(${HEDGE_PHRASES.map(escapeRegex).join('|')})\\b`,
  'gi',
);

/**
 * Count hedge words and phrases in `body`.
 *
 * Returns a HedgeResult with:
 *   - hits: each match as a Hit (surface form, offset, length)
 *   - count: total number of matches
 *
 * Multi-word phrases (e.g. "may have") are returned as a single Hit,
 * not split into individual word hits.
 *
 * Offsets are character positions in the original body string.
 * Invariant: body.slice(hit.offset, hit.offset + hit.length).toLowerCase() === hit.surface
 */
export function countHedges(body: string): HedgeResult {
  const hits: Hit[] = [];

  for (const match of body.matchAll(HEDGE_REGEX)) {
    const surface = match[0].toLowerCase();
    const offset = match.index ?? 0;
    hits.push({
      surface,
      stemmed: surface,
      offset,
      length: match[0].length,
    });
  }

  return { hits, count: hits.length };
}
