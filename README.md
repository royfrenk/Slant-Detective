# Slant Detective

Read any news article and see the slant, the loaded words, and the evidence — in the page itself. No account. No server. Your article never leaves your browser.

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/Chrome-MV3-yellow.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)

> **Status:** Pre-launch. Currently shipping alpha builds; Chrome Web Store listing in preparation.

---

## What it does

You're reading a news article. You want to know: *is this slanted, and how?* Click the toolbar icon. The side panel opens and gives you an answer in two tiers.

| Tier | What you need | What you get |
|------|---------------|--------------|
| **Layer 1** — free, instant, offline | Nothing | A bias readout from in-browser signals: BABE bias-word lexicon (2,100+ terms), attribution-verb skew ("said" vs. "alleged" vs. "admitted"), headline ↔ body drift, hedge-word counter, and a source label (e.g., "Lean Left," "Center") from a bundled dataset. |
| **Layer 2** — bring your own key | An API key from one of: **Anthropic** (Claude), **OpenAI**, or **Google** (Gemini) | The full LLM rubric: overall intensity score, political-direction tilt, four-dimension breakdown (word choice, framing, headline slant, source mix), evidence phrases with one-sentence reasons, and dotted underlines on the actual biased phrases in the article. |

The extension picks the tier automatically based on whether you've pasted a key. There is no mode selector. If you save keys for more than one provider, you choose which is active from the options page.

> **Provider accuracy:** Anthropic Claude Haiku is the reference rubric (highest agreement with the BABE-derived eval set). OpenAI and Gemini ship as alternatives for users who already have those keys, but they score below the Anthropic baseline on the parity gate. The options page surfaces this trade-off when you pick a non-Anthropic provider.

---

## How it works

```
                    ┌──────────────────────────┐
                    │  You're on a news page   │
                    └────────────┬─────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │ Click Slant Detective    │
                    │ icon in the toolbar      │
                    └────────────┬─────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │ Side panel opens.        │
                    │ Readability.js extracts  │
                    │ the article text.        │
                    └────────────┬─────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │ LAYER 1 runs in-browser  │
                    │ (no network, ~instant)   │
                    │                          │
                    │ • BABE lexicon scan      │
                    │ • Attribution-verb skew  │
                    │ • Headline ↔ body drift  │
                    │ • Hedge-word counter     │
                    │ • Source label lookup    │
                    └────────────┬─────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │ Has the user pasted a    │
                    │ provider API key?        │
                    │ (Anthropic / OpenAI /    │
                    │  Google)                 │
                    └────┬───────────────┬─────┘
                         │               │
                       NO│               │YES
                         │               │
                         ▼               ▼
            ┌─────────────────┐  ┌──────────────────────────┐
            │ Show Layer 1    │  │ LAYER 2: Browser calls   │
            │ results only.   │  │ the active provider's    │
            │ Done.           │  │ API endpoint DIRECTLY    │
            └─────────────────┘  │ with the user's key      │
                                 │ (we never see it)        │
                                 └────────────┬─────────────┘
                                              │
                                              ▼
                                 ┌──────────────────────────┐
                                 │ The model returns the    │
                                 │ rubric. Side panel       │
                                 │ renders it. Content      │
                                 │ script underlines        │
                                 │ evidence phrases in the  │
                                 │ article. Hover = reason. │
                                 │ Click row = scroll to    │
                                 │ phrase.                  │
                                 └──────────────────────────┘
```

**The two things to remember:** (1) no backend — your article never touches our servers; (2) Layer 1 is free forever, Layer 2 cost depends on the provider — roughly $0.006/article on Anthropic Claude Haiku and ~$0.001/article on OpenAI gpt-5-mini or Gemini 2.5 Flash, paid directly to the provider you chose.

---

## Install

### From the Chrome Web Store
*Listing in preparation — link will appear here once published.*

### From source (developer mode)
```bash
git clone https://github.com/royfrenk/Slant-Detective.git
cd Slant-Detective/extension
npm install
npm run build
```

Then in Chrome:
1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `extension/dist` folder

Pin the icon to your toolbar. You're done.

### Setting up Layer 2 (optional)

