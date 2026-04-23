import { Readability } from '@mozilla/readability';
import type { CanonicalSignals, ExtractionResult } from '../shared/types';

const BODY_CHAR_MIN = 50;
const PARA_TEXT_MIN = 20; // skip captions / short labels in fallback

// Ordered by specificity — first match wins in tryFallback()
const FALLBACK_SELECTORS = [
  'article',
  '[role="article"]',
  '[itemprop="articleBody"]',
  'section[name="articleBody"]',
  'main',
  '[data-testid="article-body"]',
  '[class*="article-body"]',
  '[class*="story-body"]',
  '[class*="post-content"]',
  '[class*="StoryBodyCompanion"]',
] as const;

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function countWords(text: string): number {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
}

const PUBLICATION_SUFFIX_RE = /\s*[-–|]\s*[^-–|]+$/

function cleanTitle(raw: string): string {
  return raw.replace(PUBLICATION_SUFFIX_RE, '').trim();
}

function resolveHref(href: string | null | undefined, baseUri: string): string | null {
  if (!href) return null;
  try {
    return new URL(href, baseUri).href;
  } catch {
    return null;
  }
}

function extractJsonLdUrl(doc: Document, baseUri: string): string | null {
  const ARTICLE_TYPES = new Set(['NewsArticle', 'Article', 'BlogPosting']);
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const parsed = JSON.parse(script.textContent ?? '') as Record<string, unknown>;
      const type = parsed['@type'];
      const types = Array.isArray(type) ? type : [type];
      if (!types.some((t) => typeof t === 'string' && ARTICLE_TYPES.has(t))) continue;
      // Try mainEntityOfPage first, then url
      const mep = parsed['mainEntityOfPage'];
      if (typeof mep === 'string' && mep.length > 0) return resolveHref(mep, baseUri);
      if (mep && typeof mep === 'object' && typeof (mep as Record<string, unknown>)['@id'] === 'string') {
        return resolveHref((mep as Record<string, unknown>)['@id'] as string, baseUri);
      }
      const url = parsed['url'];
      if (typeof url === 'string' && url.length > 0) return resolveHref(url, baseUri);
    } catch {
      // Malformed JSON-LD — skip
    }
  }
  return null;
}

export function extractCanonicalSignals(doc: Document): CanonicalSignals {
  const baseUri = doc.baseURI ?? '';
  return {
    linkCanonical: resolveHref(
      doc.querySelector('link[rel="canonical"]')?.getAttribute('href'),
      baseUri,
    ),
    jsonLdUrl: extractJsonLdUrl(doc, baseUri),
    ogUrl: resolveHref(
      doc.querySelector('meta[property="og:url"]')?.getAttribute('content'),
      baseUri,
    ),
    twitterUrl: resolveHref(
      doc.querySelector('meta[name="twitter:url"]')?.getAttribute('content'),
      baseUri,
    ),
  };
}

function makeResult(title: string, body: string, canonicalSignals: CanonicalSignals): ExtractionResult {
  if (body.length < BODY_CHAR_MIN) return { ok: false, error: 'extraction_failed' };
  return { ok: true, title, body, word_count: countWords(body), offsets: [{ start: 0, end: body.length }], canonicalSignals };
}

// SD-057: AMP runtime elements to strip from the Readability clone before
// scoring. These are the same elements in NOISE_SELECTORS but subset to the
// AMP-specific tags — class-pattern selectors are too broad to strip before
// Readability (they may match editorial containers on non-AMP sites).
const AMP_NOISE_SELECTORS =
  'amp-ad,amp-analytics,amp-inabox,amp-sidebar,amp-carousel,amp-story-page,amp-auto-ads,amp-sticky-ad'

