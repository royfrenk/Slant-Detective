/**
 * embedding-drift.test.ts
 *
 * Tests for the pure functions and mocked-worker path in embedding-drift.ts.
 *
 * The actual @xenova/transformers model (30MB+ ONNX + WASM) cannot run in
 * Vitest's Node environment.  All tests either:
 *   a) call pure functions directly (interpretDriftScore), or
 *   b) mock the Worker constructor so the message exchange resolves immediately,
 *      using vi.resetModules() + dynamic import to reset the module-level singleton.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EmbedResponse } from '../../shared/types';

// ---------------------------------------------------------------------------
// interpretDriftScore — pure function, no mocking needed
// ---------------------------------------------------------------------------

import { interpretDriftScore } from '../embedding-drift';

describe('interpretDriftScore()', () => {
  it('returns "low" for score = 0.1 (below 0.2 threshold)', () => {
    expect(interpretDriftScore(0.1)).toBe('low');
  });

  it('returns "medium" for score = 0.25 (between 0.2 and 0.5)', () => {
    expect(interpretDriftScore(0.25)).toBe('medium');
  });

  it('returns "high" for score = 0.5 (at or above 0.5 threshold)', () => {
    expect(interpretDriftScore(0.5)).toBe('high');
  });

  it('returns "medium" for score = 0.2 (exactly at low/medium boundary)', () => {
    expect(interpretDriftScore(0.2)).toBe('medium');
  });

  it('returns "low" for score = 0 (identical texts)', () => {
    expect(interpretDriftScore(0)).toBe('low');
  });

  it('returns "high" for score = 1 (maximally divergent)', () => {
    expect(interpretDriftScore(1)).toBe('high');
  });
});

// ---------------------------------------------------------------------------
// computeHeadlineDrift — Worker mocked, module reset between tests
// ---------------------------------------------------------------------------

type MessageHandler = (event: MessageEvent<EmbedResponse>) => void;

/**
 * Build a constructible Worker mock class.
 * The Worker constructor must be called with `new`, so we return a class
 * that immediately simulates a postMessage → response round-trip.
 */
function makeMockWorkerClass(scoreToReturn: number) {
  return class MockWorker {
    private listeners: MessageHandler[] = [];

    addEventListener(_type: string, handler: MessageHandler) {
      this.listeners.push(handler);
    }

    removeEventListener(_type: string, handler: MessageHandler) {
      const idx = this.listeners.indexOf(handler);
      if (idx !== -1) this.listeners.splice(idx, 1);
    }

    postMessage(msg: { id: string }) {
      // Respond on the next microtask to mirror real Worker behaviour.
      const snapshot = [...this.listeners];
      Promise.resolve().then(() => {
        const response: EmbedResponse = { type: 'result', id: msg.id, score: scoreToReturn };
        for (const handler of snapshot) {
          handler({ data: response } as MessageEvent<EmbedResponse>);
        }
      });
    }

    terminate() { /* no-op */ }
  };
}

function makeErrorWorkerClass(errorMessage: string) {
  return class ErrorWorker {
    private listeners: MessageHandler[] = [];

    addEventListener(_type: string, handler: MessageHandler) {
      this.listeners.push(handler);
    }

    removeEventListener(_type: string, handler: MessageHandler) {
      const idx = this.listeners.indexOf(handler);
      if (idx !== -1) this.listeners.splice(idx, 1);
    }

    postMessage(msg: { id: string }) {
      const snapshot = [...this.listeners];
      Promise.resolve().then(() => {
        const response: EmbedResponse = { type: 'error', id: msg.id, message: errorMessage };
        for (const handler of snapshot) {
          handler({ data: response } as MessageEvent<EmbedResponse>);
        }
      });
    }

    terminate() { /* no-op */ }
  };
}

describe('computeHeadlineDrift()', () => {
  // Reset module state before each test so the Worker singleton is cleared.
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();

    // Stub crypto.subtle.digest so getCacheKey works in Node
    // (chrome.storage.session is absent in tests — guarded in the module).
    if (!globalThis.crypto?.subtle) {
      vi.stubGlobal('crypto', {
        subtle: {
          digest: vi.fn(async (_algo: string, data: Uint8Array) => {
            const buf = new ArrayBuffer(32);
            new Uint8Array(buf)[0] = data.length & 0xff;
            return buf;
          }),
        },
      });
    }
  });

  it('returns a HeadlineDrift with correct shape when worker returns score 0.2', async () => {
    vi.stubGlobal('Worker', makeMockWorkerClass(0.2));
    const { computeHeadlineDrift: compute } = await import('../embedding-drift');

    const result = await compute(
      'Officials deny wrongdoing',
      'A government official issued a brief statement.',
    );

    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('interpretation');
    expect(typeof result.score).toBe('number');
    expect(['low', 'medium', 'high']).toContain(result.interpretation);
  });

  it('maps worker score 0.2 to interpretation "medium"', async () => {
    vi.stubGlobal('Worker', makeMockWorkerClass(0.2));
    const { computeHeadlineDrift: compute } = await import('../embedding-drift');

    const result = await compute(
      'Shocking revelation',
      'A routine audit found minor discrepancies.',
    );

    expect(result.score).toBe(0.2);
    expect(result.interpretation).toBe('medium');
  });

  it('returns graceful degradation { score: 0, interpretation: "low" } on worker error', async () => {
    vi.stubGlobal('Worker', makeErrorWorkerClass('ONNX runtime failed'));
    const { computeHeadlineDrift: compute } = await import('../embedding-drift');

    const result = await compute(
      'Breaking: Crisis deepens',
      'Local authorities held a press conference on Tuesday.',
    );

    expect(result.score).toBe(0);
    expect(result.interpretation).toBe('low');
  });

  it('spawnWorker() returns the same instance on repeated calls within a session', async () => {
    vi.stubGlobal('Worker', makeMockWorkerClass(0));
    const { spawnWorker } = await import('../embedding-drift');

    const instance1 = spawnWorker();
    const instance2 = spawnWorker();

    expect(instance1).toBe(instance2);
  });
});
