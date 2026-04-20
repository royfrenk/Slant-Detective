/**
 * eval/metrics.mjs — Cohen's κ, precision/recall/F1 for BABE eval harness
 *
 * All functions are pure (no I/O, no side effects).
 */

/**
 * Cohen's κ for two arrays of binary string labels.
 * Returns NaN if agreement is degenerate (all labels identical, p_e === 1).
 *
 * @param {string[]} predicted
 * @param {string[]} actual
 * @returns {number}
 */
export function cohenKappa(predicted, actual) {
  if (predicted.length !== actual.length || predicted.length === 0) {
    throw new Error('cohenKappa: arrays must be equal length and non-empty')
  }
  const n = predicted.length
  let agree = 0
  let predBiased = 0
  let actBiased = 0

  for (let i = 0; i < n; i++) {
    if (predicted[i] === actual[i]) agree++
    if (predicted[i] === 'biased') predBiased++
    if (actual[i] === 'biased') actBiased++
  }

  const p_o = agree / n
  const p_e =
    (predBiased / n) * (actBiased / n) +
    ((n - predBiased) / n) * ((n - actBiased) / n)

  if (1 - p_e < 1e-10) return Number.NaN
  return (p_o - p_e) / (1 - p_e)
}

/**
 * Precision, recall, F1 from counts of true positives, false positives,
 * and false negatives.
 *
 * @param {number} tp
 * @param {number} fp
 * @param {number} fn
 * @returns {{ precision: number, recall: number, f1: number }}
 */
export function precisionRecallF1(tp, fp, fn) {
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0
  return { precision, recall, f1 }
}

/**
 * Aggregate binary classification metrics over eval results.
 * Positive class = 'biased'.
 *
 * @param {Array<{ sentence: { label: string }, predicted: string, error?: string }>} results
 * @returns {{ kappa: number, precision: number, recall: number, f1: number }}
 */
export function computeClassificationMetrics(results) {
  const scored = results.filter((r) => !r.error)
  if (scored.length === 0) throw new Error('No scoreable results for classification metrics')

  const predicted = scored.map((r) => r.predicted)
  const actual = scored.map((r) => r.sentence.label)

  let tp = 0
  let fp = 0
  let fn = 0
  for (let i = 0; i < scored.length; i++) {
    const p = predicted[i]
    const a = actual[i]
    if (p === 'biased' && a === 'biased') tp++
    else if (p === 'biased' && a !== 'biased') fp++
    else if (p !== 'biased' && a === 'biased') fn++
  }

  const kappa = cohenKappa(predicted, actual)
  const { precision, recall, f1 } = precisionRecallF1(tp, fp, fn)
  return { kappa, precision, recall, f1 }
}

/**
 * Compute precision/recall/F1 for biased-word span detection.
 *
 * For each result whose sentence has biasedWords annotations:
 * - TP: rubric returned at least one span that case-insensitively matches an annotated word
 * - FN: rubric returned no matching spans for an annotated sentence
 * - FP: rubric returned spans but the sentence had NO annotated words
 *
 * @param {Array<{ sentence: { biasedWords: string[] }, spans: string[], error?: string }>} results
 * @returns {{ precision: number, recall: number, f1: number, annotatedCount: number }}
 */
export function computeSpanMetrics(results) {
  let tp = 0
  let fp = 0
  let fn = 0
  let annotatedCount = 0

  for (const r of results) {
    if (r.error) continue
    const words = r.sentence.biasedWords
    const spans = r.spans ?? []

    if (words.length === 0) {
      // Sentence has no annotations — FP if rubric produced spans
      if (spans.length > 0) fp++
      continue
    }

    annotatedCount++
    const lowerWords = words.map((w) => w.toLowerCase().trim())
    const matched = spans.some((span) => {
      const s = span.toLowerCase().trim()
      return lowerWords.some((w) => s.includes(w))
    })
    if (matched) tp++
    else fn++
  }

  const { precision, recall, f1 } = precisionRecallF1(tp, fp, fn)
  return { precision, recall, f1, annotatedCount }
}
