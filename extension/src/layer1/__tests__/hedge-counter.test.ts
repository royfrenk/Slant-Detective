import { describe, it, expect } from 'vitest';
import { countHedges } from '../hedge-counter';

// ---------------------------------------------------------------------------
// Basic counting
// ---------------------------------------------------------------------------

describe('countHedges()', () => {
  it('returns count = 0 and empty hits for a body with no hedges', () => {
    const result = countHedges('The president signed the bill into law on Friday.');
    expect(result.count).toBe(0);
    expect(result.hits).toHaveLength(0);
  });

  it('returns the correct count for a synthetic article with 8 known hedges', () => {
    const body = [
      'Sources said the senator allegedly accepted funds.',   // allegedly
      'The official reportedly denied the claims.',           // reportedly
      'Experts argue it is presumably a mistake.',            // presumably
      'The report supposedly contradicts earlier findings.',  // supposedly
      'Analysts say it is apparently misleading.',            // apparently
      'The committee could not confirm the numbers.',         // could
      'Officials might announce a decision next week.',       // might
      'The government may respond by end of month.',          // may
    ].join(' ');

    const result = countHedges(body);
    expect(result.count).toBe(8);
    expect(result.hits).toHaveLength(8);
  });

  // ---------------------------------------------------------------------------
  // Multi-word phrase priority
  // ---------------------------------------------------------------------------

  it('detects "may have" as a single hit, not two separate hits', () => {
    const body = 'The source may have known about the issue in advance.';
    const result = countHedges(body);

    const mayHaveHits = result.hits.filter((h) => h.surface === 'may have');
    const mayHits = result.hits.filter((h) => h.surface === 'may');

    expect(mayHaveHits).toHaveLength(1);
    expect(mayHits).toHaveLength(0); // "may" alone should not produce a separate hit
  });

  it('detects "might have" as a single hit', () => {
    const body = 'She might have been unaware of the policy.';
    const result = countHedges(body);

    const mightHaveHits = result.hits.filter((h) => h.surface === 'might have');
    expect(mightHaveHits).toHaveLength(1);

    const mightHits = result.hits.filter((h) => h.surface === 'might');
    expect(mightHits).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // Offset round-trip
  // ---------------------------------------------------------------------------

  it('returns correct character offsets (round-trip: body.slice(offset, offset+length) matches surface)', () => {
    const body = 'Officials reportedly confirmed that the agency could act.';
    const result = countHedges(body);

    expect(result.hits.length).toBeGreaterThan(0);

    for (const hit of result.hits) {
      const extracted = body.slice(hit.offset, hit.offset + hit.length).toLowerCase();
      expect(extracted).toBe(hit.surface);
    }
  });

  // ---------------------------------------------------------------------------
  // Case-insensitivity
  // ---------------------------------------------------------------------------

  it('matches "Allegedly" (capitalised) the same as "allegedly"', () => {
    const body1 = 'The official allegedly took the money.';
    const body2 = 'The official Allegedly took the money.';

    const result1 = countHedges(body1);
    const result2 = countHedges(body2);

    expect(result1.count).toBe(1);
    expect(result2.count).toBe(1);
    // Both should produce the same lowercase surface
    expect(result1.hits[0].surface).toBe('allegedly');
    expect(result2.hits[0].surface).toBe('allegedly');
  });

  it('matches "REPORTEDLY" (all-caps) as a single hedge hit', () => {
    const body = 'The company REPORTEDLY filed for bankruptcy.';
    const result = countHedges(body);
    expect(result.count).toBe(1);
    expect(result.hits[0].surface).toBe('reportedly');
  });

  // ---------------------------------------------------------------------------
  // Offset accuracy on known text
  // ---------------------------------------------------------------------------

  it('returns the correct offset for a known phrase position', () => {
    const body = 'The policy is apparently flawed.';
    // "apparently" starts at index 17
    const expected = body.indexOf('apparently');

    const result = countHedges(body);
    expect(result.count).toBe(1);
    expect(result.hits[0].offset).toBe(expected);
    expect(result.hits[0].length).toBe('apparently'.length);
  });
});
