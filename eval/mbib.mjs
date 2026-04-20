/**
 * eval/mbib.mjs — Download and parse MBIB linguistic-bias + political-bias splits
 *
 * MBIB: Media Bias Identification Benchmark
 * https://github.com/Media-Bias-Group/MBIB
 *
 * License: GPL-3.0 aggregate with mixed sub-licenses.
 * Do NOT bundle in extension. Download at eval-time only; gitignored.
 *
 * Uses the same BabeSentence shape as babe-corpus.mjs for uniform scoring.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = resolve(SCRIPT_DIR, 'data')

/**
 * @typedef {{ text: string, label: 'biased' | 'not-biased', biasedWords: string[] }} BabeSentence
 */

// ─── MBIB download URLs ───────────────────────────────────────────────────────
// MBIB repo structure: tasks/<task-name>/data/<split>.csv
// linguistic-bias and political-bias are the two relevant splits.

const MBIB_BASE =
  'https://raw.githubusercontent.com/Media-Bias-Group/MBIB/main/tasks'

const MBIB_SPLITS = {
  linguistic: `${MBIB_BASE}/linguistic-bias/data/test.csv`,
  political: `${MBIB_BASE}/political-bias/data/test.csv`,
}

const MBIB_CACHE = {
  linguistic: resolve(DATA_DIR, 'mbib-linguistic.csv'),
  political: resolve(DATA_DIR, 'mbib-political.csv'),
}

// ─── Download helper ──────────────────────────────────────────────────────────

/**
 * @param {string} url
 * @param {string} destPath
 */
async function downloadCsv(url, destPath) {
  process.stderr.write(`Downloading MBIB split from ${url}...\n`)
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) })
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(
        `MBIB split not found at expected path — update eval/mbib.mjs download URLs.\nURL: ${url}`
      )
    }
    throw new Error(`Failed to download MBIB split: HTTP ${res.status}`)
  }
  const text = await res.text()
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(destPath, text, 'utf8')
  process.stderr.write(`MBIB split cached at ${destPath}\n`)
}

// ─── CSV parser ───────────────────────────────────────────────────────────────

/**
 * Minimal CSV parser supporting quoted fields.
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
      if (ch === '"' && next === '"') { field += '"'; i++ }
      else if (ch === '"') inQuotes = false
      else field += ch
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ',') { row.push(field); field = '' }
      else if (ch === '\r' && next === '\n') {
        row.push(field); field = ''; rows.push(row); row = []; i++
      } else if (ch === '\n') {
        row.push(field); field = ''; rows.push(row); row = []
      } else {
        field += ch
      }
    }
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row) }
  return rows
}

// ─── Parse a MBIB CSV file into BabeSentence[] ───────────────────────────────

/**
 * @param {string} csvPath
 * @param {string} splitName - for error messages
 * @returns {BabeSentence[]}
 */
function parseMbibCsv(csvPath, splitName) {
  const raw = readFileSync(csvPath, 'utf8')
  const rows = parseCSV(raw)
  if (rows.length < 2) throw new Error(`MBIB ${splitName} CSV appears empty or malformed`)

  const header = rows[0].map((h) => h.trim().toLowerCase())
  const textIdx = header.findIndex((h) => h === 'text' || h === 'sentence')
  const labelIdx = header.findIndex((h) => h === 'label')

  if (textIdx === -1) {
    throw new Error(`MBIB ${splitName} CSV missing 'text' column. Headers: ${header.join(', ')}`)
  }
  if (labelIdx === -1) {
    throw new Error(`MBIB ${splitName} CSV missing 'label' column. Headers: ${header.join(', ')}`)
  }

  /** @type {BabeSentence[]} */
  const sentences = []

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (row.length < 2) continue

    const text = (row[textIdx] ?? '').trim()
    if (!text) continue

    // MBIB uses various label formats: 0/1, biased/non-biased, biased/not-biased
    const rawLabel = (row[labelIdx] ?? '').trim().toLowerCase()
    let label
    if (rawLabel === 'biased' || rawLabel === '1') label = 'biased'
    else if (rawLabel === 'not-biased' || rawLabel === 'non-biased' || rawLabel === '0') label = 'not-biased'
    else continue  // skip unrecognised labels

    sentences.push({ text, label: /** @type {'biased' | 'not-biased'} */ (label), biasedWords: [] })
  }

  return sentences
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Load MBIB linguistic-bias and political-bias splits.
 * Downloads on first call; reads from cache on subsequent calls.
 *
 * @returns {Promise<{ linguistic: BabeSentence[], political: BabeSentence[] }>}
 */
export async function loadMbibSplits() {
  for (const [split, url] of Object.entries(MBIB_SPLITS)) {
    const cachePath = MBIB_CACHE[split]
    if (!existsSync(cachePath)) {
      await downloadCsv(url, cachePath)
    }
  }

  const linguistic = parseMbibCsv(MBIB_CACHE.linguistic, 'linguistic-bias')
  const political = parseMbibCsv(MBIB_CACHE.political, 'political-bias')

  return { linguistic, political }
}
