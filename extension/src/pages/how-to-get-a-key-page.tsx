import React from 'react';
import { createRoot } from 'react-dom/client';
import './page.css';
import PageFooterNav from './page-footer-nav';

interface Step { number: number; text: React.ReactNode }
interface CostRow { usage: string; cost: string }

// TODO(SD-035): Replace all '— (pending)' placeholders with real token cost figures
// from eval/reports/SD-035-anthropic.json, SD-035-openai.json, SD-035-gemini.json
// Do NOT use provider marketing page pricing.
const ANTHROPIC_COST_PER_ARTICLE = '— (pending)';
const ANTHROPIC_COST_LIGHT = '— (pending)';
const ANTHROPIC_COST_HEAVY = '— (pending)';
const OPENAI_COST_GPT5_MINI_PER_ARTICLE = '— (pending)';
const OPENAI_COST_GPT5_MINI_LIGHT = '— (pending)';
const OPENAI_COST_GPT5_PER_ARTICLE = '— (pending)';
const OPENAI_COST_GPT5_LIGHT = '— (pending)';
const GEMINI_COST_FLASH_PER_ARTICLE = '— (pending)';
const GEMINI_COST_FLASH_LIGHT = '— (pending)';
const GEMINI_COST_PRO_PER_ARTICLE = '— (pending)';
const GEMINI_COST_PRO_LIGHT = '— (pending)';

const ANTHROPIC_STEPS: readonly Step[] = [
  {
    number: 1,
    text: (
      <>
        Go to{' '}
        <a
          href="https://platform.claude.com/settings/workspaces/default/keys"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Anthropic developer console (opens in new tab)"
          className="text-primary-fixed no-underline hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:rounded-sm"
        >
          platform.claude.com/settings/workspaces/default/keys
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
        Click <strong>Create Key</strong> → give it a name (e.g., "Slant Detective") → copy the key.
      </>
    ),
  },
  {
    number: 4,
    text: (
      <>
        Open the Slant Detective options page → paste the key into the
        "API Key" field → click <strong>Save</strong>.
      </>
    ),
  },
  {
    number: 5,
    text: 'Return to any article and click Analyze in the side panel. Layer 2 is now active.',
  },
] as const;

const OPENAI_STEPS: readonly Step[] = [
  {
    number: 1,
    text: (
      <>
        Go to{' '}
        <a
          href="https://platform.openai.com/api-keys"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="OpenAI developer console (opens in new tab)"
          className="text-primary-fixed no-underline hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:rounded-sm"
        >
          platform.openai.com/api-keys
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
        Click <strong>Create new secret key</strong> → give it a name (e.g., "Slant Detective") →
        copy the key before closing the dialog (it is shown only once).
      </>
    ),
  },
  {
    number: 4,
    text: (
      <>
        Open the Slant Detective options page → select <strong>OpenAI</strong> from the provider
        dropdown → paste the key into the "API Key" field → click <strong>Save</strong>.
      </>
    ),
  },
  {
    number: 5,
    text: 'Return to any article and click Analyze in the side panel. Layer 2 is now active.',
  },
] as const;

const GEMINI_STEPS: readonly Step[] = [
  {
    number: 1,
    text: (
      <>
        Go to{' '}
        <a
          href="https://aistudio.google.com/api-keys"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Google AI Studio (opens in new tab)"
          className="text-primary-fixed no-underline hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:rounded-sm"
        >
          aistudio.google.com/api-keys
        </a>
        {' '}→ sign in with a Google account.
      </>
    ),
  },
  {
    number: 2,
    text: (
      <>
        Click <strong>Create API key</strong> → select an existing Google Cloud project or create a new one.
      </>
    ),
  },
  {
    number: 3,
    text: 'Copy the key from the API key list.',
  },
  {
    number: 4,
    text: (
      <>
        Open the Slant Detective options page → select <strong>Gemini</strong> from the provider
        dropdown → paste the key into the "API Key" field → click <strong>Save</strong>.
      </>
    ),
  },
  {
    number: 5,
    text: 'Return to any article and click Analyze in the side panel. Layer 2 is now active.',
  },
] as const;

// Cost rows per provider
const ANTHROPIC_COST_ROWS: readonly CostRow[] = [
  { usage: 'Per article (avg. 800 words)', cost: ANTHROPIC_COST_PER_ARTICLE },
  { usage: 'Light reader (≈ 20 articles/day)', cost: ANTHROPIC_COST_LIGHT },
  { usage: 'Heavy reader (≈ 60 articles/day)', cost: ANTHROPIC_COST_HEAVY },
] as const;

const OPENAI_COST_ROWS: readonly CostRow[] = [
  { usage: 'gpt-5-mini — per article', cost: OPENAI_COST_GPT5_MINI_PER_ARTICLE },
  { usage: 'gpt-5-mini — light reader', cost: OPENAI_COST_GPT5_MINI_LIGHT },
  { usage: 'gpt-5 — per article', cost: OPENAI_COST_GPT5_PER_ARTICLE },
  { usage: 'gpt-5 — light reader', cost: OPENAI_COST_GPT5_LIGHT },
] as const;

