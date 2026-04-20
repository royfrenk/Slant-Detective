import React from 'react';
import type { Layer1Signals } from '../../shared/types';
import SourceStrip from './source-strip';
import IntensityBars from './intensity-bars';
import LoadedWords from './loaded-words';
import TooShortCard from './too-short-card';
import UpsellRow from './upsell-row';
import FooterNav from '../footer-nav';

const MIN_WORDS_FOR_ANALYSIS = 400;

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
