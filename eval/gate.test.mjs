/**
 * eval/gate.test.mjs — Unit tests for eval/gate.mjs
 * Run with: node --test eval/gate.test.mjs
 *
 * saveBaseline/loadBaseline tests write to eval/baseline.json and
 * restore it after each test case.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkGate, saveBaseline, loadBaseline } from './gate.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const BASELINE_PATH = resolve(SCRIPT_DIR, 'baseline.json')

// ─── Helpers ──────────────────────────────────────────────────────────────────

function backupBaseline() {
  if (existsSync(BASELINE_PATH)) {
    return readFileSync(BASELINE_PATH, 'utf8')
  }
  return null
}

function restoreBaseline(backup) {
  if (backup === null) {
    if (existsSync(BASELINE_PATH)) unlinkSync(BASELINE_PATH)
  } else {
    writeFileSync(BASELINE_PATH, backup, 'utf8')
  }
}

/** @returns {import('./gate.mjs').AllMetrics} */
function makeMetrics(kappa = 0.6, precision = 0.8, recall = 0.75, f1 = 0.77) {
  return {
    n_sentences: 500,
    classification: { kappa, precision, recall, f1 },
    span_detection: { precision: 0.65, recall: 0.60, f1: 0.62 },
  }
}

/** @returns {import('./gate.mjs').Baseline} */
function makeBaseline(kappa = 0.6, precision = 0.8, recall = 0.75, f1 = 0.77) {
  return {
    rubric_version: 'v1.0',
    run_at: new Date().toISOString(),
    n_sentences: 500,
    classification: { kappa, precision, recall, f1 },
    span_detection: { precision: 0.65, recall: 0.60, f1: 0.62 },
  }
}

// ─── checkGate ────────────────────────────────────────────────────────────────

test('checkGate: metrics exactly at threshold → pass', () => {
  // tolerance is 0.03 — a metric exactly at baseline passes (delta = 0)
  const baseline = makeBaseline(0.6, 0.8, 0.75, 0.77)
  const current = makeMetrics(0.6, 0.8, 0.75, 0.77)
  const result = checkGate(current, baseline)
  assert.strictEqual(result.passed, true)
  assert.strictEqual(result.regressions.length, 0)
})

test('checkGate: metric within tolerance (-0.02) → pass', () => {
  // Regression filter is delta < -0.03. A delta of -0.02 should pass.
  const manualBaseline = {
    rubric_version: 'v1.0',
    run_at: new Date().toISOString(),
    n_sentences: 500,
    classification: { kappa: 0.60, precision: 0.8, recall: 0.75, f1: 0.77 },
    span_detection: { precision: 0.65, recall: 0.60, f1: 0.62 },
  }
  const current = makeMetrics(0.58) // delta = 0.58 - 0.60 = -0.02, within tolerance
  const result = checkGate(current, manualBaseline)
  assert.strictEqual(result.passed, true)
  assert.strictEqual(result.regressions.length, 0)
})

test('checkGate: metric 0.01 below threshold → fail (regression)', () => {
  // delta = -0.031 is below -0.03 → regression
  const baseline = makeBaseline(0.6)
  const current = makeMetrics(0.569) // delta ≈ -0.031
  const result = checkGate(current, baseline)
  assert.strictEqual(result.passed, false)
  assert.strictEqual(result.regressions.length, 1)
  assert.strictEqual(result.regressions[0].metric, 'classification.kappa')
  assert.ok(result.regressions[0].delta < -0.03)
})

test('checkGate: metric above baseline → pass', () => {
  const baseline = makeBaseline(0.6)
  const current = makeMetrics(0.72)
  const result = checkGate(current, baseline)
  assert.strictEqual(result.passed, true)
  assert.strictEqual(result.regressions.length, 0)
})

test('checkGate: multiple regressions are all reported', () => {
  const baseline = makeBaseline(0.6, 0.8, 0.75, 0.77)
  const current = makeMetrics(0.50, 0.70, 0.65, 0.67) // all drop by 0.10
  const result = checkGate(current, baseline)
  assert.strictEqual(result.passed, false)
  assert.strictEqual(result.regressions.length, 4)
})

// ─── saveBaseline / loadBaseline round-trip ───────────────────────────────────

test('saveBaseline / loadBaseline: round-trip preserves values', () => {
  const backup = backupBaseline()
  try {
    const metrics = makeMetrics(0.55, 0.79, 0.72, 0.75)
    saveBaseline(metrics, 'v1.0')
    const loaded = loadBaseline()
    assert.ok(loaded !== null)
    assert.strictEqual(loaded.rubric_version, 'v1.0')
    assert.strictEqual(loaded.n_sentences, 500)
    // Values are round4()'d — check within tolerance
    assert.ok(Math.abs(loaded.classification.kappa - 0.55) < 0.0001)
    assert.ok(Math.abs(loaded.classification.precision - 0.79) < 0.0001)
    assert.ok(Math.abs(loaded.classification.recall - 0.72) < 0.0001)
    assert.ok(Math.abs(loaded.classification.f1 - 0.75) < 0.0001)
    assert.ok(Math.abs(loaded.span_detection.precision - 0.65) < 0.0001)
    assert.ok(Math.abs(loaded.span_detection.recall - 0.60) < 0.0001)
    assert.ok(Math.abs(loaded.span_detection.f1 - 0.62) < 0.0001)
    assert.ok(typeof loaded.run_at === 'string')
  } finally {
    restoreBaseline(backup)
  }
})

test('loadBaseline: returns null when file does not exist', () => {
  const backup = backupBaseline()
  try {
    if (existsSync(BASELINE_PATH)) unlinkSync(BASELINE_PATH)
    const result = loadBaseline()
    assert.strictEqual(result, null)
  } finally {
    restoreBaseline(backup)
  }
})

test('saveBaseline / loadBaseline: passing run with higher metric updates baseline', () => {
  const backup = backupBaseline()
  try {
    // Save a "current" baseline, then simulate a passing run with improved metrics
    saveBaseline(makeMetrics(0.60), 'v1.0')

    const improvedMetrics = makeMetrics(0.70)
    saveBaseline(improvedMetrics, 'v1.1')

    const loaded = loadBaseline()
    assert.ok(loaded !== null)
    assert.strictEqual(loaded.rubric_version, 'v1.1')
    assert.ok(Math.abs(loaded.classification.kappa - 0.70) < 0.0001)
  } finally {
    restoreBaseline(backup)
  }
})
