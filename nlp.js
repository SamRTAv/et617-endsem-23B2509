/* Bhojpurify · ET617 · 23B2509
 * NLP layer (DESIGN.md §D6):
 *   - normalise(): Unicode NFC + punctuation stripping (ड़ U+095C ≡ ड + nukta U+093C)
 *   - classify(): rule-based spelling-error classifier → CORRECT | M1 | OVER | M2_D | M2_R | M2_DH | POS | OVER_D | OTHER
 *   - judgeSpeech(): checks ASR alternatives against the standard word + accepted dialect variants
 *   - graphemes(): akshara segmentation for tiles and the "अक्षर तोड़ो" tool
 * Works in the browser (globals) and in Node (module.exports) for tests.
 */
'use strict';

const NUKTA = '़';
const RH = 'ड़';   // ड़ after NFC
const RHH = 'ढ़';  // ढ़ after NFC
const TOK_RH = 'Ɖ', TOK_RHH = 'Ŧ';

function N(s) { return String(s == null ? '' : s).normalize('NFC'); }

/** Normalise a word for comparison: NFC, drop spaces, punctuation and danda. */
function normalise(s) {
  return N(s).replace(/[\s।॥.,!?;:'"“”‘’()\-]/g, '');
}

/** Turn ड़ / ढ़ (two code points after NFC) into single tokens so positions line up. */
function tok(s) {
  return [...normalise(s).split(RH).join(TOK_RH).split(RHH).join(TOK_RHH)];
}

const SUBST = {
  'श>स': 'M1', 'स>श': 'OVER',
  [TOK_RH + '>ड']: 'M2_D', [TOK_RH + '>र']: 'M2_R',
  [TOK_RHH + '>ढ']: 'M2_DH', [TOK_RHH + '>र']: 'M2_DH',
  ['ड>' + TOK_RH]: 'OVER_D', ['ढ>' + TOK_RHH]: 'OVER_D'
};

/** Classify a written response against the target word. Deterministic. */
function classify(target, response) {
  const t = tok(target), r = tok(response);
  if (t.join('') === r.join('')) return 'CORRECT';
  if (r[0] === TOK_RH || r[0] === TOK_RHH) return 'POS';
  if (t.length !== r.length) return 'OTHER';
  let label = null;
  for (let i = 0; i < t.length; i++) {
    if (t[i] === r[i]) continue;
    const l = SUBST[t[i] + '>' + r[i]];
    if (!l) return 'OTHER';
    if (!label) label = l;
  }
  return label || 'OTHER';
}

/** Levenshtein distance on token arrays. */
function lev(a, b) {
  a = tok(a); b = tok(b);
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[a.length][b.length];
}

/**
 * Judge speech-recognition alternatives (§D6.1).
 * @param {string} word       standard word
 * @param {string[]} variants accepted regional pronunciations
 * @param {{text:string, conf:number}[]} alts ASR alternatives
 * @returns {{result:'SPEECH_STD'|'SPEECH_VAR'|'SPEECH_NEAR'|'SPEECH_UNCLEAR', heard:string}}
 */
function judgeSpeech(word, variants, alts) {
  const W = normalise(word);
  const V = (variants || []).map(normalise);
  const candidates = [];
  (alts || []).forEach(a => {
    const text = N(a && a.text).trim();
    if (!text) return;
    candidates.push(text);
    text.split(/\s+/).forEach(w => { if (w && w !== text) candidates.push(w); });
  });
  for (const c of candidates) if (normalise(c) === W) return { result: 'SPEECH_STD', heard: c };
  for (const c of candidates) if (V.includes(normalise(c))) return { result: 'SPEECH_VAR', heard: c };
  for (const c of candidates) if (lev(c, word) <= 1) return { result: 'SPEECH_NEAR', heard: c };
  return { result: 'SPEECH_UNCLEAR', heard: candidates[0] || '' };
}

const _seg = (typeof Intl !== 'undefined' && Intl.Segmenter) ? new Intl.Segmenter('hi', { granularity: 'grapheme' }) : null;
function isCombining(cp) {
  return (cp >= 0x0900 && cp <= 0x0903) || (cp >= 0x093A && cp <= 0x094F) ||
         (cp >= 0x0951 && cp <= 0x0957) || cp === 0x0962 || cp === 0x0963;
}
/** Split a Devanagari word into aksharas (grapheme clusters), joining conjuncts across virama. */
function graphemes(word) {
  const w = N(word);
  let parts;
  if (_seg) parts = Array.from(_seg.segment(w), s => s.segment);
  else {
    parts = [];
    for (const ch of w) {
      const cp = ch.codePointAt(0);
      if (parts.length && isCombining(cp)) parts[parts.length - 1] += ch;
      else parts.push(ch);
    }
  }
  // join clusters that end in virama with the next consonant (conjuncts)
  const out = [];
  for (const p of parts) {
    if (out.length && out[out.length - 1].endsWith('्')) out[out.length - 1] += p;
    else out.push(p);
  }
  return out;
}

/** Index of a letter in a word (NFC); for a bare letter, skip occurrences followed by a nukta. */
function findLetter(word, letter) {
  const w = N(word), L = N(letter);
  let from = 0;
  while (true) {
    const i = w.indexOf(L, from);
    if (i < 0) return -1;
    if (L.length === 1 && w[i + 1] === NUKTA) { from = i + 1; continue; }
    return i;
  }
}

const NLP = { N, normalise, tok, classify, lev, judgeSpeech, graphemes, findLetter, isCombining, RH, RHH, NUKTA };
if (typeof module !== 'undefined' && module.exports) module.exports = NLP;
