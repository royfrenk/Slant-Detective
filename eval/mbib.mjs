/**
 * eval/mbib.mjs — Download and parse MBIB dataset splits
 *
 * MBIB: Media Bias Identification Benchmark
 * https://github.com/Media-Bias-Group/MBIB
 *
 * License: GPL-3.0 aggregate with mixed sub-licenses.
 * Do NOT bundle in extension. Download at eval-time only; gitignored.
 *
 * Uses the same BabeSentence shape as babe-corpus.mjs for uniform scoring.
 *
 * Available splits in datasets/mbib-full/:
 *   political-bias, text-level-bias, cognitive-bias, fake-news,
 *   gender-bias, hate-speech, racial-bias
 *
 * We use political-bias and text-level-bias (closest to "linguistic bias")
 * as the two secondary benchmark splits referenced in the spec.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = resolve(SCRIPT_DIR, 'data')

/**
 * @typedef {{ text: string, label: 'biased' | 'not-biased', biasedWords: string[] }} BabeSentence
 */

const MBIB_BASE =
  'https://raw.githubusercontent.com/Media-Bias-Group/MBIB/main/datasets/mbib-full'

// text-level-bias is the closest equivalent to "linguistic bias" in the current MBIB repo.
// The spec referenced an older MBIB structure; these are the current canonical split paths.
const MBIB_SPLITS = {
  political: `${MBIB_BASE}/political-bias.csv`,
  linguistic: `${MBIB_BASE}/text-level-bias.csv`,
}

const MBIB_CACHE = {
  political: resolve(DATA_DIR, 'mbib-political.csv'),
  linguistic: resolve(DATA_DIR, 'mbib-linguistic.csv'),
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
 * @param {string} [delimiter=',']
 * @returns {string[][]}
 */
function parseCSV(csv, delimiter = ',') {
  const text = csv.startsWith('\uFEFF') ? csv.slice(1) : csv
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++ }
      else if (ch === '"') inQuotes = false
      else field += ch
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === delimiter) { row.push(field); field = '' }
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
  const rows = parseCSV(raw, ',')
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
    if (!row || row.length < 2) continue

    const text = (row[textIdx] ?? '').trim()
    if (!text) continue

    // MBIB uses 0/1 integer labels
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
 * Load MBIB political-bias and text-level-bias (linguistic) splits.
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

  const linguistic = parseMbibCsv(MBIB_CACHE.linguistic, 'text-level-bias')
  const political = parseMbibCsv(MBIB_CACHE.political, 'political-bias')

  return { linguistic, political }
}
