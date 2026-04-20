#!/usr/bin/env node
/**
 * scripts/build-phrase-lexicon.mjs — Build the bias-phrase lexicon
 *
 * Three-step pipeline:
 *   Step 1 — n-gram skew mining: fetch partisan/center articles, score bigrams/trigrams
 *   Step 2 — BABE sentence corpus: mine n-grams from labeled biased sentences
 *   Step 3 — LLM balance pass: classify candidates via Claude Haiku, reject neutrals
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... node scripts/build-phrase-lexicon.mjs
 *   node scripts/build-phrase-lexicon.mjs --articles 3 --delay 600
 *
 * Options:
 *   --articles N   Articles per site for Step 1 (default: 5)
 *   --delay N      ms between article fetches (default: 600)
 *   --timeout N    ms per HTTP request (default: 15000)
 *   --skip-step1   Skip n-gram mining (use only BABE phrases)
 *
 * Output: extension/public/assets/bias-phrases.json
 *
 * Requires: cd extension && npm install
 * Run from: repo root
 */

// @generated — run scripts/build-phrase-lexicon.mjs to regenerate

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const OUTPUT_PATH = resolve(REPO_ROOT, 'extension/public/assets/bias-phrases.json');
const BABE_BASE_URL =
  'https://raw.githubusercontent.com/Media-Bias-Group/Neural-Media-Bias-Detection-Using-Distant-Supervision-With-BABE/main/data/';
const BABE_CSV_FILES = ['final_labels_SG1.csv', 'final_labels_SG2.csv'];

const requireExt = createRequire(resolve(REPO_ROOT, 'extension', '_calibrate.cjs'));
const { JSDOM } = requireExt('jsdom');
const { Readability } = requireExt('@mozilla/readability');

// ─── Args ────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const getNum = (flag, def) => {
    const i = args.indexOf(flag);
    return i !== -1 && args[i + 1] ? Number(args[i + 1]) : def;
  };
  return {
    articlesPerSite: getNum('--articles', 5),
    delayMs: getNum('--delay', 600),
    timeoutMs: getNum('--timeout', 15000),
    skipStep1: args.includes('--skip-step1'),
    noLlm: args.includes('--no-llm'),
  };
}

const args = parseArgs();

// ─── Config check ────────────────────────────────────────────────────────────

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY && !args.noLlm) {
  process.stderr.write(
    'Error: ANTHROPIC_API_KEY environment variable is not set.\n' +
    'Run: ANTHROPIC_API_KEY=sk-ant-... node scripts/build-phrase-lexicon.mjs\n' +
    'Or skip LLM classification (produces unfiltered candidates): --no-llm\n',
  );
  process.exit(1);
}

// ─── HTTP ────────────────────────────────────────────────────────────────────

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function fetchText(url, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.text();
  } finally {
    clearTimeout(timer);
  }
}

function extractText(html, url) {
  const dom = new JSDOM(html, { url });
  const article = new Readability(dom.window.document).parse();
  return article?.textContent ?? '';
}

// ─── RSS Parsing ──────────────────────────────────────────────────────────────

function parseRssLinks(xml, limit) {
  const seen = new Set();
  let links = [];

  for (const m of xml.matchAll(/<link>([^<]{10,})<\/link>/g)) {
    const url = m[1].trim();
    if (url.startsWith('http') && !seen.has(url)) {
      seen.add(url);
      links = [...links, url];
    }
  }

  for (const m of xml.matchAll(/<link><!\[CDATA\[([^\]]+)\]\]><\/link>/g)) {
    const url = m[1].trim();
    if (url.startsWith('http') && !seen.has(url)) {
      seen.add(url);
      links = [...links, url];
    }
  }

  for (const m of xml.matchAll(/<link[^>]+href="(https?:[^"]+)"[^>]*(?:\/>|>)/g)) {
    const url = m[1].trim();
    if (!seen.has(url)) {
      seen.add(url);
      links = [...links, url];
    }
  }

  return links.slice(0, limit);
}

// ─── N-gram extraction ────────────────────────────────────────────────────────

