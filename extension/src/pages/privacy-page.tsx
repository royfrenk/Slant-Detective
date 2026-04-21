import React from 'react';
import { createRoot } from 'react-dom/client';
import './page.css';
import PageFooterNav from './page-footer-nav';

const WORKER_SOURCE_URL =
  'https://github.com/royfrenk/Slant-Detective/blob/main/infra/cloudflare-worker/src/index.ts' as const;
const CLIENT_TELEMETRY_URL =
  'https://github.com/royfrenk/Slant-Detective/blob/main/extension/src/service-worker/telemetry.ts' as const;

const TELEMETRY_SCHEMA = `interface TelemetryBatch {
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
}` as const;

const EXCLUDED_FIELDS: readonly string[] = [
  'No distinct_id, device_id, install_id, or session_id',
  'No per-event timestamps (only UTC day bucket)',
  'No raw URLs, paths, query strings, or full-URL hashes',
  'No article titles, bodies, or rubric scores',
  'No API key, key fingerprint, or key prefix',
  'No user agent, screen size, OS, or locale',
  'No IP address — the Cloudflare Worker reads it only for in-memory rate-limiting and never writes it to Analytics Engine',
] as const;

const BUG_REPORT_NOT_SENT: readonly string[] = [
  'No automatic extension state (rubric results, cache entries, API key, settings, history)',
  'No IP address — the Worker reads it only for in-memory rate-limiting (5 reports/min per IP) and never writes it anywhere',
  'No identifiers that persist across submissions',
] as const;

const NOT_COLLECTED: readonly string[] = [
  'No account, email address, or password',
  'No IP address logs',
  'No session identifiers or device fingerprints',
  'No article content contribution to any database',
  'No rubric output aggregation at the per-article level',
  'No advertising IDs or third-party tracking',
] as const;

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary-fixed no-underline hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:rounded-sm"
    >
      {children}
    </a>
  );
}

