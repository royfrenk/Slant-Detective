/**
 * Hook to load a reference distribution JSON once per side-panel session.
 *
 * Returns the sorted `overall` array (and per-dim arrays) from the
 * reference-distribution-{provider}.json shipped in extension/public/assets/.
 *
 * Returns null while loading or on error — callers should gracefully omit
 * the percentile label when distribution is null.
 *
 * SD-040: uses static JSONs.
 * SD-041: prefers empirical curves when available; falls back to static.
 *         Per-site curves are loaded when a domain slug is provided.
 *
 * PUBLIC SIGNATURE STABLE: useDistribution(provider, domainEtld1?) → DistributionData | null
 */
import { useState, useEffect } from 'react'
import type { DistributionData } from './percentile-utils'

type ProviderKey = 'anthropic' | 'openai' | 'gemini' | 'layer1'

// Safe slug: only lowercase letters, digits, dots, hyphens (mirrors eval script)
function domainToSlug(domain: string): string {
  return domain.replace(/[^a-z0-9.-]/g, '_')
}

function assetName(provider: ProviderKey, suffix: string): string {
  return `assets/reference-distribution-${provider}${suffix}.json`
}

// Module-level cache: cache key → distribution. Loaded once, never refetched.
const distributionCache = new Map<string, DistributionData | null>()

async function tryLoadAsset(provider: ProviderKey, suffix: string): Promise<DistributionData | null> {
  const cacheKey = `${provider}${suffix}`
  const cached = distributionCache.get(cacheKey)
  if (cached !== undefined) return cached

  try {
    const url = chrome.runtime.getURL(assetName(provider, suffix))
    const response = await fetch(url)
    if (!response.ok) {
      distributionCache.set(cacheKey, null)
      return null
    }
    const data = (await response.json()) as DistributionData
    if (!Array.isArray(data.overall)) {
      distributionCache.set(cacheKey, null)
      return null
    }
    distributionCache.set(cacheKey, data)
    return data
  } catch {
    distributionCache.set(cacheKey, null)
    return null
  }
}

/**
 * Load distribution with fallback chain:
 *  1. Per-site empirical (if domainEtld1 provided)
 *  2. Global empirical
 *  3. Static reference corpus
 */
async function loadDistribution(
  provider: ProviderKey,
  domainEtld1?: string,
): Promise<DistributionData | null> {
  // Step 1: per-site empirical curve
  if (domainEtld1) {
    const slug = domainToSlug(domainEtld1)
    const perSite = await tryLoadAsset(provider, `-${slug}-empirical`)
    if (perSite !== null) return perSite
  }

  // Step 2: global empirical curve
  const empirical = await tryLoadAsset(provider, '-empirical')
  if (empirical !== null) return empirical

  // Step 3: static reference corpus (SD-040 baseline)
  return tryLoadAsset(provider, '')
}

/**
 * React hook that resolves the best available distribution for the given provider.
 *
 * @param provider   - LLM provider key or 'layer1'
 * @param domainEtld1 - optional eTLD+1 of the current article's domain,
 *                      used to prefer a per-site curve when available
 */
export function useDistribution(
  provider: ProviderKey,
  domainEtld1?: string,
): DistributionData | null {
  const [distribution, setDistribution] = useState<DistributionData | null>(null)

  useEffect(() => {
    let cancelled = false
    void loadDistribution(provider, domainEtld1).then((data) => {
      if (!cancelled) setDistribution(data)
    })
    return () => {
      cancelled = true
    }
  }, [provider, domainEtld1])

  return distribution
}
