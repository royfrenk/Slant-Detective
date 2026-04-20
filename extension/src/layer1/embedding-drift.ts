/**
 * embedding-drift.ts
 *
 * Public API for headline ↔ body embedding drift.
 *
 * - Checks chrome.storage.session for a cached result before spawning the worker.
 * - Spawns a single Web Worker (module-level singleton) on first call.
 * - On worker error: returns graceful-degradation result { score: 0, interpretation: 'low' }.
 * - Interpretation thresholds (per SD-012 spec):
 *     score < 0.2  → 'low'
 *     score < 0.5  → 'medium'
 *     score >= 0.5 → 'high'
 */

import type { HeadlineDrift, EmbedRequest, EmbedResponse } from '../shared/types';

// ---------------------------------------------------------------------------
// Interpretation
// ---------------------------------------------------------------------------

export function interpretDriftScore(score: number): HeadlineDrift['interpretation'] {
  if (score < 0.2) return 'low';
  if (score < 0.5) return 'medium';
  return 'high';
}

// ---------------------------------------------------------------------------
// Cache helpers — chrome.storage.session (MV3, Chrome 112+)
// ---------------------------------------------------------------------------

const CACHE_PREFIX = 'embed:';

async function getCacheKey(text: string): Promise<string> {
  const input = text.slice(0, 500);
  const encoded = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${CACHE_PREFIX}${hashHex}`;
}

function isSessionStorageAvailable(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    chrome.storage != null &&
    chrome.storage.session != null
  );
}

async function readCache(key: string): Promise<HeadlineDrift | null> {
  if (!isSessionStorageAvailable()) return null;

  const result = await chrome.storage.session.get(key);
  const value: unknown = result[key];

  if (
    value != null &&
    typeof value === 'object' &&
    'score' in value &&
    'interpretation' in value &&
    typeof (value as { score: unknown }).score === 'number' &&
    typeof (value as { interpretation: unknown }).interpretation === 'string'
  ) {
    return value as HeadlineDrift;
  }

  return null;
}

async function writeCache(key: string, value: HeadlineDrift): Promise<void> {
  if (!isSessionStorageAvailable()) return;
  await chrome.storage.session.set({ [key]: value });
}

// ---------------------------------------------------------------------------
// Worker singleton
// ---------------------------------------------------------------------------

// Reuse the same worker across calls within the same tab lifecycle.
let workerInstance: Worker | null = null;

export function spawnWorker(): Worker {
  if (workerInstance === null) {
    workerInstance = new Worker(
      new URL('../workers/embedding-worker.ts', import.meta.url),
      { type: 'module' },
    );
  }
  return workerInstance;
}

// ---------------------------------------------------------------------------
// Unique request IDs
// ---------------------------------------------------------------------------

let requestCounter = 0;

function nextRequestId(): string {
  requestCounter += 1;
  return `req-${requestCounter}`;
}

// ---------------------------------------------------------------------------
// Core public API
// ---------------------------------------------------------------------------

/**
 * Compute headline ↔ body embedding drift.
 *
 * Returns a HeadlineDrift with score (cosine distance 0–1) and interpretation.
 * On any error (worker failure, storage error) returns a graceful-degradation
 * result: { score: 0, interpretation: 'low' }.
 */
export async function computeHeadlineDrift(
  title: string,
  body: string,
): Promise<HeadlineDrift> {
  // Use first 300 words of body as opening-paragraph proxy.
  const bodySlice = body.split(/\s+/).slice(0, 300).join(' ');

  const cacheInputText = title + '\n' + bodySlice;

  try {
    const cacheKey = await getCacheKey(cacheInputText);
    const cached = await readCache(cacheKey);

    if (cached !== null) {
      return cached;
    }

    const score = await requestEmbedScore(title, bodySlice);
    const result: HeadlineDrift = {
      score,
      interpretation: interpretDriftScore(score),
    };

    await writeCache(cacheKey, result);
    return result;
  } catch {
    // Graceful degradation: never surface embedding errors to the caller.
    return { score: 0, interpretation: 'low' };
  }
}

// ---------------------------------------------------------------------------
// Worker message exchange
// ---------------------------------------------------------------------------

const WORKER_TIMEOUT_MS = 25_000;

function requestEmbedScore(titleText: string, bodyText: string): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const worker = spawnWorker();
    const id = nextRequestId();

    // Guard against a permanently-hung worker (e.g. ONNX runtime init failure).
    const timeoutHandle = setTimeout(() => {
      worker.removeEventListener('message', handler);
      reject(new Error('embedding worker timed out'));
    }, WORKER_TIMEOUT_MS);

    const handler = (event: MessageEvent<EmbedResponse>) => {
      const msg = event.data;
      if (msg.id !== id) return;

      clearTimeout(timeoutHandle);
      worker.removeEventListener('message', handler);

      if (msg.type === 'result') {
        resolve(msg.score);
      } else {
        reject(new Error(msg.message));
      }
    };

    worker.addEventListener('message', handler);

    const request: EmbedRequest = { type: 'embed', id, titleText, bodyText };
    worker.postMessage(request);
  });
}