export function PrivacyPage(): React.JSX.Element {
  return (
    <div className="min-h-screen bg-background px-6 pt-8 pb-16">
      <div className="max-w-[560px] mx-auto">

        {/* Wordmark */}
        <header>
          <p className="text-[0.875rem] font-black uppercase tracking-wordmark text-primary mb-8 m-0">
            SLANT DETECTIVE
          </p>
        </header>

        <main>
          {/* Page title */}
          <h1 className="font-bold text-2xl text-primary mb-8 mt-0">
            Privacy Protocol
          </h1>

          {/* Section 1 */}
          <section aria-labelledby="on-device-heading">
            <h2
              id="on-device-heading"
              className="text-xs font-semibold tracking-wider uppercase text-on-surface-variant mb-3"
            >
              What Stays on Your Device
            </h2>
            <p className="text-sm text-on-surface leading-relaxed mb-3">
              Your API key is stored in <code className="font-mono text-xs">chrome.storage.local</code> on
              your device only. It is never transmitted to our servers.
            </p>
            <p className="text-sm text-on-surface leading-relaxed mb-3">
              The rubric cache (article body hash → analysis result) is stored
              in <code className="font-mono text-xs">chrome.storage.local</code>. Cache entries expire after 30 days.
            </p>
            <p className="text-sm text-on-surface leading-relaxed mb-3">
              Layer 1 signals run entirely in the browser. No network request is made
              during a Layer 1 analysis.
            </p>
          </section>

          {/* Section 2 */}
          <section aria-labelledby="to-provider-heading" className="mt-10">
            <h2
              id="to-provider-heading"
              className="text-xs font-semibold tracking-wider uppercase text-on-surface-variant mb-3"
            >
              What Goes Directly to Your Provider
            </h2>
            <p className="text-sm text-on-surface leading-relaxed mb-3">
              When you trigger a Layer 2 analysis, the article title and body are sent
              directly to your chosen provider's API — Anthropic (<code className="font-mono text-xs">api.anthropic.com</code>),
              OpenAI (<code className="font-mono text-xs">api.openai.com</code>), or Google (<code className="font-mono text-xs">generativelanguage.googleapis.com</code>) —
              using your own API key.
            </p>
            <p className="text-sm text-on-surface leading-relaxed mb-3">
              This request is made directly from your browser to the chosen provider. It does not
              pass through our servers.
            </p>
            <p className="text-sm text-on-surface leading-relaxed mb-3">
              Your key goes directly to the chosen provider. We never see it.
            </p>
            <p className="text-sm text-on-surface leading-relaxed mb-3">
              Each provider's own privacy policy governs data sent through their API.
            </p>
          </section>

          {/* Section 3 */}
          <section aria-labelledby="telemetry-heading" className="mt-10">
            <h2
              id="telemetry-heading"
              className="text-xs font-semibold tracking-wider uppercase text-on-surface-variant mb-3"
            >
              What Goes to Us (Aggregate Telemetry)
            </h2>
            <p className="text-sm text-on-surface leading-relaxed mb-3">
              Once per day, the extension may send a single aggregate batch to our
              Cloudflare Worker. Telemetry is <strong>on by default</strong> and can be disabled at
              any time — see "How to turn it off" below. The full payload schema:
            </p>
            <figure>
              <figcaption className="sr-only">Telemetry payload schema</figcaption>
              <pre
                className="bg-surface-variant rounded-lg px-4 py-3 text-xs text-on-surface font-mono overflow-x-auto"
                aria-label="Telemetry payload TypeScript interface"
              >
                <code>{TELEMETRY_SCHEMA}</code>
              </pre>
            </figure>
            <p className="text-sm font-semibold text-on-surface mt-6 mb-3">
              What is NOT in the payload:
            </p>
            <ul className="m-0 pl-0 list-none">
              {EXCLUDED_FIELDS.map((field) => (
                <li key={field} className="text-sm text-on-surface leading-relaxed mb-1 flex gap-2">
                  <span aria-hidden="true" className="text-on-surface-variant select-none">·</span>
                  <span>{field}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Section 4 */}
          <section aria-labelledby="bug-reports-heading" className="mt-10">
            <h2
              id="bug-reports-heading"
              className="text-xs font-semibold tracking-wider uppercase text-on-surface-variant mb-3"
            >
              What Goes to Us (Bug Reports)
            </h2>
            <p className="text-sm text-on-surface leading-relaxed mb-3">
              The extension has a <strong>Report bug</strong> affordance in the evidence tooltip and in
              the side-panel footer. Nothing is sent unless you click <strong>Send</strong> in the
              confirmation modal.
            </p>
            <p className="text-sm text-on-surface leading-relaxed mb-3">
              When you do click Send, the following are forwarded — through our Cloudflare Worker — to
              the extension author via Resend. The Worker uses{' '}
              <code className="font-mono text-xs">onboarding@resend.dev</code> as the
              <code className="font-mono text-xs">{' '}from:</code> address and never stores the payload.
            </p>
            <ul className="m-0 pl-0 list-none">
              <li className="text-sm text-on-surface leading-relaxed mb-2 flex gap-2">
                <span aria-hidden="true" className="text-on-surface-variant select-none">·</span>
                <span><strong>Page URL</strong> — optional, sent only when the "Include page URL" toggle is ON. Editable in the modal so you can strip query strings, tokens, or identifiers before sending.</span>
              </li>
              <li className="text-sm text-on-surface leading-relaxed mb-2 flex gap-2">
                <span aria-hidden="true" className="text-on-surface-variant select-none">·</span>
                <span><strong>Screenshot</strong> — optional, sent only when the "Include screenshot" toggle is ON. Full-capture PNG of the active tab at the moment you opened the modal. Cropping ships in a future update.</span>
              </li>
              <li className="text-sm text-on-surface leading-relaxed mb-2 flex gap-2">
                <span aria-hidden="true" className="text-on-surface-variant select-none">·</span>
                <span><strong>Free-text description</strong> — optional, up to 500 characters.</span>
              </li>
            </ul>
            <p className="text-sm font-semibold text-on-surface mt-6 mb-3">
              What is NOT sent with a bug report:
            </p>
            <ul className="m-0 pl-0 list-none">
              {BUG_REPORT_NOT_SENT.map((item) => (
                <li key={item} className="text-sm text-on-surface leading-relaxed mb-1 flex gap-2">
                  <span aria-hidden="true" className="text-on-surface-variant select-none">·</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-on-surface leading-relaxed mt-6 mb-3">
              <strong>Recipient:</strong> the extension author only. The payload is not stored on our
              Cloudflare Worker or in any database — it is forwarded to Resend, which delivers the email,
              and nothing else is retained server-side.
            </p>
            <p className="text-sm text-on-surface leading-relaxed mb-3">
              <strong>How to avoid it entirely:</strong> don't click Send. A network-level block on{' '}
              <code className="font-mono text-xs">sd-telemetry.*.workers.dev</code> also blocks bug reports.
            </p>
          </section>

          {/* Section 5 */}
          <section aria-labelledby="domain-safety-heading" className="mt-10">
            <h2
              id="domain-safety-heading"
              className="text-xs font-semibold tracking-wider uppercase text-on-surface-variant mb-3"
            >
              Why Domain Counts Are Safe
            </h2>
            <p className="text-sm text-on-surface leading-relaxed mb-3">
              <code className="font-mono text-xs">domain_counts</code> maps a salted hash of the registrable domain
              (eTLD+1) to an article count. Raw domain names are never sent.
            </p>
            <p className="text-sm text-on-surface leading-relaxed mb-3">
              The salt is generated in-browser and rotates at UTC midnight. Even we cannot
              correlate a domain hash across two different days — the previous day's hash
              is mathematically unrelated to today's.
            </p>
            <p className="text-sm text-on-surface leading-relaxed mb-3">
              Each batch is capped at 50 domain hashes. Overflow domains are bucketed
              as <code className="font-mono text-xs">__other__</code>.
            </p>
          </section>

          {/* Section 6 */}
          <section aria-labelledby="opt-out-heading" className="mt-10">
            <h2
              id="opt-out-heading"
              className="text-xs font-semibold tracking-wider uppercase text-on-surface-variant mb-3"
            >
              How to Turn It Off
            </h2>
            <p className="text-sm text-on-surface leading-relaxed mb-3">
              Open the Slant Detective options page (right-click the extension icon → "Options").
            </p>
            <p className="text-sm text-on-surface leading-relaxed mb-3">
              Toggle off <strong>"Share anonymous usage stats"</strong>. The toggle takes effect
              immediately — no pending counters are sent after it is disabled.
            </p>
            <p className="text-sm text-on-surface leading-relaxed mb-3">
              If you prefer a network-level block: add{' '}
              <code className="font-mono text-xs">sd-telemetry.*.workers.dev</code> to your hosts file
              or uBlock Origin custom filters.
            </p>
          </section>

          {/* Section 7 */}
          <section aria-labelledby="verify-heading" className="mt-10">
            <h2
              id="verify-heading"
              className="text-xs font-semibold tracking-wider uppercase text-on-surface-variant mb-3"
            >
              Where to Verify Our Claims
            </h2>
            <p className="text-sm text-on-surface leading-relaxed mb-3">
              Slant Detective is AGPL-3.0. Every line is readable.
            </p>
            <p className="text-sm text-on-surface leading-relaxed mb-3">
              <ExternalLink href={WORKER_SOURCE_URL}>
                Cloudflare Worker source
              </ExternalLink>
              {' '}(<code className="font-mono text-xs">infra/cloudflare-worker/src/index.ts</code>) — this is
              where IP stripping and the Analytics Engine write happen.
            </p>
            <p className="text-sm text-on-surface leading-relaxed mb-3">
              <ExternalLink href={CLIENT_TELEMETRY_URL}>
                Client emitter source
              </ExternalLink>
              {' '}(<code className="font-mono text-xs">extension/src/service-worker/telemetry.ts</code>) — this
              is where counters are accumulated and the daily emit is triggered.
            </p>
          </section>

          {/* Section 8 */}
          <section aria-labelledby="key-caveat-heading" className="mt-10">
            <h2
              id="key-caveat-heading"
              className="text-xs font-semibold tracking-wider uppercase text-on-surface-variant mb-3"
            >
              API Key Storage Caveat
            </h2>
            <p className="text-sm text-on-surface leading-relaxed mb-3">
              <code className="font-mono text-xs">chrome.storage.local</code> may be replicated across devices if
              Chrome Sync is enabled for extensions.
            </p>
            <p className="text-sm text-on-surface leading-relaxed mb-3">
              Any other installed extension that holds the <code className="font-mono text-xs">storage</code> permission
              can read your API key.
            </p>
            <p className="text-sm text-on-surface leading-relaxed mb-3">
              Recommendations: if this concerns you, disable Chrome Sync for extensions in
              Chrome settings, and audit which other extensions you have installed.
            </p>
          </section>

          {/* Section 9 */}
          <section aria-labelledby="never-collect-heading" className="mt-10">
            <h2
              id="never-collect-heading"
              className="text-xs font-semibold tracking-wider uppercase text-on-surface-variant mb-3"
            >
              What We Do Not Collect, Ever
            </h2>
            <ul className="m-0 pl-0 list-none">
              {NOT_COLLECTED.map((item) => (
                <li key={item} className="text-sm text-on-surface leading-relaxed mb-1 flex gap-2">
                  <span aria-hidden="true" className="text-on-surface-variant select-none">·</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        </main>

        <PageFooterNav currentPage="privacy" />
      </div>
    </div>
  );
}

const container = document.getElementById('root');
if (container !== null) {
  createRoot(container).render(<PrivacyPage />);
}
