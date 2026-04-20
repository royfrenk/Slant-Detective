import type { ContentScriptResult } from '../shared/messages';
import type {
  Layer1Signals,
  LoadedWordsResult,
  HedgeResult,
  AttributionReport,
  EvidenceSpan,
  RubricSpan,
} from '../shared/types';
import { buildStemmedLexicon } from '../layer1/lexicon';
import { countLoadedWords } from '../layer1/loaded-words';
import { countLoadedPhrases, PHRASE_WEIGHT } from '../layer1/loaded-phrases';
import { countHedges } from '../layer1/hedge-counter';
import { analyzeAttribution } from '../layer1/reporting-verbs';
import { computeHeadlineDrift } from '../layer1/embedding-drift';
import { extract } from './extract'
import { anchorSpans } from './anchor'
import { injectHighlights, cleanupHighlights } from './highlight-injector'
import { initTooltip, wireTooltipEvents, destroyTooltip } from './tooltip'
import { wireHighlightSync, unwireHighlightSync } from './highlight-sync'
import biasPhraseData from '../../public/assets/bias-phrases.json'

const BIAS_PHRASES: string[] = (biasPhraseData as { phrases: string[] }).phrases

// Adapts RubricSpan (LLM output schema) to EvidenceSpan (DOM/anchor schema).
// Maps field renames: offset_start→start, offset_end→end, loaded_language→word_choice.
function rubricSpanToEvidence(s: RubricSpan): EvidenceSpan {
  return {
    id: s.id,
    text: s.text,
    start: s.offset_start,
    end: s.offset_end,
    category: s.category === 'loaded_language' ? 'word_choice' : s.category,
    severity: s.severity,
    tilt: s.tilt,
    reason: s.reason,
  }
}

// Initialize the tooltip host once on content script startup (runs once per page load).
initTooltip()

// ---------------------------------------------------------------------------
// BABE lexicon — fetched once, cached for the lifetime of the content script.
// ---------------------------------------------------------------------------

let lexiconCache: ReturnType<typeof buildStemmedLexicon> | null = null;

async function getLexicon(): Promise<ReturnType<typeof buildStemmedLexicon>> {
  if (lexiconCache !== null) return lexiconCache;

  const url = chrome.runtime.getURL('assets/babe-lexicon.json');
  const resp = await fetch(url);
  const data = await resp.json() as { entries: string[] };
  lexiconCache = buildStemmedLexicon(data.entries);
  return lexiconCache;
}

// ---------------------------------------------------------------------------
// Zero-value fallbacks for graceful degradation via Promise.allSettled
// ---------------------------------------------------------------------------

const FALLBACK_LOADED_WORDS: LoadedWordsResult = {
  hits: [],
  uniqueSurfaces: [],
  count: 0,
};

const FALLBACK_HEDGES: HedgeResult = {
  hits: [],
  count: 0,
};

const FALLBACK_ATTRIBUTION: AttributionReport = {
  totalAttributions: 0,
  tierCounts: [0, 0, 0, 0],
  byActor: {},
};

// ---------------------------------------------------------------------------
// Score helpers (mirror IntensityBars scoring)
// ---------------------------------------------------------------------------

function computeLanguageIntensity(loadedWordCount: number): number {
  return Math.min(10, loadedWordCount / 3);
}

// ---------------------------------------------------------------------------
// Main analysis
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.action === 'apply_highlights') {
    // Remove any prior session's highlights and tooltip, then re-anchor and inject.
    destroyTooltip()
    unwireHighlightSync()
    cleanupHighlights()
    // Re-initialize tooltip host (destroyTooltip removed it) before wiring events.
    initTooltip()
    const evidence: EvidenceSpan[] = (message.spans as RubricSpan[]).map(rubricSpanToEvidence)
    const anchored = anchorSpans(evidence, document)
    injectHighlights(anchored)
    wireTooltipEvents(anchored)
    wireHighlightSync()
    return false
  }

  if (message?.action !== 'analyze') {
    return false;
  }

  runAnalysis().then(sendResponse).catch(() => {
    const fallback: ContentScriptResult = {
      ok: false,
      error: 'extraction_failed',
    };
    sendResponse(fallback);
  });

  // Return true to keep the message channel open for the async sendResponse.
  return true;
});

async function runAnalysis(): Promise<ContentScriptResult> {
  const extraction = extract(document);

  if (!extraction.ok) {
    return extraction;
  }

  // Extract domain from current page URL.
  const domain = window.location.hostname.replace(/^www\./, '');

  // Run all Layer 1 signals in parallel — allSettled ensures one failure doesn't
  // block the others from reporting.
  const [lexiconSettled, driftSettled, attributionSettled, hedgesSettled] =
    await Promise.allSettled([
      getLexicon(),
      computeHeadlineDrift(extraction.title, extraction.body),
      Promise.resolve(analyzeAttribution(extraction.body)),
      Promise.resolve(countHedges(extraction.body)),
    ]);

  const lexicon = lexiconSettled.status === 'fulfilled' ? lexiconSettled.value : null;

  // countLoadedWords requires the lexicon — run it after lexicon resolves.
  const loadedWordsResult: LoadedWordsResult =
    lexicon !== null
      ? countLoadedWords(extraction.body, lexicon)
      : FALLBACK_LOADED_WORDS;

  const phraseHits = countLoadedPhrases(extraction.body, BIAS_PHRASES)

  const phraseSurfaces = [...new Set(phraseHits.map(h => h.phrase))]
  const mergedUniqueSurfaces = [
    ...loadedWordsResult.uniqueSurfaces,
    ...phraseSurfaces.filter(p => !loadedWordsResult.uniqueSurfaces.includes(p)),
  ]

  const totalCount = loadedWordsResult.count + phraseHits.length * PHRASE_WEIGHT

  const mergedLoadedWords: LoadedWordsResult = {
    hits: loadedWordsResult.hits,
    uniqueSurfaces: mergedUniqueSurfaces,
    count: totalCount,
  }

  const attribution: AttributionReport =
    attributionSettled.status === 'fulfilled'
      ? attributionSettled.value
      : FALLBACK_ATTRIBUTION;

  const hedges: HedgeResult =
    hedgesSettled.status === 'fulfilled' ? hedgesSettled.value : FALLBACK_HEDGES;

  const headlineDrift =
    driftSettled.status === 'fulfilled'
      ? driftSettled.value
      : { score: 0, interpretation: 'low' as const };

  const layer1Signals: Layer1Signals = {
    domain,
    wordCount: extraction.word_count,
    languageIntensity: computeLanguageIntensity(totalCount),
    loadedWords: mergedLoadedWords,
    hedges,
    attribution,
    headlineDrift,
  };

  return {
    ok: true,
    title: extraction.title,
    body: extraction.body,
    word_count: extraction.word_count,
    offsets: extraction.offsets,
    layer1Signals,
  };
}
