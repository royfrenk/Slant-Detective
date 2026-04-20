#!/usr/bin/env node
/**
 * Calibrate language-intensity scoring across politically diverse news sites.
 *
 * Fetches recent articles via RSS, runs the same BABE loaded-words detection
 * used in the extension, and reports raw-match distributions across the
 * political spectrum. Output includes a suggested divisor for
 * computeLanguageIntensity() anchored to the most intense sites.
 *
 * Usage:
 *   node scripts/calibrate-intensity.mjs
 *   node scripts/calibrate-intensity.mjs --articles 5 --delay 800
 *   node scripts/calibrate-intensity.mjs --timeout 20000
 *
 * Options:
 *   --articles N   Articles per site (default: 5)
 *   --delay N      ms between article fetches (default: 600)
 *   --timeout N    ms per HTTP request (default: 15000)
 *
 * Requires: cd extension && npm install
 * Run from: repo root
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

// Resolve jsdom + Readability from extension's node_modules.
// createRequire resolves packages from the given file's directory, so pointing
// it inside extension/ makes it find extension/node_modules/*.
const requireExt = createRequire(resolve(REPO_ROOT, 'extension', '_calibrate.cjs'));
const { JSDOM } = requireExt('jsdom');
const { Readability } = requireExt('@mozilla/readability');

// ─── Porter Stemmer ──────────────────────────────────────────────────────────
// Inlined from extension/src/layer1/stemmer.ts — must stay in sync.

function isCons(word, i) {
  const c = word[i];
  if ('aeiou'.includes(c)) return false;
  if (c === 'y') return i === 0 || !isCons(word, i - 1);
  return true;
}

function measure(word) {
  let m = 0;
  let i = 0;
  const n = word.length;
  while (i < n && isCons(word, i)) i++;
  while (i < n) {
    while (i < n && !isCons(word, i)) i++;
    if (i >= n) break;
    while (i < n && isCons(word, i)) i++;
    m++;
  }
  return m;
}

function hasVowel(word) {
  for (let i = 0; i < word.length; i++) {
    if (!isCons(word, i)) return true;
  }
  return false;
}

function endsDoubleC(word) {
  const n = word.length;
  return n >= 2 && word[n - 1] === word[n - 2] && isCons(word, n - 1);
}

function endsCVC(word) {
  const n = word.length;
  if (n < 3) return false;
  return (
    isCons(word, n - 3) &&
    !isCons(word, n - 2) &&
    isCons(word, n - 1) &&
    !'wxy'.includes(word[n - 1])
  );
}

function tryRule(word, suf, rep, minM) {
  if (!word.endsWith(suf)) return null;
  const stem = word.slice(0, word.length - suf.length);
  return measure(stem) >= minM ? stem + rep : null;
}

function stemToken(word) {
  word = word.toLowerCase();
  if (word.length <= 2) return word;

  if (word.endsWith('sses')) word = word.slice(0, -4) + 'ss';
  else if (word.endsWith('ies')) word = word.slice(0, -3) + 'i';
  else if (!word.endsWith('ss') && word.endsWith('s')) word = word.slice(0, -1);

  let step1bFlag = false;
  if (word.endsWith('eed')) {
    const r = tryRule(word, 'eed', 'ee', 1);
    if (r !== null) word = r;
  } else if (word.endsWith('ed')) {
    const stem = word.slice(0, -2);
    if (hasVowel(stem)) { word = stem; step1bFlag = true; }
  } else if (word.endsWith('ing')) {
    const stem = word.slice(0, -3);
    if (hasVowel(stem)) { word = stem; step1bFlag = true; }
  }

  if (step1bFlag) {
    if (word.endsWith('at')) word += 'e';
    else if (word.endsWith('bl')) word += 'e';
    else if (word.endsWith('iz')) word += 'e';
    else if (endsDoubleC(word) && !'lsz'.includes(word[word.length - 1])) word = word.slice(0, -1);
    else if (measure(word) === 1 && endsCVC(word)) word += 'e';
  }

  if (word.endsWith('y')) {
    const stem = word.slice(0, -1);
    if (hasVowel(stem)) word = stem + 'i';
  }

  const STEP2 = [
    ['ational', 'ate'], ['tional', 'tion'], ['enci', 'ence'], ['anci', 'ance'],
    ['izer', 'ize'], ['bli', 'ble'], ['alli', 'al'], ['entli', 'ent'],
    ['eli', 'e'], ['ousli', 'ous'], ['ization', 'ize'], ['ation', 'ate'],
    ['ator', 'ate'], ['alism', 'al'], ['iveness', 'ive'], ['fulness', 'ful'],
    ['ousness', 'ous'], ['aliti', 'al'], ['iviti', 'ive'], ['biliti', 'ble'],
    ['logi', 'log'],
  ];
  for (const [s, r] of STEP2) {
    const result = tryRule(word, s, r, 1);
    if (result !== null) { word = result; break; }
  }

  const STEP3 = [
    ['icate', 'ic'], ['ative', ''], ['alize', 'al'], ['iciti', 'ic'],
    ['ical', 'ic'], ['ful', ''], ['ness', ''],
  ];
  for (const [s, r] of STEP3) {
    const result = tryRule(word, s, r, 1);
    if (result !== null) { word = result; break; }
  }

  const STEP4 = [
    ['al', ''], ['ance', ''], ['ence', ''], ['er', ''], ['ic', ''],
    ['able', ''], ['ible', ''], ['ant', ''], ['ement', ''], ['ment', ''],
    ['ent', ''], ['ism', ''], ['ate', ''], ['iti', ''], ['ous', ''],
    ['ive', ''], ['ize', ''],
  ];
  for (const [s, r] of STEP4) {
    const result = tryRule(word, s, r, 2);
    if (result !== null) { word = result; break; }
  }

  if (word.endsWith('ion')) {
    const stem = word.slice(0, -3);
    if (measure(stem) > 1 && stem.length > 0 && 'st'.includes(stem[stem.length - 1])) {
      word = stem;
    }
  }

  if (word.endsWith('e')) {
    const stem = word.slice(0, -1);
    if (measure(stem) > 1 || (measure(stem) === 1 && !endsCVC(stem))) word = stem;
  }

  if (measure(word) > 1 && endsDoubleC(word) && word.endsWith('l')) {
    word = word.slice(0, -1);
  }

  return word;
}

// ─── BABE Lexicon ────────────────────────────────────────────────────────────

function loadLexicon() {
  const path = resolve(REPO_ROOT, 'extension/public/assets/babe-lexicon.json');
  const { entries } = JSON.parse(readFileSync(path, 'utf8'));
  return new Set(entries.map(stemToken));
}

// ─── Loaded Words Counter ─────────────────────────────────────────────────────

function countLoadedWords(text, lexicon) {
  const tokenRegex = /\b[a-z]{3,}\b/gi;
  let count = 0;
  for (const match of text.matchAll(tokenRegex)) {
    if (lexicon.has(stemToken(match[0]))) count++;
  }
  return count;
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

// ─── RSS Parsing ──────────────────────────────────────────────────────────────

function parseRssLinks(xml, limit) {
  const seen = new Set();
  let links = [];

  // Standard <link>url</link>
  for (const m of xml.matchAll(/<link>([^<]{10,})<\/link>/g)) {
    const url = m[1].trim();
    if (url.startsWith('http') && !seen.has(url)) {
      seen.add(url);
      links = [...links, url];
    }
  }

  // CDATA variant: <link><![CDATA[url]]></link>
  for (const m of xml.matchAll(/<link><!\[CDATA\[([^\]]+)\]\]><\/link>/g)) {
    const url = m[1].trim();
    if (url.startsWith('http') && !seen.has(url)) {
      seen.add(url);
      links = [...links, url];
    }
  }

  // Atom <link href="url" .../> (fallback for Atom feeds)
  for (const m of xml.matchAll(/<link[^>]+href="(https?:[^"]+)"[^>]*(?:\/>|>)/g)) {
    const url = m[1].trim();
    if (!seen.has(url)) {
      seen.add(url);
      links = [...links, url];
    }
  }

  return links.slice(0, limit);
}

// ─── Article Extraction ───────────────────────────────────────────────────────

function extractText(html, url) {
  const dom = new JSDOM(html, { url });
  const article = new Readability(dom.window.document).parse();
  return article?.textContent ?? '';
}

// ─── Statistics ───────────────────────────────────────────────────────────────

function pct(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function computeStats(counts) {
  const sorted = [...counts].sort((a, b) => a - b);
  const sum = sorted.reduce((s, v) => s + v, 0);
  return {
    n: sorted.length,
    min: sorted[0] ?? 0,
    p25: pct(sorted, 25),
    median: pct(sorted, 50),
    p75: pct(sorted, 75),
    max: sorted[sorted.length - 1] ?? 0,
    mean: Math.round(sum / (sorted.length || 1)),
  };
}

// ─── Site Definitions ─────────────────────────────────────────────────────────

const SITES = [
  { name: 'Breitbart',     lean: 'far-right',   rss: 'https://feeds.feedburner.com/breitbart' },
  { name: 'The Federalist',lean: 'far-right',   rss: 'https://thefederalist.com/feed/' },
  { name: 'NY Post',       lean: 'right',        rss: 'https://nypost.com/feed/' },
  { name: 'Fox News',      lean: 'right',        rss: 'https://moxie.foxnews.com/google-publisher/politics.xml' },
  { name: 'Reuters',       lean: 'center',       rss: 'https://feeds.reuters.com/reuters/topNews' },
  { name: 'BBC',           lean: 'center',       rss: 'https://feeds.bbci.co.uk/news/rss.xml' },
  { name: 'NPR',           lean: 'center-left',  rss: 'https://feeds.npr.org/1001/rss.xml' },
  { name: 'HuffPost',      lean: 'left',         rss: 'https://www.huffpost.com/section/front-page/feed' },
  { name: 'Vox',           lean: 'left',         rss: 'https://www.vox.com/rss/index.xml' },
  { name: 'Mother Jones',  lean: 'far-left',     rss: 'https://www.motherjones.com/feed/' },
  { name: 'The Nation',    lean: 'far-left',     rss: 'https://www.thenation.com/feed/?post_type=article' },
];

// ─── Formatting ───────────────────────────────────────────────────────────────

const w = (s, n) => String(s).padStart(n);
const scoreStr = (count, divisor) => Math.min(10, count / divisor).toFixed(1).padStart(5);

function printRow(name, lean, stats, oldDiv, newDiv) {
  process.stdout.write(
    name.padEnd(16) +
    lean.padEnd(13) +
    w(stats.n, 3) +
    w(stats.min, 6) +
    w(stats.p25, 6) +
    w(stats.median, 6) +
    w(stats.p75, 6) +
    w(stats.max, 6) +
    '  ' + scoreStr(stats.median, oldDiv) +
    (newDiv ? '  ' + scoreStr(stats.median, newDiv) : '') +
    '\n',
  );
}

// ─── N-gram accumulation (for build-phrase-lexicon.mjs Step 1) ───────────────

// Module-level store of { lean, text } pairs collected during a calibration run.
// build-phrase-lexicon.mjs imports getAccumulatedTexts() to access these.
let _accumulatedTexts = [];

export function getAccumulatedTexts() {
  return _accumulatedTexts;
}

function resetAccumulatedTexts() {
  _accumulatedTexts = [];
}

// ─── Core ────────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchArticleCount(url, lean, lexicon, timeoutMs) {
  const html = await fetchText(url, timeoutMs);
  const text = extractText(html, url);
  _accumulatedTexts = [..._accumulatedTexts, { lean, text }];
  return countLoadedWords(text, lexicon);
}

async function processSite(site, articlesPerSite, delayMs, timeoutMs, lexicon) {
  process.stdout.write(`  ${site.name.padEnd(14)} rss… `);

  let rssXml;
  try {
    rssXml = await fetchText(site.rss, timeoutMs);
  } catch (e) {
    process.stdout.write(`FAILED (${e.message})\n`);
    return { site, counts: [] };
  }

  const links = parseRssLinks(rssXml, articlesPerSite + 5);
  process.stdout.write(`${links.length} links `);

  let counts = [];
  for (const url of links) {
    if (counts.length >= articlesPerSite) break;
    try {
      await sleep(delayMs);
      const count = await fetchArticleCount(url, site.lean, lexicon, timeoutMs);
      counts = [...counts, count];
      process.stdout.write(`${count} `);
    } catch {
      process.stdout.write(`. `);
    }
  }

  process.stdout.write('\n');
  return { site, counts };
}

// ─── Args ────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag, def) => {
    const i = args.indexOf(flag);
    return i !== -1 && args[i + 1] ? Number(args[i + 1]) : def;
  };
  return {
    articlesPerSite: get('--articles', 5),
    delayMs: get('--delay', 600),
    timeoutMs: get('--timeout', 15000),
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { articlesPerSite, delayMs, timeoutMs } = parseArgs();

  resetAccumulatedTexts();

  process.stdout.write('Loading BABE lexicon…\n');
  const lexicon = loadLexicon();
  process.stdout.write(`${lexicon.size} stemmed entries\n\n`);

  process.stdout.write(
    `Fetching ${articlesPerSite} articles/site · ${SITES.length} sites · ` +
    `delay=${delayMs}ms · timeout=${timeoutMs}ms\n\n`,
  );

  let results = [];
  for (const site of SITES) {
    const result = await processSite(site, articlesPerSite, delayMs, timeoutMs, lexicon);
    results = [...results, result];
  }

  const OLD_DIV = 3;
  const HR = '─'.repeat(82);

  // ── Raw distribution table ────────────────────────────────────────────────
  process.stdout.write('\n' + HR + '\n');
  process.stdout.write(
    'SITE'.padEnd(16) + 'LEAN'.padEnd(13) +
    w('N', 3) + w('MIN', 6) + w('P25', 6) + w('MED', 6) + w('P75', 6) + w('MAX', 6) +
    '  OLD_SCR\n',
  );
  process.stdout.write(HR + '\n');

  for (const { site, counts } of results) {
    if (counts.length === 0) {
      process.stdout.write(`${site.name.padEnd(16)}${site.lean.padEnd(13)} — no data\n`);
      continue;
    }
    printRow(site.name, site.lean, computeStats(counts), OLD_DIV, null);
  }
  process.stdout.write(HR + '\n');

  // ── Calibration ────────────────────────────────────────────────────────────
  const highIntensity = results.filter(
    r => r.counts.length > 0 && ['far-right', 'far-left'].includes(r.site.lean),
  );

  if (highIntensity.length === 0) {
    process.stdout.write('\nNo high-intensity site data — cannot compute calibration.\n');
    return;
  }

  const allHighCounts = highIntensity.flatMap(r => r.counts);
  const highStats = computeStats(allHighCounts);

  // Anchor: far-left/far-right P75 → score 10. Use ceil so no site exceeds 10.
  const NEW_DIV = Math.ceil(highStats.p75 / 10);

  process.stdout.write('\nCALIBRATION\n' + HR + '\n');
  process.stdout.write(`High-intensity sites (far-right + far-left): ${highIntensity.map(r => r.site.name).join(', ')}\n`);
  process.stdout.write(`  Raw match P75 across those sites: ${highStats.p75}\n`);
  process.stdout.write(`  P75 of P75 values per site:       ${computeStats(highIntensity.map(r => computeStats(r.counts).p75)).median}\n\n`);
  process.stdout.write(`Current divisor:   ${OLD_DIV}  → score 10 at ${OLD_DIV * 10} raw matches\n`);
  process.stdout.write(`Suggested divisor: ${NEW_DIV}  → score 10 at ${NEW_DIV * 10} raw matches\n`);
  process.stdout.write(`\nNew formula:\n  return Math.min(10, loadedWordCount / ${NEW_DIV});\n`);

  // ── Re-scored table ────────────────────────────────────────────────────────
  process.stdout.write('\nRE-SCORED\n' + HR + '\n');
  process.stdout.write(
    'SITE'.padEnd(16) + 'LEAN'.padEnd(13) +
    w('N', 3) + w('MIN', 6) + w('P25', 6) + w('MED', 6) + w('P75', 6) + w('MAX', 6) +
    '  OLD_SCR  NEW_SCR\n',
  );
  process.stdout.write(HR + '\n');

  for (const { site, counts } of results) {
    if (counts.length === 0) continue;
    printRow(site.name, site.lean, computeStats(counts), OLD_DIV, NEW_DIV);
  }
  process.stdout.write(HR + '\n');

  process.stdout.write('\nTo apply: update extension/src/content-script/index.ts:\n');
  process.stdout.write(`  return Math.min(10, loadedWordCount / ${NEW_DIV});\n`);
}

main().catch(err => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
