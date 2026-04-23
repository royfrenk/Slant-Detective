import { francAll } from 'franc-min';
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
import { showReloadBanner } from './reload-banner'
import biasPhraseData from '../../public/assets/bias-phrases.json'

const BIAS_PHRASES: string[] = (biasPhraseData as { phrases: string[] }).phrases

// ---------------------------------------------------------------------------
// SD-058: Runtime-alive guard + lifecycle teardown
// ---------------------------------------------------------------------------

// Returns false when the extension context has been invalidated (e.g. after a
// dev reload or CWS auto-update). Accessing chrome.runtime.id throws in some
// edge cases, so the try/catch is intentional.
export function isRuntimeAlive(): boolean {
  try { return typeof chrome?.runtime?.id === 'string'; }
  catch { return false; }
}

// Aborts the waitForReadyState load listener if teardown fires while mid-wait.
const lifecycleController = new AbortController();

// Idempotency flag — prevents re-entry if multiple rapid events each see a
// dead runtime before teardown has finished.
let tornDown = false;

export function teardownContentScript(): void {
  if (tornDown) return;
  tornDown = true;
  chrome.runtime.onMessage.removeListener(onMessageHandler);
  lifecycleController.abort();
  unwireHighlightSync();
  destroyTooltip();
  cleanupHighlights();
  showReloadBanner();
}

// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Register onMessage listener FIRST (before any other async work). The service
// worker may send {action:'analyze'} the moment it opens the side panel, and a
// race where the CS has loaded but its listener isn't registered yet surfaces
// as "Could not establish connection. Receiving end does not exist." See SD-051.
// Tooltip init is deferred until after the listener is registered.
// ---------------------------------------------------------------------------

function onMessageHandler(
  message: Record<string, unknown>,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void,
): boolean {
  // SD-058: Detect invalidated extension context on first post-reload message.
  if (!isRuntimeAlive()) { teardownContentScript(); return false; }

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
}

chrome.runtime.onMessage.addListener(onMessageHandler);

// Initialize the tooltip host once on content script startup (runs once per page load).
// Deferred until after the onMessage listener is registered so the listener is
// live the moment the CS finishes parsing.
initTooltip()

// ---------------------------------------------------------------------------
// BABE lexicon — fetched once, cached for the lifetime of the content script.
// ---------------------------------------------------------------------------

let lexiconCache: ReturnType<typeof buildStemmedLexicon> | null = null;

