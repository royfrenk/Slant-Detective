import type { CanonicalSignals } from '../shared/types'

const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'mc_cid', 'mc_eid', 'igshid', '_ga',
  'ref', 'source', 'via', 'trk', 'share',
  'at_medium', 'at_campaign', 'at_custom1', 'at_custom2', 'at_custom3', 'at_custom4',
])

/**
 * Normalize a URL: strip tracking params, fragment, and trailing slash.
 * Returns the input string unchanged if it is not a valid URL.
 */
export function normalizeUrl(raw: string): string {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return raw
  }

  // Strip tracking params
  for (const param of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.has(param)) {
      url.searchParams.delete(param)
    }
  }

  // Strip fragment
  url.hash = ''

  // Strip trailing slash (except bare origin)
  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.slice(0, -1)
  }

  return url.toString()
}

/**
 * Resolve the canonical URL for a page.
 * Priority: linkCanonical > jsonLdUrl > ogUrl > twitterUrl > tabUrl.
 * All signals and tabUrl are normalized before returning.
 */
export function resolveCanonicalUrl(
  tabUrl: string,
  signals?: CanonicalSignals,
): string {
  const candidates = signals
    ? [signals.linkCanonical, signals.jsonLdUrl, signals.ogUrl, signals.twitterUrl]
    : []

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.length > 0) {
      return normalizeUrl(candidate)
    }
  }

  return normalizeUrl(tabUrl)
}
