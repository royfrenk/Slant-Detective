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

  // SD-053: AP News live blogs use LiveBlogPosting JSON-LD — must be treated as news.
  it('returns true for JSON-LD with LiveBlogPosting type (AP News live blog)', () => {
    const doc = makeDoc(`
      <html>
        <head>
          <title>Live Blog — AP News</title>
          <script type="application/ld+json">
            {"@context":"https://schema.org","@type":"LiveBlogPosting","headline":"Live coverage"}
          </script>
        </head>
        <body><div>Timeline of updates</div></body>
      </html>
    `);
    expect(isNewsPage(doc, 50)).toBe(true);
  });

  // SD-053: NewsArticle subtypes (ReportageNewsArticle, OpinionNewsArticle, etc.)
  it('returns true for JSON-LD with ReportageNewsArticle type', () => {
    const doc = makeDoc(`
      <html>
        <head>
          <script type="application/ld+json">
            {"@context":"https://schema.org","@type":"ReportageNewsArticle","headline":"Report"}
          </script>
        </head>
        <body><p>Content</p></body>
      </html>
    `);
    expect(isNewsPage(doc, 100)).toBe(true);
  });

  it('returns true for JSON-LD with OpinionNewsArticle type', () => {
    const doc = makeDoc(`
      <html>
        <head>
          <script type="application/ld+json">
            {"@context":"https://schema.org","@type":"OpinionNewsArticle","headline":"Op-ed"}
          </script>
        </head>
        <body><p>Content</p></body>
      </html>
    `);
    expect(isNewsPage(doc, 100)).toBe(true);
  });

  // SD-053: URL-path heuristic recognises /article/ and /live/ conventions.
  it('returns true when URL contains /article/ path segment (AP News article)', () => {
    const doc = makeDoc(`
      <html>
        <head><title>Page</title></head>
        <body><div>Content</div></body>
      </html>
    `);
    expect(
      isNewsPage(doc, 50, 'https://apnews.com/article/pentagon-navy-secretary'),
    ).toBe(true);
  });

  it('returns true when URL contains /live/ path segment (AP News live blog)', () => {
    const doc = makeDoc(`
      <html>
        <head><title>Page</title></head>
        <body><div>Content</div></body>
      </html>
    `);
    expect(
      isNewsPage(doc, 50, 'https://apnews.com/live/iran-war-israel-trump-04-22-2026'),
    ).toBe(true);
  });

  it('returns true when URL contains /news/ path segment', () => {
    const doc = makeDoc('<html><head><title>Page</title></head><body><p>Hi</p></body></html>');
    expect(isNewsPage(doc, 50, 'https://bbc.com/news/world-us-canada-12345678')).toBe(true);
  });

  // SD-053: lowered floor from 400 → 150 so short hard-news briefs pass.
  it('returns true for a 200-word page with no article signals (short hard-news brief)', () => {
    const doc = makeDoc('<html><head><title>Brief</title></head><body><p>Content</p></body></html>');
    expect(isNewsPage(doc, 200)).toBe(true);
  });

  it('still returns false for truly thin pages with no article signals (< 150 words)', () => {
    const doc = makeDoc('<html><head><title>Shell</title></head><body><p>hi</p></body></html>');
    expect(isNewsPage(doc, 80)).toBe(false);
  });

  it('still returns false for product pages even with /article/ pattern absent', () => {
    const doc = makeDoc(`
      <html>
        <head>
          <meta property="og:type" content="product" />
        </head>
        <body><div>Product listing</div></body>
      </html>
    `);
    expect(
      isNewsPage(doc, 80, 'https://shop.example.com/products/widget-pro'),
    ).toBe(false);
  });

  // SD-057: menshealth.com /fitness/ URLs don't match NEWS_URL_PATH_RE but the
  // page emits <article> — isNewsPage must return true via the article-element
  // positive signal (first check, short-circuit).
  it('isNewsPage: menshealth fitness URL with article element returns true', () => {
    const doc = makeDoc(`
      <html>
        <head><title>Best Weighted Vests for Workouts — Men's Health</title></head>
        <body>
          <article>
            <h1>Best Weighted Vests for Workouts</h1>
            <p>Weighted vests add resistance to your training and build strength over time.</p>
          </article>
        </body>
      </html>
    `);
    expect(
      isNewsPage(
        doc,
        200,
        'https://www.menshealth.com/fitness/a22115800/best-weighted-vests-for-workouts/',
      ),
    ).toBe(true);
  });
});
