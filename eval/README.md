# Slant Detective — BABE Eval Harness

Scores the Layer 2 rubric prompt against the BABE 3,700-sentence expert-annotated corpus.
Establishes a regression gate: every future `rubric_version` bump must clear `eval/run.mjs` before shipping.

Multi-provider support (SD-035): Anthropic Haiku, OpenAI gpt-4o-mini, and Gemini 2.5 Flash can all
be run against the same corpus. OpenAI and Gemini must pass a parity gate (±0.05 κ, ±0.03 F1 vs.
Anthropic Haiku baseline) before their provider ships as enabled in the options dropdown.

---

## Prerequisites

- Node.js >= 18 (native `fetch` required)
- The API key for the provider you want to run (see table below)
- Internet access (corpus files are downloaded on first run and cached in `eval/data/`)

### API key environment variables

| Provider | Env var |
|----------|---------|
| Anthropic | `ANTHROPIC_API_KEY` |
| OpenAI | `OPENAI_API_KEY` |
| Gemini | `GEMINI_API_KEY` |

---

## Running

### Provider selection

Use `--provider` to select which LLM to score with. Defaults to `anthropic`.

```bash
# Anthropic (default)
ANTHROPIC_API_KEY=sk-ant-... node eval/run.mjs --provider anthropic

# OpenAI
OPENAI_API_KEY=sk-...       node eval/run.mjs --provider openai

# Gemini
GEMINI_API_KEY=AIza...      node eval/run.mjs --provider gemini
```

Or via npm scripts:

```bash
ANTHROPIC_API_KEY=sk-ant-... npm run eval
OPENAI_API_KEY=sk-...        npm run eval:openai
GEMINI_API_KEY=AIza...       npm run eval:gemini
```

### Model override

Each provider has a default model. Override with `--model`:

```bash
OPENAI_API_KEY=sk-... node eval/run.mjs --provider openai --model gpt-4o
```

| Provider | Default model |
|----------|---------------|
| Anthropic | claude-haiku-4-5-20251001 |
| OpenAI | gpt-4o-mini |
| Gemini | gemini-2.5-flash |

### Smoke test — stratified 500-sentence sample (~5 min, ~$3 Anthropic)

```bash
# Shorthand alias for --sample 500 --seed 42
ANTHROPIC_API_KEY=sk-ant-... node eval/run.mjs --smoke

# Or explicit flags
ANTHROPIC_API_KEY=sk-ant-... node eval/run.mjs --sample 500 --seed 42
```

### Full run (3,700 sentences, ~30 min, ~$22 Anthropic)

```bash
ANTHROPIC_API_KEY=sk-ant-... node eval/run.mjs
```

### With custom seed (for variance testing)

```bash
ANTHROPIC_API_KEY=sk-ant-... node eval/run.mjs --sample 500 --seed 123
```

Seed defaults to 42. Override with `--seed N` to draw a different stratified sample
and confirm score stability across shuffles.

### With MBIB secondary benchmark

```bash
ANTHROPIC_API_KEY=sk-ant-... node eval/run.mjs --mbib
```

MBIB is informational only — it does not affect the exit code or the gate.

### Force-update baseline after a deliberate prompt improvement (Anthropic only)

```bash
ANTHROPIC_API_KEY=sk-ant-... node eval/run.mjs --update-baseline
```

This saves the new metrics as the gate floor regardless of the current baseline.
Commit `eval/baseline.json` immediately after.

---

## Output

### Console

```
Provider: anthropic / Model: claude-haiku-4-5-20251001 / rubric: v1.0

Slant Detective Rubric Eval — rubric_v1.0

Sentences evaluated: 3663
─────────────────────────────────────────────
Binary classification
  κ:          0.5758
  Precision:  0.7566
  Recall:     0.8380
  F1:         0.7953

Biased-word detection (1240 annotated sentences)
  Precision:  0.5207
  Recall:     0.8670
  F1:         0.6506
─────────────────────────────────────────────
Gate: PASS  (baseline κ = 0.58, current κ = 0.58)

Report written: eval/reports/SD-035-anthropic.json
```

### Report file

Each run writes a JSON report to `eval/reports/SD-035-{provider}.json`.

These files are **gitignored** — they are large machine-generated artifacts. Share them
out-of-band with the team (Slack, file share) or summarise key numbers in the spec.
SD-036 reads these files for the cost-per-100-articles table.

**Report schema fields:**
- `schema_version` — bump if shape changes (SD-036 uses this to detect stale files)
- `provider`, `model`, `rubric_version`, `run_at`, `corpus`, `n_sentences`
- `safety_skipped` — sentences blocked by Gemini safety filter (counted separately, excluded from κ/F1)
- `gate` — parity result (for OpenAI/Gemini) or null if no baseline
- `classification` — κ, precision, recall, F1
- `span_detection` — precision, recall, F1 for biased-word spans
- `token_usage` — totals + per-sentence means (populated from API response)
- `cost_model` — pricing constants at time of run (not live)
- `cost_per_sentence_usd`, `cost_per_100_articles_usd` — computed from token means × pricing

