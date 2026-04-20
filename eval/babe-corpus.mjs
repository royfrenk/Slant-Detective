/**
 * eval/babe-corpus.mjs — Download and parse BABE sentence corpus
 *
 * Source: Spinde et al. (2021), AGPL-3.0
 * https://github.com/Media-Bias-Group/Neural-Media-Bias-Detection-Using-Distant-Supervision-With-BABE
 *
 * Uses SG2 (second annotator group, ~3,677 sentences) as the primary corpus —
 * the larger of the two sentence groups, closest to the 3,700 figure cited in
 * the PRD and spec. SG1 (1,704 sentences) is available as a separate file.
 *
 * CSV format: semicolon-delimited, columns text;news_link;outlet;topic;type;label_bias;label_opinion;biased_words
 * label_bias values: "Biased" | "Non-biased" | "No agreement"
 * biased_words format: Python list literal e.g. ['word1', 'word2'] or []
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = resolve(SCRIPT_DIR, 'data')
const CACHE_PATH = resolve(DATA_DIR, 'SGB_SG2.csv')

const BABE_CSV_URL =
  'https://raw.githubusercontent.com/Media-Bias-Group/Neural-Media-Bias-Detection-Using-Distant-Supervision-With-BABE/main/data/final_labels_SG2.csv'

/**
 * @typedef {{ text: string, label: 'biased' | 'not-biased', biasedWords: string[] }} BabeSentence
 */

/**
 * Minimal semicolon-delimited CSV parser that handles quoted fields.
 * Strips UTF-8 BOM if present.
 *
 * @param {string} csv
 * @param {string} [delimiter=';']
 * @returns {string[][]}
 */
function parseCSV(csv, delimiter = ';') {
  // Strip UTF-8 BOM
  const text = csv.startsWith('\uFEFF') ? csv.slice(1) : csv
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        field += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === delimiter) {
        row.push(field)
        field = ''
      } else if (ch === '\r' && next === '\n') {
        row.push(field)
        field = ''
        rows.push(row)
        row = []
        i++
      } else if (ch === '\n') {
        row.push(field)
        field = ''
        rows.push(row)
        row = []
      } else {
        field += ch
      }
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows
}

/**
 * Parse Python-style list literal into string[].
 * e.g. "['word1', 'word2']" → ['word1', 'word2']
 * Returns [] for empty or malformed input.
 *
 * @param {string} raw
 * @returns {string[]}
 */
function parsePythonList(raw) {
  const s = raw.trim()
  if (!s || s === '[]') return []
  // Remove brackets and split on ', '
  const inner = s.replace(/^\[/, '').replace(/\]$/, '')
  return inner
    .split(',')
    .map((w) => w.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)
}

/**
 * Download the BABE SG2 CSV from GitHub and cache locally.
 *
 * @returns {Promise<void>}
 */
async function downloadBabe() {
  process.stderr.write(`Downloading BABE SG2 corpus from ${BABE_CSV_URL}...\n`)
  const res = await fetch(BABE_CSV_URL, { signal: AbortSignal.timeout(60_000) })
  if (!res.ok) throw new Error(`Failed to download BABE corpus: HTTP ${res.status}`)
  const text = await res.text()
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(CACHE_PATH, text, 'utf8')
  process.stderr.write(`BABE corpus cached at ${CACHE_PATH} (${text.split('\n').length - 1} lines)\n`)
}

/**
 * Load and parse BABE SG2 corpus. Downloads on first call; reads cache on subsequent calls.
 * Skips sentences with label "No agreement".
 *
 * @returns {Promise<BabeSentence[]>}
 */
export async function loadBabeCorpus() {
  if (!existsSync(CACHE_PATH)) {
    await downloadBabe()
  }

  const raw = readFileSync(CACHE_PATH, 'utf8')
  const rows = parseCSV(raw, ';')

  if (rows.length < 2) throw new Error('BABE CSV appears empty or malformed')

  // Header: text;news_link;outlet;topic;type;label_bias;label_opinion;biased_words
  const header = rows[0].map((h) => h.trim().toLowerCase())
  const textIdx = header.findIndex((h) => h === 'text' || h === 'sentence')
  const labelIdx = header.findIndex((h) => h === 'label_bias' || h === 'label')
  const wordsIdx = header.findIndex((h) => h === 'biased_words' || h === 'biasedwords')

  if (textIdx === -1) throw new Error(`BABE CSV missing 'text' column. Headers: ${header.join('; ')}`)
  if (labelIdx === -1) throw new Error(`BABE CSV missing 'label_bias' column. Headers: ${header.join('; ')}`)

  /** @type {BabeSentence[]} */
  const sentences = []

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.length < 2) continue

    const text = (row[textIdx] ?? '').trim()
    if (!text) continue

    const rawLabel = (row[labelIdx] ?? '').trim().toLowerCase()

    let label
    if (rawLabel === 'biased') label = 'biased'
    else if (rawLabel === 'non-biased' || rawLabel === 'not-biased') label = 'not-biased'
    else continue  // skip "no agreement" and unrecognised labels

    const rawWords = wordsIdx !== -1 ? (row[wordsIdx] ?? '').trim() : ''
    const biasedWords = parsePythonList(rawWords)

    sentences.push({ text, label: /** @type {'biased' | 'not-biased'} */ (label), biasedWords })
  }

  if (sentences.length === 0) throw new Error('BABE CSV parsed 0 valid sentences')
  return sentences
}

/**
 * Mulberry32 — deterministic 32-bit PRNG seeded by a number.
 * Returns a function that yields floats in [0, 1).
 *
 * @param {number} seed
 * @returns {() => number}
 */
function mulberry32(seed) {
  let s = seed >>> 0
  return () => {
    s += 0x6d2b79f5
    let z = s
    z = Math.imul(z ^ (z >>> 15), z | 1)
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61)
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Stratified sample of n sentences: n/2 biased + n/2 not-biased (or all available).
 * Uses a seeded PRNG for deterministic results across runs.
 *
 * @param {BabeSentence[]} corpus
 * @param {number} n - total desired sample size
 * @param {number} [seed=42] - PRNG seed. Override with --seed N for variance testing.
 * @returns {BabeSentence[]}
 */
export function sampleCorpus(corpus, n, seed = 42) {
  const half = Math.floor(n / 2)
  const rand = mulberry32(seed)

  const biased = corpus.filter((s) => s.label === 'biased')
  const notBiased = corpus.filter((s) => s.label === 'not-biased')

  const sample = (arr, k) => {
    const shuffled = [...arr].sort(() => rand() - 0.5)
    return shuffled.slice(0, Math.min(k, shuffled.length))
  }

  return [...sample(biased, half), ...sample(notBiased, n - half)]
}
