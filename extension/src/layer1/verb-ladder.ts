import type { LadderTier } from '../shared/types';

/**
 * Curated reporting-verb ladder, organised by tier.
 *
 * Each tier contains explicit surface forms and their common conjugations
 * (past tense, -s, -ing, -ed). Runtime conjugation is intentionally avoided
 * to keep matching O(1) and the word-list auditable.
 *
 * Tier order (index in tierCounts tuple):
 *   0 – neutral       ("said", "stated", …)
 *   1 – soft          ("suggested", "implied", …)
 *   2 – assertive     ("claimed", "alleged", …)
 *   3 – assertive-plus ("admitted", "revealed", …)
 */
export const VERB_LADDER: Record<LadderTier, string[]> = {
  neutral: [
    // say
    'say', 'says', 'said', 'saying',
    // tell
    'tell', 'tells', 'told', 'telling',
    // note
    'note', 'notes', 'noted', 'noting',
    // report
    'report', 'reports', 'reported', 'reporting',
    // explain
    'explain', 'explains', 'explained', 'explaining',
    // state
    'state', 'states', 'stated', 'stating',
    // describe
    'describe', 'describes', 'described', 'describing',
    // confirm (neutral use)
    'confirm', 'confirms', 'confirmed', 'confirming',
    // indicate
    'indicate', 'indicates', 'indicated', 'indicating',
    // announce
    'announce', 'announces', 'announced', 'announcing',
    // add
    'add', 'adds', 'added', 'adding',
    // continue
    'continue', 'continues', 'continued', 'continuing',
    // write
    'write', 'writes', 'wrote', 'writing',
    // tweet
    'tweet', 'tweets', 'tweeted', 'tweeting',
  ],

  soft: [
    // suggest
    'suggest', 'suggests', 'suggested', 'suggesting',
    // imply
    'imply', 'implies', 'implied', 'implying',
    // believe
    'believe', 'believes', 'believed', 'believing',
    // think
    'think', 'thinks', 'thought', 'thinking',
    // hope
    'hope', 'hopes', 'hoped', 'hoping',
    // expect
    'expect', 'expects', 'expected', 'expecting',
    // assume
    'assume', 'assumes', 'assumed', 'assuming',
    // argue
    'argue', 'argues', 'argued', 'arguing',
    // maintain
    'maintain', 'maintains', 'maintained', 'maintaining',
    // insist (soft use — also appears in assertive; assertive wins in VERB_TO_TIER because it is built second)
    'insist', 'insists', 'insisted', 'insisting',
  ],

  assertive: [
    // claim
    'claim', 'claims', 'claimed', 'claiming',
    // allege
    'allege', 'alleges', 'alleged', 'alleging',
    // accuse
    'accuse', 'accuses', 'accused', 'accusing',
    // charge
    'charge', 'charges', 'charged', 'charging',
    // warn
    'warn', 'warns', 'warned', 'warning',
    // criticize
    'criticize', 'criticizes', 'criticized', 'criticizing',
    // attack
    'attack', 'attacks', 'attacked', 'attacking',
    // slam
    'slam', 'slams', 'slammed', 'slamming',
    // blast
    'blast', 'blasts', 'blasted', 'blasting',
    // demand
    'demand', 'demands', 'demanded', 'demanding',
    // insist (assertive sense overrides soft entry in the map)
    'insist', 'insists', 'insisted', 'insisting',
  ],

  'assertive-plus': [
    // lie
    'lie', 'lies', 'lied', 'lying',
    // admit
    'admit', 'admits', 'admitted', 'admitting',
    // confess
    'confess', 'confesses', 'confessed', 'confessing',
    // concede
    'concede', 'concedes', 'conceded', 'conceding',
    // expose
    'expose', 'exposes', 'exposed', 'exposing',
    // reveal
    'reveal', 'reveals', 'revealed', 'revealing',
    // prove
    'prove', 'proves', 'proved', 'proving',
  ],
};

/**
 * O(1) lookup: lowercase verb surface form → LadderTier.
 *
 * Built once at module load. When a verb appears in multiple tiers (e.g.
 * "insist" is listed under both soft and assertive) the higher tier wins
 * because the loop processes tiers in ascending severity order and later
 * entries overwrite earlier ones.
 */
export const VERB_TO_TIER: Map<string, LadderTier> = (() => {
  const tierOrder: LadderTier[] = ['neutral', 'soft', 'assertive', 'assertive-plus'];
  const map = new Map<string, LadderTier>();

  for (const tier of tierOrder) {
    for (const verb of VERB_LADDER[tier]) {
      map.set(verb.toLowerCase(), tier);
    }
  }

  return map;
})();
