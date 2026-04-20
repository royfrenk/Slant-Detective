/**
 * embedding-worker.ts
 *
 * Web Worker that lazily loads the BGE-small-en-v1.5 model via @xenova/transformers
 * and computes cosine distance between a headline and opening body text.
 *
 * Message protocol (see shared/types.ts):
 *   IN:  EmbedRequest  { type: 'embed'; id; titleText; bodyText }
 *   OUT: EmbedResponse { type: 'result'; id; score } | { type: 'error'; id; message }
 */

import { pipeline, FeatureExtractionPipeline } from '@xenova/transformers';

import type { EmbedRequest, EmbedResponse } from '../shared/types';

// Module-level singleton — model is loaded on first message, reused for all
// subsequent messages within this worker's lifetime.
let extractor: FeatureExtractionPipeline | null = null;

async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (extractor === null) {
    extractor = await pipeline(
      'feature-extraction',
      'Xenova/bge-small-en-v1.5',
      { quantized: true },
    );
  }
  return extractor;
}

/**
 * Compute cosine similarity between two equal-length vectors.
 * Returns a value in [-1, 1]; 1 = identical direction.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

self.onmessage = async (event: MessageEvent<EmbedRequest>) => {
  const { type, id, titleText, bodyText } = event.data;

  if (type !== 'embed') {
    return;
  }

  try {
    const ext = await getExtractor();

    // Slice body to first 512 characters (well within BGE-small's 512-token
    // limit when measured in tokens; character slice is a conservative proxy).
    const [titleEmb, bodyEmb] = await Promise.all([
      ext(titleText, { pooling: 'mean', normalize: true }),
      ext(bodyText.slice(0, 512), { pooling: 'mean', normalize: true }),
    ]);

    // titleEmb and bodyEmb are Tensor instances.
    // Tensor.data is Float32Array — spread into number[] for pure-JS cosine impl.
    const score = 1 - cosineSimilarity(
      Array.from(titleEmb.data as Float32Array),
      Array.from(bodyEmb.data as Float32Array),
    );

    const response: EmbedResponse = { type: 'result', id, score };
    self.postMessage(response);
  } catch (err) {
    const response: EmbedResponse = {
      type: 'error',
      id,
      message: String(err),
    };
    self.postMessage(response);
  }
};