async function getLexicon(): Promise<ReturnType<typeof buildStemmedLexicon>> {
  // SD-058: Degrade gracefully when the runtime is dead mid-flight.
  if (!isRuntimeAlive()) return lexiconCache ?? buildStemmedLexicon([]);
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

// Density-based — normalizes by article length so long articles don't
// auto-saturate at the 30-hit ceiling. Saturates at ~50 hits per 1000 words
// (5% density), which aligns with far-right / far-left outlet P75 after
// recalibration against the BABE corpus. See scripts/calibrate-intensity.mjs.
function computeLanguageIntensity(loadedWordCount: number, wordCount: number): number {
  if (wordCount === 0) return 0;
  const hitsPerKiloword = (loadedWordCount / wordCount) * 1000;
  return Math.min(10, hitsPerKiloword / 5);
}

// ---------------------------------------------------------------------------
// SD-047: News-page heuristic + language detection
// SD-053: Extended to cover NewsArticle subtypes (LiveBlogPosting, etc.),
// broader og:type values, URL-path signals, and a lower word-count floor so
// short legitimate articles aren't rejected.
// ---------------------------------------------------------------------------

// schema.org NewsArticle subtypes + common Article variants. LiveBlogPosting
// covers AP/Reuters/Guardian live coverage; the News*Article subtypes cover
// the explicit typings major outlets emit.
const NEWS_JSONLD_TYPES = new Set([
  'NewsArticle',
  'Article',
  'BlogPosting',
  'LiveBlogPosting',
  'ReportageNewsArticle',
  'AnalysisNewsArticle',
  'BackgroundNewsArticle',
  'OpinionNewsArticle',
  'ReviewNewsArticle',
  'Report',
]);

const NEWS_OG_TYPES = new Set(['article', 'article.live', 'news']);

// Explicit negative og:type signals — if a page declares itself as product,
// video, profile, etc., trust that declaration and reject immediately. Without
// this, the lowered word-count floor would let 150+ word product pages through.
const NON_NEWS_OG_TYPES = new Set([
  'product',
  'product.item',
  'product.group',
  'video',
  'video.movie',
  'video.episode',
  'video.tv_show',
  'video.other',
  'music',
  'music.song',
  'music.album',
  'music.playlist',
  'music.radio_station',
  'profile',
  'book',
  'website',
]);

// URL path segments that very strongly signal news coverage. Matches
// `/article/…`, `/live/…`, `/story/…`, `/news/…`, etc. — the conventions used
// across AP, Reuters, BBC, NYT, WaPo, Guardian.
const NEWS_URL_PATH_RE = /\/(article|articles|live|story|stories|news|blog|post|posts|opinion|opinions|editorial|feature|features)\//i;

// Significantly lower than the original 400-word floor. Short hard-news briefs
// (breaking alerts, wire updates) are legitimately < 400 words. 150 still
// filters out navigation shells, product pages, and SPA error states while
// accepting short articles.
const WORD_COUNT_FLOOR = 150;

export function isNewsPage(doc: Document, wordCount: number, url?: string): boolean {
  // Positive signals — any one is enough on its own.
  if (doc.querySelector('article') !== null) return true;

  const ogType = doc.querySelector('meta[property="og:type"]')?.getAttribute('content');
  if (ogType !== null && ogType !== undefined && NEWS_OG_TYPES.has(ogType)) return true;

  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const parsed = JSON.parse(script.textContent ?? '') as Record<string, unknown>;
      const type = parsed['@type'];
      const types = Array.isArray(type) ? (type as unknown[]) : [type];
      if (types.some((t) => typeof t === 'string' && NEWS_JSONLD_TYPES.has(t))) return true;
    } catch {
      // Malformed JSON-LD — skip this block
    }
  }

  // URL-path heuristic: `/article/…`, `/live/…`, etc. Strong enough by itself
  // because these paths are only used by outlets for actual editorial content.
  const href = url ?? doc.location?.href ?? '';
  if (href !== '' && NEWS_URL_PATH_RE.test(href)) return true;

  // Negative signal: if the page explicitly declares itself as product/video/
  // profile/etc. and none of the positive signals fired, trust the declaration
  // and reject — prevents the word-count floor from accepting long e-commerce
  // pages that happen to cross 150 words.
  if (ogType !== null && ogType !== undefined && NON_NEWS_OG_TYPES.has(ogType)) return false;

  return wordCount >= WORD_COUNT_FLOOR;
}

const LANG_CONFIDENCE_THRESHOLD = 0.5;

// SD-047 follow-up: franc-min's script detection only ships expressions for
// Latin, Cyrillic, Arabic, Devanagari, and a handful of language-specific
// scripts — Hebrew is notably absent, and mixed-script articles with any
// Latin embeds (English names, numerals, URLs) make Latin win franc's
// script vote, after which trigram matching picks 'eng' as the closest
// Latin language and the article sails through the non-English gate.
//
// This regex covers the scripts that are unambiguously non-English when
// present at any meaningful ratio: Greek, Cyrillic, Hebrew, Arabic,
// Devanagari, Thai, Hiragana, Katakana, CJK Unified Ideographs, Hangul.
// 5% coverage is well above incidental quotes (a single proper noun in a
// 2000-char English sample is < 1%) and catches predominantly non-Latin
// bodies even when English names dominate their first chars.
const NON_LATIN_SCRIPT_RE =
  /[Ͱ-ϿЀ-ӿ֐-׿؀-ۿऀ-ॿ฀-๿぀-ゟ゠-ヿ一-鿿가-힯]/g;
const NON_LATIN_SCRIPT_RATIO_THRESHOLD = 0.05;

