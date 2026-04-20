#!/usr/bin/env node
/**
 * scripts/convert-babe.mjs — Convert + clean the BABE bias-word lexicon
 *
 * Usage:
 *   node scripts/convert-babe.mjs                      # fetch xlsx from GitHub
 *   node scripts/convert-babe.mjs --input <xlsx-path>  # read local xlsx file
 *   node scripts/convert-babe.mjs --input <json-path>  # read local JSON file
 *
 * Output: extension/public/assets/babe-lexicon.json
 *
 * Source: BABE (Bias Annotations By Experts) lexicon
 *   Spinde et al. (2021), AGPL-3.0
 *   https://github.com/Media-Bias-Group/Neural-Media-Bias-Detection-Using-Distant-Supervision-With-BABE
 *
 * Note: The upstream lexicon is distributed as an .xlsx file. This script
 * delegates xlsx parsing to the `python3` interpreter (openpyxl) since xlsx
 * parsers are not shipped in the extension bundle. Run from repo root.
 * Requires: python3 + openpyxl (`pip3 install openpyxl`)
 *
 * Deterministic output: same input → identical entries array (sorted, deduped).
 * Timestamps in generated_at will differ between runs; entries array will not.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');
const OUTPUT_PATH = resolve(REPO_ROOT, 'extension/public/assets/babe-lexicon.json');

const BABE_XLSX_URL =
  'https://raw.githubusercontent.com/Media-Bias-Group/Neural-Media-Bias-Detection-Using-Distant-Supervision-With-BABE/main/data/bias_word_lexicon.xlsx';

const MIN_TOKEN_LENGTH = 3;

/**
 * Explicit blocklist: known proper nouns and typos from the BABE lexicon.
 * These are removed deterministically to avoid filtering heuristics removing
 * legitimate bias words.
 */
const BLOCKLIST = new Set([
  'mmfa',
  'marshbaum',
  'hypocricy',
]);

/**
 * Parse CLI args. Returns { inputPath: string | null }.
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const inputIndex = args.indexOf('--input');
  if (inputIndex !== -1 && args[inputIndex + 1]) {
    return { inputPath: resolve(args[inputIndex + 1]) };
  }
  return { inputPath: null };
}

/**
 * Download a URL to a local file path using fetch.
 */
async function downloadFile(url, destPath) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: HTTP ${response.status} ${response.statusText}`);
  }
  const buffer = await response.arrayBuffer();
  writeFileSync(destPath, Buffer.from(buffer));
}

/**
 * Parse a local .xlsx file to a flat array of strings using Python + openpyxl.
 * Each row is a single bias word (no header row in the BABE lexicon xlsx).
 */
function parseXlsxWithPython(xlsxPath) {
  const script = `
import openpyxl, json, sys
wb = openpyxl.load_workbook(sys.argv[1])
ws = wb.active
words = [str(r[0]).strip() for r in ws.iter_rows(values_only=True) if r[0] is not None]
print(json.dumps(words))
`.trim();

  const tmpScript = join(tmpdir(), 'babe-parse.py');
  writeFileSync(tmpScript, script, 'utf8');

  try {
    const output = execSync(`python3 "${tmpScript}" "${xlsxPath}"`, { encoding: 'utf8' });
    return JSON.parse(output.trim());
  } catch (err) {
    const msg = err.message || String(err);
    if (msg.includes('ModuleNotFoundError') && msg.includes('openpyxl')) {
      throw new Error(
        'openpyxl not found. Install it with: pip3 install openpyxl\n' +
        'Then re-run: node scripts/convert-babe.mjs',
      );
    }
    throw new Error(`xlsx parsing failed: ${msg}`);
  }
}

/**
 * Parse a local JSON file (dict format: { "word": {...}, ... } or string[]).
 * Supports both the BABE dict format and a plain word array.
 */
function parseJsonFile(jsonPath) {
  const raw = JSON.parse(readFileSync(jsonPath, 'utf8'));
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'object' && raw !== null) return Object.keys(raw);
  throw new Error('Unexpected JSON format: expected array or object');
}

/**
 * Returns true if a token should be kept in the lexicon.
 * Filters out:
 * - Proper nouns (original form starts with uppercase)
 * - Tokens shorter than MIN_TOKEN_LENGTH chars
 * - Numeric tokens (starts with a digit)
 * - URL fragments (contains '://')
 * - Explicit blocklist entries
 */
function isValidEntry(originalWord) {
  if (/^[A-Z]/.test(originalWord)) return false;

  const lowered = originalWord.trim().toLowerCase();
  if (lowered.length < MIN_TOKEN_LENGTH) return false;
  if (/^\d/.test(lowered)) return false;
  if (lowered.includes('://')) return false;
  if (BLOCKLIST.has(lowered)) return false;

  return true;
}

/**
 * Apply cleanup rules and return sorted, deduped array of lowercase entries.
 */
function cleanLexicon(rawWords) {
  const rawCount = rawWords.length;

  const cleaned = rawWords
    .filter(isValidEntry)
    .map((w) => w.trim().toLowerCase());

  const unique = [...new Set(cleaned)].sort((a, b) => a.localeCompare(b, 'en'));

  const removedCount = rawCount - unique.length;
  const removalPct = ((removedCount / rawCount) * 100).toFixed(1);

  process.stdout.write(
    `Raw entries:     ${rawCount}\n` +
    `After cleanup:   ${unique.length}\n` +
    `Removed:         ${removedCount} (${removalPct}%)\n`,
  );

  return unique;
}

/**
 * Build the output JSON object.
 */
function buildOutput(entries) {
  return {
    attribution: {
      name: 'BABE: Bias Annotations By Experts',
      authors: 'Spinde, T., Plank, M., Krieger, J.-D., Ruas, T., Gipp, B., & Aizawa, A.',
      url: 'https://github.com/Media-Bias-Group/Neural-Media-Bias-Detection-Using-Distant-Supervision-With-BABE',
      license: 'AGPL-3.0',
    },
    version: '1.0.0',
    generated_at: new Date().toISOString(),
    entries,
  };
}

async function main() {
  const { inputPath } = parseArgs();

  let rawWords;

  if (inputPath) {
    if (!existsSync(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }
    process.stdout.write(`Reading BABE lexicon from: ${inputPath}\n`);
    const ext = extname(inputPath).toLowerCase();
    if (ext === '.xlsx') {
      rawWords = parseXlsxWithPython(inputPath);
    } else if (ext === '.json') {
      rawWords = parseJsonFile(inputPath);
    } else {
      throw new Error(`Unsupported file extension: ${ext}. Use .xlsx or .json`);
    }
  } else {
    process.stdout.write(`Fetching BABE lexicon from: ${BABE_XLSX_URL}\n`);
    const tmpXlsx = join(tmpdir(), 'babe-lexicon-download.xlsx');
    await downloadFile(BABE_XLSX_URL, tmpXlsx);
    process.stdout.write('Download complete. Parsing xlsx...\n');
    rawWords = parseXlsxWithPython(tmpXlsx);
  }

  const entries = cleanLexicon(rawWords);
  const output = buildOutput(entries);

  // Ensure output directory exists
  const outputDir = dirname(OUTPUT_PATH);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n', 'utf8');

  process.stdout.write(`\nWritten to: ${OUTPUT_PATH}\n`);
  process.stdout.write(`Done. ${entries.length} entries committed to lexicon.\n`);
}

main().catch((err) => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
