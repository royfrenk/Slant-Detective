import React from 'react';
import { createRoot } from 'react-dom/client';
import './page.css';
import PageFooterNav from './page-footer-nav';

// ---------------------------------------------------------------------------
// Rubric dimensions
// ---------------------------------------------------------------------------

interface Dimension {
  label: string;
  glyph: string;
  description: string;
  note?: string;
}

const DIMENSIONS: readonly Dimension[] = [
  {
    label: 'WORD CHOICE',
    glyph: '⚠',
    description: 'Detects loaded, emotive, or partisan language that colours how information is delivered.',
    note: 'Scored against the BABE bias-word lexicon (cleaned and Porter-stemmed).',
  },
  {
    label: 'FRAMING',
    glyph: '◈',
    description: 'Evaluates the reporting-verb ladder and structural choices that shape the reader\'s interpretation.',
    note: 'Requires ≥ 400-word article body.',
  },
  {
    label: 'HEADLINE SLANT',
    glyph: '✎',
    description: 'Measures drift between the headline and the article body — exaggeration, omission, or spin.',
  },
  {
    label: 'SOURCE MIX',
    glyph: '\u201c',
    description: 'Assesses whether the article draws on a diverse range of sources or leans on a narrow set.',
  },
] as const;

// ---------------------------------------------------------------------------
// Reporting-verb rungs
// ---------------------------------------------------------------------------

interface VerbRung {
  rung: number;
  direction: string;
  examples: string;
}

const VERB_RUNGS: readonly VerbRung[] = [
  { rung: 1, direction: 'Neutral', examples: 'said, reported, stated' },
  { rung: 2, direction: 'Mildly charged', examples: 'suggested, noted, acknowledged' },
  { rung: 3, direction: 'Moderately charged', examples: 'claimed, insisted, pushed back' },
  { rung: 4, direction: 'Strongly charged', examples: 'slammed, blasted, accused' },
  { rung: 5, direction: 'Extreme', examples: 'lied, admitted guilt, confessed' },
] as const;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DimensionCard({ label, glyph, description, note }: Dimension): React.JSX.Element {
  return (
    <div className="bg-surface rounded-lg px-4 py-3 mb-2">
      <p className="text-sm font-semibold text-on-surface m-0">
        <span aria-hidden="true">{glyph} </span>{label}
      </p>
      <p className="text-xs text-on-surface-variant mt-1 mb-0">{description}</p>
      {note !== undefined && (
        <p className="text-xs text-on-surface-variant mt-1 mb-0">{note}</p>
      )}
    </div>
  );
}

