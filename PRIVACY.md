# Privacy Protocol — Slant Detective

Slant Detective is AGPL-3.0 open-source software. This document describes what data the extension handles and where it goes.

---

## What Stays on Your Device

Your Anthropic API key is stored in `chrome.storage.local` on your device only. It is never transmitted to our servers.

The rubric cache (article body hash → analysis result) is stored in `chrome.storage.local`. Cache entries expire after 30 days.

Layer 1 signals run entirely in the browser. No network request is made during a Layer 1 analysis.

---

## What Goes Directly to Anthropic

When you trigger a Layer 2 analysis, the article title and body are sent to Anthropic's API (`api.anthropic.com`) using your own API key.

This request is made directly from your browser to Anthropic. It does not pass through our servers.

Anthropic's own [privacy policy](https://www.anthropic.com/privacy) governs this data.

---

## What Goes to Us (Aggregate Telemetry)

Once per day, the extension may send a single aggregate batch to our Cloudflare Worker. Telemetry is **on by default** and can be disabled at any time — see "How to Turn It Off" below. The full payload schema:

```ts
interface TelemetryBatch {
  schema_version: 1
  extension_version: string       // e.g. "1.0.0"
  period_start: string             // "2026-04-19" (UTC day)
  period_end: string               // "2026-04-19"
  counters: {
    analyze_started: number
    analyze_layer1_ok: number
    analyze_layer2_ok: number
    analyze_extraction_failed: number
    analyze_too_short: number
    analyze_llm_timeout: number
    analyze_invalid_key: number
    analyze_rate_limit: number
    key_saved: number
    key_rejected: number
  }
  domain_counts: Record<string, number>  // hash → count; see § Why domain counts are safe
}
```

**What is NOT in the payload:**

- No `distinct_id`, `device_id`, `install_id`, or `session_id`
- No per-event timestamps (only UTC day bucket)
- No raw URLs, paths, query strings, or full-URL hashes
- No article titles, bodies, or rubric scores
- No API key, key fingerprint, or key prefix
- No user agent, screen size, OS, or locale
- No IP address — the Cloudflare Worker reads it only for in-memory rate-limiting and never writes it to Analytics Engine

---

## What Goes to Us (Bug Reports)

The extension has a **Report bug** affordance in the evidence tooltip and in the side-panel footer. Nothing is sent unless you click **Send** in the confirmation modal.

When you do click Send, the following are forwarded — through our Cloudflare Worker — to the extension author via Resend. The Worker uses `onboarding@resend.dev` as the `from:` address and never stores the payload.

- **Page URL** — optional, sent only when the "Include page URL" toggle is ON at Send time. The URL is editable in the modal so you can strip query strings, tokens, or identifiers before sending.
- **Screenshot** — optional, sent only when the "Include screenshot" toggle is ON at Send time. This is a full-capture PNG of the active tab at the moment you opened the modal. Cropping will ship in a future update.
- **Free-text description** — optional, up to 500 characters.

**What is NOT sent with a bug report:**

- No automatic extension state (rubric results, cache entries, API key, settings, history)
- No IP address — the Worker reads it only for in-memory rate-limiting (5 reports per minute per IP) and never writes it anywhere
- No identifiers that persist across submissions

**Recipient:** the extension author only. The payload is not stored on our Cloudflare Worker or in any database — it is forwarded to Resend, which delivers the email, and nothing else is retained server-side.

**How to avoid it entirely:** don't click Send. If you prefer a network-level block, add `sd-telemetry.*.workers.dev` to your hosts file or uBlock filters — this also blocks aggregate telemetry.

---

## Why Domain Counts Are Safe

`domain_counts` maps a salted hash of the registrable domain (eTLD+1) to an article count. Raw domain names are never sent.

The salt is generated in-browser and rotates at UTC midnight. Even we cannot correlate a domain hash across two different days — the previous day's hash is mathematically unrelated to today's.

Each batch is capped at 50 domain hashes. Overflow domains are bucketed as `__other__`.

---

## How to Turn It Off

Open the Slant Detective options page (right-click the extension icon → "Options").

Toggle off **"Share anonymous usage stats"**. The toggle takes effect immediately — no pending counters are sent after it is disabled.

If you prefer a network-level block: add `sd-telemetry.*.workers.dev` to your hosts file or uBlock Origin custom filters.

---

## Where to Verify Our Claims

Slant Detective is AGPL-3.0. Every line is readable.

[Cloudflare Worker source](https://github.com/royfrenk/Slant-Detective/blob/main/infra/cloudflare-worker/src/index.ts) (`infra/cloudflare-worker/src/index.ts`) — this is where IP stripping and the Analytics Engine write happen.

[Client emitter source](https://github.com/royfrenk/Slant-Detective/blob/main/extension/src/service-worker/telemetry.ts) (`extension/src/service-worker/telemetry.ts`) — this is where counters are accumulated and the daily emit is triggered.

---

## API Key Storage Caveat

`chrome.storage.local` may be replicated across devices if Chrome Sync is enabled for extensions.

Any other installed extension that holds the `storage` permission can read your API key.

Recommendations: if this concerns you, disable Chrome Sync for extensions in Chrome settings, and audit which other extensions you have installed.

---

## What We Do Not Collect, Ever

- No account, email address, or password
- No IP address logs
- No session identifiers or device fingerprints
- No article content contribution to any database
- No rubric output aggregation at the per-article level
- No advertising IDs or third-party tracking
