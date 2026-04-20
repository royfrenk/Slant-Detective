/**
 * eval/run.mjs — BABE eval harness entry point
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... node eval/run.mjs
 *   ANTHROPIC_API_KEY=sk-... node eval/run.mjs --sample 500
 *   ANTHROPIC_API_KEY=sk-... node eval/run.mjs --mbib
 *   ANTHROPIC_API_KEY=sk-... node eval/run.mjs --update-baseline
 *
 * Exit codes:
 *   0 — gate passed (or first run)
 *   1 — gate failed (metric regression) or fatal error
 */

import { loadBabeCorpus, sampleCorpus } from './babe-corpus.mjs'
import { scoreBatch, RUBRIC_VERSION } from './rubric-driver.mjs'
import { computeClassificationMetrics, computeSpanMetrics } from './metrics.mjs'
import { loadBaseline, saveBaseline, checkGate, printGateReport } from './gate.mjs'
import { loadMbibSplits } from './mbib.mjs'

const CONCURRENCY = 5
const PROGRESS_EVERY = 100

// ─── CLI args ─────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  let sampleN = null
  let seed = 42
  let runMbib = false
  let updateBaseline = false

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
    }
  }

  return { sampleN, seed, runMbib, updateBaseline }
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

function printReport(label, classMetrics, spanMetrics, nTotal, nSkipped) {
  const sep = '─'.repeat(45)
  process.stdout.write(`\nSlant Detective Rubric Eval — rubric_${RUBRIC_VERSION}\n`)
  if (label) process.stdout.write(`Dataset: ${label}\n`)
  process.stdout.write(`\n`)
  process.stdout.write(`Sentences evaluated: ${nTotal - nSkipped}`)
  if (nSkipped > 0) process.stdout.write(` (${nSkipped} skipped due to errors)`)
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
  return n.toFixed(2)
}

// ─── Score a corpus and collect EvalResults ───────────────────────────────────

/**
 * @param {Array<{ text: string, label: string, biasedWords: string[] }>} sentences
 * @param {string} apiKey
 * @returns {Promise<Array<{ sentence: object, predicted: string, spans: string[], error?: string }>>}
 */
async function scoreSentences(sentences, apiKey) {
  const texts = sentences.map((s) => s.text)
  const total = texts.length
  const onProgress = makeProgressReporter(total)

  const raw = await scoreBatch(texts, apiKey, CONCURRENCY, onProgress)

  return sentences.map((sentence, i) => {
    const result = raw[i]
    if (result instanceof Error) {
      process.stderr.write(`[sentence ${i}] error: ${result.message}\n`)
      return { sentence, predicted: 'not-biased', spans: [], error: result.message }
    }
    const predicted = result.overall.intensity > 4 ? 'biased' : 'not-biased'
    const spans = result.spans.map((s) => s.text)
    return { sentence, predicted, spans }
  })
}

// ─── MBIB report ─────────────────────────────────────────────────────────────

async function runMbibReport(apiKey) {
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
    const results = await scoreSentences(corpus, apiKey)
    const nSkipped = results.filter((r) => r.error).length
    const classMetrics = computeClassificationMetrics(results)
    const spanMetrics = computeSpanMetrics(results)
    printReport(`MBIB ${name}`, classMetrics, spanMetrics, corpus.length, nSkipped)
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { sampleN, seed, runMbib, updateBaseline } = parseArgs()

  const apiKey = process.env['ANTHROPIC_API_KEY']?.trim()
  if (!apiKey) {
    process.stderr.write(
      'Error: ANTHROPIC_API_KEY environment variable is required.\n' +
      'Usage: ANTHROPIC_API_KEY=sk-... node eval/run.mjs\n'
    )
    process.exit(1)
  }

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
  const results = await scoreSentences(corpus, apiKey)

  const nSkipped = results.filter((r) => r.error).length

  // ── 3. Compute metrics ────────────────────────────────────────────────────
  const classMetrics = computeClassificationMetrics(results)
  const spanMetrics = computeSpanMetrics(results)

  /** @type {import('./gate.mjs').AllMetrics} */
  const allMetrics = {
    classification: classMetrics,
    span_detection: spanMetrics,
    n_sentences: corpus.length - nSkipped,
  }

  // ── 4. Print report ───────────────────────────────────────────────────────
  printReport(null, classMetrics, spanMetrics, corpus.length, nSkipped)

  // ── 5. Gate ───────────────────────────────────────────────────────────────
  const baseline = loadBaseline()

  if (!baseline || updateBaseline) {
    saveBaseline(allMetrics, RUBRIC_VERSION)
    printGateReport({ passed: true, regressions: [] }, allMetrics, null)
  } else {
    const gateResult = checkGate(allMetrics, baseline)
    printGateReport(gateResult, allMetrics, baseline)

    if (gateResult.passed) {
      saveBaseline(allMetrics, RUBRIC_VERSION)
    } else {
      // Print MBIB if requested before exiting with error
      if (runMbib) await runMbibReport(apiKey)
      process.exit(1)
    }
  }

  // ── 6. MBIB (informational, does not affect exit code) ────────────────────
  if (runMbib) await runMbibReport(apiKey)
}

main().catch((err) => {
  process.stderr.write(`Fatal error: ${err.message}\n`)
  if (process.env['DEBUG']) process.stderr.write(err.stack + '\n')
  process.exit(1)
})