function tokenize(text) {
  return text.toLowerCase().match(/\b[a-z]{2,}\b/g) ?? [];
}

function extractNgrams(text) {
  const tokens = tokenize(text);
  const bigrams = [];
  const trigrams = [];

  for (let i = 0; i < tokens.length - 1; i++) {
    bigrams.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  for (let i = 0; i < tokens.length - 2; i++) {
    trigrams.push(`${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`);
  }

  return [...bigrams, ...trigrams];
}

// ─── Site definitions ─────────────────────────────────────────────────────────

const PARTISAN_SITES = [
  { name: 'Breitbart',    lean: 'far-right', rss: 'https://feeds.feedburner.com/breitbart' },
  { name: 'The Federalist', lean: 'far-right', rss: 'https://thefederalist.com/feed/' },
  { name: 'Mother Jones', lean: 'far-left',  rss: 'https://www.motherjones.com/feed/' },
  { name: 'The Nation',   lean: 'far-left',  rss: 'https://www.thenation.com/feed/?post_type=article' },
];

const CENTER_SITES = [
  { name: 'Reuters', rss: 'https://feeds.reuters.com/reuters/topNews' },
  { name: 'BBC',     rss: 'https://feeds.bbci.co.uk/news/rss.xml' },
  { name: 'AP News', rss: 'https://apnews.com/feed/rss' },
];

// ─── Step 1: N-gram skew mining ───────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchSiteTexts(sites, articlesPerSite, delayMs, timeoutMs) {
  const texts = [];

  for (const site of sites) {
    process.stdout.write(`  ${site.name.padEnd(16)} rss… `);

    let rssXml;
    try {
      rssXml = await fetchText(site.rss, timeoutMs);
    } catch (e) {
      process.stdout.write(`FAILED (${e.message})\n`);
      continue;
    }

    const links = parseRssLinks(rssXml, articlesPerSite + 3);
    process.stdout.write(`${links.length} links `);

    let fetched = 0;
    for (const url of links) {
      if (fetched >= articlesPerSite) break;
      try {
        await sleep(delayMs);
        const html = await fetchText(url, timeoutMs);
        const text = extractText(html, url);
        if (text.length > 200) {
          texts.push({ lean: site.lean ?? 'center', text });
          fetched++;
          process.stdout.write('.');
        }
      } catch {
        process.stdout.write('x');
      }
    }
    process.stdout.write('\n');
  }

  return texts;
}

function computeSkewCandidates(partisanTexts, centerTexts) {
  const partisanFreq = new Map();
  const partisanArticleCount = new Map();
  const centerFreq = new Map();

  for (const { text } of partisanTexts) {
    const ngrams = extractNgrams(text);
    const seen = new Set();
    for (const ng of ngrams) {
      partisanFreq.set(ng, (partisanFreq.get(ng) ?? 0) + 1);
      if (!seen.has(ng)) {
        partisanArticleCount.set(ng, (partisanArticleCount.get(ng) ?? 0) + 1);
        seen.add(ng);
      }
    }
  }

  for (const { text } of centerTexts) {
    const ngrams = extractNgrams(text);
    for (const ng of ngrams) {
      centerFreq.set(ng, (centerFreq.get(ng) ?? 0) + 1);
    }
  }

  const candidates = [];
  for (const [phrase, freq] of partisanFreq) {
    const articleCount = partisanArticleCount.get(phrase) ?? 0;
    if (articleCount < 3) continue;
    const skew = freq / ((centerFreq.get(phrase) ?? 0) + 1);
    if (skew > 3) {
      candidates.push(phrase);
    }
  }

  return candidates;
}

// ─── Step 2: BABE sentence corpus ─────────────────────────────────────────────

