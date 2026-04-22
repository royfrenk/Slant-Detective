/**
 * eval/build-distribution.mjs — Reference corpus distribution builder
 *
 * Usage:
 *   node eval/build-distribution.mjs --mode=static --provider=anthropic
 *   node eval/build-distribution.mjs --mode=static --provider=openai
 *   node eval/build-distribution.mjs --mode=static --provider=gemini
 *   node eval/build-distribution.mjs --mode=static --provider=layer1
 *
 * SD-041 will add:
 *   node eval/build-distribution.mjs --mode=empirical --provider=anthropic
 *
 * Output:
 *   extension/public/assets/reference-distribution-{provider}.json
 *
 * The distribution JSON contains sorted arrays (one score per corpus article)
 * for overall + each dimension. The side-panel uses binary search to find a
 * score's percentile rank at render time.
 *
 * SD-040 (static mode): scores are derived from the reference corpus using the
 * full rubric pipeline. Running this requires an API key for the given provider.
 * Layer1 mode uses deterministic local signals — no API key needed.
 *
 * SD-041 (empirical mode, not yet implemented): will query Analytics Engine for
 * real-world score samples and rebuild per-provider + per-site curves.
 */

import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const ASSETS_DIR = resolve(SCRIPT_DIR, '../extension/public/assets')
const CORPUS_DIR = resolve(SCRIPT_DIR, 'reference-corpus')

// ─── CLI arg parsing ──────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  const parsed = { mode: 'static', provider: 'anthropic' }

  for (const arg of args) {
    if (arg.startsWith('--mode=')) {
      parsed.mode = arg.slice('--mode='.length)
    } else if (arg.startsWith('--provider=')) {
      parsed.provider = arg.slice('--provider='.length)
    }
  }

  return parsed
}

const VALID_MODES = new Set(['static', 'empirical'])
const VALID_PROVIDERS = new Set(['anthropic', 'openai', 'gemini', 'layer1'])

// ─── Rubric-version lookup ────────────────────────────────────────────────────

const RUBRIC_VERSIONS = {
  anthropic: 'v1.1',
  openai: 'rubric_v1.1-openai',
  gemini: 'rubric_v1.1-gemini',
  layer1: 'layer1-v1.0',
}

// ─── Corpus loader ────────────────────────────────────────────────────────────

function loadCorpusIndex() {
  const indexPath = join(CORPUS_DIR, 'corpus-index.json')
  if (!existsSync(indexPath)) {
    console.error(`Reference corpus index not found: ${indexPath}`)
    console.error('Run the corpus builder or create eval/reference-corpus/corpus-index.json')
    process.exit(1)
  }
  return JSON.parse(readFileSync(indexPath, 'utf8'))
}

// ─── Static mode (LLM scoring) ───────────────────────────────────────────────

async function runStatic(provider) {
  console.log(`Building static distribution: provider=${provider}`)

  // For Layer 1, skip LLM call — use deterministic signal-based scores
  if (provider === 'layer1') {
    return runLayer1Static()
  }

  const apiKey = process.env[`${provider.toUpperCase()}_API_KEY`]
    ?? process.env['ANTHROPIC_API_KEY']
  if (!apiKey && provider !== 'layer1') {
    console.error(`No API key found. Set ${provider.toUpperCase()}_API_KEY.`)
    process.exit(1)
  }

  const corpus = loadCorpusIndex()
  console.log(`Loaded ${corpus.articles.length} articles from reference corpus`)

  // Import provider-specific rubric driver
  const { scoreBatch } = await import('./rubric-driver.mjs')

  const results = []
  for (const article of corpus.articles) {
    try {
      const articlePath = join(CORPUS_DIR, article.text_file)
      if (!existsSync(articlePath)) {
        console.warn(`  Skipping ${article.id}: text file not found at ${articlePath}`)
        continue
      }
      const body = readFileSync(articlePath, 'utf8')
      const scored = await scoreBatch(
        [{ title: article.title, body, word_count: body.split(/\s+/).length }],
        { provider, apiKey, concurrency: 1 },
      )
      if (scored[0]?.ok) {
        results.push(scored[0].result)
      }
    } catch (err) {
      console.warn(`  Error scoring ${article.id}: ${String(err)}`)
    }
  }

  return buildDistributionFromResults(results, provider)
}

// Layer 1 deterministic scoring (no LLM)
async function runLayer1Static() {
  console.log('Building Layer 1 static distribution (deterministic signals)')
  const corpus = loadCorpusIndex()
  console.log(`Loaded ${corpus.articles.length} articles from reference corpus`)

  // Layer 1 does not use the LLM — placeholder scores based on corpus metadata
  // when text signal analysis is not available in eval harness
  const overallScores = corpus.articles
    .filter((a) => typeof a.layer1_overall_score === 'number')
    .map((a) => a.layer1_overall_score)
    .sort((x, y) => x - y)

  const output = {
    rubric_version: RUBRIC_VERSIONS.layer1,
    provider: 'layer1',
    corpus_size: overallScores.length,
    built_at: new Date().toISOString().slice(0, 10),
    note: 'Static reference corpus distribution for Layer 1 signal-based scores.',
    overall: overallScores,
  }

  return output
}

function buildDistributionFromResults(results, provider) {
  const overall = results.map((r) => r.overall.intensity).sort((a, b) => a - b)
  const wordChoice = results.map((r) => r.dimensions.word_choice.score).sort((a, b) => a - b)
  const framing = results.map((r) => r.dimensions.framing.score).sort((a, b) => a - b)
  const headlineSlant = results.map((r) => r.dimensions.headline_slant.score).sort((a, b) => a - b)
  const sourceMix = results.map((r) => r.dimensions.source_mix.score).sort((a, b) => a - b)

  return {
    rubric_version: RUBRIC_VERSIONS[provider],
    provider,
    corpus_size: results.length,
    built_at: new Date().toISOString().slice(0, 10),
    note: 'Static reference corpus distribution. Replace with empirical curves via SD-041.',
    overall,
    word_choice: wordChoice,
    framing,
    headline_slant: headlineSlant,
    source_mix: sourceMix,
  }
}

// ─── Empirical mode (SD-041) ─────────────────────────────────────────────────

async function runEmpirical(provider) {
  // SD-041 will implement this mode. It queries Analytics Engine for real-world
  // score samples and outputs per-provider + per-site curves.
  console.error('Empirical mode is not yet implemented. This will be added in SD-041.')
  console.error('Usage: node eval/build-distribution.mjs --mode=static --provider=anthropic')
  process.exit(1)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { mode, provider } = parseArgs()

  if (!VALID_MODES.has(mode)) {
    console.error(`Invalid --mode: ${mode}. Valid values: ${[...VALID_MODES].join(', ')}`)
    process.exit(1)
  }

  if (!VALID_PROVIDERS.has(provider)) {
    console.error(`Invalid --provider: ${provider}. Valid values: ${[...VALID_PROVIDERS].join(', ')}`)
    process.exit(1)
  }

  let distribution
  if (mode === 'static') {
    distribution = await runStatic(provider)
  } else {
    distribution = await runEmpirical(provider)
  }

  mkdirSync(ASSETS_DIR, { recursive: true })
  const outPath = join(ASSETS_DIR, `reference-distribution-${provider}.json`)
  writeFileSync(outPath, JSON.stringify(distribution, null, 2), 'utf8')
  console.log(`Wrote: ${outPath} (${distribution.overall.length} articles)`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