const GEMINI_COST_ROWS: readonly CostRow[] = [
  { usage: 'gemini-2.5-flash — per article', cost: GEMINI_COST_FLASH_PER_ARTICLE },
  { usage: 'gemini-2.5-flash — light reader', cost: GEMINI_COST_FLASH_LIGHT },
  { usage: 'gemini-2.5-pro — per article', cost: GEMINI_COST_PRO_PER_ARTICLE },
  { usage: 'gemini-2.5-pro — light reader', cost: GEMINI_COST_PRO_LIGHT },
] as const;

// Sub-components
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
  // Non-critical: privacy page open failure does not affect analysis (e.g., extension context invalidated).
  chrome.tabs.create({ url: chrome.runtime.getURL('src/pages/privacy.html') }).catch(() => {});
}

interface ProviderSectionProps {
  id: string;
  headingId: string;
  providerName: string;
  steps: readonly Step[];
  costIntro: string;
  costRows: readonly CostRow[];
  privacyNote: string;
  className?: string;
}

function ProviderSection({
  id,
  headingId,
  providerName,
  steps,
  costIntro,
  costRows,
  privacyNote,
  className,
}: ProviderSectionProps): React.JSX.Element {
  return (
    <section id={id} aria-labelledby={headingId} className={className}>
      <h2
        id={headingId}
        className="text-xs font-semibold tracking-wider uppercase text-on-surface-variant mb-3"
      >
        {providerName}
      </h2>
      <ol className="list-none m-0 p-0">
        {steps.map((step) => (
          <StepCard key={step.number} {...step} />
        ))}
      </ol>

      <h3
        className="text-xs font-semibold tracking-wider uppercase text-on-surface-variant mb-3 mt-10"
      >
        Cost Estimate
      </h3>
      <p className="text-sm text-on-surface leading-relaxed mb-3">
        {costIntro}
      </p>
      <div className="bg-surface-variant rounded-lg px-4 py-3">
        <div className="flex items-center pb-2 mb-2 border-b border-outline">
          <span className="text-xs font-semibold text-on-surface-variant tracking-wider uppercase flex-1">
            Usage Type
          </span>
          <span className="text-xs font-semibold text-on-surface-variant tracking-wider uppercase">
            Est. Monthly Cost
          </span>
        </div>
        {costRows.map((row) => (
          <div key={row.usage} className="flex items-center py-1.5">
            <span className="text-sm text-on-surface flex-1">{row.usage}</span>
            <span className="text-sm font-semibold text-primary">{row.cost}</span>
          </div>
        ))}
      </div>

      <p className="text-sm text-on-surface leading-relaxed mb-3 mt-10">
        {privacyNote}{' '}
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
  );
}

// Page component
export function HowToGetAKeyPage(): React.JSX.Element {
  return (
    <div className="min-h-screen bg-background px-6 pt-8 pb-16">
      <div className="max-w-[560px] mx-auto">

        <header>
          <p className="text-[0.875rem] font-black uppercase tracking-wordmark text-primary mb-8 m-0">
            SLANT DETECTIVE
          </p>
        </header>

        <main>
          <h1 className="font-bold text-2xl text-primary mb-8 mt-0">
            How to Get a Key
          </h1>

          <nav aria-label="Provider sections" className="mb-8">
            <a
              href="#anthropic"
              className="text-xs text-on-surface-variant no-underline hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:rounded-sm"
            >
              Anthropic
            </a>
            <span className="mx-2 text-xs text-on-surface-variant select-none" aria-hidden="true">·</span>
            <a
              href="#openai"
              className="text-xs text-on-surface-variant no-underline hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:rounded-sm"
            >
              OpenAI
            </a>
            <span className="mx-2 text-xs text-on-surface-variant select-none" aria-hidden="true">·</span>
            <a
              href="#gemini"
              className="text-xs text-on-surface-variant no-underline hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:rounded-sm"
            >
              Gemini
            </a>
          </nav>

          <ProviderSection
            id="anthropic"
            headingId="anthropic-heading"
            providerName="Anthropic"
            steps={ANTHROPIC_STEPS}
            costIntro="Claude Haiku pricing — figures from SD-035 eval harness. Actual cost depends on article length."
            costRows={ANTHROPIC_COST_ROWS}
            privacyNote="Your API key is stored locally on your device only. Analyses go directly from your browser to Anthropic — never through our servers."
          />

          <ProviderSection
            id="openai"
            headingId="openai-heading"
            providerName="OpenAI"
            steps={OPENAI_STEPS}
            costIntro="OpenAI pricing — figures from SD-035 eval harness. Actual cost depends on article length."
            costRows={OPENAI_COST_ROWS}
            privacyNote="Your API key is stored locally on your device only. Analyses go directly from your browser to OpenAI — never through our servers."
            className="mt-10"
          />

          <ProviderSection
            id="gemini"
            headingId="gemini-heading"
            providerName="Gemini"
            steps={GEMINI_STEPS}
            costIntro="Gemini pricing — figures from SD-035 eval harness. Free-tier limits apply for unpaid accounts. Actual cost depends on article length."
            costRows={GEMINI_COST_ROWS}
            privacyNote="Your API key is stored locally on your device only. Analyses go directly from your browser to Google — never through our servers."
            className="mt-10"
          />
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
