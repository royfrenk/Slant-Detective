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
//
// Queries Analytics Engine via Cloudflare API for real-world score_sample events
// and outputs reference-distribution-{provider}-empirical.json.
//
// Required environment variables:
//   CF_ACCOUNT_ID   — Cloudflare account ID
//   CF_API_TOKEN    — Cloudflare API token with Analytics Engine read permission
//   CF_DATASET      — Analytics Engine dataset name (default: TELEMETRY)
//
// Min-count threshold: buckets with fewer than MIN_COUNT samples per (domain,day)
// are excluded from per-site curves, but all samples contribute to the global curve.
//
// Per-site JSON output: reference-distribution-{provider}-{domain_etld1}-empirical.json
// for any domain with >= MIN_SITE_SAMPLES total samples.

const MIN_SITE_SAMPLES = 30 // min samples for a per-site curve to be useful
const TOP_N_SITES = 50      // generate per-site curves for top N domains by sample count

async function runEmpirical(provider) {
  console.log(`Building empirical distribution: provider=${provider}`)

  const accountId = process.env['CF_ACCOUNT_ID']
  const apiToken = process.env['CF_API_TOKEN']
  const dataset = process.env['CF_DATASET'] ?? 'TELEMETRY'

  if (!accountId || !apiToken) {
    console.error('Missing required env vars: CF_ACCOUNT_ID and CF_API_TOKEN')
    console.error('Get a Cloudflare API token with Analytics Engine read permission.')
    process.exit(1)
  }

  // Query Analytics Engine SQL API for score_sample data points
  // Analytics Engine stores blob1=domain_etld1, blob3=provider, doubles=[overall,wc,fr,hs,sm]
  // We filter by provider (blob3 = index field) and select all score columns.
  const sql = `
    SELECT
      blob1 AS domain_etld1,
      double1 AS overall,
      double2 AS word_choice,
      double3 AS framing,
      double4 AS headline_slant,
      double5 AS source_mix,
      COUNT() AS sample_count
    FROM ${dataset}
    WHERE blob3 = '${provider}'
    GROUP BY blob1, overall, word_choice, framing, headline_slant, source_mix
    LIMIT 100000
  `.trim()

  let rows
  try {
    const resp = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `query=${encodeURIComponent(sql)}`,
      }
    )

    if (!resp.ok) {
      const text = await resp.text()
      console.error(`Analytics Engine API error ${resp.status}: ${text}`)
      process.exit(1)
    }

    const json = await resp.json()
    rows = json.data ?? []
  } catch (err) {
    console.error(`Failed to query Analytics Engine: ${String(err)}`)
    process.exit(1)
  }

  console.log(`Received ${rows.length} aggregated rows from Analytics Engine`)

  if (rows.length === 0) {
    console.log('No empirical data yet — returning empty distribution.')
    const empty = buildEmptyCurveOutput(provider)
    return empty
  }

  // Build global distribution from all rows
  const allOverall = rows.map((r) => Number(r.overall)).sort((a, b) => a - b)
  const allWordChoice = rows.map((r) => Number(r.word_choice)).sort((a, b) => a - b)
  const allFraming = rows.map((r) => Number(r.framing)).sort((a, b) => a - b)
  const allHeadlineSlant = rows.map((r) => Number(r.headline_slant)).sort((a, b) => a - b)
  const allSourceMix = rows.map((r) => Number(r.source_mix)).sort((a, b) => a - b)

  const globalOutput = {
    rubric_version: RUBRIC_VERSIONS[provider],
    provider,
    corpus_size: rows.length,
    source: 'empirical',
    built_at: new Date().toISOString().slice(0, 10),
    note: `Empirical distribution from ${rows.length} score_sample events via Analytics Engine.`,
    overall: allOverall,
    word_choice: allWordChoice,
    framing: allFraming,
    headline_slant: allHeadlineSlant,
    source_mix: allSourceMix,
  }

  // Per-site distributions: group rows by domain_etld1
  const byDomain = {}
  for (const row of rows) {
    const domain = row.domain_etld1
    if (!domain) continue
    if (!byDomain[domain]) byDomain[domain] = []
    byDomain[domain].push(row)
  }

  // Sort domains by sample count descending, take top N with >= MIN_SITE_SAMPLES
  const topDomains = Object.entries(byDomain)
    .filter(([, domainRows]) => domainRows.length >= MIN_SITE_SAMPLES)
    .sort(([, a], [, b]) => b.length - a.length)
    .slice(0, TOP_N_SITES)

  console.log(`Generating per-site curves for ${topDomains.length} domains (min ${MIN_SITE_SAMPLES} samples)`)

  // Write per-site JSONs
  for (const [domain, domainRows] of topDomains) {
    const siteOverall = domainRows.map((r) => Number(r.overall)).sort((a, b) => a - b)
    const siteWordChoice = domainRows.map((r) => Number(r.word_choice)).sort((a, b) => a - b)
    const siteFraming = domainRows.map((r) => Number(r.framing)).sort((a, b) => a - b)
    const siteHeadlineSlant = domainRows.map((r) => Number(r.headline_slant)).sort((a, b) => a - b)
    const siteSourceMix = domainRows.map((r) => Number(r.source_mix)).sort((a, b) => a - b)

    const safeDomainSlug = domain.replace(/[^a-z0-9.-]/g, '_')
    const siteOutput = {
      rubric_version: RUBRIC_VERSIONS[provider],
      provider,
      domain_etld1: domain,
      corpus_size: domainRows.length,
      source: 'empirical-site',
      built_at: new Date().toISOString().slice(0, 10),
      note: `Per-site empirical distribution for ${domain} (${domainRows.length} samples).`,
      overall: siteOverall,
      word_choice: siteWordChoice,
      framing: siteFraming,
      headline_slant: siteHeadlineSlant,
      source_mix: siteSourceMix,
    }

    mkdirSync(ASSETS_DIR, { recursive: true })
    const sitePath = join(ASSETS_DIR, `reference-distribution-${provider}-${safeDomainSlug}-empirical.json`)
    writeFileSync(sitePath, JSON.stringify(siteOutput, null, 2), 'utf8')
    console.log(`  Wrote per-site: ${sitePath} (${domainRows.length} samples)`)
  }

  return globalOutput
}

function buildEmptyCurveOutput(provider) {
  return {
    rubric_version: RUBRIC_VERSIONS[provider],
    provider,
    corpus_size: 0,
    source: 'empirical',
    built_at: new Date().toISOString().slice(0, 10),
    note: 'No empirical data collected yet. Re-run after score_sample events are collected.',
    overall: [],
    word_choice: [],
    framing: [],
    headline_slant: [],
    source_mix: [],
  }
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
  // Empirical global curve gets a distinct filename to avoid overwriting static corpus.
  const suffix = mode === 'empirical' ? '-empirical' : ''
  const outPath = join(ASSETS_DIR, `reference-distribution-${provider}${suffix}.json`)
  writeFileSync(outPath, JSON.stringify(distribution, null, 2), 'utf8')
  console.log(`Wrote: ${outPath} (${distribution.overall.length} data points)`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
