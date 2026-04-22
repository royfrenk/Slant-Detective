/**
 * eval/run.mjs — BABE eval harness entry point
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... node eval/run.mjs [--provider anthropic] [--model MODEL]
 *   OPENAI_API_KEY=sk-...    node eval/run.mjs --provider openai
 *   GEMINI_API_KEY=AIza...   node eval/run.mjs --provider gemini
 *
 *   # Smoke test (500-sentence sample)
 *   ANTHROPIC_API_KEY=sk-... node eval/run.mjs --smoke
 *
 *   # MBIB secondary benchmark
 *   ANTHROPIC_API_KEY=sk-... node eval/run.mjs --mbib
 *
 *   # Force-update baseline after deliberate prompt improvement (Anthropic only)
 *   ANTHROPIC_API_KEY=sk-... node eval/run.mjs --update-baseline
 *
 * Exit codes:
 *   0 — gate passed (or first run)
 *   1 — gate failed, parity failed, or fatal error
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadBabeCorpus, sampleCorpus } from './babe-corpus.mjs'
import { scoreBatch, classifyResult, RUBRIC_VERSION } from './rubric-driver.mjs'
import { computeClassificationMetrics, computeSpanMetrics } from './metrics.mjs'
import { loadBaseline, saveBaseline, checkGate, printGateReport, checkParity } from './gate.mjs'
import { loadMbibSplits } from './mbib.mjs'
import { getProvider, getApiKey, DEFAULT_MODELS, PROVIDER_NAMES } from './providers/index.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const CONCURRENCY = 5
const PROGRESS_EVERY = 100

// ─── CLI args ─────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  let sampleN = null
  let seed = 42
  let runMbib = false
  let updateBaseline = false
  let providerName = 'anthropic'
  let model = null     // null = use provider default
  let smoke = false

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--sample' && args[i + 1]) {
      sampleN = parseInt(args[i + 1], 10)
      if (isNaN(sampleN) || sampleN <= 0) {
        process.stderr.write('--sample requires a positive integer\n')
        process.exit(1)
      }
      i++
    } else if (args[i] === '--seed' && args[i + 1]) {
      seed = parseInt(args[i + 1], 10)
      if (isNaN(seed)) {
        process.stderr.write('--seed requires an integer\n')
        process.exit(1)
      }
      i++
    } else if (args[i] === '--mbib') {
      runMbib = true
    } else if (args[i] === '--update-baseline') {
      updateBaseline = true
    } else if (args[i] === '--provider' && args[i + 1]) {
      providerName = args[i + 1]
      if (!PROVIDER_NAMES.includes(providerName)) {
        process.stderr.write(
          `--provider must be one of: ${PROVIDER_NAMES.join(', ')}. Got: "${providerName}"\n`
        )
        process.exit(1)
      }
      i++
    } else if (args[i] === '--model' && args[i + 1]) {
      model = args[i + 1]
      i++
    } else if (args[i] === '--smoke') {
      smoke = true
    }
  }

  // --smoke is an alias for --sample 500 --seed 42
  if (smoke) {
    sampleN = sampleN ?? 500
    seed = 42
  }

  // Resolve final model: explicit --model flag > provider default
  const resolvedModel = model ?? DEFAULT_MODELS[providerName]

  return { sampleN, seed, runMbib, updateBaseline, providerName, model: resolvedModel }
}

// ─── Progress tracker ─────────────────────────────────────────────────────────

function makeProgressReporter(total) {
  let last = 0
  return (completed) => {
    if (completed - last >= PROGRESS_EVERY || completed === total) {
      process.stderr.write(`[${completed}/${total}] scored\n`)
      last = completed
    }
  }
}

// ─── Report printer ───────────────────────────────────────────────────────────

function printReport(label, classMetrics, spanMetrics, nTotal, nSkipped, safetySKipped) {
  const sep = '─'.repeat(45)
  process.stdout.write(`\nSlant Detective Rubric Eval — rubric_${RUBRIC_VERSION}\n`)
  if (label) process.stdout.write(`Dataset: ${label}\n`)
  process.stdout.write(`\n`)
  process.stdout.write(`Sentences evaluated: ${nTotal - nSkipped}`)
  if (nSkipped > 0) process.stdout.write(` (${nSkipped} skipped due to errors)`)
  if (safetySKipped > 0) process.stdout.write(` (${safetySKipped} blocked by safety filter)`)
  process.stdout.write(`\n`)
  process.stdout.write(`${sep}\n`)
  process.stdout.write(`Binary classification\n`)
  process.stdout.write(`  κ:          ${fmt(classMetrics.kappa)}\n`)
  process.stdout.write(`  Precision:  ${fmt(classMetrics.precision)}\n`)
  process.stdout.write(`  Recall:     ${fmt(classMetrics.recall)}\n`)
  process.stdout.write(`  F1:         ${fmt(classMetrics.f1)}\n`)
  process.stdout.write(`\n`)
  process.stdout.write(`Biased-word detection (${spanMetrics.annotatedCount} annotated sentences)\n`)
  process.stdout.write(`  Precision:  ${fmt(spanMetrics.precision)}\n`)
  process.stdout.write(`  Recall:     ${fmt(spanMetrics.recall)}\n`)
  process.stdout.write(`  F1:         ${fmt(spanMetrics.f1)}\n`)
  process.stdout.write(`${sep}\n`)
}

function fmt(n) {
  if (typeof n !== 'number' || isNaN(n)) return 'N/A'
  return n.toFixed(4)
}

// ─── Report file writer ───────────────────────────────────────────────────────

/**
 * Build and write the SD-035 JSON report artifact.
 * Schema defined in docs/technical-specs/SD-035.md — Cost Report JSON Schema.
 *
 * @param {object} opts
 * @returns {string} - Path of written file
 */
