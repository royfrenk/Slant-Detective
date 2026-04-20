import type { RubricResponse, CacheEntry } from '../shared/types'
import { CACHE_PREFIX, CACHE_MAX_ENTRIES } from '../shared/storage-keys'

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Build the storage key for a given article + rubric version.
 * Format: `sd_cache_${sha256(canonicalUrl)}:${sha256(body)}:${rubricVersion}`
 */
export async function buildCacheKey(
  canonicalUrl: string,
  body: string,
  rubricVersion: string,
): Promise<string> {
  const [urlHash, bodyHash] = await Promise.all([
    sha256Hex(canonicalUrl),
    sha256Hex(body),
  ])
  return `${CACHE_PREFIX}${urlHash}:${bodyHash}:${rubricVersion}`
}

/**
 * Return the cached RubricResponse if present and within TTL; null otherwise.
 * Updates lastAccessedAt on hit. Lazily deletes expired entries.
 */
export async function getCachedResult(cacheKey: string): Promise<RubricResponse | null> {
  const stored = await chrome.storage.local.get(cacheKey)
  const entry = stored[cacheKey] as CacheEntry | undefined

  if (entry === undefined) return null

  const now = Date.now()
  if (now - entry.cachedAt > CACHE_TTL_MS) {
    await chrome.storage.local.remove(cacheKey)
    return null
  }

  // Update lastAccessedAt immutably
  const updated: CacheEntry = { ...entry, lastAccessedAt: now }
  await chrome.storage.local.set({ [cacheKey]: updated })

  return entry.result
}

/**
 * Write a result to the cache.
 * Evicts the LRU entry if count exceeds CACHE_MAX_ENTRIES.
 */
export async function setCachedResult(
  cacheKey: string,
  result: RubricResponse,
): Promise<void> {
  const now = Date.now()
  const entry: CacheEntry = { result, cachedAt: now, lastAccessedAt: now }

  await chrome.storage.local.set({ [cacheKey]: entry })
  await evictIfNeeded()
}

async function evictIfNeeded(): Promise<void> {
  const all = await chrome.storage.local.get(null)
  const cacheKeys = Object.keys(all).filter((k) => k.startsWith(CACHE_PREFIX))

  if (cacheKeys.length <= CACHE_MAX_ENTRIES) return

  // Sort by lastAccessedAt ascending — evict the least recently accessed
  const sorted = cacheKeys.sort((a, b) => {
    const entryA = all[a] as CacheEntry
    const entryB = all[b] as CacheEntry
    return entryA.lastAccessedAt - entryB.lastAccessedAt
  })

  const toEvict = sorted[0]
  if (toEvict !== undefined) {
    await chrome.storage.local.remove(toEvict)
  }
}
