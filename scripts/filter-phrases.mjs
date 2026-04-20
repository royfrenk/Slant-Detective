#!/usr/bin/env node
// One-shot post-processor: filter stopword-polluted phrases from bias-phrases.json
// and merge back the curated seed list recovered from git.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../extension/public/assets/bias-phrases.json');
const SEED = '/tmp/seed-phrases.txt';

const STOP_FIRST = new Set([
  'a','an','the','of','to','in','on','by','for','with','at','from','about','as','into','onto','than',
  'is','are','was','were','be','been','being','am',
  'has','have','had','having',
  'will','would','could','should','can','may','might','must','shall',
  'do','does','did','doing','done',
  'and','or','but','nor','so','yet','if','then','because',
  'this','that','these','those','it','its','they','them','their','there','here',
  'he','she','him','her','his','hers','we','us','our','ours','i','me','my','mine','you','your','yours',
  'who','whom','whose','what','when','where','which','why','how',
  'not','no','very','just','only','also','too','more','most','less','least',
  'one','two','three','four','five','six','seven','eight','nine','ten',
  'all','any','each','every','some','many','much','few','several','both','either','neither',
]);
const STOP_LAST = new Set([
  ...STOP_FIRST,
]);

const seed = readFileSync(SEED, 'utf8').split('\n').map(s => s.trim()).filter(Boolean);
const data = JSON.parse(readFileSync(OUT, 'utf8'));
const llmPhrases = data.phrases;

function isClean(phrase) {
  const tokens = phrase.split(/\s+/);
  if (tokens.length < 2) return false;
  if (STOP_FIRST.has(tokens[0])) return false;
  if (STOP_LAST.has(tokens[tokens.length - 1])) return false;
  // drop if all tokens are short (likely fragment)
  if (tokens.every(t => t.length <= 2)) return false;
  // drop if 2+ consecutive stopwords (sentence fragments)
  let consecStop = 0;
  for (const t of tokens) {
    if (STOP_FIRST.has(t)) {
      consecStop += 1;
      if (consecStop >= 2) return false;
    } else {
      consecStop = 0;
    }
  }
  return true;
}

const cleanLlm = llmPhrases.filter(isClean);
const merged = [...new Set([...seed, ...cleanLlm])].sort((a, b) => a.localeCompare(b, 'en'));

const before = llmPhrases.length;
const afterFilter = cleanLlm.length;
const finalCount = merged.length;

process.stdout.write(`Seed phrases: ${seed.length}\n`);
process.stdout.write(`LLM phrases (before filter): ${before}\n`);
process.stdout.write(`LLM phrases (after filter): ${afterFilter}\n`);
process.stdout.write(`Final merged + deduped: ${finalCount}\n`);

const output = {
  generated_at: data.generated_at,
  filtered_at: new Date().toISOString(),
  source_counts: {
    seed: seed.length,
    llm_pipeline: before,
    llm_after_stopword_filter: afterFilter,
    final_merged: finalCount,
  },
  balance: data.balance,
  phrases: merged,
};

writeFileSync(OUT, JSON.stringify(output, null, 2) + '\n', 'utf8');
process.stdout.write(`Written: ${OUT}\n`);
