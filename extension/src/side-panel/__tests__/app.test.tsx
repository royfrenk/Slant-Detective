import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import App from '../App';
import type { RubricResponse, Layer1Signals, RubricDimensions } from '../../shared/types';
import type { InboundMessage } from '../../shared/messages';
import { LAYER2_SUCCESS_COUNT } from '../../shared/storage-keys';

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
          canonicalSignals: { linkCanonical: null, jsonLdUrl: null, ogUrl: null, twitterUrl: null },
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
        payload: { ok: true, title: 'T', body: 'B', word_count: 800, offsets: [], canonicalSignals: { linkCanonical: null, jsonLdUrl: null, ogUrl: null, twitterUrl: null }, layer1Signals: mockLayer1Signals, layer2: null },
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
        payload: { ok: true, title: 'T', body: 'B', word_count: 800, offsets: [], canonicalSignals: { linkCanonical: null, jsonLdUrl: null, ogUrl: null, twitterUrl: null }, layer1Signals: mockLayer1Signals, layer2: null },
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

  // ─── SD-047: non_english routing (Layer 2 path — API key present) ────────

  it('shows NonEnglishCard on analysis_failed with reason non_english (API key present)', async () => {
    render(<App />);
    const listener = getMessageListener();

    await act(async () => {
      listener({ action: 'analysis_failed', reason: 'non_english' });
    });

    expect(screen.getByRole('alert', { name: 'Language not supported' })).toBeInTheDocument();
    expect(screen.getByText(/Slant Detective only works in English/i)).toBeInTheDocument();
  });

  it('shows NotANewsPageCard on analysis_failed with reason not_a_news_page (API key present)', async () => {
    render(<App />);
    const listener = getMessageListener();

    await act(async () => {
      listener({ action: 'analysis_failed', reason: 'not_a_news_page' });
    });

    expect(screen.getByRole('alert', { name: 'No news article detected' })).toBeInTheDocument();
    expect(screen.getByText(/No News Detected/i)).toBeInTheDocument();
  });

  it('shows ExtractionFailedCard (regression) on analysis_failed with reason extraction_failed', async () => {
    render(<App />);
    const listener = getMessageListener();

    await act(async () => {
      listener({ action: 'analysis_failed', reason: 'extraction_failed' });
    });

    expect(screen.getByText(/Couldn't read this page/i)).toBeInTheDocument();
  });
});

// ─── SD-047: Layer 1 path (no API key) ──────────────────────────────────────

describe('App — SD-047 error routing (Layer 1 path, no API key)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // No API key
    (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockImplementation(
      (_keys: unknown, cb: (r: Record<string, unknown>) => void) => {
        cb({});
      },
    );
  });

  it('shows NonEnglishCard on analysis_failed with reason non_english (no API key)', async () => {
    render(<App />);
    const calls = (chrome.runtime.onMessage.addListener as ReturnType<typeof vi.fn>).mock.calls;
    const listener = calls[calls.length - 1][0] as (msg: { action: string; reason?: string }) => void;

    await act(async () => {
      listener({ action: 'analysis_failed', reason: 'non_english' });
    });

    expect(screen.getByRole('alert', { name: 'Language not supported' })).toBeInTheDocument();
    expect(screen.getByText(/Slant Detective only works in English/i)).toBeInTheDocument();
  });

  it('shows NotANewsPageCard on analysis_failed with reason not_a_news_page (no API key)', async () => {
    render(<App />);
    const calls = (chrome.runtime.onMessage.addListener as ReturnType<typeof vi.fn>).mock.calls;
    const listener = calls[calls.length - 1][0] as (msg: { action: string; reason?: string }) => void;

    await act(async () => {
      listener({ action: 'analysis_failed', reason: 'not_a_news_page' });
    });

    expect(screen.getByRole('alert', { name: 'No news article detected' })).toBeInTheDocument();
    expect(screen.getByText(/No News Detected/i)).toBeInTheDocument();
  });
});

// ─── SD-060: Layer 2 success counter ─────────────────────────────────────────

