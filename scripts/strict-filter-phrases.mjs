#!/usr/bin/env node
// Re-classify the existing bias-phrases.json with a much stricter prompt.
// Only keeps phrases that are recognizable as deliberate political framing.

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
  `You are a media-bias analyst with a HIGH bar for what counts as a "loaded political phrase."\n\n` +
  `For each phrase below, answer YES only if ALL of the following are true:\n` +
  `  1. It is a complete, self-contained idiom or framing choice (NOT a sentence fragment).\n` +
  `  2. A partisan writer would DELIBERATELY pick this exact phrasing for rhetorical effect.\n` +
  `  3. It is recognizably political — could not appear naturally in a neutral article about cooking, sports, weather, or technology.\n` +
  `  4. It carries an evaluative judgment (good/bad, hero/villain, virtue/vice) — not just a topic descriptor.\n\n` +
  `Answer NO for:\n` +
  `  - Sentence fragments ("ahead of international", "around the idea", "details about swaddling")\n` +
  `  - Neutral noun phrases ("administration strategy", "academic analysis", "baby supplies")\n` +
  `  - Common English idioms ("good faith", "give up", "far away", "forced to choose")\n` +
  `  - Topic descriptors without rhetorical loading ("border official", "federal investigations")\n` +
  `  - Phrases that need additional context to be loaded ("anti china" alone — too vague)\n\n` +
  `Answer YES for:\n` +
  `  - Recognizable framing idioms ("war on christmas", "open borders", "deep state", "cancel culture")\n` +
  `  - Loaded labels ("radical left", "fascist regime", "billionaire class", "climate denier")\n` +
  `  - Loaded action phrases ("abolish the police", "drain the swamp", "indoctrinate children")\n` +
  `  - Pejoratives with clear political target ("plutocratic elites", "trump cult", "woke mob")\n\n` +
  `Respond ONLY with a JSON array of "yes" or "no" strings, one per phrase, in order.\n` +
  `The array must have exactly N elements where N matches the count below.\n\n`;

async function classifyStrict(phrases) {
  const surviving = [];
  const totalBatches = Math.ceil(phrases.length / BATCH_SIZE);

  process.stdout.write(`Strict re-classification: ${phrases.length} phrases in ${totalBatches} batches of ${BATCH_SIZE}\n`);

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
      process.stdout.write(`ERROR (${e.message}) — keeping all\n`);
      // on error, keep all (conservative: don't drop good phrases due to API issue)
      for (const p of batch) surviving.push(p);
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
    strict_filtered_at: new Date().toISOString(),
    source_counts: {
      ...(data.source_counts || {}),
      before_strict_filter: original.length,
      after_strict_filter: sorted.length,
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
