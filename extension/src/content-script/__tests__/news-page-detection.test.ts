import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { isNewsPage } from '../index';

function makeDoc(html: string): Document {
  return new JSDOM(html).window.document;
}

describe('isNewsPage()', () => {
  it('returns true for NYT-style article page (has <article>, og:type=article, high word count)', () => {
    const doc = makeDoc(`
      <html>
        <head>
          <title>Breaking News — NYT</title>
          <meta property="og:type" content="article" />
        </head>
        <body>
          <article>
            <h1>Breaking News</h1>
            <p>Article body content.</p>
          </article>
        </body>
      </html>
    `);
    expect(isNewsPage(doc, 800)).toBe(true);
  });

  it('returns false for NYT homepage (no article signals, low word count)', () => {
    const doc = makeDoc(`
      <html>
        <head><title>The New York Times - Breaking News</title></head>
        <body>
          <nav>Navigation links</nav>
          <div class="homepage-grid">
            <div class="story-link">Read story</div>
            <div class="story-link">Another story</div>
          </div>
          <footer>Footer</footer>
        </body>
      </html>
    `);
    expect(isNewsPage(doc, 120)).toBe(false);
  });

  it('returns false for product page (no article signals, low word count)', () => {
    const doc = makeDoc(`
      <html>
        <head>
          <title>Buy Widget Pro — WidgetShop</title>
          <meta property="og:type" content="product" />
        </head>
        <body>
          <div class="product-listing">
            <h1>Widget Pro</h1>
            <p>Buy now for $49.99</p>
          </div>
        </body>
      </html>
    `);
    expect(isNewsPage(doc, 200)).toBe(false);
  });

  it('returns true for blog post with JSON-LD BlogPosting type', () => {
    const doc = makeDoc(`
      <html>
        <head>
          <title>My Blog Post</title>
          <script type="application/ld+json">
            {"@context":"https://schema.org","@type":"BlogPosting","headline":"My Blog Post"}
          </script>
        </head>
        <body>
          <div class="blog-content">
            <h1>My Blog Post</h1>
            <p>Some content here.</p>
          </div>
        </body>
      </html>
    `);
    expect(isNewsPage(doc, 150)).toBe(true);
  });

  it('returns true for long-form essay (no article tag but 600 words)', () => {
    const doc = makeDoc(`
      <html>
        <head><title>Long Essay</title></head>
        <body>
          <div class="content">
            <h1>An Essay</h1>
            <p>Content without article tag.</p>
          </div>
        </body>
      </html>
    `);
    expect(isNewsPage(doc, 600)).toBe(true);
  });

  it('returns true for JSON-LD with array @type including NewsArticle', () => {
    const doc = makeDoc(`
      <html>
        <head>
          <title>News Article</title>
          <script type="application/ld+json">
            {"@context":"https://schema.org","@type":["NewsArticle","Thing"],"headline":"News"}
          </script>
        </head>
        <body>
          <div>Content</div>
        </body>
      </html>
    `);
    expect(isNewsPage(doc, 100)).toBe(true);
  });

  it('does not throw on malformed JSON-LD and continues evaluation', () => {
    const doc = makeDoc(`
      <html>
        <head>
          <title>Page With Bad JSON-LD</title>
          <script type="application/ld+json">{invalid json here</script>
        </head>
        <body>
          <article>
            <p>Article content.</p>
          </article>
        </body>
      </html>
    `);
    // Should not throw, and should return true because <article> is present
    expect(() => isNewsPage(doc, 100)).not.toThrow();
    expect(isNewsPage(doc, 100)).toBe(true);
  });

  it('returns true when only og:type=article is present (no <article> tag, low word count)', () => {
    const doc = makeDoc(`
      <html>
        <head>
          <title>Paywalled Article</title>
          <meta property="og:type" content="article" />
        </head>
        <body>
          <div class="paywall-wrapper">
            <p>Subscribe to read more.</p>
          </div>
        </body>
      </html>
    `);
    expect(isNewsPage(doc, 50)).toBe(true);
  });

  it('returns true for JSON-LD with Article type', () => {
    const doc = makeDoc(`
      <html>
        <head>
          <title>Article Page</title>
          <script type="application/ld+json">
            {"@context":"https://schema.org","@type":"Article","headline":"Test"}
          </script>
        </head>
        <body><p>Content</p></body>
      </html>
    `);
    expect(isNewsPage(doc, 100)).toBe(true);
  });
});