describe('App — SD-060 Layer 2 success counter', () => {
  const l1Payload = {
    ok: true,
    title: 'T',
    body: 'B',
    word_count: 800,
    offsets: [],
    canonicalSignals: { linkCanonical: null, jsonLdUrl: null, ogUrl: null, twitterUrl: null },
    layer1Signals: {
      domain: 'example.com',
      wordCount: 800,
      languageIntensity: 3,
      loadedWords: { hits: [], uniqueSurfaces: [], count: 2 },
      hedges: { hits: [], count: 1 },
      attribution: { totalAttributions: 0, tierCounts: [0, 0, 0, 0], byActor: {} },
      headlineDrift: { score: 0.1, interpretation: 'low' },
    },
    layer2: null,
  } as const;

  const mockRubric: RubricResponse = {
    rubric_version: '1.0',
    overall: { intensity: 5, direction: 'right', confidence: 0.8 },
    dimensions: {
      word_choice: { score: 6 },
      framing: { score: 4 },
      headline_slant: { score: 3 },
      source_mix: { score: 2 },
    },
    spans: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockImplementation(
      (_keys: unknown, cb: (r: Record<string, unknown>) => void) => {
        cb({
          providers: { anthropic: { key: 'sk-ant-test-key', model: 'claude-haiku-4-5-20251001' } },
          activeProvider: 'anthropic',
          [LAYER2_SUCCESS_COUNT]: 0,
        });
      },
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('increments the counter exactly once when layer2_result arrives', async () => {
    render(<App />);
    const listener = getMessageListener();

    await act(async () => {
      listener({ action: 'analyzed', payload: l1Payload });
    });
    await act(async () => {
      listener({ action: 'layer2_result', payload: mockRubric });
    });

    const setCalls = (chrome.storage.local.set as ReturnType<typeof vi.fn>).mock.calls;
    const counterCalls = setCalls.filter(
      (args: unknown[]) =>
        typeof args[0] === 'object' &&
        args[0] !== null &&
        LAYER2_SUCCESS_COUNT in (args[0] as Record<string, unknown>),
    );
    expect(counterCalls).toHaveLength(1);
  });

  it('does NOT increment the counter when layer2_failed (error) arrives', async () => {
    render(<App />);
    const listener = getMessageListener();

    await act(async () => {
      listener({ action: 'analyzed', payload: l1Payload });
    });
    await act(async () => {
      listener({ action: 'layer2_failed', errorType: 'timeout' });
    });

    const setCalls = (chrome.storage.local.set as ReturnType<typeof vi.fn>).mock.calls;
    const counterCalls = setCalls.filter(
      (args: unknown[]) =>
        typeof args[0] === 'object' &&
        args[0] !== null &&
        LAYER2_SUCCESS_COUNT in (args[0] as Record<string, unknown>),
    );
    expect(counterCalls).toHaveLength(0);
  });

  it('does NOT double-increment if layer2_result triggers a re-render', async () => {
    render(<App />);
    const listener = getMessageListener();

    await act(async () => {
      listener({ action: 'analyzed', payload: l1Payload });
    });
    // Simulate receiving the same result twice (defensive — shouldn't happen in prod).
    await act(async () => {
      listener({ action: 'layer2_result', payload: mockRubric });
    });
    await act(async () => {
      listener({ action: 'layer2_result', payload: mockRubric });
    });

    const setCalls = (chrome.storage.local.set as ReturnType<typeof vi.fn>).mock.calls;
    const counterCalls = setCalls.filter(
      (args: unknown[]) =>
        typeof args[0] === 'object' &&
        args[0] !== null &&
        LAYER2_SUCCESS_COUNT in (args[0] as Record<string, unknown>),
    );
    expect(counterCalls).toHaveLength(1);
  });

  it('counter increments again after a fresh analysis (ref reset works)', async () => {
    render(<App />);
    const listener = getMessageListener();

    // Session 1: fire analyzed + layer2_result → counter +1
    await act(async () => {
      listener({ action: 'analyzed', payload: l1Payload });
    });
    await act(async () => {
      listener({ action: 'layer2_result', payload: mockRubric });
    });

    // Trigger startFreshAnalysis (resets hasIncrementedRef)
    await act(async () => {
      listener({ action: 'tab_navigated' });
    });

    // Session 2: fire analyzed + layer2_result → counter +1 again
    await act(async () => {
      listener({ action: 'analyzed', payload: l1Payload });
    });
    await act(async () => {
      listener({ action: 'layer2_result', payload: mockRubric });
    });

    const setCalls = (chrome.storage.local.set as ReturnType<typeof vi.fn>).mock.calls;
    const counterCalls = setCalls.filter(
      (args: unknown[]) =>
        typeof args[0] === 'object' &&
        args[0] !== null &&
        LAYER2_SUCCESS_COUNT in (args[0] as Record<string, unknown>),
    );
    // Both sessions should have incremented the counter
    expect(counterCalls).toHaveLength(2);
  });
});
