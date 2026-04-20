/**
 * eval/gate.mjs — Baseline load/save/compare for regression gating
 *
 * On first run (no baseline.json): saves metrics and exits 0.
 * On subsequent runs: compares against baseline. If any metric regresses
 * by more than REGRESSION_TOLERANCE, prints a diff table and signals failure.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const BASELINE_PATH = resolve(SCRIPT_DIR, 'baseline.json')

const REGRESSION_TOLERANCE = 0.03

// ─── Types (JSDoc) ────────────────────────────────────────────────────────────

/**
 * @typedef {{
 *   rubric_version: string,
 *   run_at: string,
 *   n_sentences: number,
 *   classification: { kappa: number, precision: number, recall: number, f1: number },
 *   span_detection: { precision: number, recall: number, f1: number }
 * }} Baseline
 */

/**
 * @typedef {{
 *   classification: { kappa: number, precision: number, recall: number, f1: number },
 *   span_detection: { precision: number, recall: number, f1: number },
 *   n_sentences: number
 * }} AllMetrics
 */

/**
 * @typedef {{
 *   passed: boolean,
 *   regressions: Array<{ metric: string, baseline: number, current: number, delta: number }>
 * }} GateResult
 */

// ─── I/O ──────────────────────────────────────────────────────────────────────

/**
 * Load baseline.json. Returns null if the file does not exist.
 *
 * @returns {Baseline | null}
 */
export function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return null
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  } catch (err) {
    throw new Error(`Failed to read baseline.json: ${String(err)}`)
  }
}

/**
 * Save AllMetrics to baseline.json with rubric_version and timestamp.
 *
 * @param {AllMetrics} metrics
 * @param {string} rubricVersion
 */
export function saveBaseline(metrics, rubricVersion) {
  const baseline = {
    rubric_version: rubricVersion,
    run_at: new Date().toISOString(),
    n_sentences: metrics.n_sentences,
    classification: {
      kappa: round4(metrics.classification.kappa),
      precision: round4(metrics.classification.precision),
      recall: round4(metrics.classification.recall),
      f1: round4(metrics.classification.f1),
    },
    span_detection: {
      precision: round4(metrics.span_detection.precision),
      recall: round4(metrics.span_detection.recall),
      f1: round4(metrics.span_detection.f1),
    },
  }
  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n', 'utf8')
}

// ─── Gate logic ───────────────────────────────────────────────────────────────

/**
 * Compare current metrics against baseline. Returns a GateResult.
 *
 * @param {AllMetrics} current
 * @param {Baseline} baseline
 * @returns {GateResult}
 */
export function checkGate(current, baseline) {
  const checks = [
    { metric: 'classification.kappa', baseline: baseline.classification.kappa, current: current.classification.kappa },
    { metric: 'classification.precision', baseline: baseline.classification.precision, current: current.classification.precision },
    { metric: 'classification.recall', baseline: baseline.classification.recall, current: current.classification.recall },
    { metric: 'classification.f1', baseline: baseline.classification.f1, current: current.classification.f1 },
    { metric: 'span_detection.precision', baseline: baseline.span_detection.precision, current: current.span_detection.precision },
    { metric: 'span_detection.recall', baseline: baseline.span_detection.recall, current: current.span_detection.recall },
    { metric: 'span_detection.f1', baseline: baseline.span_detection.f1, current: current.span_detection.f1 },
  ]

  const regressions = checks
    .map(({ metric, baseline: b, current: c }) => ({ metric, baseline: b, current: c, delta: c - b }))
    .filter(({ delta }) => delta < -REGRESSION_TOLERANCE)

  return { passed: regressions.length === 0, regressions }
}

/**
 * Print a gate report to stdout.
 *
 * @param {GateResult} result
 * @param {AllMetrics} current
 * @param {Baseline | null} baseline
 */
export function printGateReport(result, current, baseline) {
  const useColor = process.stdout.hasColors?.() ?? false
  const red = (s) => (useColor ? `\x1b[31m${s}\x1b[0m` : s)
  const green = (s) => (useColor ? `\x1b[32m${s}\x1b[0m` : s)

  if (!baseline) {
    process.stdout.write(`Gate: ${green('PASS')}  (first run — baseline saved)\n`)
    return
  }

  if (result.passed) {
    process.stdout.write(
      `Gate: ${green('PASS')}  (baseline κ = ${baseline.classification.kappa.toFixed(2)}, current κ = ${current.classification.kappa.toFixed(2)})\n`
    )
    return
  }

  process.stdout.write(`Gate: ${red('FAIL')}  — ${result.regressions.length} metric(s) regressed beyond tolerance (${REGRESSION_TOLERANCE})\n\n`)
  process.stdout.write(`${'Metric'.padEnd(30)} ${'Baseline'.padStart(10)} ${'Current'.padStart(10)} ${'Delta'.padStart(10)}\n`)
  process.stdout.write(`${'-'.repeat(62)}\n`)

  for (const { metric, baseline: b, current: c, delta } of result.regressions) {
    const row = `${metric.padEnd(30)} ${b.toFixed(4).padStart(10)} ${c.toFixed(4).padStart(10)} ${red(delta.toFixed(4).padStart(10))}\n`
    process.stdout.write(row)
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function round4(n) {
  return Math.round(n * 10000) / 10000
}
