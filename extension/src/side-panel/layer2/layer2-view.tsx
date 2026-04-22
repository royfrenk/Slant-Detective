import React from 'react';
import type { Layer1Signals, RubricResponse } from '../../shared/types';
import SourceStrip from '../layer1/source-strip';
import TooShortCardL2 from './too-short-card-l2';
import OverallScoreCard from './overall-score-card';
import DimensionBreakdown from './dimension-breakdown';
import EvidenceList from './evidence-list';
import FooterNav from '../footer-nav';
import { useDistribution } from './use-distribution';
import { getPercentileLabel } from './percentile-utils';

const MIN_WORDS_FOR_ANALYSIS = 400;

// Derive a ProviderKey from rubric_version string.
// v1.x -> anthropic; rubric_vX.X-openai -> openai; rubric_vX.X-gemini -> gemini
function providerFromVersion(rubricVersion: string): 'anthropic' | 'openai' | 'gemini' {
  if (rubricVersion.endsWith('-openai')) return 'openai'
  if (rubricVersion.endsWith('-gemini')) return 'gemini'
  return 'anthropic'
}

interface Layer2ViewProps {
  result: RubricResponse;
  layer1Signals: Layer1Signals;
}

export default function Layer2View({
  result,
  layer1Signals,
}: Layer2ViewProps): React.JSX.Element {
  const tooShort = layer1Signals.wordCount < MIN_WORDS_FOR_ANALYSIS;
  const provider = providerFromVersion(result.rubric_version);
  const distribution = useDistribution(provider);

  const percentileLabel = getPercentileLabel(
    result.overall.intensity,
    distribution?.overall ?? null,
  );

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
            percentileLabel={percentileLabel}
            rationale={result.overall.rationale}
          />
          <DimensionBreakdown dims={result.dimensions} />
          <EvidenceList items={result.spans} />
        </>
      )}

      <FooterNav />
    </div>
  );
}