---

## Parity gate (OpenAI / Gemini)

OpenAI and Gemini are compared against `eval/baseline.json` (Anthropic Haiku).

| Metric | Band |
|--------|------|
| κ (Cohen's kappa) | ±0.05 |
| F1 | ±0.03 |

- **Pass** → provider ships enabled in the SD-032 options dropdown.
- **Fail** → provider ships behind `beta: true` with a one-line disclaimer.

The parity gate does **not** modify `baseline.json`. Only Anthropic runs update the baseline.

---

## How the Anthropic regression gate works

The baseline is a floor, not a historical record. Every passing Anthropic run (even a small
regression within the 0.03 tolerance) overwrites `baseline.json` with the current metrics.
This is intentional — it lets incremental changes ratchet the floor down gently.
To hold a hard floor, commit a frozen `baseline.pinned.json` alongside `baseline.json`.

| Condition | Result |
|-----------|--------|
| First run (no baseline) | Saves baseline, exits 0 |
| All metrics within 0.03 of baseline | Saves updated baseline, exits 0 |
| Any metric regresses > 0.03 | Prints diff table, exits 1 |

**No future `rubric_version` bump ships until `node eval/run.mjs --provider anthropic` exits 0.**

---

## Cost estimates

Pricing as of 2026-04-20:

| Provider | Model | Input ($/M) | Output ($/M) | 500-sentence smoke | Full 3,663 run |
|----------|-------|-------------|--------------|---------------------|----------------|
| Anthropic | claude-haiku-4-5-20251001 | $0.80 | $4.00 | ~$3 | ~$22 |
| OpenAI | gpt-4o-mini | $0.15 | $0.60 | ~$0.30 | ~$1.10 |
| Gemini | gemini-2.5-flash | $0.15 | $0.60 | free tier* | ~$1.10 |

*Gemini free tier: 60 req/min, 1,500 req/day. A 500-sentence smoke test fits within the free tier.
The report `notes` field flags this. `cost_per_100_articles_usd` is a theoretical non-free-tier estimate.

All three providers at 500 sentences: ~$5 + ~15 min.
All three providers at 3,663 sentences: ~$38 + ~90 min.

These are per-sentence costs. Real article analysis involves more text — multiply by your mean
sentence count per article for a full-article cost estimate. SD-036 documents this.

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
├── run.mjs              Entry point — CLI flags, orchestration, progress logging, report writer
├── rubric-driver.mjs    Concurrency-limited batch scorer; delegates HTTP to providers/
├── providers/
│   ├── index.mjs        Factory: getProvider(name), getApiKey(name), DEFAULT_MODELS
│   ├── anthropic.mjs    Anthropic Messages API driver (rubric_v1.0)
│   ├── openai.mjs       OpenAI Chat Completions driver (rubric_v1.0-openai)
│   ├── gemini.mjs       Gemini generateContent driver (rubric_v1.0-gemini)
│   └── providers.test.mjs  Unit tests (no live API calls)
├── babe-corpus.mjs      Download + parse SGB_SG2.csv (BABE sentence corpus)
├── mbib.mjs             Download + parse MBIB linguistic/political splits
├── metrics.mjs          Cohen's κ, precision/recall/F1 (pure functions)
├── gate.mjs             baseline.json load/save/compare + checkParity for multi-provider
├── gate.test.mjs        Unit tests for gate.mjs
├── metrics.test.mjs     Unit tests for metrics.mjs
├── baseline.json        Committed Anthropic Haiku gate floor (updated by passing Anthropic runs)
├── reports/             Gitignored — per-run JSON artifacts (consumed by SD-036)
│   ├── SD-035-anthropic.json
│   ├── SD-035-openai.json
│   └── SD-035-gemini.json
└── data/                Gitignored — downloaded corpus files cached here
    ├── SGB_SG2.csv
    ├── mbib-linguistic.csv
    └── mbib-political.csv
```

### Inline duplicates

Each provider driver contains inline copies of:

- `validateRubricResponse()` from `extension/src/service-worker/response-validator.ts`
- `buildPrompt()` / prompt template from `extension/src/service-worker/rubric-prompt.ts`

These are duplicated (not imported) to avoid a TypeScript build step in the eval harness.
Keep them in sync when the canonical sources change. Each file contains a `SYNC REQUIRED` comment.

---

## Progress logging

During a long run, scored-sentence counts are printed to stderr every 100 sentences:

```
[100/3663] scored
[200/3663] scored
...
```

Errors per sentence are also logged to stderr. The final report shows `N skipped` if any sentences
failed validation or were blocked by Gemini's safety filter.

---

## Rubric version strings

| Provider | RUBRIC_VERSION |
|----------|---------------|
| Anthropic | `v1.0` (reported as `rubric_v1.0` in eval output) |
| OpenAI | `rubric_v1.0-openai` |
| Gemini | `rubric_v1.0-gemini` |

These match the `rubric_version` field in the JSON response from each provider.
SD-032 uses these strings to identify which prompt variant was used.
