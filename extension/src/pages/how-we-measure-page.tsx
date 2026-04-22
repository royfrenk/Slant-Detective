import React from 'react';
import { createRoot } from 'react-dom/client';
import './page.css';
import PageFooterNav from './page-footer-nav';
import { DIMENSIONS } from '../shared/dimension-copy';
import type { DimensionCopy } from '../shared/dimension-copy';

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
// Accuracy table rows
// ---------------------------------------------------------------------------

interface AccuracyRow {
  metric: string;
  scores: { haiku: string; gemini: string; openai: string };
  plainEnglish: string;
}

const ACCURACY_ROWS: readonly AccuracyRow[] = [
  {
    metric: 'Agreement with experts',
    scores: { haiku: '0.58', gemini: '0.57', openai: '0.32' },
    plainEnglish: 'We agree with the human labelers about as often as two experts agree with each other.',
  },
  {
    metric: 'Precision',
    scores: { haiku: '0.76', gemini: '0.73', openai: '0.60' },
    plainEnglish: 'When we flag a sentence as biased, we’re right about 3 times out of 4.',
  },
  {
    metric: 'Recall',
    scores: { haiku: '0.84', gemini: '0.90', openai: '0.94' },
    plainEnglish: 'We catch about 5 out of every 6 sentences the experts flagged.',
  },
  {
    metric: 'Combined accuracy',
    scores: { haiku: '0.80', gemini: '0.81', openai: '0.74' },
    plainEnglish: 'A single number that balances precision and recall. In line with published research.',
  },
  {
    metric: 'Highlighted-word accuracy',
    scores: { haiku: '0.65', gemini: '0.70', openai: '0.52' },
    plainEnglish: 'When we highlight specific loaded words, about 2 out of 3 match what a human would highlight.',
  },
] as const;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DimensionCard({
  label,
  glyph,
  description,
  example,
  accentBorderClass,
  accentTextClass,
}: DimensionCopy): React.JSX.Element {
  return (
    <div className={`bg-surface rounded-lg border-l-4 ${accentBorderClass} px-4 py-3 mb-2`}>
      <p className={`text-sm font-semibold ${accentTextClass} m-0`}>
        <span aria-hidden="true">{glyph} </span>{label}
      </p>
      <p className="text-xs text-on-surface-variant mt-1 mb-0">{description}</p>
      {example !== undefined && (
        <p className="text-xs text-on-surface-variant italic mt-1 mb-0">{example}</p>
      )}
    </div>
  );
}