function writeProviderReport({
  providerName,
  model,
  rubricVersion,
  nSentences,
  classMetrics,
  spanMetrics,
  tokenTotals,
  safetySkipped,
  baseline,
  parityResult,
  provider,
}) {
  const reportsDir = resolve(SCRIPT_DIR, 'reports')
  mkdirSync(reportsDir, { recursive: true })

  const outPath = resolve(reportsDir, `SD-035-${providerName}.json`)

  const meanInput = nSentences > 0 ? tokenTotals.input_tokens / nSentences : 0
  const meanOutput = nSentences > 0 ? tokenTotals.output_tokens / nSentences : 0

  const inPrice = provider.input_price_per_million / 1_000_000
  const outPrice = provider.output_price_per_million / 1_000_000
  const costPerSentence = meanInput * inPrice + meanOutput * outPrice
  const costPer100Articles = costPerSentence * 100

  const gateBlock = baseline && parityResult
    ? {
        passed: parityResult.passed,
        baseline_kappa: baseline.classification.kappa,
        current_kappa: round4(classMetrics.kappa),
        kappa_delta: round4(parityResult.kappa_delta),
        baseline_f1: baseline.classification.f1,
        current_f1: round4(classMetrics.f1),
        f1_delta: round4(parityResult.f1_delta),
        parity_band_kappa: 0.05,
        parity_band_f1: 0.03,
      }
    : null

  const isGeminiFreeTier = providerName === 'gemini' && nSentences <= 500

  const report = {
    schema_version: '1',
    provider: providerName,
    model,
    rubric_version: rubricVersion,
    run_at: new Date().toISOString(),
    corpus: 'BABE-SG2',
    n_sentences: nSentences,
    safety_skipped: safetySkipped,
    gate: gateBlock,
    classification: {
      kappa: round4(classMetrics.kappa),
      precision: round4(classMetrics.precision),
      recall: round4(classMetrics.recall),
      f1: round4(classMetrics.f1),
    },
    span_detection: {
      precision: round4(spanMetrics.precision),
      recall: round4(spanMetrics.recall),
      f1: round4(spanMetrics.f1),
    },
    token_usage: {
      total_input_tokens: tokenTotals.input_tokens,
      total_output_tokens: tokenTotals.output_tokens,
      mean_input_tokens_per_sentence: round4(meanInput),
      mean_output_tokens_per_sentence: round4(meanOutput),
    },
    cost_model: {
      input_price_per_million: provider.input_price_per_million,
      output_price_per_million: provider.output_price_per_million,
      currency: 'USD',
    },
    cost_per_sentence_usd: round6(costPerSentence),
    cost_per_100_articles_usd: round6(costPer100Articles),
    notes: isGeminiFreeTier
      ? 'Small eval (≤500 sentences) likely falls within Gemini free tier (60 req/min, 1,500 req/day) — actual spend may be $0. cost_per_100_articles_usd is a theoretical non-free-tier estimate. Assumes average article ≈ 1 sentence scored per run. For full-article mode, multiply by mean sentence count per article.'
      : 'Assumes average article ≈ 1 sentence scored per run. For full-article mode, multiply by mean sentence count per article.',
  }

  const json = JSON.stringify(report, null, 2)
  writeFileSync(outPath, json + '\n', 'utf8')

  // Validate the file is parseable before returning
  JSON.parse(json)

  return outPath
}

