import type { StemmedLexicon } from '../shared/types';

// Inline Porter stemmer — replaces the `natural` package import.
// M.F. Porter, "An algorithm for suffix stripping", Program 14(3): 130–137 (1980)
// Produces equivalent output to natural's PorterStemmer.stem() for English words.

function isCons(word: string, i: number): boolean {
  const c = word[i];
  if ('aeiou'.includes(c)) return false;
  if (c === 'y') return i === 0 || !isCons(word, i - 1);
  return true;
}

// Count (VC) sequences: m = number of vowel-run → consonant-run transitions.
function measure(word: string): number {
  let m = 0;
  let i = 0;
  const n = word.length;
  while (i < n && isCons(word, i)) i++;
  while (i < n) {
    while (i < n && !isCons(word, i)) i++;
    if (i >= n) break;
    while (i < n && isCons(word, i)) i++;
    m++;
  }
  return m;
}

function hasVowel(word: string): boolean {
  for (let i = 0; i < word.length; i++) {
    if (!isCons(word, i)) return true;
  }
  return false;
}

function endsDoubleC(word: string): boolean {
  const n = word.length;
  return n >= 2 && word[n - 1] === word[n - 2] && isCons(word, n - 1);
}

function endsCVC(word: string): boolean {
  const n = word.length;
  if (n < 3) return false;
  return (
    isCons(word, n - 3) &&
    !isCons(word, n - 2) &&
    isCons(word, n - 1) &&
    !'wxy'.includes(word[n - 1])
  );
}

function tryRule(word: string, suf: string, rep: string, minM: number): string | null {
  if (!word.endsWith(suf)) return null;
  const stem = word.slice(0, word.length - suf.length);
  return measure(stem) >= minM ? stem + rep : null;
}

export function stemToken(word: string): string {
  word = word.toLowerCase();
  if (word.length <= 2) return word;

  // Step 1a
  if (word.endsWith('sses')) {
    word = word.slice(0, -4) + 'ss';
  } else if (word.endsWith('ies')) {
    word = word.slice(0, -3) + 'i';
  } else if (!word.endsWith('ss') && word.endsWith('s')) {
    word = word.slice(0, -1);
  }

  // Step 1b
  let step1bFlag = false;
  if (word.endsWith('eed')) {
    const r = tryRule(word, 'eed', 'ee', 1);
    if (r !== null) word = r;
  } else if (word.endsWith('ed')) {
    const stem = word.slice(0, -2);
    if (hasVowel(stem)) { word = stem; step1bFlag = true; }
  } else if (word.endsWith('ing')) {
    const stem = word.slice(0, -3);
    if (hasVowel(stem)) { word = stem; step1bFlag = true; }
  }

  if (step1bFlag) {
    if (word.endsWith('at')) word += 'e';
    else if (word.endsWith('bl')) word += 'e';
    else if (word.endsWith('iz')) word += 'e';
    else if (endsDoubleC(word) && !'lsz'.includes(word[word.length - 1])) word = word.slice(0, -1);
    else if (measure(word) === 1 && endsCVC(word)) word += 'e';
  }

  // Step 1c
  if (word.endsWith('y')) {
    const stem = word.slice(0, -1);
    if (hasVowel(stem)) word = stem + 'i';
  }

  // Step 2 — m > 0
  const STEP2: [string, string][] = [
    ['ational', 'ate'], ['tional', 'tion'], ['enci', 'ence'], ['anci', 'ance'],
    ['izer', 'ize'], ['bli', 'ble'], ['alli', 'al'], ['entli', 'ent'],
    ['eli', 'e'], ['ousli', 'ous'], ['ization', 'ize'], ['ation', 'ate'],
    ['ator', 'ate'], ['alism', 'al'], ['iveness', 'ive'], ['fulness', 'ful'],
    ['ousness', 'ous'], ['aliti', 'al'], ['iviti', 'ive'], ['biliti', 'ble'],
    ['logi', 'log'],
  ];
  for (const [s, r] of STEP2) {
    const result = tryRule(word, s, r, 1);
    if (result !== null) { word = result; break; }
  }

  // Step 3 — m > 0
  const STEP3: [string, string][] = [
    ['icate', 'ic'], ['ative', ''], ['alize', 'al'], ['iciti', 'ic'],
    ['ical', 'ic'], ['ful', ''], ['ness', ''],
  ];
  for (const [s, r] of STEP3) {
    const result = tryRule(word, s, r, 1);
    if (result !== null) { word = result; break; }
  }

  // Step 4 — m > 1 (ordered per Porter's original spec)
  const STEP4: [string, string][] = [
    ['al', ''], ['ance', ''], ['ence', ''], ['er', ''], ['ic', ''],
    ['able', ''], ['ible', ''], ['ant', ''], ['ement', ''], ['ment', ''],
    ['ent', ''], ['ism', ''], ['ate', ''], ['iti', ''], ['ous', ''],
    ['ive', ''], ['ize', ''],
  ];
  for (const [s, r] of STEP4) {
    const result = tryRule(word, s, r, 2);
    if (result !== null) { word = result; break; }
  }
  // Special step 4 rule: (m>1 AND preceding S or T) ION →
  if (word.endsWith('ion')) {
    const stem = word.slice(0, -3);
    if (measure(stem) > 1 && stem.length > 0 && 'st'.includes(stem[stem.length - 1])) {
      word = stem;
    }
  }

  // Step 5a
  if (word.endsWith('e')) {
    const stem = word.slice(0, -1);
    if (measure(stem) > 1 || (measure(stem) === 1 && !endsCVC(stem))) {
      word = stem;
    }
  }

  // Step 5b
  if (measure(word) > 1 && endsDoubleC(word) && word.endsWith('l')) {
    word = word.slice(0, -1);
  }

  return word;
}

export function tokenize(text: string): string[] {
  return text.toLowerCase().match(/\b[a-z]{3,}\b/g) ?? [];
}

export function matchesBiasWord(token: string, lexicon: StemmedLexicon): boolean {
  return lexicon.has(stemToken(token));
}
