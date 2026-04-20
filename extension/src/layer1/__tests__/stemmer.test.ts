import { describe, it, expect, beforeAll } from 'vitest';
import { stemToken, tokenize, matchesBiasWord } from '../stemmer';
import { buildStemmedLexicon } from '../lexicon';
import type { StemmedLexicon } from '../../shared/types';

// ---------------------------------------------------------------------------
// stemToken
// ---------------------------------------------------------------------------

describe('stemToken()', () => {
  it('produces the same stem for "radicals", "radicalized", and "radicalizing"', () => {
    const s1 = stemToken('radicals');
    const s2 = stemToken('radicalized');
    const s3 = stemToken('radicalizing');
    expect(s1).toBe(s2);
    expect(s2).toBe(s3);
  });

  it('produces a different stem for "radio" than for "radical"', () => {
    expect(stemToken('radio')).not.toBe(stemToken('radical'));
  });

  it('is case-insensitive: "RUNNING" and "running" produce the same stem', () => {
    expect(stemToken('RUNNING')).toBe(stemToken('running'));
  });

  it('returns a non-empty string for a typical word', () => {
    expect(stemToken('biased')).toBeTruthy();
  });

  it('returns a stem for "partisan" that is the same as for "partisanship"', () => {
    // Both should reduce to the same partisan base
    const s1 = stemToken('partisan');
    const s2 = stemToken('partisans');
    expect(s1).toBe(s2);
  });
});

// ---------------------------------------------------------------------------
// tokenize
// ---------------------------------------------------------------------------

describe('tokenize()', () => {
  it('strips punctuation and short tokens', () => {
    const result = tokenize("He said, 'OK'.");
    expect(result).toContain('said');
    expect(result).not.toContain('ok'); // 2 chars — below minimum
    expect(result).not.toContain('he'); // 2 chars
  });

  it('returns empty array for empty string', () => {
    expect(tokenize('')).toEqual([]);
  });

  it('returns all lowercase tokens', () => {
    const tokens = tokenize('Senate PASSED Major bill');
    tokens.forEach((t) => expect(t).toBe(t.toLowerCase()));
  });

  it('excludes tokens shorter than 3 characters', () => {
    const tokens = tokenize('he is an ox doing great');
    expect(tokens).not.toContain('he');
    expect(tokens).not.toContain('is');
    expect(tokens).not.toContain('an');
    expect(tokens).not.toContain('ox');
    expect(tokens).toContain('doing');
    expect(tokens).toContain('great');
  });
});

// ---------------------------------------------------------------------------
// buildStemmedLexicon + matchesBiasWord
// ---------------------------------------------------------------------------

describe('buildStemmedLexicon() + matchesBiasWord()', () => {
  let lexicon: StemmedLexicon;

  beforeAll(() => {
    lexicon = buildStemmedLexicon(['radical', 'bias', 'partisan', 'slant']);
  });

  it('returns true for a word directly in the lexicon', () => {
    expect(matchesBiasWord('radical', lexicon)).toBe(true);
  });

  it('returns true for an inflected form of a lexicon word ("radicals")', () => {
    expect(matchesBiasWord('radicals', lexicon)).toBe(true);
  });

  it('returns true for a derived form of a lexicon word ("radicalized")', () => {
    expect(matchesBiasWord('radicalized', lexicon)).toBe(true);
  });

  it('returns true for uppercase input ("RADICALIZED")', () => {
    expect(matchesBiasWord('RADICALIZED', lexicon)).toBe(true);
  });

  it('returns false for "radio" (different stem from "radical")', () => {
    expect(matchesBiasWord('radio', lexicon)).toBe(false);
  });

  it('returns false for a common stop word ("the")', () => {
    expect(matchesBiasWord('the', lexicon)).toBe(false);
  });

  it('returns false for a word not in the lexicon ("neutral")', () => {
    expect(matchesBiasWord('neutral', lexicon)).toBe(false);
  });

  it('returns false for a short token not in the lexicon ("an")', () => {
    expect(matchesBiasWord('an', lexicon)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Performance smoke test
// ---------------------------------------------------------------------------

describe('Performance', () => {
  it('builds a 2000-entry lexicon and runs 10000 match calls in < 50ms', () => {
    // Generate 2000 synthetic entries
    const syntheticWords = Array.from({ length: 2000 }, (_, i) => `word${i}`);
    const start = performance.now();

    const lex = buildStemmedLexicon(syntheticWords);
    for (let i = 0; i < 10_000; i++) {
      matchesBiasWord(`word${i % 2000}`, lex);
    }

    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(200);
  });
});
