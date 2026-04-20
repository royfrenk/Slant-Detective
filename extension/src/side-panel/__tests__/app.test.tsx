import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import App from '../App';
import type { RubricResponse, Layer1Signals, RubricDimensions } from '../../shared/types';
import type { InboundMessage } from '../../shared/messages';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockLayer1Signals: Layer1Signals = {
  domain: 'example.com',
  wordCount: 800,
  languageIntensity: 3,
  loadedWords: { hits: [], uniqueSurfaces: [], count: 2 },
  hedges: { hits: [], count: 1 },
  attribution: { totalAttributions: 0, tierCounts: [0, 0, 0, 0], byActor: {} },
  headlineDrift: { score: 0.1, interpretation: 'low' },
};

const mockDimensions: RubricDimensions = {
  word_choice: { score: 6 },
  framing: { score: 4 },
  headline_slant: { score: 3 },
  source_mix: { score: 2 },
};

const mockRubricResponse: RubricResponse = {
  rubric_version: '1.0',
  overall: { intensity: 5, direction: 'right', confidence: 0.8 },
  dimensions: mockDimensions,
  spans: [],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMessageListener(): (msg: InboundMessage) => void {
  const calls = (chrome.runtime.onMessage.addListener as ReturnType<typeof vi.fn>).mock.calls;
  const last = calls[calls.length - 1];
  return last[0] as (msg: InboundMessage) => void;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('App — Layer 2 state machine integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: API key present in new storage schema
    (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockImplementation(
      (_keys: unknown, cb: (r: Record<string, unknown>) => void) => {
        cb({
          providers: { anthropic: { key: 'sk-ant-test-key', model: 'claude-haiku-4-5-20251001' } },
          activeProvider: 'anthropic',
        });
      },
    );
  });

  it('shows Layer2SkeletonView while Layer 1 is loading (API key present)', () => {
    render(<App />);
    expect(screen.getByTestId('layer2-skeleton')).toBeInTheDocument();
  });

  it('shows Layer2View after layer2_result message received', async () => {
    render(<App />);

    const listener = getMessageListener();

    // Step 1: Layer 1 succeeds
    await act(async () => {
      listener({
        action: 'analyzed',
        payload: {
          ok: true,
          title: 'Test article',
          body: 'Body text.',
          word_count: 800,
          offsets: [],
          layer1Signals: mockLayer1Signals,
          layer2: null,
        },
      });
    });

    // Still loading Layer 2 — skeleton should be visible
    expect(screen.getByTestId('layer2-skeleton')).toBeInTheDocument();

    // Step 2: Layer 2 result arrives
    await act(async () => {
      listener({ action: 'layer2_result', payload: mockRubricResponse });
    });

    // Layer2View should replace the skeleton
    expect(screen.queryByTestId('layer2-skeleton')).not.toBeInTheDocument();
    expect(screen.getByTestId('layer2-view')).toBeInTheDocument();
  });

  it('shows InvalidKeyCard on invalid_key error', async () => {
    render(<App />);
    const listener = getMessageListener();

    await act(async () => {
      listener({
        action: 'analyzed',
        payload: { ok: true, title: 'T', body: 'B', word_count: 800, offsets: [], layer1Signals: mockLayer1Signals, layer2: null },
      });
    });
    await act(async () => {
      listener({ action: 'layer2_failed', errorType: 'invalid_key' });
    });

    expect(screen.getByText(/API key not recognized/i)).toBeInTheDocument();
  });

  it('shows LLMTimeoutCard on timeout error', async () => {
    render(<App />);
    const listener = getMessageListener();

    await act(async () => {
      listener({
        action: 'analyzed',
        payload: { ok: true, title: 'T', body: 'B', word_count: 800, offsets: [], layer1Signals: mockLayer1Signals, layer2: null },
      });
    });
    await act(async () => {
      listener({ action: 'layer2_failed', errorType: 'timeout' });
    });

    expect(screen.getByText(/Analysis is taking too long/i)).toBeInTheDocument();
  });

  it('shows Layer1View when no API key is set', () => {
    (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockImplementation(
      (_keys: unknown, cb: (r: Record<string, unknown>) => void) => {
        cb({});
      },
    );
    render(<App />);
    // Without an API key, Layer1SkeletonView loads (not Layer2SkeletonView)
    expect(screen.queryByTestId('layer2-skeleton')).not.toBeInTheDocument();
  });
});
