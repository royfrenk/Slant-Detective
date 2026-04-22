/**
 * SD-041: Minimal static Public Suffix List helper for eTLD+1 derivation.
 *
 * Does NOT fetch a runtime PSL — all entries are baked in at build time.
 * The list covers the most common two-part TLDs (ccSLD patterns) that a
 * news-reading audience encounters. For exotic TLDs not in the list the
 * fallback is "last 2 labels", which is correct for the vast majority of
 * generic TLDs (.com, .net, .org, .io, .ai, .app, .dev, etc.).
 *
 * Privacy: caller must pass only the hostname (no path/query/fragment).
 * Returns null for localhost, IP addresses, or unparseable input.
 */

// ── Static two-part public suffixes (ccSLD patterns) ─────────────────────────
// These are second-level domains that are themselves public suffixes —
// meaning registrations happen at the third label, not the second.
//
// Source: derived from mozilla/public-suffix-list, pruned to patterns
// commonly encountered in English-language news publishing.

const TWO_PART_SUFFIXES: ReadonlySet<string> = new Set([
  // United Kingdom
  'co.uk',
  'me.uk',
  'org.uk',
  'net.uk',
  'ltd.uk',
  'plc.uk',
  'sch.uk',
  'gov.uk',
  'nhs.uk',
  'police.uk',
  'ac.uk',

  // Australia
  'com.au',
  'net.au',
  'org.au',
  'gov.au',
  'edu.au',
  'id.au',
  'asn.au',

  // New Zealand
  'co.nz',
  'net.nz',
  'org.nz',
  'govt.nz',
  'ac.nz',
  'edu.nz',

  // South Africa
  'co.za',
  'net.za',
  'org.za',
  'gov.za',
  'edu.za',
  'ac.za',

  // India
  'co.in',
  'net.in',
  'org.in',
  'gov.in',
  'edu.in',
  'ac.in',

  // Japan
  'co.jp',
  'ne.jp',
  'or.jp',
  'go.jp',
  'ac.jp',
  'ad.jp',

  // Canada
  'co.ca',

  // Brazil
  'com.br',
  'net.br',
  'org.br',
  'gov.br',
  'edu.br',

  // China
  'com.cn',
  'net.cn',
  'org.cn',
  'gov.cn',
  'edu.cn',

  // Germany
  'com.de',

  // Hong Kong
  'com.hk',

  // Singapore
  'com.sg',
  'edu.sg',
  'gov.sg',
  'net.sg',
  'org.sg',
  'per.sg',

  // Spain
  'com.es',

  // Italy
  'co.it',

  // Netherlands
  'co.nl',

  // Poland
  'co.pl',

  // Turkey
  'com.tr',

  // Ireland
  'co.ie',

  // Argentina
  'com.ar',

  // Mexico
  'com.mx',

  // Colombia
  'com.co',

  // Ukraine
  'com.ua',

  // Pakistan
  'com.pk',

  // Nigeria
  'com.ng',

  // Kenya
  'co.ke',

  // Israel
  'co.il',

  // Malaysia
  'com.my',

  // Philippines
  'com.ph',

  // Indonesia
  'co.id',

  // Vietnam
  'com.vn',

  // Thailand
  'co.th',

  // Bangladesh
  'com.bd',

  // Sri Lanka
  'com.lk',

  // Nepal
  'com.np',

  // Iran
  'co.ir',

  // Russia
  'com.ru',

  // Global / blogging platforms that act as PSL (users register sub-domains)
  // These are NOT two-part TLDs but are treated as public suffixes by browsers.
  // Including them protects user-owned subdomains from being over-aggregated.
  // e.g. personal-blog.substack.com → substack.com (not personal-blog.substack.com)
])

// ── Known "effective TLD+1 = hostname" platforms ─────────────────────────────
// For these hosts the eTLD+1 IS the registered domain; subdomains are
// user-owned and must NOT be returned. We normalise to the platform domain.

const PLATFORM_DOMAINS: ReadonlySet<string> = new Set([
  'substack.com',
  'wordpress.com',
  'blogspot.com',
  'medium.com',
  'github.io',
  'gitlab.io',
  'netlify.app',
  'vercel.app',
  'pages.dev',
  'web.app',
  'firebaseapp.com',
])

// ── IP-address guards ─────────────────────────────────────────────────────────

const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/
// IPv6 addresses have colons; reject anything with colons (also catches [::1]).
function isIpAddress(hostname: string): boolean {
  return IPV4_RE.test(hostname) || hostname.includes(':')
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Derives the eTLD+1 (registrable domain) from a full URL string.
 *
 * Examples:
 *   "https://www.nytimes.com/article" → "nytimes.com"
 *   "https://personal-blog.substack.com/p/post" → "substack.com"
 *   "https://www.bbc.co.uk/news" → "bbc.co.uk"
 *   "https://news.gov.au/story" → "gov.au"   (3-label: news.gov.au → gov.au is PSL → need 4th)
 *
 * Returns null for:
 *   - Unparseable URLs
 *   - localhost / IP addresses
 *   - Single-label hostnames (e.g. "intranet")
 *
 * @param url - Full URL string (https://hostname/path...)
 */
export function getEtld1(url: string): string | null {
  let hostname: string
  try {
    hostname = new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }

  // Reject IP addresses and localhost
  if (hostname === 'localhost' || isIpAddress(hostname)) return null

  const labels = hostname.split('.')
  // Need at least 2 labels (e.g. "nytimes.com")
  if (labels.length < 2) return null

  // Check for known platform domains (user-owned subdomains)
  // Walk from 2 labels upward looking for a platform match
  for (let n = 2; n <= labels.length; n++) {
    const candidate = labels.slice(labels.length - n).join('.')
    if (PLATFORM_DOMAINS.has(candidate)) {
      return candidate
    }
  }

  // Check for two-part public suffixes
  // e.g. hostname = "www.bbc.co.uk" → labels = ["www","bbc","co","uk"]
  // two-part TLD candidate = "co.uk" → match → return "bbc.co.uk" (labels[-3..])
  if (labels.length >= 3) {
    const twoPartCandidate = labels.slice(-2).join('.')
    if (TWO_PART_SUFFIXES.has(twoPartCandidate)) {
      // eTLD+1 = label before two-part TLD + two-part TLD
      return labels.slice(-3).join('.')
    }
  }

  // Default: last 2 labels
  return labels.slice(-2).join('.')
}

/**
 * Extracts eTLD+1 from a hostname string directly (without URL parsing).
 * Useful when the caller already has a hostname.
 *
 * @param hostname - bare hostname (no scheme, no path)
 */
export function getEtld1FromHostname(hostname: string): string | null {
  const normalised = hostname.toLowerCase().replace(/^www\./, '')
  return getEtld1(`https://${normalised}`)
}