function tryReadability(doc: Document): ExtractionResult {
  try {
    const cloned = doc.cloneNode(true) as Document;
    // Strip AMP noise elements before Readability scores the clone. Readability
    // does not know about custom elements and treats their inline text
    // (tracker config JSON, ad slot attributes) as content-bearing nodes.
    for (const el of cloned.querySelectorAll(AMP_NOISE_SELECTORS)) {
      el.parentNode?.removeChild(el);
    }
    const reader = new Readability(cloned, { charThreshold: 0 });
    const article = reader.parse();
    if (article === null) return { ok: false, error: 'extraction_failed' };
    return makeResult(cleanTitle((article.title ?? '').trim()), stripHtml(article.content ?? ''), extractCanonicalSignals(doc));
  } catch {
    return { ok: false, error: 'extraction_failed' };
  }
}

// Standard noise elements + AMP runtime elements (amp-ad, amp-analytics, etc.) that
// contribute tracker pixel text, ad config JSON, and attribute noise to raw textContent.
// Class-pattern selectors strip newsletter CTAs, related-content modules, and ad slots
// that compound on AMP pages but appear on non-AMP sites too.
const NOISE_SELECTORS = [
  'nav',
  'header',
  'footer',
  'aside',
  'form',
  'button',
  '[aria-hidden="true"]',
  '[role="complementary"]',
  // AMP runtime elements — SD-057
  'amp-ad',
  'amp-analytics',
  'amp-inabox',
  'amp-sidebar',
  'amp-carousel',
  'amp-story-page',
  'amp-auto-ads',
  'amp-sticky-ad',
  // Class-pattern noise — SD-057
  '[class*="newsletter"]',
  '[class*="related-"]',
  '[class*="recommended"]',
  '[class*="sticky"]',
  '[class*="ad-slot"]',
  '[class*="advertisement"]',
].join(',')

// Extract readable text from an element. Tries <p> tags first (precise);
// falls back to raw textContent after stripping known noise elements.
function extractTextFromElement(el: Element): string {
  const fromPs = Array.from(el.querySelectorAll('p'))
    .map((p) => (p.textContent ?? '').trim())
    .filter((t) => t.length >= PARA_TEXT_MIN)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (fromPs.length >= BODY_CHAR_MIN) return fromPs

  // <p>-based extraction failed — strip noise and use raw textContent.
  const clone = el.cloneNode(true) as Element
  for (const noise of clone.querySelectorAll(NOISE_SELECTORS)) {
    noise.parentNode?.removeChild(noise)
  }
  return (clone.textContent ?? '').replace(/\s+/g, ' ').trim()
}

// Selector-based fallback: walks common article containers and extracts text.
function tryFallback(doc: Document): ExtractionResult {
  const title = cleanTitle(doc.title ?? '');
  const signals = extractCanonicalSignals(doc);

  for (const sel of FALLBACK_SELECTORS) {
    const el = doc.querySelector(sel);
    if (!el) continue;

    const body = extractTextFromElement(el);
    const result = makeResult(title, body, signals);
    if (result.ok) return result;
  }

  // Last resort: sites that don't match any known container (JS-hydrated NYT
  // subsections, custom publication shells, etc). Walk every <p> in the doc,
  // keep only those substantial enough to be prose (skip captions and nav).
  const allParas = Array.from(doc.querySelectorAll('p'))
    .map((p) => (p.textContent ?? '').trim())
    .filter((t) => t.length >= PARA_TEXT_MIN)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  const whole = makeResult(title, allParas, signals);
  if (whole.ok) return whole;

  // SD-054: absolute last resort. Some news sites (Mother Jones, The Free
  // Press on Substack) render articles inside custom containers AND split
  // body copy across non-<p> elements (<div>, styled spans), so the <p>
  // walker yields < 50 chars. Strip known noise from the whole body and use
  // raw textContent. Lower quality than a targeted selector hit, but better
  // than telling the user "Couldn't read this page" on a real article.
  if (doc.body) {
    const bodyText = extractTextFromElement(doc.body);
    const bodyResult = makeResult(title, bodyText, signals);
    if (bodyResult.ok) return bodyResult;
  }

  return { ok: false, error: 'extraction_failed' };
}

/**
 * Tries Readability first; falls back to selector-based paragraph extraction
 * for sites where Readability's heuristics return null.
 */
export function extract(doc: Document): ExtractionResult {
  const primary = tryReadability(doc);
  if (primary.ok) return primary;
  return tryFallback(doc);
}