function parseBabeCsv(csvText) {
  const lines = csvText.split('\n').filter(l => l.trim().length > 0);
  const header = lines[0].split(';').map(h => h.trim().toLowerCase());
  const textIdx = header.indexOf('text');
  const labelIdx = header.indexOf('label_bias');

  if (textIdx === -1 || labelIdx === -1) {
    throw new Error(`Unexpected BABE CSV header: ${lines[0]}`);
  }

  const rows = [];
  for (const line of lines.slice(1)) {
    const parts = line.split(';');
    if (parts.length <= Math.max(textIdx, labelIdx)) continue;
    const text = parts[textIdx].replace(/^"|"$/g, '').trim();
    const label = parts[labelIdx].replace(/^"|"$/g, '').trim().toLowerCase();
    if (text && label) rows.push({ text, label });
  }
  return rows;
}

async function fetchBabePhrases(timeoutMs) {
  process.stdout.write('\nStep 2: Downloading BABE sentence corpus…\n');

  const biasedPhrases = new Set();
  const notBiasedPhrases = new Set();
  let biasedCount = 0;
  let notBiasedCount = 0;

  for (const filename of BABE_CSV_FILES) {
    const url = BABE_BASE_URL + filename;
    process.stdout.write(`  Fetching ${filename}… `);

    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'User-Agent': UA },
    });
    if (!response.ok) {
      process.stdout.write(`FAILED (HTTP ${response.status})\n`);
      continue;
    }

    const csvText = await response.text();
    process.stdout.write(`${csvText.length} bytes\n`);

    const rows = parseBabeCsv(csvText);

    for (const { text, label } of rows) {
      const ngrams = extractNgrams(text);
      if (label === 'biased') {
        biasedCount++;
        for (const ng of ngrams) biasedPhrases.add(ng);
      } else if (label === 'non-biased') {
        notBiasedCount++;
        for (const ng of ngrams) notBiasedPhrases.add(ng);
      }
    }
  }

  process.stdout.write(`  Biased rows: ${biasedCount}, Non-biased rows: ${notBiasedCount}\n`);

  const exclusiveBiasedPhrases = [...biasedPhrases].filter(p => !notBiasedPhrases.has(p));
  process.stdout.write(`  Exclusive biased n-grams: ${exclusiveBiasedPhrases.length}\n`);

  return exclusiveBiasedPhrases;
}

// ─── Step 3: LLM balance pass ─────────────────────────────────────────────────