function round4(n) {
  return Math.round(n * 10000) / 10000
}

function round6(n) {
  return Math.round(n * 1_000_000) / 1_000_000
}

// ─── Score a corpus and collect EvalResults ───────────────────────────────────

/**
 * @param {Array<{ text: string, label: string, biasedWords: string[] }>} sentences
 * @param {object} provider
 * @param {string} apiKey
 * @param {string} model
 * @returns {Promise<{
 *   evalResults: Array<{ sentence: object, predicted: string, spans: string[], error?: string }>,
 *   tokenTotals: { input_tokens: number, output_tokens: number },
 *   safety_skipped: number
 * }>}
 */
async function scoreSentences(sentences, provider, apiKey, model) {
  const texts = sentences.map((s) => s.text)
  const total = texts.length
  const onProgress = makeProgressReporter(total)

  const { results: raw, tokenTotals, safety_skipped } = await scoreBatch(
    texts, provider, apiKey, model, CONCURRENCY, onProgress
  )

  const evalResults = sentences.map((sentence, i) => {
    const item = raw[i]
    if (item instanceof Error) {
      process.stderr.write(`[sentence ${i}] error: ${item.message}\n`)
      return { sentence, predicted: 'not-biased', spans: [], error: item.message }
    }
    const { result } = item
    const predicted = classifyResult(result)
    const spans = result.spans.map((s) => s.text)
    return { sentence, predicted, spans }
  })

  return { evalResults, tokenTotals, safety_skipped }
}

// ─── MBIB report ─────────────────────────────────────────────────────────────

