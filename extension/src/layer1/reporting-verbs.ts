import compromise from 'compromise';
import { VERB_TO_TIER } from './verb-ladder';
import type { AttributionReport, LadderTier } from '../shared/types';

const TIER_INDEX: Record<LadderTier, number> = {
  neutral: 0,
  soft: 1,
  assertive: 2,
  'assertive-plus': 3,
};

const ZERO_TIER_COUNTS: [number, number, number, number] = [0, 0, 0, 0];

interface Attribution {
  readonly verb: string;
  readonly tier: LadderTier;
  readonly actor: string;
}

/**
 * Split `body` into individual sentences using compromise's sentence segmenter.
 * Returns an empty array for blank or whitespace-only input.
 */
function splitToSentences(body: string): string[] {
  if (!body.trim()) return [];
  return (compromise(body).sentences().out('array') as string[]).filter(
    (s) => s.trim().length > 0,
  );
}

/**
 * Find the best actor label for `sentence`.
 *
 * Strategy (in order):
 *   1. Named people detected by compromise's `.people()` NER.
 *   2. First-person pronoun ("I").
 *   3. Other subject pronouns (he/she/they/we/it).
 *   4. Falls back to 'unnamed' when nothing is found.
 */
function extractActor(sentence: string): string {
  const doc = compromise(sentence);

  const people = doc.people().out('array') as string[];
  if (people.length > 0) {
    return people[0].trim();
  }

  const lower = sentence.toLowerCase();
  for (const pronoun of ['i ', 'she ', 'he ', 'they ', 'we ', 'it ']) {
    if (lower.includes(pronoun)) {
      return pronoun.trim();
    }
  }

  return 'unnamed';
}

/**
 * Extract all attribution events (verb + tier + actor) from a single sentence.
 *
 * For each verb token in the sentence that appears in VERB_TO_TIER, we record
 * one Attribution. The actor is resolved once per sentence (the nearest named
 * entity or pronoun).
 */
function extractAttributions(sentence: string): Attribution[] {
  const verbTokens = compromise(sentence).verbs().out('array') as string[];

  const matched: Attribution[] = [];
  let actorCache: string | undefined;

  for (const token of verbTokens) {
    const normalised = token.toLowerCase().trim();
    const tier = VERB_TO_TIER.get(normalised);

    if (tier !== undefined) {
      if (actorCache === undefined) {
        actorCache = extractActor(sentence);
      }
      matched.push({ verb: normalised, tier, actor: actorCache });
    }
  }

  return matched;
}

/**
 * Analyse `text` for reporting-verb attributions.
 *
 * Returns an `AttributionReport`:
 *   - `totalAttributions`: count of all matched attribution verbs
 *   - `tierCounts`: [neutral, soft, assertive, assertive-plus] tallies
 *   - `byActor`: speaker → attribution count map
 *
 * Designed to run in < 200 ms on a ~1 000-word article in V8.
 */
export function analyzeAttribution(text: string): AttributionReport {
  if (!text.trim()) {
    return {
      totalAttributions: 0,
      tierCounts: [...ZERO_TIER_COUNTS] as [number, number, number, number],
      byActor: {},
    };
  }

  const sentences = splitToSentences(text);
  const tierCounts: [number, number, number, number] = [0, 0, 0, 0];
  const byActor: Record<string, number> = {};
  let totalAttributions = 0;

  for (const sentence of sentences) {
    const attributions = extractAttributions(sentence);

    for (const { tier, actor } of attributions) {
      totalAttributions += 1;
      tierCounts[TIER_INDEX[tier]] += 1;
      byActor[actor] = (byActor[actor] ?? 0) + 1;
    }
  }

  return { totalAttributions, tierCounts, byActor };
}
