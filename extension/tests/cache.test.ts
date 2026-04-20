import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildCacheKey } from '../src/service-worker/cache'

// Mock crypto.subtle.digest for deterministic hashing in tests.
// The test verifies structural properties (distinct keys, segment format),
// not the cryptographic correctness — that is exercised by the real SubtleCrypto.
function mockDigest(input: string): ArrayBuffer {
  // Produce a fake but deterministic 32-byte buffer based on input length + content.
  const buf = new Uint8Array(32)
  for (let i = 0; i < Math.min(input.length, 32); i++) {
    buf[i] = input.charCodeAt(i) % 256
  }
  return buf.buffer
}

beforeEach(() => {
  vi.stubGlobal('crypto', {
    subtle: {
      digest: vi.fn((_algo: string, data: BufferSource) => {
        const decoded = new TextDecoder().decode(data as ArrayBuffer)
        return Promise.resolve(mockDigest(decoded))
      }),
    },
  })
})

describe('buildCacheKey', () => {
  it('includes provider and model segments in the key', async () => {
    const key = await buildCacheKey('https://example.com', 'article body', 'rubric_v1.0', 'anthropic', 'claude-haiku-4-5-20251001')
    // New format: sd_cache_<urlHash>:<bodyHash>:<version>:<provider>:<model>
    expect(key).toContain('sd_cache_')
    expect(key).toContain(':rubric_v1.0:anthropic:claude-haiku-4-5-20251001')
  })

  it('produces different keys for the same article with different providers', async () => {
    const key1 = await buildCacheKey('https://example.com', 'body', 'rubric_v1.0', 'anthropic', 'claude-haiku-4-5-20251001')
    const key2 = await buildCacheKey('https://example.com', 'body', 'rubric_v1.0', 'openai', 'gpt-4o-mini')
    expect(key1).not.toBe(key2)
  })

  it('produces different keys for the same article + provider with different models', async () => {
    const key1 = await buildCacheKey('https://example.com', 'body', 'rubric_v1.0', 'anthropic', 'claude-haiku-4-5-20251001')
    const key2 = await buildCacheKey('https://example.com', 'body', 'rubric_v1.0', 'anthropic', 'claude-opus-4-5-20251001')
    expect(key1).not.toBe(key2)
  })

  it('produces different keys for different articles with the same provider', async () => {
    const key1 = await buildCacheKey('https://example.com/article-1', 'body A', 'rubric_v1.0', 'anthropic', 'claude-haiku-4-5-20251001')
    const key2 = await buildCacheKey('https://example.com/article-2', 'body B', 'rubric_v1.0', 'anthropic', 'claude-haiku-4-5-20251001')
    expect(key1).not.toBe(key2)
  })

  it('key has exactly 5 colon-separated segments after the prefix', async () => {
    const key = await buildCacheKey('https://example.com', 'body', 'rubric_v1.0', 'anthropic', 'claude-haiku-4-5-20251001')
    const withoutPrefix = key.replace('sd_cache_', '')
    const segments = withoutPrefix.split(':')
    // urlHash : bodyHash : version : provider : model
    expect(segments).toHaveLength(5)
  })
})