1. Get an API key from one of the supported providers:
   - **Anthropic** (Claude) — recommended for accuracy. [platform.claude.com](https://platform.claude.com/settings/workspaces/default/keys)
   - **OpenAI** — [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
   - **Google** (Gemini) — [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Open the extension's options page, pick the provider tab, and paste the key.
3. Reload the article and you'll see the full rubric and inline highlights.

The key is stored in `chrome.storage.local` on your device only. It is never transmitted to our servers — only to the provider's own API endpoint (`api.anthropic.com`, `api.openai.com`, or `generativelanguage.googleapis.com`) by your own browser when you trigger an analysis.

---

## Privacy

There is no backend. There is no account. There is no advertising.

- **Layer 1** runs entirely in your browser. Zero network calls.
- **Layer 2** sends the article directly from your browser to the provider you chose (`api.anthropic.com`, `api.openai.com`, or `generativelanguage.googleapis.com`), using your own key. We never see it.
- **Telemetry** (on by default, one-click opt-out): one anonymous batch per day with counters only — no URLs, no article content, no device IDs. Domain counts are HMAC-hashed with a UTC-midnight-rotating salt so we cannot correlate a domain to a user across days.
- **Bug reports** are opt-in per-submission. Nothing is sent unless you click **Send**.

Full details: [PRIVACY.md](PRIVACY.md).

---

## Architecture

| Layer | Tech |
|-------|------|
| Manifest | Chrome MV3, side panel API (Chrome 114+) |
| UI | React 18 + Tailwind CSS |
| Build | Vite + `@crxjs/vite-plugin` |
| Article extraction | Mozilla Readability |
| NLP (Layer 1) | Compromise + bundled BABE lexicon |
| Embeddings (headline drift) | BGE-small-en via ONNX (`@xenova/transformers`) |
| LLM (Layer 2) | User-supplied key, called direct from the service worker. Supported providers: Anthropic Claude Haiku 3.5 (reference), OpenAI gpt-5-mini, Google Gemini 2.5 Flash. |
| Storage | `chrome.storage.local` (per-provider keys + active provider + 30-day analysis cache) |
| Telemetry | Cloudflare Worker (counters only, opt-out) |

All logic ships inside the extension package. No remote code is fetched at runtime.

---

## Bundled datasets

| Dataset | License | Source |
|---------|---------|--------|
| BABE bias-word lexicon (2,100+ terms) | AGPL-3.0 | [Media-Bias-Group](https://github.com/Media-Bias-Group/Neural-Media-Bias-Detection-Using-Distant-Supervision-With-BABE) — see [`LICENSES/BABE.txt`](LICENSES/BABE.txt) and [`LICENSES/BABE-MODIFICATIONS.md`](LICENSES/BABE-MODIFICATIONS.md) |
| Source bias labels | AGPL-3.0 (originally authored) | [`LICENSES/SourceBiasLabels.txt`](LICENSES/SourceBiasLabels.txt) |
| BGE-small-en embedding model | Apache-2.0 | [`LICENSES/BGE-small.txt`](LICENSES/BGE-small.txt) |

---

## Development

```bash
cd extension
npm run dev          # Vite watch mode — rebuilds on save
npm run build        # Production bundle
npm run build:alpha  # Alpha channel build
npm test             # Vitest unit tests
```

Reload the extension in `chrome://extensions` after each rebuild.

### Repository layout

```
extension/   Chrome MV3 extension source (React + Vite)
docs/        PRD, design system, technical specs, sprint history
eval/        BABE evaluation harness (not shipped)
infra/       Cloudflare Worker (telemetry + bug-report relay)
scripts/     Build helpers (credits generation, source-bias linter)
LICENSES/    Third-party dataset licenses
```

---

## Contributing

Bug reports and pull requests are welcome. For substantive changes, please open an issue first to discuss the approach.

This is a not-for-profit project. There is no operator running an LLM bill — everyone pays for their own Layer 2 calls — so contributions that increase token usage need a strong justification.

---

## License

[AGPL-3.0](LICENSE). The extension source, the bias-word lexicon, and the source-label dataset are all AGPL-3.0 and publicly auditable. You can verify exactly what data leaves your device and where it goes.
