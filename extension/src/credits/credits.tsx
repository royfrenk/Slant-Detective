import React from "react";
import creditsData from "../../assets/credits.json";
import DepRow from "./dep-row";

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
// Footer nav triad
// TODO SD-Week4: wire how-we-measure.html, privacy.html, source code links
// ---------------------------------------------------------------------------

function FooterNav(): React.JSX.Element {
  return (
    <nav
      className="mt-12 border-t border-outline pt-4"
      aria-label="Footer navigation"
    >
      <div className="flex flex-wrap items-center gap-0 text-xs text-on-surface-variant">
        <a
          href="#"
          onClick={(e) => e.preventDefault()}
          aria-label="How we measure bias"
          className="text-on-surface-variant no-underline hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:rounded-sm"
        >
          How we measure
        </a>
        <span className="mx-2 select-none" aria-hidden="true">·</span>
        <a
          href="#"
          onClick={(e) => e.preventDefault()}
          aria-label="Privacy policy"
          className="text-on-surface-variant no-underline hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:rounded-sm"
        >
          Privacy
        </a>
        <span className="mx-2 select-none" aria-hidden="true">·</span>
        {/* Current page — not a link */}
        <span
          className="text-xs font-semibold text-primary"
          aria-current="page"
        >
          Credits
        </span>
        <span className="mx-2 select-none" aria-hidden="true">·</span>
        <a
          href="https://github.com/royfrenk/Slant-Detective"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Source code on GitHub (opens in new tab)"
          className="text-on-surface-variant no-underline hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:rounded-sm"
        >
          Source code (GitHub)
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
      <div className="max-w-[560px] mx-auto">

        {/* Wordmark */}
        <p className="font-bold text-sm tracking-widest uppercase text-primary mb-8 m-0">
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
