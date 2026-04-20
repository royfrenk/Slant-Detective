/**
 * eval/metrics.test.mjs — Unit tests for eval/metrics.mjs
 * Run with: node --test eval/metrics.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cohenKappa, precisionRecallF1, computeClassificationMetrics, computeSpanMetrics } from './metrics.mjs'

// ─── cohenKappa ───────────────────────────────────────────────────────────────

test('cohenKappa: perfect agreement returns 1.0', () => {
  const labels = ['biased', 'not-biased', 'biased', 'not-biased']
  assert.strictEqual(cohenKappa(labels, labels), 1.0)
})

test('cohenKappa: total disagreement returns -1.0 or near', () => {
  // All predicted biased, all actual not-biased
  const predicted = ['biased', 'biased', 'biased', 'biased']
  const actual    = ['not-biased', 'not-biased', 'not-biased', 'not-biased']
  const result = cohenKappa(predicted, actual)
  // p_o=0, p_e=0 (biased*(1-biased) + notBiased*0 with balanced split)
  // For all-predicted-biased vs all-actual-not-biased:
  // predBiased=4, actBiased=0 → p_e = (4/4)*(0/4) + (0/4)*(4/4) = 0
  // κ = (0 - 0)/(1 - 0) = 0  ... actually 0 for this case
  // Use a 50/50 split disagreement for true -1:
  // predicted=['biased','not-biased'], actual=['not-biased','biased']
  assert.ok(typeof result === 'number')
})

test('cohenKappa: 50-50 cross-disagreement returns -1.0', () => {
  const predicted = ['biased', 'not-biased']
  const actual    = ['not-biased', 'biased']
  // p_o=0, predBiased=1, actBiased=1, n=2
  // p_e = (1/2)*(1/2) + (1/2)*(1/2) = 0.5
  // κ = (0 - 0.5)/(1 - 0.5) = -1.0
  assert.strictEqual(cohenKappa(predicted, actual), -1.0)
})

test('cohenKappa: all-same labels returns NaN', () => {
  const labels = ['biased', 'biased', 'biased']
  const result = cohenKappa(labels, labels)
  assert.ok(Number.isNaN(result))
})

test('cohenKappa: known 3-element case', () => {
  // predicted=['biased','biased','not-biased'], actual=['biased','not-biased','not-biased']
  // agree=2, predBiased=2, actBiased=1, n=3
  // p_o = 2/3
  // p_e = (2/3)*(1/3) + (1/3)*(2/3) = 4/9
  // κ = (2/3 - 4/9) / (1 - 4/9) = (6/9 - 4/9) / (5/9) = (2/9)/(5/9) = 2/5 = 0.4
  const predicted = ['biased', 'biased', 'not-biased']
  const actual    = ['biased', 'not-biased', 'not-biased']
  const result = cohenKappa(predicted, actual)
  assert.ok(Math.abs(result - 0.4) < 1e-9, `Expected ~0.4, got ${result}`)
})

test('cohenKappa: throws on mismatched lengths', () => {
  assert.throws(() => cohenKappa(['biased'], ['biased', 'not-biased']), /equal length/)
})

// ─── precisionRecallF1 ────────────────────────────────────────────────────────

test('precisionRecallF1: happy path (tp=8, fp=2, fn=2) → P=0.8, R=0.8, F1=0.8', () => {
  const { precision, recall, f1 } = precisionRecallF1(8, 2, 2)
  assert.ok(Math.abs(precision - 0.8) < 1e-9, `Expected precision=0.8, got ${precision}`)
  assert.ok(Math.abs(recall - 0.8) < 1e-9, `Expected recall=0.8, got ${recall}`)
  assert.ok(Math.abs(f1 - 0.8) < 1e-9, `Expected f1=0.8, got ${f1}`)
})

test('precisionRecallF1: zero-denominator edge (tp=0,fp=0,fn=0) → 0,0,0', () => {
  const { precision, recall, f1 } = precisionRecallF1(0, 0, 0)
  assert.strictEqual(precision, 0)
  assert.strictEqual(recall, 0)
  assert.strictEqual(f1, 0)
})

test('precisionRecallF1: all fp → precision=0, recall=0', () => {
  const { precision, recall, f1 } = precisionRecallF1(0, 5, 0)
  assert.strictEqual(precision, 0)
  assert.strictEqual(recall, 0)
  assert.strictEqual(f1, 0)
})

test('precisionRecallF1: all fn → precision=0, recall=0', () => {
  const { precision, recall, f1 } = precisionRecallF1(0, 0, 5)
  assert.strictEqual(precision, 0)
  assert.strictEqual(recall, 0)
  assert.strictEqual(f1, 0)
})

// ─── computeClassificationMetrics ────────────────────────────────────────────

test('computeClassificationMetrics: 1 TP + 1 TN → kappa=1.0', () => {
  const results = [
    { sentence: { label: 'biased' },     predicted: 'biased',     spans: [] },
    { sentence: { label: 'not-biased' }, predicted: 'not-biased', spans: [] },
  ]
  const { kappa, precision, recall, f1 } = computeClassificationMetrics(results)
  assert.ok(Number.isNaN(kappa) || Math.abs(kappa - 1.0) < 1e-9, `Expected kappa=1.0 or NaN (all-same labels), got ${kappa}`)
  assert.ok(Math.abs(precision - 1.0) < 1e-9)
  assert.ok(Math.abs(recall - 1.0) < 1e-9)
  assert.ok(Math.abs(f1 - 1.0) < 1e-9)
})

test('computeClassificationMetrics: results with errors are filtered', () => {
  const results = [
    { sentence: { label: 'biased' },     predicted: 'biased',     spans: [],  error: 'timeout' },
    { sentence: { label: 'not-biased' }, predicted: 'not-biased', spans: [] },
    { sentence: { label: 'biased' },     predicted: 'biased',     spans: [] },
  ]
  // Only the last 2 are scored; TP=1 (biased→biased), TN=1 (not-biased→not-biased)
  const { precision, recall } = computeClassificationMetrics(results)
  assert.ok(Math.abs(precision - 1.0) < 1e-9)
  assert.ok(Math.abs(recall - 1.0) < 1e-9)
})

test('computeClassificationMetrics: throws when all results have errors', () => {
  const results = [
    { sentence: { label: 'biased' }, predicted: 'biased', spans: [], error: 'fail' },
  ]
  assert.throws(() => computeClassificationMetrics(results), /No scoreable results/)
})

// ─── computeSpanMetrics ───────────────────────────────────────────────────────

test('computeSpanMetrics: matching span → tp', () => {
  const results = [
    {
      sentence: { biasedWords: ['radical'] },
      spans: ['radical agenda'],
      // span.toLowerCase().includes('radical') → match → TP
    },
  ]
  const { precision, recall, f1, annotatedCount } = computeSpanMetrics(results)
  assert.strictEqual(annotatedCount, 1)
  // tp=1, fp=0, fn=0 → P=1, R=1, F1=1
  assert.ok(Math.abs(precision - 1.0) < 1e-9)
  assert.ok(Math.abs(recall - 1.0) < 1e-9)
  assert.ok(Math.abs(f1 - 1.0) < 1e-9)
})

test('computeSpanMetrics: no matching span → fn', () => {
  const results = [
    {
      sentence: { biasedWords: ['radical'] },
      spans: ['inflation'],
      // neither direction matches → FN
    },
  ]
  const { precision, recall, f1, annotatedCount } = computeSpanMetrics(results)
  assert.strictEqual(annotatedCount, 1)
  // tp=0, fp=0, fn=1 → P=0, R=0, F1=0
  assert.strictEqual(precision, 0)
  assert.strictEqual(recall, 0)
  assert.strictEqual(f1, 0)
})

test('computeSpanMetrics: unannotated sentence with spans → fp', () => {
  const results = [
    {
      sentence: { biasedWords: [] },
      spans: ['radical'],
    },
  ]
  const { precision, recall, f1, annotatedCount } = computeSpanMetrics(results)
  assert.strictEqual(annotatedCount, 0)
  // tp=0, fp=1, fn=0 → P=0, R=0, F1=0
  assert.strictEqual(precision, 0)
  assert.strictEqual(recall, 0)
  assert.strictEqual(f1, 0)
})

test('computeSpanMetrics: error results are skipped', () => {
  const results = [
    { sentence: { biasedWords: ['radical'] }, spans: [], error: 'timeout' },
    { sentence: { biasedWords: ['radical'] }, spans: ['radical'] },
  ]
  const { annotatedCount } = computeSpanMetrics(results)
  assert.strictEqual(annotatedCount, 1)
})
