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
import { useDistribution } from '../layer2/use-distribution';
import { getPercentileLabel } from '../layer2/percentile-utils';
import Layer1DimRationales from './layer1-dim-rationales';

const MIN_WORDS_FOR_ANALYSIS = 400;

interface Layer1OverallCardProps {
  signals: Layer1Signals;
}

function Layer1OverallCard({ signals }: Layer1OverallCardProps): React.JSX.Element {
  const distribution = useDistribution('layer1');
  // Use language intensity as a proxy score for percentile lookup in Layer 1
  const percentileLabel = getPercentileLabel(signals.languageIntensity, distribution?.overall ?? null);
  const rationale = getLayer1OverallRationale(signals);

  return (
    <div
      role="region"
      aria-label="Signal summary"
      className="bg-surface rounded-[10px] shadow-ambient p-4 flex flex-col gap-2"
    >
      <span className="text-[0.625rem] font-bold text-on-surface-variant uppercase tracking-[0.1em]">
        SIGNAL SUMMARY
      </span>
      {percentileLabel != null && (
        <p className="text-[0.75rem] font-normal text-on-surface-variant leading-tight m-0">
          {percentileLabel}
        </p>
      )}
      <RationalePanel
        text={rationale}
        id="layer1-overall-rationale-panel"
        animated={false}
        marginTop="mt-2"
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
          <Layer1DimRationales signals={signals} />
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
