/**
 * Hook to load a reference distribution JSON once per side-panel session.
 *
 * Returns the sorted `overall` array (and per-dim arrays) from the
 * reference-distribution-{provider}.json shipped in extension/public/assets/.
 *
 * Returns null while loading or on error — callers should gracefully omit
 * the percentile label when distribution is null.
 *
 * SD-040: uses static JSONs. SD-041 will extend with empirical curves.
 */
import { useState, useEffect } from 'react'
import type { DistributionData } from './percentile-utils'

type ProviderKey = 'anthropic' | 'openai' | 'gemini' | 'layer1'

const ASSET_NAMES: Record<ProviderKey, string> = {
  anthropic: 'assets/reference-distribution-anthropic.json',
  openai: 'assets/reference-distribution-openai.json',
  gemini: 'assets/reference-distribution-gemini.json',
  layer1: 'assets/reference-distribution-layer1.json',
}

// Module-level cache: provider -> distribution. Loaded once, never refetched.
const distributionCache = new Map<ProviderKey, DistributionData | null>()

async function loadDistribution(provider: ProviderKey): Promise<DistributionData | null> {
  const cached = distributionCache.get(provider)
  if (cached !== undefined) return cached

  try {
    const assetName = ASSET_NAMES[provider]
    const url = chrome.runtime.getURL(assetName)
    const response = await fetch(url)
    if (!response.ok) {
      distributionCache.set(provider, null)
      return null
    }
    const data = (await response.json()) as DistributionData
    if (!Array.isArray(data.overall)) {
      distributionCache.set(provider, null)
      return null
    }
    distributionCache.set(provider, data)
    return data
  } catch {
    distributionCache.set(provider, null)
    return null
  }
}

export function useDistribution(provider: ProviderKey): DistributionData | null {
  const [distribution, setDistribution] = useState<DistributionData | null>(
    () => distributionCache.get(provider) ?? null,
  )

  useEffect(() => {
    let cancelled = false
    void loadDistribution(provider).then((data) => {
      if (!cancelled) setDistribution(data)
    })
    return () => {
      cancelled = true
    }
  }, [provider])

  return distribution
}
