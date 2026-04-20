import React from 'react';
import type { Layer1Signals, RubricResponse } from '../../shared/types';
import SourceStrip from '../layer1/source-strip';
import TooShortCardL2 from './too-short-card-l2';
import OverallScoreCard from './overall-score-card';
import DimensionBreakdown from './dimension-breakdown';
import EvidenceList from './evidence-list';
import FooterNav from '../footer-nav';

const MIN_WORDS_FOR_ANALYSIS = 400;

interface Layer2ViewProps {
  result: RubricResponse;
  layer1Signals: Layer1Signals;
}

export default function Layer2View({
  result,
  layer1Signals,
}: Layer2ViewProps): React.JSX.Element {
  const tooShort = layer1Signals.wordCount < MIN_WORDS_FOR_ANALYSIS;

  return (
    <div data-testid="layer2-view" className="flex flex-col gap-2">
      <SourceStrip domain={layer1Signals.domain} />

      {tooShort ? (
        <TooShortCardL2 wordCount={layer1Signals.wordCount} />
      ) : (
        <>
          <OverallScoreCard
            score={result.overall.intensity}
            direction={result.overall.direction}
            confidence={result.overall.confidence}
          />
          <DimensionBreakdown dims={result.dimensions} />
          <EvidenceList items={result.spans} />
        </>
      )}

      <FooterNav />
    </div>
  );
}
