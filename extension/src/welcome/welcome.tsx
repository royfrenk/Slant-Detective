import React from "react";
import { FEEDBACK_FORM_URL } from "../shared/urls";
import { DIMENSIONS } from "../shared/dimension-copy";
import type { DimensionCopy } from "../shared/dimension-copy";

// ---------------------------------------------------------------------------
// CTA handlers
// ---------------------------------------------------------------------------

function handleAddApiKey(): void {
  chrome.runtime.openOptionsPage();
}

function handleTryIt(): void {
  chrome.tabs.getCurrent((tab) => {
    if (tab?.id !== undefined) {
      chrome.tabs.remove(tab.id);
    }
  });
}

// ---------------------------------------------------------------------------
// Dimension preview chip (2x2 grid)
// ---------------------------------------------------------------------------

function DimensionChip({ label, glyph, description }: DimensionCopy): React.JSX.Element {
  return (
    <div
      className="rounded-[12px] px-4 py-3"
      style={{ background: "linear-gradient(135deg, #f2f4f6, #ffffff)" }}
    >
      <p className="text-primary font-semibold text-[12px] uppercase tracking-[0.08em] m-0">
        <span aria-hidden="true" className="mr-2">{glyph}</span>
        {label}
      </p>
      <p className="text-primary-container font-normal text-[13px] leading-snug mt-1 mb-0">
        {description}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Footer nav (unchanged from current implementation)
// ---------------------------------------------------------------------------

function FooterNav(): React.JSX.Element {
  return (
    <nav
      className="mt-8 flex items-center justify-center gap-0 text-xs text-on-surface-variant"
      aria-label="Footer navigation"
    >
      <a
        role="link"
        tabIndex={0}
        aria-label="How we measure bias"
        className="text-on-surface-variant no-underline hover:underline cursor-pointer"
        onClick={() => { chrome.tabs.create({ url: chrome.runtime.getURL("src/pages/how-we-measure.html") }).catch(() => {}); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") chrome.tabs.create({ url: chrome.runtime.getURL("src/pages/how-we-measure.html") }).catch(() => {}); }}
      >
        How we measure
      </a>
      <span className="mx-2 select-none" aria-hidden="true">·</span>
      <a
        role="link"
        tabIndex={0}
        aria-label="Privacy policy"
        className="text-on-surface-variant no-underline hover:underline cursor-pointer"
        onClick={() => { chrome.tabs.create({ url: chrome.runtime.getURL("src/pages/privacy.html") }).catch(() => {}); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") chrome.tabs.create({ url: chrome.runtime.getURL("src/pages/privacy.html") }).catch(() => {}); }}
      >
        Privacy
      </a>
      <span className="mx-2 select-none" aria-hidden="true">·</span>
      <a
        role="link"
        tabIndex={0}
        aria-label="Credits and attributions"
        className="text-on-surface-variant no-underline hover:underline cursor-pointer"
        onClick={() => { chrome.tabs.create({ url: chrome.runtime.getURL("src/pages/credits.html") }).catch(() => {}); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") chrome.tabs.create({ url: chrome.runtime.getURL("src/pages/credits.html") }).catch(() => {}); }}
      >
        Credits
      </a>
      <span className="mx-2 select-none" aria-hidden="true">·</span>
      <a
        role="link"
        tabIndex={0}
        aria-label="Open Slant Detective feedback form in new tab"
        className="text-on-surface-variant no-underline hover:underline cursor-pointer"
        onClick={() => { chrome.tabs.create({ url: FEEDBACK_FORM_URL, active: true }).catch(() => {}); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") chrome.tabs.create({ url: FEEDBACK_FORM_URL, active: true }).catch(() => {}); }}
      >
        Feedback
      </a>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Welcome page
// ---------------------------------------------------------------------------

export default function Welcome(): React.JSX.Element {
  const isFirefox = typeof (chrome as unknown as Record<string, unknown>).sidebarAction !== 'undefined';

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-[720px]">

        {/* Content card */}
        <div className="bg-surface rounded-2xl shadow-ambient overflow-hidden">

          {/* Top zone — centered lockup + headline + sub-headline + dimension grid */}
          <div className="px-8 pt-8 pb-0 md:px-12 md:pt-12 text-center">

            {/* Monogram icon (wordmark omitted per SD-043 design spec § 10) */}
            <div className="flex justify-center mb-6">
              <img
                src={chrome.runtime.getURL("assets/icon-128.png")}
                alt=""
                aria-hidden="true"
                width={40}
                height={40}
                className="block"
              />
            </div>

            {/* Headline */}
            <h1 className="text-on-surface font-semibold text-[24px] md:text-[28px] leading-[1.3] mb-3 mt-0">
              You&apos;re in. Here&apos;s what happens next.
            </h1>

            {/* Sub-headline */}
            <p className="text-on-surface-variant font-normal text-[14px] leading-relaxed mb-8 mt-0">
              {isFirefox
                ? "On first install, right-click the Slant Detective icon → 'Pin to toolbar', then click it to toggle the sidebar."
                : "Click the toolbar icon on any news article. A side panel will open with the bias readout. No key needed to start."}
            </p>

            {/* Dimension preview grid (2x2) */}
            <div className="grid grid-cols-2 gap-3 text-left mb-8">
              {DIMENSIONS.map((dim) => (
                <DimensionChip key={dim.key} {...dim} />
              ))}
            </div>
          </div>

          {/* Bottom zone — tinted surface band with "Why" block + CTAs */}
          <div className="bg-surface-variant px-8 py-6 md:px-12">
            <div className="md:flex md:items-start md:gap-8">

              {/* "Why a key?" explainer */}
              <div className="flex-1 mb-6 md:mb-0">
                <p className="text-on-surface font-semibold text-[15px] mb-2 mt-0">
                  Why a key?
                </p>
                <p className="text-on-surface-variant font-normal text-[14px] leading-relaxed m-0">
                  The in-depth analysis — overall lean, four-dimension breakdown, inline highlights — uses a language model. You pay your provider (Anthropic, OpenAI, or Google) directly, about $0.006 an article. We never see the article or the key.
                </p>
              </div>

              {/* CTA column */}
              <div className="flex-shrink-0">
                {/* Primary CTA */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleAddApiKey}
                    aria-label="Get in-depth analysis — open the Slant Detective options page to add an API key"
                    className={[
                      "bg-gradient-to-br from-primary to-primary-container",
                      "text-on-primary font-medium text-sm",
                      "px-6 py-3 rounded-md border-0 cursor-pointer",
                      "hover:brightness-[0.96]",
                      "focus:outline focus:outline-2 focus:outline-primary focus:outline-offset-2",
                      "active:scale-[0.98] transition-transform duration-75",
                    ].join(" ")}
                  >
                    Get in-depth analysis
                  </button>

                  {/* Secondary CTA */}
                  <button
                    type="button"
                    onClick={handleTryIt}
                    aria-label="Use free mode — close this tab and start using Slant Detective"
                    className={[
                      "bg-transparent text-primary font-medium text-sm",
                      "px-3 py-3 rounded-md border-0 cursor-pointer",
                      "hover:underline",
                      "focus:outline focus:outline-2 focus:outline-primary focus:outline-offset-2",
                    ].join(" ")}
                  >
                    Use free mode
                  </button>
                </div>

                {/* Caption under CTAs */}
                <p className="text-on-surface-variant font-normal text-[12px] mt-2 mb-0">
                  Free mode runs entirely in your browser. No key, no network — but fewer checks than the in-depth analysis.
                </p>
              </div>
            </div>

            {/* Lock-icon microcopy */}
            <div className="flex items-center gap-2 mt-4">
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
                className="flex-shrink-0 text-on-surface-variant"
              >
                <rect x="1.5" y="5" width="9" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M3.5 5V3.5a2.5 2.5 0 0 1 5 0V5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              <p className="text-on-surface-variant text-[12px] m-0">
                Nothing leaves your browser without your key. No account. No tracking.
              </p>
            </div>
          </div>
        </div>

        {/* Footer nav quad */}
        <FooterNav />
      </div>
    </div>
  );
}