function VerbRungCard({ rung, direction, examples }: VerbRung): React.JSX.Element {
  return (
    <div className="bg-surface rounded-lg px-4 py-3 mb-2">
      <div className="flex items-start gap-3">
        <span
          className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-on-primary"
          style={{ background: 'linear-gradient(135deg, #1e293b, #334155)' }}
          aria-hidden="true"
        >
          {rung}
        </span>
        <div>
          <p className="text-sm font-semibold text-on-surface m-0">Rung {rung} — {direction}</p>
          <p className="text-xs text-on-surface-variant mt-1 mb-0">{examples}</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

function HowWeMeasurePage(): React.JSX.Element {
  return (
    <div className="min-h-screen bg-background px-6 pt-8 pb-16">
      <div className="max-w-[560px] mx-auto">

        {/* Wordmark */}
        <header>
          <p className="font-bold text-sm tracking-widest uppercase text-primary mb-8 m-0">
            SLANT DETECTIVE
          </p>
        </header>

        <main>
          {/* Page title */}
          <h1 className="font-bold text-2xl text-primary mb-8 mt-0">
            How We Measure
          </h1>

          {/* Section 1 — The Rubric */}
          <section aria-labelledby="rubric-heading">
            <h2
              id="rubric-heading"
              className="text-xs font-semibold tracking-wider uppercase text-on-surface-variant mb-3"
            >
              The Rubric
            </h2>
            <p className="text-sm text-on-surface leading-relaxed mb-3">
              Every analysis scores an article on four dimensions, each rated 0–4. Together
              they form a composite picture of the article's tilt and intensity.
            </p>
            {DIMENSIONS.map((d) => (
              <DimensionCard key={d.label} {...d} />
            ))}
          </section>

          {/* Section 2 — Reporting-Verb Ladder */}
          <section aria-labelledby="verb-ladder-heading" className="mt-10">
            <h2
              id="verb-ladder-heading"
              className="text-xs font-semibold tracking-wider uppercase text-on-surface-variant mb-3"
            >
              Reporting-Verb Ladder
            </h2>
            <p className="text-sm text-on-surface leading-relaxed mb-3">
              The framing dimension uses a five-rung scale to assess the emotional weight
              of attribution verbs used throughout the article.
            </p>
            {VERB_RUNGS.map((r) => (
              <VerbRungCard key={r.rung} {...r} />
            ))}
          </section>

          {/* Section 3 — Known Limitations */}
          <section aria-labelledby="limitations-heading" className="mt-10">
            <h2
              id="limitations-heading"
              className="text-xs font-semibold tracking-wider uppercase text-on-surface-variant mb-3"
            >
              Known Limitations
            </h2>
            <p className="text-sm text-on-surface leading-relaxed mb-3">
              Inter-rater agreement ceiling: κ ≈ 0.4 at full rubric. This is expected for
              subjective bias annotation tasks and is consistent with published benchmarks.
            </p>
            <p className="text-sm text-on-surface leading-relaxed mb-3">
              Span miss rate: approximately 15% of bias spans go undetected by Layer 1
              lexical matching. Layer 2 (Claude Haiku) catches more; neither is exhaustive.
            </p>
            <p className="text-sm text-on-surface leading-relaxed mb-3">
              Word-count floor: articles under 400 words receive a "too short for analysis"
              result rather than a bias score.
            </p>
          </section>

          {/* Section 4 — BABE Agreement Metrics */}
          <section aria-labelledby="babe-heading" className="mt-10">
            <h2
              id="babe-heading"
              className="text-xs font-semibold tracking-wider uppercase text-on-surface-variant mb-3"
            >
              BABE Agreement Metrics
            </h2>
            <p className="text-sm text-on-surface leading-relaxed mb-3">
              Slant Detective's rubric (v1.0) was evaluated against the full BABE
              corpus — 3,663 expert-labeled sentences — using Claude Haiku 4.5. The
              harness computes Cohen's κ for binary bias classification and
              precision/recall/F1 for biased-word span detection. Full harness and
              baseline file are committed in <code>eval/</code>.
            </p>
            <div className="bg-surface-variant rounded-lg px-4 py-3">
              <table className="w-full text-sm text-on-surface">
                <thead>
                  <tr className="text-left border-b border-outline">
                    <th className="py-1 pr-4 font-semibold">Metric</th>
                    <th className="py-1 pr-4 font-semibold">Score</th>
                    <th className="py-1 font-semibold text-on-surface-variant">Floor</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-1 pr-4">Cohen's κ (classification)</td>
                    <td className="py-1 pr-4 font-mono">0.58</td>
                    <td className="py-1 font-mono text-on-surface-variant">≥ 0.35</td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-4">Precision (classification)</td>
                    <td className="py-1 pr-4 font-mono">0.76</td>
                    <td className="py-1 font-mono text-on-surface-variant">—</td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-4">Recall (classification)</td>
                    <td className="py-1 pr-4 font-mono">0.84</td>
                    <td className="py-1 font-mono text-on-surface-variant">—</td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-4">F1 (classification)</td>
                    <td className="py-1 pr-4 font-mono">0.80</td>
                    <td className="py-1 font-mono text-on-surface-variant">≥ 0.50</td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-4">F1 (biased-span detection)</td>
                    <td className="py-1 pr-4 font-mono">0.65</td>
                    <td className="py-1 font-mono text-on-surface-variant">—</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-on-surface-variant italic mt-2">
              Baseline run 2026-04-20, rubric v1.0. Future prompt changes must keep
              κ within 0.03 of this floor or the regression gate blocks release.
            </p>
          </section>

          {/* Section 5 — Evidence Requirement */}
          <section aria-labelledby="evidence-heading" className="mt-10">
            <h2
              id="evidence-heading"
              className="text-xs font-semibold tracking-wider uppercase text-on-surface-variant mb-3"
            >
              Evidence Requirement
            </h2>
            <p className="text-sm text-on-surface leading-relaxed mb-3">
              Every dimension score must be accompanied by a quoted evidence span from the
              article. Layer 2 (Claude Haiku) provides these spans directly. The client
              validates that each score has at least one evidence quote before accepting a
              response — no score is displayed without justification.
            </p>
            <p className="text-sm text-on-surface leading-relaxed mb-3">
              Layer 1 (in-browser) flags spans using the BABE lexicon match. No spans are
              fabricated — misses are surfaced as gaps, not invented evidence.
            </p>
          </section>
        </main>

        <PageFooterNav currentPage="how-we-measure" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------

const container = document.getElementById('root');
if (container !== null) {
  createRoot(container).render(<HowWeMeasurePage />);
}