export function isNonEnglish(body: string): boolean {
  const sample = body.slice(0, 2000);
  if (sample.length > 0) {
    const scriptMatches = sample.match(NON_LATIN_SCRIPT_RE);
    const scriptRatio = (scriptMatches?.length ?? 0) / sample.length;
    if (scriptRatio >= NON_LATIN_SCRIPT_RATIO_THRESHOLD) return true;
  }
  const results = francAll(sample);
  if (results.length === 0) return false;
  const [topLang, topScore] = results[0];
  return topLang !== 'eng' && topScore >= LANG_CONFIDENCE_THRESHOLD;
}

// ---------------------------------------------------------------------------
// Main analysis
// ---------------------------------------------------------------------------

// SD-054: Heavy-tracker sites (Mother Jones, The Free Press/Substack) ship
// large third-party bundles (Datadog RUM, Coral, pub.network, TrueAnthem)
// that keep the page busy past `document_idle` — when the panel fires
// `analyze`, extraction can run against a DOM where the article body hasn't
// been hydrated yet, so Readability + all selector fallbacks miss. Waiting
// for `document.readyState === 'complete'` before extracting fixes this
// with no cost on well-behaved sites (they're already 'complete' when the
// user opens the panel). Capped at 8s so pages that never fire `load` (rare
// broken sites) still surface a real error instead of hanging.
const READY_STATE_TIMEOUT_MS = 8_000;
// SD-057: AMP pages (menshealth.com/Hearst) hydrate much later than non-AMP
// pages due to the AMP runtime + heavy tracker load. Raise the cap to 14s for
// AMP pages only so extraction runs against a populated DOM.
const AMP_READY_STATE_TIMEOUT_MS = 14_000;

// SD-057: Detect AMP pages via the three cheapest O(1) DOM-attribute signals.
// Covers canonical AMP (html[amp]), emoji-AMP (html[⚡]), and AMP-to-web
// transformations that link to the canonical AMP URL.
export function isAmpPage(doc: Document): boolean {
  const html = doc.documentElement;
  return (
    html.hasAttribute('amp') ||
    html.hasAttribute('⚡') ||
    !!doc.querySelector('link[rel="amphtml"]')
  );
}

function waitForReadyState(doc: Document): Promise<void> {
  if (doc.readyState === 'complete') return Promise.resolve();
  const timeoutMs = isAmpPage(doc) ? AMP_READY_STATE_TIMEOUT_MS : READY_STATE_TIMEOUT_MS;
  return new Promise((resolve) => {
    const start = Date.now();
    const check = (): void => {
      if (doc.readyState === 'complete' || Date.now() - start >= timeoutMs) {
        window.removeEventListener('load', check);
        resolve();
        return;
      }
    };
    window.addEventListener('load', check, { once: true, signal: lifecycleController.signal });
    // Belt-and-braces timeout in case `load` already fired between the
    // readyState check and the listener being attached.
    setTimeout(check, timeoutMs);
  });
}

async function runAnalysis(): Promise<ContentScriptResult> {
  await waitForReadyState(document);

  const extraction = extract(document);

  const pageUrl = window.location.href;

  // SD-052: When extraction fails, still check the news-page gate before
  // surfacing `extraction_failed`. Many non-news pages (login walls, dashboards,
  // SPA shells) fail Readability but are not articles — those should route to
  // the "not a news page" card, not the generic extraction-failed error.
  if (!extraction.ok) {
    if (!isNewsPage(document, 0, pageUrl)) {
      return { ok: false, error: 'not_a_news_page' };
    }
    return extraction;
  }

  // SD-047: news-page gate (synchronous DOM check + word count + URL path)
  if (!isNewsPage(document, extraction.word_count, pageUrl)) {
    return { ok: false, error: 'not_a_news_page' };
  }

  // SD-047: language gate (trigram-based, runs on extracted body text)
  if (isNonEnglish(extraction.body)) {
    return { ok: false, error: 'non_english' };
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
    languageIntensity: computeLanguageIntensity(totalCount, extraction.word_count),
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
    canonicalSignals: extraction.canonicalSignals,
    layer1Signals,
  };
}
