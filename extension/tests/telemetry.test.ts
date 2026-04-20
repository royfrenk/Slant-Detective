/**
 * SD-030: Telemetry module unit tests
 *
 * Tests: counter accumulation, opt-out no-op, emit skip when <24h, emit fires
 * after 24h, counters cleared on 204, counters retained on non-204, daily salt
 * rotation when UTC date changes.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Chrome storage mock ────────────────────────────────────────────────────────

const storageStore: Record<string, unknown> = {}

const chromeMock = {
  runtime: {
    getManifest: vi.fn(() => ({ version: '0.1.0' })),
    getURL: vi.fn((p: string) => `chrome-extension://test/${p}`),
  },
  storage: {
    local: {
      get: vi.fn(async (keys: string | string[] | Record<string, unknown>) => {
        const result: Record<string, unknown> = {}
        const ks = typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys)
        for (const k of ks) result[k] = storageStore[k]
        return result
      }),
      set: vi.fn(async (data: Record<string, unknown>) => {
        for (const [k, v] of Object.entries(data)) storageStore[k] = v
      }),
    },
  },
}

// @ts-expect-error -- partial chrome mock
globalThis.chrome = chromeMock

// ── Fetch mock ────────────────────────────────────────────────────────────────

const fetchMock = vi.fn()
globalThis.fetch = fetchMock

// ── Crypto mock (SubtleCrypto + getRandomValues) ──────────────────────────────
// Use vi.stubGlobal because jsdom defines crypto as a getter-only property.

const cryptoMock = {
  getRandomValues: vi.fn((arr: Uint8Array) => {
    for (let i = 0; i < arr.length; i++) arr[i] = i % 256
    return arr
  }),
  subtle: {
    digest: vi.fn(async (_algo: string, data: ArrayBuffer) => {
      // Deterministic fake hash: XOR bytes into a 32-byte buffer
      const input = new Uint8Array(data)
      const out = new Uint8Array(32)
      for (let i = 0; i < input.length; i++) out[i % 32] ^= input[i]
      return out.buffer
    }),
  },
}

vi.stubGlobal('crypto', cryptoMock)

// ── Import module under test (after mocks set up) ─────────────────────────────

import { bump, maybeEmit } from '../src/service-worker/telemetry'

import {
  TELEMETRY_ENABLED,
  TELEMETRY_COUNTERS,
  TELEMETRY_LAST_EMIT,
  TELEMETRY_DAILY_SALT,
  TELEMETRY_SALT_DATE,
} from '../src/shared/storage-keys'

// ── Helpers ───────────────────────────────────────────────────────────────────

function clearStore(): void {
  for (const k of Object.keys(storageStore)) delete storageStore[k]
}

function setStore(data: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(data)) storageStore[k] = v
}

function getStore<T>(key: string): T | undefined {
  return storageStore[key] as T | undefined
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('telemetry.bump()', () => {
  beforeEach(() => {
    clearStore()
    vi.clearAllMocks()
    // Set getRandomValues mock back (cleared by clearAllMocks)
    cryptoMock.getRandomValues.mockImplementation((arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) arr[i] = i % 256
      return arr
    })
    cryptoMock.subtle.digest.mockImplementation(async (_algo: string, data: ArrayBuffer) => {
      const input = new Uint8Array(data)
      const out = new Uint8Array(32)
      for (let i = 0; i < input.length; i++) out[i % 32] ^= input[i]
      return out.buffer
    })
  })

  it('is a no-op when TELEMETRY_ENABLED is false', async () => {
    setStore({ [TELEMETRY_ENABLED]: false })
    await bump('analyze_started')
    expect(getStore(TELEMETRY_COUNTERS)).toBeUndefined()
  })

  it('initializes counters on first bump', async () => {
    setStore({ [TELEMETRY_ENABLED]: true })
    await bump('analyze_started')
    const c = getStore<Record<string, unknown>>(TELEMETRY_COUNTERS)
    expect(c).toBeDefined()
    expect(c!['analyze_started']).toBe(1)
    expect(c!['analyze_layer1_ok']).toBe(0)
  })

  it('accumulates multiple bumps', async () => {
    setStore({ [TELEMETRY_ENABLED]: true })
    await bump('analyze_started')
    await bump('analyze_started')
    await bump('analyze_layer1_ok')
    const c = getStore<Record<string, unknown>>(TELEMETRY_COUNTERS)
    expect(c!['analyze_started']).toBe(2)
    expect(c!['analyze_layer1_ok']).toBe(1)
  })

  it('treats absent TELEMETRY_ENABLED (fresh install) as enabled', async () => {
    // storageStore is empty → undefined key
    await bump('analyze_layer2_ok')
    const c = getStore<Record<string, unknown>>(TELEMETRY_COUNTERS)
    expect(c!['analyze_layer2_ok']).toBe(1)
  })

  it('records domain hash when pageUrl is provided on analyze_started', async () => {
    setStore({ [TELEMETRY_ENABLED]: true })
    await bump('analyze_started', 1, 'https://www.nytimes.com/article/foo')
    const c = getStore<Record<string, unknown>>(TELEMETRY_COUNTERS)
    const dc = c!['domain_counts'] as Record<string, number>
    expect(Object.keys(dc).length).toBe(1)
    const [hashKey] = Object.keys(dc)
    expect(hashKey).toMatch(/^[0-9a-f]{12}$/)
    expect(dc[hashKey]).toBe(1)
  })

  it('reuses existing domain hash entry on repeated domain', async () => {
    setStore({ [TELEMETRY_ENABLED]: true })
    await bump('analyze_started', 1, 'https://nytimes.com/a')
    await bump('analyze_started', 1, 'https://nytimes.com/b')
    const c = getStore<Record<string, unknown>>(TELEMETRY_COUNTERS)
    const dc = c!['domain_counts'] as Record<string, number>
    const vals = Object.values(dc)
    expect(vals).toContain(2)
  })

  it('buckets into __other__ when domain_counts exceeds 50 entries', async () => {
    setStore({ [TELEMETRY_ENABLED]: true })

    // Pre-fill 50 distinct hashes manually
    const existingDomains: Record<string, number> = {}
    for (let i = 0; i < 50; i++) {
      existingDomains[`hash${i.toString().padStart(12, '0')}`] = 1
    }
    setStore({
      [TELEMETRY_ENABLED]: true,
      [TELEMETRY_COUNTERS]: {
        analyze_started: 50,
        analyze_layer1_ok: 0,
        analyze_layer2_ok: 0,
        analyze_extraction_failed: 0,
        analyze_too_short: 0,
        analyze_llm_timeout: 0,
        analyze_invalid_key: 0,
        analyze_rate_limit: 0,
        key_saved: 0,
        key_rejected: 0,
        domain_counts: existingDomains,
        period_start: '2026-04-19',
      },
    })

    await bump('analyze_started', 1, 'https://newdomain.com/page')
    const c = getStore<Record<string, unknown>>(TELEMETRY_COUNTERS)
    const dc = c!['domain_counts'] as Record<string, number>
    // The new hash should have gone to __other__ (since domain hashes are 12-char hex,
    // they won't match the pre-filled 'hash000000000000' keys)
    expect(dc['__other__']).toBeGreaterThanOrEqual(1)
  })
})

describe('telemetry.maybeEmit()', () => {
  const NOW = 1_745_000_000_000 // fixed timestamp

  beforeEach(() => {
    clearStore()
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    fetchMock.mockResolvedValue({ status: 204 })
    cryptoMock.getRandomValues.mockImplementation((arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) arr[i] = i % 256
      return arr
    })
    cryptoMock.subtle.digest.mockImplementation(async (_algo: string, data: ArrayBuffer) => {
      const input = new Uint8Array(data)
      const out = new Uint8Array(32)
      for (let i = 0; i < input.length; i++) out[i % 32] ^= input[i]
      return out.buffer
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('is a no-op when TELEMETRY_ENABLED is false (and discards counters)', async () => {
    setStore({
      [TELEMETRY_ENABLED]: false,
      [TELEMETRY_COUNTERS]: {
        analyze_started: 5,
        analyze_layer1_ok: 5,
        analyze_layer2_ok: 0,
        analyze_extraction_failed: 0,
        analyze_too_short: 0,
        analyze_llm_timeout: 0,
        analyze_invalid_key: 0,
        analyze_rate_limit: 0,
        key_saved: 0,
        key_rejected: 0,
        domain_counts: {},
        period_start: '2026-04-19',
      },
    })
    await maybeEmit()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('skips emit when last emit was less than 24h ago', async () => {
    const recentEmit = NOW - (23 * 60 * 60 * 1000)
    setStore({
      [TELEMETRY_ENABLED]: true,
      [TELEMETRY_LAST_EMIT]: recentEmit,
      [TELEMETRY_COUNTERS]: {
        analyze_started: 3,
        analyze_layer1_ok: 3,
        analyze_layer2_ok: 0,
        analyze_extraction_failed: 0,
        analyze_too_short: 0,
        analyze_llm_timeout: 0,
        analyze_invalid_key: 0,
        analyze_rate_limit: 0,
        key_saved: 0,
        key_rejected: 0,
        domain_counts: {},
        period_start: '2026-04-18',
      },
    })
    await maybeEmit()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('emits when no previous emit and counters are non-zero', async () => {
    setStore({
      [TELEMETRY_ENABLED]: true,
      [TELEMETRY_COUNTERS]: {
        analyze_started: 2,
        analyze_layer1_ok: 2,
        analyze_layer2_ok: 1,
        analyze_extraction_failed: 0,
        analyze_too_short: 0,
        analyze_llm_timeout: 0,
        analyze_invalid_key: 0,
        analyze_rate_limit: 0,
        key_saved: 1,
        key_rejected: 0,
        domain_counts: {},
        period_start: '2026-04-19',
      },
    })
    await maybeEmit()
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('https://sd-telemetry.rabbit-factory.workers.dev/v1/ingest')
    expect(opts.method).toBe('POST')
    const body = JSON.parse(opts.body as string)
    expect(body.schema_version).toBe(1)
    expect(body.counters.analyze_started).toBe(2)
  })

  it('clears counters on 204 response', async () => {
    fetchMock.mockResolvedValue({ status: 204 })
    setStore({
      [TELEMETRY_ENABLED]: true,
      [TELEMETRY_COUNTERS]: {
        analyze_started: 5,
        analyze_layer1_ok: 5,
        analyze_layer2_ok: 0,
        analyze_extraction_failed: 0,
        analyze_too_short: 0,
        analyze_llm_timeout: 0,
        analyze_invalid_key: 0,
        analyze_rate_limit: 0,
        key_saved: 0,
        key_rejected: 0,
        domain_counts: {},
        period_start: '2026-04-19',
      },
    })
    await maybeEmit()
    const c = getStore<Record<string, unknown>>(TELEMETRY_COUNTERS)
    expect(c!['analyze_started']).toBe(0)
    expect(getStore(TELEMETRY_LAST_EMIT)).toBe(NOW)
  })

  it('retains counters on non-204 response', async () => {
    fetchMock.mockResolvedValue({ status: 500 })
    setStore({
      [TELEMETRY_ENABLED]: true,
      [TELEMETRY_COUNTERS]: {
        analyze_started: 7,
        analyze_layer1_ok: 7,
        analyze_layer2_ok: 0,
        analyze_extraction_failed: 0,
        analyze_too_short: 0,
        analyze_llm_timeout: 0,
        analyze_invalid_key: 0,
        analyze_rate_limit: 0,
        key_saved: 0,
        key_rejected: 0,
        domain_counts: {},
        period_start: '2026-04-19',
      },
    })
    await maybeEmit()
    const c = getStore<Record<string, unknown>>(TELEMETRY_COUNTERS)
    expect(c!['analyze_started']).toBe(7)
    expect(getStore(TELEMETRY_LAST_EMIT)).toBeUndefined()
  })

  it('retains counters on network failure', async () => {
    fetchMock.mockRejectedValue(new Error('Network error'))
    setStore({
      [TELEMETRY_ENABLED]: true,
      [TELEMETRY_COUNTERS]: {
        analyze_started: 3,
        analyze_layer1_ok: 3,
        analyze_layer2_ok: 0,
        analyze_extraction_failed: 0,
        analyze_too_short: 0,
        analyze_llm_timeout: 0,
        analyze_invalid_key: 0,
        analyze_rate_limit: 0,
        key_saved: 0,
        key_rejected: 0,
        domain_counts: {},
        period_start: '2026-04-19',
      },
    })
    await maybeEmit()
    const c = getStore<Record<string, unknown>>(TELEMETRY_COUNTERS)
    expect(c!['analyze_started']).toBe(3)
  })

  it('does not emit when counters are all zero', async () => {
    setStore({
      [TELEMETRY_ENABLED]: true,
    })
    await maybeEmit()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('daily salt rotation', () => {
  beforeEach(() => {
    clearStore()
    vi.clearAllMocks()
    cryptoMock.getRandomValues.mockImplementation((arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) arr[i] = i % 256
      return arr
    })
    cryptoMock.subtle.digest.mockImplementation(async (_algo: string, data: ArrayBuffer) => {
      const input = new Uint8Array(data)
      const out = new Uint8Array(32)
      for (let i = 0; i < input.length; i++) out[i % 32] ^= input[i]
      return out.buffer
    })
  })

  it('generates a new salt when none exists', async () => {
    setStore({ [TELEMETRY_ENABLED]: true })
    await bump('analyze_started', 1, 'https://reuters.com/article')
    expect(getStore(TELEMETRY_DAILY_SALT)).toBeDefined()
    expect(getStore(TELEMETRY_SALT_DATE)).toBeDefined()
  })

  it('reuses the same salt within the same UTC day', async () => {
    setStore({ [TELEMETRY_ENABLED]: true })
    await bump('analyze_started', 1, 'https://reuters.com/a')
    const salt1 = getStore<string>(TELEMETRY_DAILY_SALT)
    await bump('analyze_started', 1, 'https://reuters.com/b')
    const salt2 = getStore<string>(TELEMETRY_DAILY_SALT)
    expect(salt1).toBe(salt2)
  })

  it('rotates the salt when the UTC date has changed', async () => {
    const yesterday = new Date()
    yesterday.setUTCDate(yesterday.getUTCDate() - 1)
    const yesterdayStr = yesterday.toISOString().slice(0, 10)

    setStore({
      [TELEMETRY_ENABLED]: true,
      [TELEMETRY_DAILY_SALT]: 'old-salt-value',
      [TELEMETRY_SALT_DATE]: yesterdayStr,
    })

    // Make getRandomValues return different values for new salt
    let callCount = 0
    cryptoMock.getRandomValues.mockImplementation((arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) arr[i] = (i + callCount * 17) % 256
      callCount++
      return arr
    })

    await bump('analyze_started', 1, 'https://ap.org/news')
    const newSalt = getStore<string>(TELEMETRY_DAILY_SALT)
    expect(newSalt).not.toBe('old-salt-value')
  })
})
