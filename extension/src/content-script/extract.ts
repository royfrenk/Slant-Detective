import { Readability } from '@mozilla/readability';
import type { ExtractionResult } from '../shared/types';

const BODY_CHAR_MIN = 50;
const PARA_TEXT_MIN = 20; // skip captions / short labels in fallback

// Ordered by specificity — first match wins in tryFallback()
const FALLBACK_SELECTORS = [
  'article',
  '[role="article"]',
  '[itemprop="articleBody"]',
  'main',
  '[data-testid="article-body"]',
  '[class*="article-body"]',
  '[class*="story-body"]',
  '[class*="post-content"]',
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

function makeResult(title: string, body: string): ExtractionResult {
  if (body.length < BODY_CHAR_MIN) return { ok: false, error: 'extraction_failed' };
  return { ok: true, title, body, word_count: countWords(body), offsets: [{ start: 0, end: body.length }] };
}

function tryReadability(doc: Document): ExtractionResult {
  try {
    const cloned = doc.cloneNode(true) as Document;
    const reader = new Readability(cloned, { charThreshold: 0 });
    const article = reader.parse();
    if (article === null) return { ok: false, error: 'extraction_failed' };
    return makeResult(cleanTitle((article.title ?? '').trim()), stripHtml(article.content ?? ''));
  } catch {
    return { ok: false, error: 'extraction_failed' };
  }
}

const NOISE_SELECTORS = 'nav,header,footer,aside,form,button,[aria-hidden="true"],[role="complementary"]'

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

  for (const sel of FALLBACK_SELECTORS) {
    const el = doc.querySelector(sel);
    if (!el) continue;

    const body = extractTextFromElement(el);
    const result = makeResult(title, body);
    if (result.ok) return result;
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
