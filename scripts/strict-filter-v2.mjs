#!/usr/bin/env node
// Strict filter v2: explicitly require political content (named actor, named
// ideology, or recognizable framing idiom). Drops sentence fragments and
// generic emotional language.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../extension/public/assets/bias-phrases.json');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  process.stderr.write('Error: ANTHROPIC_API_KEY env var required.\n');
  process.exit(1);
}

const MODEL = 'claude-haiku-4-5-20251001';
const BATCH_SIZE = 100;
const MAX_RETRIES = 3;

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function callClaude(prompt) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }
      const data = await res.json();
      return data.content[0].text;
    } catch (e) {
      if (attempt === MAX_RETRIES - 1) throw e;
      await sleep(1000 * (attempt + 1));
    }
  }
}

const STRICT_PROMPT_HEAD =
  `You are filtering a phrase list for a media-bias detector. The detector flags phrases that are UNAMBIGUOUSLY politically loaded.\n\n` +
  `Reply YES only if the phrase satisfies AT LEAST ONE of these tests:\n\n` +
  `  Test A: Contains a named political actor or party AND carries clear evaluative weight.\n` +
  `    YES: "trump cult", "warren savages", "biden disaster", "republican lies", "democrat scheme"\n` +
  `    NO: "republican officials", "biden spoke", "trump task", "democrat challenger" (purely descriptive)\n\n` +
  `  Test B: Names a partisan-coded ideology, movement, or pejorative.\n` +
  `    YES: "woke ideology", "deep state", "antifa terrorist", "leftist mob", "socialist agenda", "fascist regime", "globalist elite"\n` +
  `    NO: "left activists", "right wing", "conservative think tank" (neutral descriptor)\n\n` +
  `  Test C: A recognizable, complete loaded idiom — something a reader would identify as a partisan slogan or framing choice.\n` +
  `    YES: "war on christmas", "open borders", "drain the swamp", "cancel culture", "abolish the police", "climate hoax", "billionaire class"\n` +
  `    NO: "the swamp", "open border", "war on" (incomplete fragment)\n\n` +
  `Reply NO for everything else, including:\n` +
  `  - Sentence fragments ("across social", "act like", "ah yes", "ahead of election", "air and water")\n` +
  `  - Generic emotional words without a target ("disgusting display", "absolute disaster", "absurd policy")\n` +
  `  - Topic descriptors ("affordable health care", "border official", "police brutality" — too neutral on their own)\n` +
  `  - Vague action phrases ("agitate against", "agree with democrats", "aimed at satisfying")\n` +
  `  - Anything where you cannot identify a SPECIFIC political target or ideological frame\n\n` +
  `When in doubt, reply NO. The goal is precision over recall.\n\n` +
  `Respond ONLY with a JSON array of "yes" or "no" strings, one per phrase, in order.\n` +
  `The array must have exactly N elements where N matches the count below.\n\n`;

async function classifyStrict(phrases) {
  const surviving = [];
  const totalBatches = Math.ceil(phrases.length / BATCH_SIZE);

  process.stdout.write(`Strict v2 re-classification: ${phrases.length} phrases in ${totalBatches} batches of ${BATCH_SIZE}\n`);

  for (let i = 0; i < phrases.length; i += BATCH_SIZE) {
    const batch = phrases.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    process.stdout.write(`  Batch ${batchNum}/${totalBatches}… `);

    const list = batch.map((p, idx) => `${idx + 1}. ${p}`).join('\n');
    const prompt = STRICT_PROMPT_HEAD + `Phrases (N=${batch.length}):\n${list}`;

    let answers;
    try {
      const responseText = await callClaude(prompt);
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('no JSON array');
      answers = JSON.parse(jsonMatch[0]);
    } catch (e) {
      process.stdout.write(`ERROR (${e.message}) — DROPPING all (precision mode)\n`);
      // v2 change: on error, DROP the batch (precision over recall)
      continue;
    }

    let kept = 0;
    for (let j = 0; j < batch.length; j++) {
      if (typeof answers[j] === 'string' && answers[j].toLowerCase().startsWith('y')) {
        surviving.push(batch[j]);
        kept += 1;
      }
    }
    process.stdout.write(`kept ${kept}/${batch.length}\n`);
    await sleep(300);
  }

  return surviving;
}

async function main() {
  const data = JSON.parse(readFileSync(OUT, 'utf8'));
  const original = data.phrases;

  process.stdout.write(`Loaded ${original.length} phrases from ${OUT}\n\n`);

  const survivors = await classifyStrict(original);
  const sorted = [...new Set(survivors)].sort((a, b) => a.localeCompare(b, 'en'));

  process.stdout.write(`\nFinal count: ${sorted.length} (kept ${((sorted.length / original.length) * 100).toFixed(1)}%)\n`);

  const output = {
    ...data,
    strict_v2_filtered_at: new Date().toISOString(),
    source_counts: {
      ...(data.source_counts || {}),
      before_strict_v2: original.length,
      after_strict_v2: sorted.length,
    },
    phrases: sorted,
  };

  writeFileSync(OUT, JSON.stringify(output, null, 2) + '\n', 'utf8');
  process.stdout.write(`Written to: ${OUT}\n`);
}

main().catch(err => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