async function runMbibReport(provider, apiKey, model) {
  process.stdout.write('\n\n══ MBIB Secondary Benchmark ══\n')
  process.stderr.write('Loading MBIB splits...\n')

  let splits
  try {
    splits = await loadMbibSplits()
  } catch (err) {
    process.stdout.write(`MBIB: skipped — ${err.message}\n`)
    return
  }

  for (const [name, corpus] of Object.entries(splits)) {
    if (corpus.length === 0) {
      process.stdout.write(`\nMBIB ${name}: empty split, skipping\n`)
      continue
    }
    process.stderr.write(`\nScoring MBIB ${name} (${corpus.length} sentences)...\n`)
    const { evalResults, safety_skipped } = await scoreSentences(corpus, provider, apiKey, model)
    const nSkipped = evalResults.filter((r) => r.error).length
    const classMetrics = computeClassificationMetrics(evalResults)
    const spanMetrics = computeSpanMetrics(evalResults)
    printReport(`MBIB ${name}`, classMetrics, spanMetrics, corpus.length, nSkipped, safety_skipped)
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { sampleN, seed, runMbib, updateBaseline, providerName, model } = parseArgs()

  // Resolve provider driver and API key
  const provider = getProvider(providerName)
  const apiKey = getApiKey(providerName)

  const providerRubricVersion = provider.RUBRIC_VERSION ?? RUBRIC_VERSION

  process.stderr.write(
    `Provider: ${providerName} / Model: ${model} / rubric: ${providerRubricVersion}\n`
  )

  // ── 1. Load corpus ────────────────────────────────────────────────────────
  process.stderr.write('Loading BABE corpus...\n')
  const fullCorpus = await loadBabeCorpus()

  const corpus = sampleN ? sampleCorpus(fullCorpus, sampleN, seed) : fullCorpus
  const nBiased = corpus.filter((s) => s.label === 'biased').length
  const nNotBiased = corpus.length - nBiased
  process.stderr.write(
    `Corpus: ${corpus.length} sentences (biased: ${nBiased} / not-biased: ${nNotBiased})\n`
  )

  // ── 2. Score sentences ────────────────────────────────────────────────────
  process.stderr.write(`Scoring with CONCURRENCY=${CONCURRENCY}...\n`)
  const { evalResults, tokenTotals, safety_skipped } = await scoreSentences(
    corpus, provider, apiKey, model
  )

  const nSkipped = evalResults.filter((r) => r.error).length
  const nEvaluated = corpus.length - nSkipped - safety_skipped

  // ── 3. Compute metrics ────────────────────────────────────────────────────
  const classMetrics = computeClassificationMetrics(evalResults)
  const spanMetrics = computeSpanMetrics(evalResults)

  /** @type {import('./gate.mjs').AllMetrics} */
  const allMetrics = {
    classification: classMetrics,
    span_detection: spanMetrics,
    n_sentences: nEvaluated,
  }

  // ── 4. Print report ───────────────────────────────────────────────────────
  printReport(null, classMetrics, spanMetrics, corpus.length, nSkipped, safety_skipped)

  // ── 5. Gate + parity ──────────────────────────────────────────────────────
  const baseline = loadBaseline()
  let parityResult = null

  if (providerName === 'anthropic') {
    // Anthropic: use the normal regression gate
    if (!baseline || updateBaseline) {
      saveBaseline(allMetrics, providerRubricVersion)
      printGateReport({ passed: true, regressions: [] }, allMetrics, null)
    } else {
      const gateResult = checkGate(allMetrics, baseline)
      printGateReport(gateResult, allMetrics, baseline)

      if (gateResult.passed) {
        saveBaseline(allMetrics, providerRubricVersion)
      } else {
        if (runMbib) await runMbibReport(provider, apiKey, model)
        writeProviderReport({
          providerName, model, rubricVersion: providerRubricVersion, nSentences: nEvaluated,
          classMetrics, spanMetrics, tokenTotals, safetySkipped: safety_skipped,
          baseline, parityResult: null, provider,
        })
        process.exit(1)
      }
    }
  } else {
    // OpenAI / Gemini: parity gate vs. Anthropic Haiku baseline
    if (baseline) {
      parityResult = checkParity(allMetrics, baseline)
      const useColor = process.stdout.hasColors?.() ?? false
      const green = (s) => (useColor ? `\x1b[32m${s}\x1b[0m` : s)
      const red = (s) => (useColor ? `\x1b[31m${s}\x1b[0m` : s)

      if (parityResult.passed) {
        process.stdout.write(
          `Parity gate: ${green('PASS')}  (κ delta ${parityResult.kappa_delta.toFixed(4)}, F1 delta ${parityResult.f1_delta.toFixed(4)})\n`
        )
      } else {
        process.stdout.write(
          `Parity gate: ${red('FAIL')}  — κ delta ${parityResult.kappa_delta.toFixed(4)} (band ±0.05), F1 delta ${parityResult.f1_delta.toFixed(4)} (band ±0.03)\n`
        )
        process.stdout.write(
          `Provider "${providerName}" must ship behind beta: true in SD-032 options dropdown.\n`
        )
      }
    } else {
      process.stderr.write(
        'Warning: no baseline.json found. Run --provider anthropic first to establish baseline.\n'
      )
    }
  }

  // ── 6. Write provider report ──────────────────────────────────────────────
  const reportPath = writeProviderReport({
    providerName, model, rubricVersion: providerRubricVersion, nSentences: nEvaluated,
    classMetrics, spanMetrics, tokenTotals, safetySkipped: safety_skipped,
    baseline, parityResult, provider,
  })
  process.stdout.write(`\nReport written: ${reportPath}\n`)

  // ── 7. MBIB (informational, does not affect exit code) ────────────────────
  if (runMbib) await runMbibReport(provider, apiKey, model)

  // Exit 1 if non-Anthropic provider fails parity
  if (providerName !== 'anthropic' && parityResult && !parityResult.passed) {
    process.exit(1)
  }
}

main().catch((err) => {
  process.stderr.write(`Fatal error: ${err.message}\n`)
  if (process.env['DEBUG']) process.stderr.write(err.stack + '\n')
  process.exit(1)
})