async function callClaude(prompt) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Anthropic API error ${resp.status}: ${body}`);
  }

  const data = await resp.json();
  return data.content?.[0]?.text ?? '';
}

async function classifyPhrases(candidates) {
  const BATCH_SIZE = 200;
  const surviving = [];
  let leftCount = 0;
  let rightCount = 0;

  process.stdout.write(`\nStep 3: LLM classification of ${candidates.length} candidates in batches of ${BATCH_SIZE}…\n`);

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(candidates.length / BATCH_SIZE);
    process.stdout.write(`  Batch ${batchNum}/${totalBatches} (${batch.length} phrases)… `);

    const phraseList = batch.map((p, idx) => `${idx + 1}. ${p}`).join('\n');
    const prompt =
      `You are a media-bias analyst. For each phrase below, classify it as exactly one of: "left-leaning", "right-leaning", or "neutral".\n\n` +
      `A phrase is "left-leaning" if it is loaded framing or rhetoric associated with left-wing or progressive ideology.\n` +
      `A phrase is "right-leaning" if it is loaded framing or rhetoric associated with right-wing or conservative ideology.\n` +
      `A phrase is "neutral" if it is factual, commonly used across the political spectrum, or not politically loaded.\n\n` +
      `Respond ONLY with a JSON array where each element is one of the strings "left-leaning", "right-leaning", or "neutral".\n` +
      `The array must have exactly ${batch.length} elements, one per phrase, in the same order.\n\n` +
      `Phrases:\n${phraseList}`;

    let classifications;
    try {
      const responseText = await callClaude(prompt);
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('No JSON array found in response');
      classifications = JSON.parse(jsonMatch[0]);
    } catch (e) {
      process.stdout.write(`ERROR (${e.message}) — skipping batch\n`);
      continue;
    }

    let kept = 0;
    for (let j = 0; j < batch.length; j++) {
      const label = classifications[j];
      if (label === 'left-leaning') {
        surviving.push(batch[j]);
        leftCount += 1;
        kept += 1;
      } else if (label === 'right-leaning') {
        surviving.push(batch[j]);
        rightCount += 1;
        kept += 1;
      }
    }

    process.stdout.write(`kept ${kept}/${batch.length}\n`);
    await sleep(500);
  }

  return { phrases: surviving, leftCount, rightCount };
}

function reportBalance(leftCount, rightCount) {
  process.stdout.write(`\nStep 3b: Balance check (using per-phrase classifications from Step 3a)\n`);
  process.stdout.write(`  Left-leaning: ${leftCount}, Right-leaning: ${rightCount}\n`);

  if (leftCount === 0 || rightCount === 0) {
    process.stdout.write(`  WARNING: One side has zero phrases — list is unusable as-is.\n`);
    return false;
  }

  const ratio = leftCount > rightCount ? leftCount / rightCount : rightCount / leftCount;
  if (ratio > 2) {
    const heavier = leftCount > rightCount ? 'left' : 'right';
    process.stdout.write(
      `  WARNING: Phrase list is imbalanced — ${heavier} has ${ratio.toFixed(2)}× the other.\n` +
      `  Review the list before committing. Political balance is a product requirement.\n`,
    );
    return false;
  }

  process.stdout.write(`  Balance check passed (ratio ${ratio.toFixed(2)}×).\n`);
  return true;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { articlesPerSite, delayMs, timeoutMs, skipStep1, noLlm } = args;

  let step1Candidates = [];

  if (!skipStep1) {
    process.stdout.write('Step 1: N-gram skew mining\n');
    process.stdout.write(`  Fetching ${articlesPerSite} articles each from ${PARTISAN_SITES.length} partisan sites…\n`);

    const partisanTexts = await fetchSiteTexts(PARTISAN_SITES, articlesPerSite, delayMs, timeoutMs);

    process.stdout.write(`  Fetching ${articlesPerSite} articles each from ${CENTER_SITES.length} center sites…\n`);
    const centerTexts = await fetchSiteTexts(CENTER_SITES, articlesPerSite, delayMs, timeoutMs);

    process.stdout.write(`  Collected: ${partisanTexts.length} partisan, ${centerTexts.length} center articles\n`);

    step1Candidates = computeSkewCandidates(partisanTexts, centerTexts);
    process.stdout.write(`  Step 1 candidates (skew > 3, ≥3 partisan articles): ${step1Candidates.length}\n`);
  } else {
    process.stdout.write('Step 1: Skipped (--skip-step1 flag)\n');
  }

  const step2Candidates = await fetchBabePhrases(timeoutMs);

  const merged = [...new Set([...step1Candidates, ...step2Candidates])];
  process.stdout.write(`\nMerged candidates (Step 1 + Step 2, deduped): ${merged.length}\n`);

  if (merged.length === 0) {
    process.stderr.write('Error: No candidates to classify. Check network connectivity.\n');
    process.exit(1);
  }

  let balanced;
  let balancePassed = true;
  let balanceMeta = null;
  if (noLlm) {
    process.stdout.write('\nStep 3: Skipped (--no-llm flag). Using unfiltered candidates.\n');
    balanced = merged;
  } else {
    const { phrases, leftCount, rightCount } = await classifyPhrases(merged);
    balanced = phrases;
    balancePassed = reportBalance(leftCount, rightCount);
    balanceMeta = { left_count: leftCount, right_count: rightCount, balance_passed: balancePassed };
  }

  const sorted = [...new Set(balanced)].sort((a, b) => a.localeCompare(b, 'en'));

  process.stdout.write(`\nFinal phrase count: ${sorted.length}\n`);

  const outputDir = dirname(OUTPUT_PATH);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const output = {
    generated_at: new Date().toISOString(),
    ...(balanceMeta ? { balance: balanceMeta } : {}),
    phrases: sorted,
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n', 'utf8');
  process.stdout.write(`Written to: ${OUTPUT_PATH}\n`);

  if (!balancePassed) {
    process.stdout.write(`\nExiting with code 1: file written but balance check failed. Review before committing.\n`);
    process.exit(1);
  }
}

main().catch(err => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
