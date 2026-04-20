import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { extract } from '../src/content-script/extract';

/**
 * Smoke tests for extract().
 *
 * Manual verification pending: load-unpacked + click icon on
 * Reuters, BBC, NYT, AP News, The Guardian.
 */

const WORD_COUNT_FLOOR = 400;

function makeLongBody(wordCount: number): string {
  const sentence = 'The journalist reported that several sources confirmed the findings. ';
  const sentences = Math.ceil(wordCount / 10);
  return sentence.repeat(sentences);
}

function makeDocument(html: string): Document {
  const dom = new JSDOM(html, { url: 'https://example.com/article' });
  return dom.window.document;
}

function makeArticleDocument(title: string, bodyText: string): Document {
  const html = `<!DOCTYPE html>
<html>
  <head><title>${title}</title></head>
  <body>
    <article>
      <h1>${title}</h1>
      <p>${bodyText}</p>
    </article>
  </body>
</html>`;
  return makeDocument(html);
}

describe('extract()', () => {
  describe('happy path — article with sufficient content', () => {
    it('returns ok:true with title, body, and word_count for a full article', () => {
      const title = 'Senate Passes Major Infrastructure Bill';
      const bodyText = makeLongBody(500);
      const doc = makeArticleDocument(title, bodyText);

      const result = extract(doc);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.title).toBeTruthy();
      expect(result.body.length).toBeGreaterThan(0);
      expect(result.word_count).toBeGreaterThanOrEqual(WORD_COUNT_FLOOR);
    });

    it('includes offsets covering the entire body', () => {
      const doc = makeArticleDocument('Test Article', makeLongBody(500));

      const result = extract(doc);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.offsets).toHaveLength(1);
      expect(result.offsets[0].start).toBe(0);
      expect(result.offsets[0].end).toBe(result.body.length);
    });

    it('does not include HTML tags in body', () => {
      const doc = makeArticleDocument('Clean Body Test', makeLongBody(500));

      const result = extract(doc);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.body).not.toMatch(/<[^>]+>/);
    });
  });

  describe('failure path — empty or near-empty body', () => {
    it('returns extraction_failed for an empty body', () => {
      const doc = makeDocument(`<!DOCTYPE html>
<html>
  <head><title>Empty</title></head>
  <body></body>
</html>`);

      const result = extract(doc);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe('extraction_failed');
    });

    it('returns extraction_failed for a body with only whitespace', () => {
      const doc = makeDocument(`<!DOCTYPE html>
<html>
  <head><title>Whitespace</title></head>
  <body>   </body>
</html>`);

      const result = extract(doc);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe('extraction_failed');
    });
  });

  describe('short article — below 400 words', () => {
    it('returns ok:true with low word_count so Layer1View can show TooShortCard', () => {
      const doc = makeArticleDocument(
        'Short Piece',
        'This article is very short. It only has a few sentences and does not meet the minimum length requirement for analysis.',
      );

      const result = extract(doc);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.word_count).toBeGreaterThan(0);
      expect(result.word_count).toBeLessThan(400);
    });
  });

  describe('DOM safety — live document is not mutated', () => {
    it('does not remove elements from the provided document', () => {
      const doc = makeArticleDocument('Mutation Check', makeLongBody(500));
      const paragraphCountBefore = doc.querySelectorAll('p').length;

      extract(doc);

      const paragraphCountAfter = doc.querySelectorAll('p').length;
      expect(paragraphCountAfter).toBe(paragraphCountBefore);
    });

    it('does not alter the title element in the provided document', () => {
      const doc = makeArticleDocument('Original Title', makeLongBody(500));
      const originalTitle = doc.title;

      extract(doc);

      expect(doc.title).toBe(originalTitle);
    });
  });
});
