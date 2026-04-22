import { describe, it, expect } from 'vitest'
import { getEtld1, getEtld1FromHostname } from '../etld'

// ── getEtld1 (full URL input) ────────────────────────────────────────────────

describe('getEtld1', () => {
  // Standard generic TLDs
  describe('generic TLDs (.com, .org, .net, .io, etc.)', () => {
    it('strips www. from nytimes.com', () => {
      expect(getEtld1('https://www.nytimes.com/article/foo')).toBe('nytimes.com')
    })

    it('handles bare nytimes.com', () => {
      expect(getEtld1('https://nytimes.com/article/foo')).toBe('nytimes.com')
    })

    it('handles deep subdomain on .com', () => {
      expect(getEtld1('https://news.eu.bbc.com/article')).toBe('bbc.com')
    })

    it('handles .org', () => {
      expect(getEtld1('https://www.propublica.org/investigation/foo')).toBe('propublica.org')
    })

    it('handles .net', () => {
      expect(getEtld1('https://politico.net/article')).toBe('politico.net')
    })

    it('handles .io', () => {
      expect(getEtld1('https://app.example.io/page')).toBe('example.io')
    })

    it('handles .ai', () => {
      expect(getEtld1('https://www.media.ai/post')).toBe('media.ai')
    })
  })

  // Two-part public suffixes (ccSLD)
  describe('two-part public suffixes', () => {
    it('handles bbc.co.uk', () => {
      expect(getEtld1('https://www.bbc.co.uk/news/article')).toBe('bbc.co.uk')
    })

    it('handles theguardian.com (NOT guardian.co.uk)', () => {
      expect(getEtld1('https://www.theguardian.com/world/article')).toBe('theguardian.com')
      expect(getEtld1('https://www.guardian.co.uk/world/article')).toBe('guardian.co.uk')
    })

    it('handles news.gov.au', () => {
      // gov.au is a two-part TLD → result = news.gov.au (3 labels: news + gov.au)
      expect(getEtld1('https://www.news.gov.au/story')).toBe('news.gov.au')
    })

    it('handles abc.net.au', () => {
      // net.au is a two-part TLD → result = abc.net.au
      expect(getEtld1('https://www.abc.net.au/news/article')).toBe('abc.net.au')
    })

    it('handles smh.com.au (Sydney Morning Herald)', () => {
      expect(getEtld1('https://www.smh.com.au/politics/article')).toBe('smh.com.au')
    })

    it('handles theindependent.co.uk', () => {
      expect(getEtld1('https://www.independent.co.uk/news/article')).toBe('independent.co.uk')
    })

    it('handles co.in', () => {
      expect(getEtld1('https://www.example.co.in/article')).toBe('example.co.in')
    })

    it('handles co.jp', () => {
      expect(getEtld1('https://www.asahi.co.jp/news')).toBe('asahi.co.jp')
    })

    it('handles com.br', () => {
      expect(getEtld1('https://www.folha.com.br/news')).toBe('folha.com.br')
    })

    it('handles org.uk', () => {
      expect(getEtld1('https://www.charity.org.uk/page')).toBe('charity.org.uk')
    })
  })

  // Platform domains (user-owned subdomains)
  describe('platform domains — user subdomains normalise to platform', () => {
    it('strips personal-blog.substack.com → substack.com', () => {
      expect(getEtld1('https://personal-blog.substack.com/p/post')).toBe('substack.com')
    })

    it('strips multi-subdomain substack', () => {
      expect(getEtld1('https://a.b.substack.com/p/post')).toBe('substack.com')
    })

    it('strips user.wordpress.com → wordpress.com', () => {
      expect(getEtld1('https://user.wordpress.com/post')).toBe('wordpress.com')
    })

    it('strips user.blogspot.com → blogspot.com', () => {
      expect(getEtld1('https://myblog.blogspot.com/2024/01/post.html')).toBe('blogspot.com')
    })

    it('strips user.medium.com → medium.com', () => {
      expect(getEtld1('https://author.medium.com/article-title')).toBe('medium.com')
    })

    it('strips user.github.io → github.io', () => {
      expect(getEtld1('https://user.github.io/repo/')).toBe('github.io')
    })

    it('strips app.netlify.app → netlify.app', () => {
      expect(getEtld1('https://my-site.netlify.app/')).toBe('netlify.app')
    })
  })

  // Null / invalid inputs
  describe('null / invalid inputs', () => {
    it('returns null for localhost', () => {
      expect(getEtld1('http://localhost:3000/page')).toBeNull()
    })

    it('returns null for IPv4 address', () => {
      expect(getEtld1('http://192.168.1.1/page')).toBeNull()
    })

    it('returns null for IPv6 address', () => {
      expect(getEtld1('http://[::1]/page')).toBeNull()
    })

    it('returns null for unparseable URL', () => {
      expect(getEtld1('not-a-url')).toBeNull()
    })

    it('returns null for single-label hostname', () => {
      expect(getEtld1('http://intranet/page')).toBeNull()
    })

    it('returns null for empty string', () => {
      expect(getEtld1('')).toBeNull()
    })
  })

  // Edge cases
  describe('edge cases', () => {
    it('ignores query string and fragment', () => {
      expect(getEtld1('https://www.nytimes.com/search?q=foo#section')).toBe('nytimes.com')
    })

    it('handles https vs http scheme identically', () => {
      expect(getEtld1('http://www.nytimes.com/article')).toBe('nytimes.com')
    })

    it('handles uppercase hostname by normalising to lowercase', () => {
      expect(getEtld1('https://WWW.NYTIMES.COM/article')).toBe('nytimes.com')
    })

    it('handles Breitbart', () => {
      expect(getEtld1('https://www.breitbart.com/news/story')).toBe('breitbart.com')
    })

    it('handles foxnews.com', () => {
      expect(getEtld1('https://www.foxnews.com/politics/article')).toBe('foxnews.com')
    })

    it('handles jacobinmag.com', () => {
      expect(getEtld1('https://jacobinmag.com/2024/01/article')).toBe('jacobinmag.com')
    })

    it('returns domain without port', () => {
      expect(getEtld1('https://example.com:8080/page')).toBe('example.com')
    })
  })
})

// ── getEtld1FromHostname ──────────────────────────────────────────────────────

describe('getEtld1FromHostname', () => {
  it('handles bare hostname', () => {
    expect(getEtld1FromHostname('nytimes.com')).toBe('nytimes.com')
  })

  it('strips www. prefix', () => {
    expect(getEtld1FromHostname('www.bbc.co.uk')).toBe('bbc.co.uk')
  })

  it('handles substack platform', () => {
    expect(getEtld1FromHostname('personal-blog.substack.com')).toBe('substack.com')
  })

  it('handles co.uk pattern', () => {
    expect(getEtld1FromHostname('news.independent.co.uk')).toBe('independent.co.uk')
  })

  it('returns null for localhost', () => {
    expect(getEtld1FromHostname('localhost')).toBeNull()
  })
})
