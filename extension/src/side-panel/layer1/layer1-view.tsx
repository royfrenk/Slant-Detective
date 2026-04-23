import React from 'react';
import type { Layer1Signals } from '../../shared/types';
import SourceStrip from './source-strip';
import IntensityBars from './intensity-bars';
import LoadedWords from './loaded-words';
import TooShortCard from './too-short-card';
import UpsellRow from './upsell-row';
import FooterNav from '../footer-nav';
import RationalePanel from '../layer2/rationale-panel';
import { getLayer1OverallRationale } from '../layer2/layer1-rationale';
import { getLayer1NeutralityLabel } from '../layer2/percentile-utils';

const MIN_WORDS_FOR_ANALYSIS = 400;

interface Layer1OverallCardProps {
  signals: Layer1Signals;
}

function Layer1OverallCard({ signals }: Layer1OverallCardProps): React.JSX.Element {
  // Use language intensity as the Layer 1 score (proxied to a 0–10 integer).
  const score = signals.languageIntensity;
  const scoreLabel = Math.round(score).toString();
  const neutralityLabel = getLayer1NeutralityLabel(score);
  const rationale = getLayer1OverallRationale(signals);

  // SD-056: Bold the comparative word ("more" / "less") or "median" for
  // at-a-glance direction cueing.
  const neutralityCopy =
    neutralityLabel.kind === 'median' ? (
      <>
        <strong className="font-semibold text-on-surface">median</strong>{' '}
        neutrality for news articles
      </>
    ) : (
      <>
        <strong className="font-semibold text-on-surface">{neutralityLabel.emphasis}</strong>{' '}
        neutral than {neutralityLabel.percentage}% of articles
      </>
    );

  return (
    <div
      role="region"
      aria-label="Signal summary"
      className="bg-surface rounded-[10px] shadow-ambient p-4 flex flex-col gap-2"
    >
      <span className="text-[0.625rem] font-bold text-on-surface-variant uppercase tracking-[0.1em]">
        SIGNAL SUMMARY
      </span>
      <span
        className="text-[2.25rem] font-black text-primary leading-none"
        aria-label={`Signal score: ${scoreLabel} out of 10`}
      >
        {scoreLabel}
      </span>
      <p className="text-[0.75rem] font-normal text-on-surface-variant leading-tight m-0">
        {neutralityCopy}
      </p>
      <RationalePanel
        text={rationale}
        id="layer1-overall-rationale-panel"
        animated={false}
        marginTop="mt-0"
      />
    </div>
  );
}

interface Layer1ViewProps {
  signals: Layer1Signals;
  hasApiKey: boolean;
}

export default function Layer1View({ signals, hasApiKey }: Layer1ViewProps): React.JSX.Element {
  const tooShort = signals.wordCount < MIN_WORDS_FOR_ANALYSIS;

  return (
    <div className="flex flex-col gap-2">
      <SourceStrip domain={signals.domain} />

      {tooShort ? (
        <TooShortCard wordCount={signals.wordCount} />
      ) : (
        <>
          <Layer1OverallCard signals={signals} />
          <IntensityBars signals={signals} />
          <LoadedWords loadedWords={signals.loadedWords} />
        </>
      )}

      {!hasApiKey && <UpsellRow />}

      <div className="mt-2">
        <FooterNav />
      </div>
    </div>
  );
}
