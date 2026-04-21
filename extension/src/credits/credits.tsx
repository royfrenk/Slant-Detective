import React from "react";
import creditsData from "../../assets/credits.json";
import DepRow from "./dep-row";
import { FEEDBACK_FORM_URL } from "../shared/urls";

// ---------------------------------------------------------------------------
// Types derived from build-credits.mjs output shape
// ---------------------------------------------------------------------------

interface Dataset {
  name: string;
  author: string;
  license: string;
  url: string;
}

interface NpmDep {
  name: string;
  version: string;
  license: string;
  homepage: string;
}

interface CreditsData {
  generated_at: string;
  datasets: Dataset[];
  npmDeps: NpmDep[];
  licensesUrl: string;
}

const data = creditsData as CreditsData;

// ---------------------------------------------------------------------------
// Footer nav quad
// ---------------------------------------------------------------------------

const GITHUB_URL = 'https://github.com/royfrenk/Slant-Detective' as const;

function openPage(pageName: string): void {
  chrome.tabs.create({ url: chrome.runtime.getURL(`src/pages/${pageName}.html`) }).catch(() => {});
}

function openExternalUrl(url: string): void {
  chrome.tabs.create({ url, active: true }).catch(() => {});
}

const NAV_LINK_CLASS = [
  'text-xs text-on-surface-variant font-normal',
  'no-underline hover:underline',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:rounded-sm',
].join(' ');

const DOT = <span className="mx-2 select-none" aria-hidden="true">·</span>;

function FooterNav(): React.JSX.Element {
  return (
    <nav
      className="mt-12 border-t border-outline pt-4"
      aria-label="Footer navigation"
    >
      <div className="flex flex-nowrap items-center gap-0 text-xs text-on-surface-variant">
        <a
          role="link"
          tabIndex={0}
          aria-label="How we measure bias"
          className={NAV_LINK_CLASS}
          onClick={() => openPage('how-we-measure')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openPage('how-we-measure'); }}
        >
          How we measure
        </a>
        {DOT}
        <a
          role="link"
          tabIndex={0}
          aria-label="Privacy policy"
          className={NAV_LINK_CLASS}
          onClick={() => openPage('privacy')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openPage('privacy'); }}
        >
          Privacy
        </a>
        {DOT}
        {/* Current page — not a link */}
        <span
          className="text-xs font-semibold text-primary"
          aria-current="page"
        >
          Credits
        </span>
        {DOT}
        <a
          role="link"
          tabIndex={0}
          aria-label="Open Slant Detective feedback form in new tab"
          className={NAV_LINK_CLASS}
          onClick={() => openExternalUrl(FEEDBACK_FORM_URL)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openExternalUrl(FEEDBACK_FORM_URL); }}
        >
          Feedback
        </a>
        {DOT}
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Source code on GitHub (opens in new tab)"
          className={NAV_LINK_CLASS}
        >
          Source code
        </a>
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function Credits(): React.JSX.Element {
  const hasNpmDeps = Array.isArray(data.npmDeps) && data.npmDeps.length > 0;

  return (
    <div className="min-h-screen bg-background px-6 pt-8 pb-16">
      <div className="max-w-[720px] mx-auto">

        {/* Wordmark */}
        <p className="text-[0.875rem] font-black uppercase tracking-wordmark text-primary mb-8 m-0">
          SLANT DETECTIVE
        </p>

        {/* Page title */}
        <h1 className="font-bold text-2xl text-primary mb-8 mt-0">
          Credits
        </h1>

        {/* ---------------------------------------------------------------- */}
        {/* Section 1: Data Sources                                          */}
        {/* ---------------------------------------------------------------- */}
        <section aria-labelledby="data-sources-heading">
          <h2
            id="data-sources-heading"
            className="text-xs font-semibold tracking-wider uppercase text-on-surface-variant mb-3"
          >
            Data Sources
          </h2>

          {data.datasets.map((ds) => (
            <DepRow
              key={ds.name}
              name={ds.name}
              author={ds.author}
              license={ds.license}
              homepage={ds.url}
            />
          ))}
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Section 2: npm Dependencies                                      */}
        {/* ---------------------------------------------------------------- */}
        <section aria-labelledby="npm-deps-heading" className="mt-10">
          <h2
            id="npm-deps-heading"
            className="text-xs font-semibold tracking-wider uppercase text-on-surface-variant mb-3"
          >
            npm Dependencies
          </h2>

          {hasNpmDeps ? (
            data.npmDeps.map((dep) => (
              <DepRow
                key={dep.name}
                name={dep.name}
                version={dep.version}
                license={dep.license}
                homepage={dep.homepage}
              />
            ))
          ) : (
            <p className="text-sm text-tertiary">
              Dependency list unavailable — run{" "}
              <code className="font-mono">npm run build</code> to regenerate.
            </p>
          )}
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* LICENSES/ link block                                             */}
        {/* ---------------------------------------------------------------- */}
        <a
          href={data.licensesUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View full LICENSES/ folder on GitHub (opens in new tab)"
          className={[
            "flex items-center gap-2 mt-8",
            "bg-surface-variant rounded-lg px-4 py-3",
            "text-sm font-medium text-primary-fixed no-underline",
            "hover:underline",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:rounded-lg",
          ].join(" ")}
        >
          <span aria-hidden="true">→</span>
          View full LICENSES/ folder on GitHub
        </a>

        {/* Footer */}
        <FooterNav />
      </div>
    </div>
  );
}
