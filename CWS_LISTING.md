# Slant Detective — Chrome Web Store Listing Copy

Reference file for the CWS developer dashboard. Paste fields as directed below.

---

## Name

Slant Detective

---

## Short Description (≤ 132 chars — currently 110 chars)

Per-article media-bias analysis. Open source, AGPL-3.0. No account, no article data stored on our servers.

---

## Detailed Description

Slant Detective analyzes any news article you're reading for language bias — right in the page you're already on. Click the toolbar icon on any article and a side panel opens instantly with results. No sign-up. No account. No server that ever sees your reading.

**Layer 1 — works immediately, no setup required.** Even without an API key, Slant Detective runs entirely in your browser: it scans the article body against a research-backed bias-word lexicon (based on the BABE dataset, 2,100+ loaded terms), tallies attribution-verb skew (how differently sources are described — "said" vs. "alleged" vs. "admitted"), measures headline drift from the article body, and counts hedge words. The source label (e.g., "Lean Left," "Center") comes from our own open-source dataset, AGPL-3.0, bundled in the extension.

**Layer 2 — full rubric with inline highlights.** Paste your own Anthropic API key (takes 3 minutes — we walk you through it) and you unlock the full analysis: an overall intensity score and political-direction tilt, a four-dimension breakdown (word choice, framing, headline slant, source mix), a list of specific evidence phrases with one-sentence explanations, and dotted underlines on the actual biased phrases in the article. Hover any underline for the reason. Click any evidence row in the panel and the page scrolls to the phrase. Your key stays on your device; the call goes straight from your browser to Anthropic — we never see the article or your key.

**Why open source?** The extension source, the bias-word lexicon, and the source-label dataset are all AGPL-3.0, publicly auditable on GitHub. You can verify exactly what data leaves your device and where it goes. We run no backend. There is no server to breach, no account database, no advertising, no monetization.

**Cost to you:** Layer 1 is completely free. Layer 2 uses your own Anthropic key at roughly $0.006 per article (Claude Haiku 3.5, ~3,000 input tokens + ~800 output tokens). A typical reader spends under $2/month.

---

## Category

Productivity

(Alternative: "News & Weather" — if CWS accepts it for extensions, prefer News & Weather as it matches user intent more directly. If the dashboard only offers Productivity for extensions, use that.)

---

## Single-Purpose Statement

Per-article media-bias analysis

---

## Privacy Policy URL

https://raw.githubusercontent.com/royfrenk/Slant-Detective/main/PRIVACY.md

---

## Homepage / Support URL

https://github.com/royfrenk/Slant-Detective

---

## Remote Code Policy

This extension does not execute any remote code. The only network calls are:
1. User-initiated Layer 2 analysis sent directly from the user's browser to api.anthropic.com using the user's own API key.
2. Optional aggregate telemetry (counters only — no URLs, no article content, no device identifiers) to our Cloudflare Worker at sd-telemetry.rabbit-factory.workers.dev. This can be disabled on the options page.

No code is ever fetched from a remote server and executed. All logic ships inside the extension package.

---

## Permissions Justifications

| Permission | Type | Justification |
|------------|------|---------------|
| `sidePanel` | Permission | Open the Chrome side panel for the analysis UI (requires Chrome 114+). |
| `tabs` | Permission | Query the active tab's URL so the service worker can open the side panel and route messages to the correct content script. |
| `activeTab` | Permission | Read the current tab's URL and send messages to the injected content script when the toolbar icon is clicked. |
| `storage` | Permission | Store the user's Anthropic API key and analysis cache in `chrome.storage.local` so analyses persist across sessions without a server. |
| `scripting` | Permission | Inject the content script (Readability.js + highlight layer) into the current page to extract article text and render inline highlights. |
| `alarms` | Permission | Schedule the once-per-day aggregate telemetry emit (counters only). Without `alarms`, the service worker cannot wake itself on a schedule — `setTimeout` does not persist across service-worker restarts. |
| `https://api.anthropic.com/*` | Host permission | Direct API calls from the service worker to Anthropic using the user's own key (Layer 2 only, user-triggered). |
| `https://sd-telemetry.rabbit-factory.workers.dev/*` | Host permission | POST aggregate counters (article count, error counts, rotating-salt hashed domain counts — no URLs, no content, no identifiers) to our Cloudflare Worker once per day. Can be disabled. |

---

## Data Use Disclosure (for CWS Privacy Practices form)

Answer each question in the CWS developer console Data tab as follows:

| Data Type | Collected? | Notes |
|-----------|-----------|-------|
| Personally identifiable information | NO | No name, email, or account system of any kind. |
| Health information | NO | |
| Financial information | NO | |
| Authentication information | YES — stored locally only | The user's Anthropic API key is stored in `chrome.storage.local` on the user's device. It is never transmitted to our servers. It is transmitted only to api.anthropic.com (Anthropic's servers) by the user's own browser when they trigger a Layer 2 analysis. |
| Personal communications | NO | |
| Location | NO | |
| Web history | NO | We never log URLs. Aggregate telemetry uses 12-character HMAC-SHA256 domain counts with a UTC-midnight-rotating salt — we cannot correlate a specific domain back to a user or device across days. |
| User activity | NO (aggregate counters only) | If telemetry is enabled (default on, opt-out in options), the extension sends once-daily aggregate counters: number of articles analyzed, number of errors, hashed domain counts. No per-article events, no timestamps, no device IDs. See PRIVACY.md. |
| Website content | USER'S BROWSER ONLY | Readability.js extracts the article body in the user's browser. For Layer 2 analyses, the extracted text is sent by the user's browser directly to api.anthropic.com using the user's own Anthropic API key. It is never sent to our servers. |

**Certification:** This extension uses only the minimum data required for its stated single purpose (per-article media-bias analysis). No data is sold. No data is used for advertising, profiling, or any purpose unrelated to bias analysis.

---

## Additional CWS Review Notes (include in "Additional information" field if available)

- **AGPL-3.0 open source:** Full source at https://github.com/royfrenk/Slant-Detective
- **No remote code execution:** All scripts ship inside the package.
- **Bundled research data:** The extension bundles the BABE bias-word lexicon (AGPL-3.0, Media-Bias-Group), an originally-authored source-bias-labels dataset (AGPL-3.0), and a BGE-small-en embedding model (Apache-2.0 via ONNX). All licenses in the `LICENSES/` folder of the repository.
- **Content script scope:** The content script matches `http://*/*` and `https://*/*` because media-bias analysis must work on any news domain. It runs at `document_idle`, does not modify persistent page state, and only activates on user click (toolbar icon).
