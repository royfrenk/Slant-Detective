/**
 * eval/babe-corpus.mjs — Download and parse BABE sentence corpus
 *
 * Source: Spinde et al. (2021), AGPL-3.0
 * https://github.com/Media-Bias-Group/Neural-Media-Bias-Detection-Using-Distant-Supervision-With-BABE
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = resolve(SCRIPT_DIR, 'data')
const CACHE_PATH = resolve(DATA_DIR, 'SGB_combined.csv')

const BABE_CSV_URL =
  'https://raw.githubusercontent.com/Media-Bias-Group/Neural-Media-Bias-Detection-Using-Distant-Supervision-With-BABE/master/data/SGB_combined.csv'

/**
 * @typedef {{ text: string, label: 'biased' | 'not-biased', biasedWords: string[] }} BabeSentence
 */

/**
 * Minimal CSV parser that handles quoted fields with embedded commas/newlines.
 * Returns rows as string arrays.
 *
 * @param {string} csv
 * @returns {string[][]}
 */
function parseCSV(csv) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i]
    const next = csv[i + 1]

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
      } else if (ch === ',') {
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

  // Trailing row without newline
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows
}

/**
 * Download the BABE CSV from GitHub and cache locally.
 *
 * @returns {Promise<void>}
 */
async function downloadBabe() {
  process.stderr.write(`Downloading BABE corpus from ${BABE_CSV_URL}...\n`)
  const res = await fetch(BABE_CSV_URL, { signal: AbortSignal.timeout(60_000) })
  if (!res.ok) throw new Error(`Failed to download BABE corpus: HTTP ${res.status}`)
  const text = await res.text()
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(CACHE_PATH, text, 'utf8')
  process.stderr.write(`BABE corpus cached at ${CACHE_PATH}\n`)
}

/**
 * Load and parse BABE corpus. Downloads on first call; reads cache on subsequent calls.
 *
 * @returns {Promise<BabeSentence[]>}
 */
export async function loadBabeCorpus() {
  if (!existsSync(CACHE_PATH)) {
    await downloadBabe()
  }

  const raw = readFileSync(CACHE_PATH, 'utf8')
  const rows = parseCSV(raw)

  if (rows.length < 2) throw new Error('BABE CSV appears empty or malformed')

  // Detect header row to find column indices
  const header = rows[0].map((h) => h.trim().toLowerCase())
  const textIdx = header.findIndex((h) => h === 'text' || h === 'sentence')
  const labelIdx = header.findIndex((h) => h === 'label')
  const wordsIdx = header.findIndex((h) => h === 'biased_words' || h === 'biasedwords')

  if (textIdx === -1) throw new Error(`BABE CSV missing 'text' column. Headers: ${header.join(', ')}`)
  if (labelIdx === -1) throw new Error(`BABE CSV missing 'label' column. Headers: ${header.join(', ')}`)

  /** @type {BabeSentence[]} */
  const sentences = []

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (row.length < 2) continue

    const text = (row[textIdx] ?? '').trim()
    const rawLabel = (row[labelIdx] ?? '').trim().toLowerCase()

    if (!text) continue
    if (rawLabel !== 'biased' && rawLabel !== 'not-biased') continue

    const label = /** @type {'biased' | 'not-biased'} */ (rawLabel)
    const rawWords = wordsIdx !== -1 ? (row[wordsIdx] ?? '').trim() : ''
    const biasedWords = rawWords ? rawWords.split(/\s+/).filter(Boolean) : []

    sentences.push({ text, label, biasedWords })
  }

  if (sentences.length === 0) throw new Error('BABE CSV parsed 0 valid sentences')
  return sentences
}

/**
 * Stratified sample of n sentences: n/2 biased + n/2 not-biased (or all available).
 *
 * @param {BabeSentence[]} corpus
 * @param {number} n - total desired sample size
 * @returns {BabeSentence[]}
 */
export function sampleCorpus(corpus, n) {
  const half = Math.floor(n / 2)

  const biased = corpus.filter((s) => s.label === 'biased')
  const notBiased = corpus.filter((s) => s.label === 'not-biased')

  const sample = (arr, k) => {
    const shuffled = [...arr].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, Math.min(k, shuffled.length))
  }

  return [...sample(biased, half), ...sample(notBiased, n - half)]
}
