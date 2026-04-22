import { describe, it, expect } from 'vitest'
import { normalizeUrl, resolveCanonicalUrl } from '../canonical-url'
import type { CanonicalSignals } from '../../shared/types'

// ─── normalizeUrl() ──────────────────────────────────────────────────────────

describe('normalizeUrl()', () => {
  it('strips utm_campaign and utm_source', () => {
    expect(normalizeUrl('https://nytimes.com/article?utm_campaign=nl&utm_source=email'))
      .toBe('https://nytimes.com/article')
  })

  it('strips fbclid', () => {
    expect(normalizeUrl('https://nytimes.com/article?fbclid=abc123'))
      .toBe('https://nytimes.com/article')
  })

  it('strips utm_medium but keeps meaningful id param', () => {
    expect(normalizeUrl('https://nytimes.com/article?id=12345&utm_medium=social'))
      .toBe('https://nytimes.com/article?id=12345')
  })

  it('strips fragment (#section-2)', () => {
    expect(normalizeUrl('https://nytimes.com/article#section-2'))
      .toBe('https://nytimes.com/article')
  })

  it('strips trailing slash from non-root pathname', () => {
    expect(normalizeUrl('https://nytimes.com/article/'))
      .toBe('https://nytimes.com/article')
  })

  it('preserves root trailing slash (bare origin)', () => {
    expect(normalizeUrl('https://nytimes.com/'))
      .toBe('https://nytimes.com/')
  })

  it('strips multiple tracking params and keeps non-tracking params', () => {
    expect(normalizeUrl('https://nytimes.com/article?utm_campaign=X&gclid=Y&id=42'))
      .toBe('https://nytimes.com/article?id=42')
  })

  it('strips _ga param', () => {
    expect(normalizeUrl('https://nytimes.com/article?_ga=2.123.456.789'))
      .toBe('https://nytimes.com/article')
  })

  it('returns malformed URL unchanged', () => {
    expect(normalizeUrl('not-a-url')).toBe('not-a-url')
  })

  it('strips igshid but keeps meaningful p param', () => {
    expect(normalizeUrl('https://example.com/article?igshid=abc&p=5'))
      .toBe('https://example.com/article?p=5')
  })

  it('strips at_campaign param', () => {
    expect(normalizeUrl('https://example.com/article?at_campaign=nl'))
      .toBe('https://example.com/article')
  })

  it('strips mc_cid and mc_eid params', () => {
    expect(normalizeUrl('https://example.com/article?mc_cid=abc&mc_eid=def'))
      .toBe('https://example.com/article')
  })

  it('handles empty string gracefully', () => {
    expect(normalizeUrl('')).toBe('')
  })

  it('strips both fragment and tracking params together', () => {
    expect(normalizeUrl('https://example.com/article?utm_source=twitter#top'))
      .toBe('https://example.com/article')
  })
})

// ─── resolveCanonicalUrl() ───────────────────────────────────────────────────

describe('resolveCanonicalUrl()', () => {
  const NULL_SIGNALS: CanonicalSignals = {
    linkCanonical: null,
    jsonLdUrl: null,
    ogUrl: null,
    twitterUrl: null,
  }

  it('returns normalized tabUrl when signals is undefined', () => {
    expect(resolveCanonicalUrl('https://example.com/article?utm_source=x'))
      .toBe('https://example.com/article')
  })

  it('returns normalized tabUrl when all signals are null', () => {
    expect(resolveCanonicalUrl('https://example.com/article?utm_source=x', NULL_SIGNALS))
      .toBe('https://example.com/article')
  })

  it('linkCanonical takes priority over all other signals', () => {
    const signals: CanonicalSignals = {
      linkCanonical: 'https://canonical.com/article',
      jsonLdUrl: 'https://jsonld.com/article',
      ogUrl: 'https://og.com/article',
      twitterUrl: 'https://twitter.com/article',
    }
    expect(resolveCanonicalUrl('https://tab.com/article', signals))
      .toBe('https://canonical.com/article')
  })

  it('falls through to jsonLdUrl when linkCanonical is null', () => {
    const signals: CanonicalSignals = {
      linkCanonical: null,
      jsonLdUrl: 'https://jsonld.com/article',
      ogUrl: 'https://og.com/article',
      twitterUrl: 'https://twitter.com/article',
    }
    expect(resolveCanonicalUrl('https://tab.com/article', signals))
      .toBe('https://jsonld.com/article')
  })

  it('falls through to ogUrl when linkCanonical and jsonLdUrl are null', () => {
    const signals: CanonicalSignals = {
      linkCanonical: null,
      jsonLdUrl: null,
      ogUrl: 'https://og.com/article',
      twitterUrl: 'https://twitter.com/article',
    }
    expect(resolveCanonicalUrl('https://tab.com/article', signals))
      .toBe('https://og.com/article')
  })

  it('falls through to twitterUrl when higher-priority signals are null', () => {
    const signals: CanonicalSignals = {
      linkCanonical: null,
      jsonLdUrl: null,
      ogUrl: null,
      twitterUrl: 'https://twitter.com/article',
    }
    expect(resolveCanonicalUrl('https://tab.com/article', signals))
      .toBe('https://twitter.com/article')
  })

  it('falls through to tabUrl when all signals are null', () => {
    expect(resolveCanonicalUrl('https://tab.com/article', NULL_SIGNALS))
      .toBe('https://tab.com/article')
  })

  it('normalizes the selected canonical URL (strips tracking params)', () => {
    const signals: CanonicalSignals = {
      linkCanonical: 'https://canonical.com/article?utm_campaign=nl&utm_source=email',
      jsonLdUrl: null,
      ogUrl: null,
      twitterUrl: null,
    }
    expect(resolveCanonicalUrl('https://tab.com/', signals))
      .toBe('https://canonical.com/article')
  })

  it('normalizes the tabUrl fallback (strips tracking params)', () => {
    expect(resolveCanonicalUrl('https://tab.com/article?fbclid=abc', NULL_SIGNALS))
      .toBe('https://tab.com/article')
  })

  it('handles empty-string canonical signal by falling through', () => {
    const signals: CanonicalSignals = {
      linkCanonical: '',
      jsonLdUrl: null,
      ogUrl: 'https://og.com/article',
      twitterUrl: null,
    }
    expect(resolveCanonicalUrl('https://tab.com/article', signals))
      .toBe('https://og.com/article')
  })
})
