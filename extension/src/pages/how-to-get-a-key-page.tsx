import React from 'react';
import { createRoot } from 'react-dom/client';
import './page.css';
import PageFooterNav from './page-footer-nav';

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

interface Step {
  number: number;
  text: React.ReactNode;
}

const STEPS: readonly Step[] = [
  {
    number: 1,
    text: (
      <>
        Go to{' '}
        <a
          href="https://console.anthropic.com"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Anthropic console (opens in new tab)"
          className="text-primary-fixed no-underline hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:rounded-sm"
        >
          console.anthropic.com
        </a>
        {' '}→ create an account or sign in.
      </>
    ),
  },
  {
    number: 2,
    text: (
      <>
        Navigate to <strong>Billing</strong> → add a payment method and set a monthly
        spend limit (recommended: $5).
      </>
    ),
  },
  {
    number: 3,
    text: (
      <>
        Navigate to <strong>API Keys</strong> → click <strong>Create Key</strong> → give it a
        name (e.g., "Slant Detective") → copy the key.
      </>
    ),
  },
  {
    number: 4,
    text: (
      <>
        Open the Slant Detective options page → paste the key into the
        "Anthropic API Key" field → click <strong>Save</strong>.
      </>
    ),
  },
  {
    number: 5,
    text: 'Return to any article and click Analyze in the side panel. Layer 2 is now active.',
  },
] as const;

// ---------------------------------------------------------------------------
// Cost rows
// ---------------------------------------------------------------------------

interface CostRow {
  usage: string;
  cost: string;
}

const COST_ROWS: readonly CostRow[] = [
  { usage: 'Per article (avg. 800 words)', cost: '~$0.006' },
  { usage: 'Light reader (≈ 20 articles/day)', cost: '~$1.30/month' },
  { usage: 'Heavy reader (≈ 60 articles/day)', cost: '~$3.80/month' },
] as const;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StepCard({ number, text }: Step): React.JSX.Element {
  return (
    <div className="bg-surface rounded-lg px-4 py-3 mb-2 flex items-start gap-3">
      <span
        className="flex-shrink-0 text-xs font-bold text-primary w-6 text-right leading-5 pt-0.5"
        aria-hidden="true"
      >
        {number}.
      </span>
      <p className="text-sm text-on-surface leading-relaxed m-0 flex-1">
        {text}
      </p>
    </div>
  );
}

function openPrivacy(): void {
  chrome.tabs.create({ url: chrome.runtime.getURL('src/pages/privacy.html') }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

function HowToGetAKeyPage(): React.JSX.Element {
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
            How to Get a Key
          </h1>

          {/* Section 1 — Steps */}
          <section aria-labelledby="steps-heading">
            <h2
              id="steps-heading"
              className="text-xs font-semibold tracking-wider uppercase text-on-surface-variant mb-3"
            >
              Steps
            </h2>
            <ol className="list-none m-0 p-0">
              {STEPS.map((step) => (
                <StepCard key={step.number} {...step} />
              ))}
            </ol>
          </section>

          {/* Section 2 — Cost Estimate */}
          <section aria-labelledby="cost-heading" className="mt-10">
            <h2
              id="cost-heading"
              className="text-xs font-semibold tracking-wider uppercase text-on-surface-variant mb-3"
            >
              Cost Estimate
            </h2>
            <p className="text-sm text-on-surface leading-relaxed mb-3">
              Claude Haiku pricing as of April 2026. Actual cost depends on article length.
            </p>
            <div className="bg-surface-variant rounded-lg px-4 py-3">
              {/* Header row */}
              <div className="flex items-center pb-2 mb-2 border-b border-outline">
                <span className="text-xs font-semibold text-on-surface-variant tracking-wider uppercase flex-1">
                  Usage Type
                </span>
                <span className="text-xs font-semibold text-on-surface-variant tracking-wider uppercase">
                  Est. Monthly Cost
                </span>
              </div>
              {/* Data rows */}
              {COST_ROWS.map((row) => (
                <div key={row.usage} className="flex items-center py-1.5">
                  <span className="text-sm text-on-surface flex-1">{row.usage}</span>
                  <span className="text-sm font-semibold text-primary">{row.cost}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Section 3 — Privacy Note */}
          <section aria-labelledby="privacy-note-heading" className="mt-10">
            <h2
              id="privacy-note-heading"
              className="text-xs font-semibold tracking-wider uppercase text-on-surface-variant mb-3"
            >
              Privacy Note
            </h2>
            <p className="text-sm text-on-surface leading-relaxed mb-3">
              Your API key is stored locally on your device only. Analyses go directly
              from your browser to Anthropic — never through our servers.{' '}
              <a
                role="link"
                tabIndex={0}
                className="text-primary-fixed no-underline hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:rounded-sm cursor-pointer"
                onClick={openPrivacy}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openPrivacy(); }}
                aria-label="Learn more about privacy"
              >
                Learn more →
              </a>
            </p>
          </section>
        </main>

        <PageFooterNav showSourceCode={true} />
      </div>
    </div>
  );
}

const container = document.getElementById('root');
if (container !== null) {
  createRoot(container).render(<HowToGetAKeyPage />);
}