function VerbRungCard({ rung, direction, examples }: VerbRung): React.JSX.Element {
  return (
    <div className="bg-surface rounded-lg px-4 py-3 mb-2">
      <div className="flex items-start gap-3">
        <span
          className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-on-primary bg-dim-framing"
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
      <div className="max-w-[720px] mx-auto">

        {/* Wordmark */}
        <header>
          <p className="text-[0.875rem] font-black uppercase tracking-wordmark text-primary mb-8 m-0">
            SLANT DETECTIVE
          </p>
        </header>

        <main>
          {/* Page title */}
          <h1 className="font-bold text-2xl text-primary mb-8 mt-0">
            How We Measure
          </h1>

          <p className="text-sm text-on-surface leading-relaxed mb-10">
            Every article gets a short bias readout. We try to show you <strong>what</strong> looks
            slanted, <strong>where</strong> in the article it shows up, and <strong>how strongly</strong>{' '}
            we think it's slanted — so you can make your own call.
          </p>

          {/* Section 1 — The Rubric */}
          <section aria-labelledby="rubric-heading">
            <h2
              id="rubric-heading"
              className="text-xs font-semibold tracking-wider uppercase text-on-surface-variant mb-3"
            >
              The four things we look at
            </h2>
            <p className="text-sm text-on-surface leading-relaxed mb-3">
              Each dimension gets a 0–10 score. Together they give you a snapshot of the
              article's tilt and intensity.
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
              A closer look at verbs
            </h2>
            <p className="text-sm text-on-surface leading-relaxed mb-3">
              The framing score leans heavily on how reporters introduce what people said. Here's
              the ladder, from plain to loaded — the higher the rung, the more the verb itself pushes
              you toward a conclusion.
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
              What we can't do
            </h2>
            <p className="text-sm text-on-surface leading-relaxed mb-3">
              <strong>Bias isn't a fact, it's a judgment.</strong> Even trained human
              reviewers only agree with each other part of the time on the same passages. Treat our
              score as a signal, not a verdict.
            </p>
            <p className="text-sm text-on-surface leading-relaxed mb-3">
              <strong>We miss things.</strong> Our fast in-browser scan catches most loaded language.
              The deeper scan — which uses Claude when you add your own API key — catches more.
              Neither is exhaustive.
            </p>
            <p className="text-sm text-on-surface leading-relaxed mb-3">
              <strong>Very short articles get skipped.</strong> Under 400 words, there isn't
              enough to work with, so we don't score it.
            </p>
          </section>

          {/* Section 4 — Accuracy */}
          <section id="per-model-accuracy" aria-labelledby="accuracy-heading" className="mt-10">
            <h2
              id="accuracy-heading"
              className="text-xs font-semibold tracking-wider uppercase text-on-surface-variant mb-3"
            >
              How well it works
            </h2>
            <p className="text-sm text-on-surface leading-relaxed mb-3">
              We tested our rubric against a research dataset called{' '}
              <a
                href="https://github.com/Media-Bias-Group/Neural-Media-Bias-Detection-Using-Distant-Supervision-With-BABE"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="BABE dataset repository (opens in new tab)"
                className="text-primary-fixed no-underline hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:rounded-sm"
              >
                <strong>BABE</strong>
              </a>{' '}
              — 3,663 sentences that media-bias researchers labeled by hand. Here's how the three
              supported models compare, with each score translated into plain English.
            </p>
            <div className="bg-surface-variant rounded-lg border-l-4 border-primary-fixed px-4 py-3">
              <table className="w-full text-sm text-on-surface">
                <thead>
                  <tr className="text-left border-b border-outline align-bottom">
                    <th className="py-1 pr-4 font-semibold">What we measured</th>
                    <th className="py-1 pr-4 font-semibold text-right">
                      <span className="block">Claude Haiku</span>
                      <span className="block text-[0.625rem] font-normal text-on-surface-variant">
                        baseline
                      </span>
                    </th>
                    <th className="py-1 pr-4 font-semibold text-right">
                      <span className="block">Gemini 2.5 Flash</span>
                      <span className="block text-[0.625rem] font-normal text-primary-fixed">
                        ✓ parity
                      </span>
                    </th>
                    <th className="py-1 pr-4 font-semibold text-right">
                      <span className="block">GPT-4o-mini</span>
                      <span className="block text-[0.625rem] font-normal text-tertiary">
                        ✗ below parity
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ACCURACY_ROWS.map((row) => (
                    <React.Fragment key={row.metric}>
                      <tr>
                        <td className="pt-2 pr-4 align-top">{row.metric}</td>
                        <td className="pt-2 pr-4 font-mono align-top text-right">{row.scores.haiku}</td>
                        <td className="pt-2 pr-4 font-mono align-top text-right">{row.scores.gemini}</td>
                        <td className="pt-2 pr-4 font-mono align-top text-right">{row.scores.openai}</td>
                      </tr>
                      <tr>
                        <td colSpan={4} className="pb-2 pt-0 text-xs text-on-surface-variant italic">
                          {row.plainEnglish}
                        </td>
                      </tr>
                    </React.Fragment>
                  ))}
                  <tr className="border-t border-outline">
                    <td className="pt-2 pr-4 text-xs text-on-surface-variant">Sentences evaluated</td>
                    <td className="pt-2 pr-4 font-mono text-xs text-on-surface-variant text-right">3,663</td>
                    <td className="pt-2 pr-4 font-mono text-xs text-on-surface-variant text-right">487</td>
                    <td className="pt-2 pr-4 font-mono text-xs text-on-surface-variant text-right">500</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-on-surface-variant italic mt-2">
              Baseline run 2026-04-20, rubric v1.0. Non-baseline models evaluated on BABE-SG2
              (~500 sentences), a held-out subset — smaller than the full 3,663-sentence baseline.
              Parity gate: κ within ±0.05 and F1 within ±0.03 of the Claude Haiku baseline.
              GPT-4o-mini did not pass (κ 0.32 vs baseline 0.58). If a future prompt change drops
              these scores, the build gate blocks the release. Testing code lives in{' '}
              <code>eval/</code> — you can re-run it.
            </p>
          </section>

          {/* Section 5 — Evidence Requirement */}
          <section aria-labelledby="evidence-heading" className="mt-10">
            <h2
              id="evidence-heading"
              className="text-xs font-semibold tracking-wider uppercase text-on-surface-variant mb-3"
            >
              Every score comes with a receipt
            </h2>
            <p className="text-sm text-on-surface leading-relaxed mb-3">
              We never show you a number without the sentence it's based on. Hover any
              highlight in the article and you'll see the exact quote that earned it. If you
              think we got it wrong, the raw material is right there — judge for yourself.
            </p>
            <p className="text-sm text-on-surface leading-relaxed mb-3">
              Nothing is made up. We only highlight words that are actually in the article, and if
              the deeper scan can't back up a score with a quote, we don't show the score.
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
