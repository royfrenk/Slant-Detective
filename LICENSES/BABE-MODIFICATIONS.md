# BABE — Modifications from Upstream

Slant Detective bundles a cleaned version of the BABE bias-word lexicon.
This document describes every change we apply to upstream and explains how
to reproduce our bundled `babe-lexicon.json` byte-for-byte from scratch.

Both the upstream lexicon and this modified version are AGPL-3.0. No license
change has occurred. The original attribution notice is preserved in
[`LICENSES/BABE.txt`](./BABE.txt).

---

## Upstream source

| Field | Value |
|-------|-------|
| Project | Media-Bias-Group / Neural-Media-Bias-Detection |
| Repository | https://github.com/Media-Bias-Group/Neural-Media-Bias-Detection-Using-Distant-Supervision-With-BABE |
| Upstream file | `data/bias_word_lexicon.xlsx` |
| License | AGPL-3.0 |
| Paper | Spinde et al. (2021), *Neural Media Bias Detection Using Distant Supervision With BABE — Bias Annotations By Experts*, Findings of EMNLP 2021 |
| DOI | https://doi.org/10.18653/v1/2021.findings-emnlp.101 |

---

## What we ship

| Field | Value |
|-------|-------|
| Bundled file | `extension/public/assets/babe-lexicon.json` |
| Bundled entries | 2,119 (lowercased, deduped, sorted) |
| Lexicon schema version | `1.0.0` |
| Build script | `scripts/convert-babe.mjs` |

The script is deterministic: given the same input xlsx, it produces the same
`entries` array (generated_at timestamp is the only run-to-run difference).

---

## Every modification we apply

Applied by `scripts/convert-babe.mjs` against upstream `bias_word_lexicon.xlsx`,
in the order listed:

### 1. Strip entries that begin with an uppercase letter

Regex: `/^[A-Z]/` against the *original* (pre-lowercase) token.

Rationale: BABE's raw lexicon mixes domain-general bias words (e.g. *slammed*,
*radical*, *hypocrisy*) with proper nouns that appeared in biased training
sentences (e.g. specific politician names, publisher names, country-specific
terms). Proper nouns don't generalize as bias signals across articles and
would create false positives on any article mentioning the named entity.

### 2. Drop tokens shorter than 3 characters

Rationale: 1–2 character tokens in the lexicon are almost exclusively OCR
artifacts, single-letter abbreviations, or over-aggressive tokenization
residue. Removing them prevents highlight noise.

### 3. Drop tokens that start with a digit

Rationale: numeric tokens (years, counts, ordinals) are not bias words.
Upstream includes a handful as a side effect of sentence-level extraction.

### 4. Drop URL fragments

Removes any token containing `://`. Upstream ships a few residual URL-like
strings from the annotation pipeline; they are not lexicon entries.

### 5. Explicit blocklist

Three manually-identified entries with no bias signal (proper-noun residue +
a misspelling):

- `mmfa` — abbreviation of Media Matters for America (proper noun)
- `marshbaum` — surname (proper noun)
- `hypocricy` — misspelling of *hypocrisy* (the correct spelling is retained)

The blocklist lives at `scripts/convert-babe.mjs` line ~46. To extend it,
add the lowercase token and rebuild.

### 6. Normalize + deduplicate

Remaining entries are `trim()`-ed, lowercased, deduplicated, and sorted with
English locale collation (`localeCompare(a, b, 'en')`).

---

## What we do NOT change

- **No relabeling.** BABE's sentence-level annotations used in our eval
  harness (`eval/babe-corpus.mjs`) are consumed as-is.
- **No re-weighting.** We do not add scores, intensities, or tier labels to
  lexicon entries beyond what upstream provides (upstream is an unweighted
  word list; we keep it that way).
- **No additions.** Every entry in our bundled lexicon originates in upstream.
  Bias *phrases* (multi-word n-grams) are a separately-derived dataset under
  `extension/public/assets/phrase-lexicon.json` and are **not** attributed to
  BABE — see `scripts/build-phrase-lexicon.mjs`.
- **No change to the license.** Modifications ship under AGPL-3.0, identical
  to upstream.

---

## Impact on our published accuracy numbers

The **How We Measure** page (and our CWS listing copy) reports κ 0.58 /
F1 0.80 against BABE. Those numbers are computed on the cleaned corpus
described here, not on raw upstream.

- The cleaning removes ~5% of entries, all from categories that would
  primarily *add* false positives (proper nouns, typos, digits). Scoring on
  the cleaned lexicon yields **conservative** numbers — if anything, a raw
  upstream run would inflate precision by including easy-to-match proper-noun
  patterns.
- Baseline eval run is pinned at `eval/baseline.json` (2026-04-20). Every
  future `rubric_version` bump must match or beat this baseline via
  `eval/gate.mjs` or the build fails.
- `eval/babe-corpus.mjs` documents the exact corpus split used. The eval
  harness is bundled in the public repo under AGPL-3.0 and is reproducible
  end-to-end with a single `node eval/run.mjs`.

---

## Reproducing the bundled lexicon

From repo root:

```bash
# Fetch upstream xlsx and regenerate lexicon from scratch
node scripts/convert-babe.mjs

# Or, with a local xlsx/json copy
node scripts/convert-babe.mjs --input path/to/bias_word_lexicon.xlsx
```

Output is written to `extension/public/assets/babe-lexicon.json`. Diff the
result against the bundled file to confirm determinism:

```bash
git diff extension/public/assets/babe-lexicon.json
```

The only expected delta is the `generated_at` ISO timestamp.

---

## Contact

Questions about the modifications, or suggestions to extend the blocklist,
belong in a GitHub issue on the Slant Detective repo:
https://github.com/royfrenk/Slant-Detective/issues

Research questions about the underlying BABE dataset should go to the
original authors via the upstream repository linked above.
