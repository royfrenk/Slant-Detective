# Slant Detective — BABE Eval Harness

Scores the Layer 2 rubric prompt against the BABE 3,700-sentence expert-annotated corpus.
Establishes a regression gate: every future `rubric_version` bump must clear `eval/run.mjs` before shipping.

---

## Prerequisites

- Node.js >= 18 (native `fetch` required)
- An Anthropic API key with Claude Haiku access
- Internet access (corpus files are downloaded on first run and cached in `eval/data/`)

---

## Running

### Full run (3,700 sentences, ~30 min, ~$22)

```bash
ANTHROPIC_API_KEY=sk-ant-... node eval/run.mjs
```

Or via npm:

```bash
ANTHROPIC_API_KEY=sk-ant-... npm run eval
```

### Smoke test — stratified 500-sentence sample (~5 min, ~$3)

```bash
ANTHROPIC_API_KEY=sk-ant-... node eval/run.mjs --sample 500
```

### With MBIB secondary benchmark

```bash
ANTHROPIC_API_KEY=sk-ant-... node eval/run.mjs --mbib
```

MBIB is informational only — it does not affect the exit code or the gate.

---

## Output

```
Slant Detective Rubric Eval — rubric_v1.0

Sentences evaluated: 3700
─────────────────────────────────────────────
Binary classification
  κ:          0.42
  Precision:  0.74
  Recall:     0.71
  F1:         0.72

Biased-word detection (1240 annotated sentences)
  Precision:  0.63
  Recall:     0.58
  F1:         0.60
─────────────────────────────────────────────
Gate: PASS  (baseline κ = 0.40, current κ = 0.42)
```

---

## Gate rule

`eval/baseline.json` is committed to the repo. Every run compares current metrics against it:

| Condition | Result |
|-----------|--------|
| First run (no baseline) | Saves baseline, exits 0 |
| All metrics within 0.03 of baseline | Saves updated baseline, exits 0 |
| Any metric regresses > 0.03 | Prints diff table, exits 1 |

**No future `rubric_version` bump ships until `node eval/run.mjs` exits 0.**

---

## Updating the baseline after a deliberate prompt improvement

After an intentional rubric upgrade that raises scores, force-accept the new metrics as the baseline:

```bash
ANTHROPIC_API_KEY=sk-ant-... node eval/run.mjs --update-baseline
```

This saves the new metrics as the gate floor regardless of the current baseline. Commit `eval/baseline.json` immediately after.

---

## Cost estimates

| Run | Approx. cost |
|-----|-------------|
| Full 3,700-sentence eval | ~$22 |
| `--sample 500` smoke test | ~$3 |
| `--sample 100` quick check | ~$0.60 |

Costs assume Claude Haiku pricing (~$0.006 per sentence at ~3k input + ~500 output tokens).

---

## MBIB data

MBIB (Media Bias Identification Benchmark) is downloaded at eval-time from:
`https://github.com/Media-Bias-Group/MBIB`

It is **gitignored** (`eval/data/mbib-*.csv`) because it is a GPL-3.0 aggregate dataset with mixed
sub-licenses. Never bundle MBIB data in the extension.

`--mbib` runs only the `linguistic-bias` and `political-bias` splits for generalization sanity.
Results are printed after the BABE gate report and do not affect the exit code.

---

## Architecture

```
eval/
├── run.mjs           Entry point — CLI flags, orchestration, progress logging
├── rubric-driver.mjs Node.js Anthropic caller + inline validator (no browser deps)
├── babe-corpus.mjs   Download + parse SGB_combined.csv
├── mbib.mjs          Download + parse MBIB linguistic/political splits
├── metrics.mjs       Cohen's κ, precision/recall/F1 (pure functions)
├── gate.mjs          baseline.json load/save/compare
├── baseline.json     Committed gate floor (updated by passing runs)
└── data/             Gitignored — downloaded corpus files cached here
```

### Inline duplicates

`rubric-driver.mjs` contains inline copies of:

- `validateRubricResponse()` from `extension/src/service-worker/response-validator.ts`
- `buildPrompt()` + prompt template from `extension/src/service-worker/rubric-prompt.ts`

These are duplicated (not imported) to avoid a TypeScript build step in the eval harness.
Keep them in sync when the canonical sources change.

---

## Progress logging

During a long run, scored-sentence counts are printed to stderr every 100 sentences:

```
[100/3700] scored
[200/3700] scored
...
```

Errors per sentence are also logged to stderr. The final report shows `N skipped` if any sentences
failed validation.
