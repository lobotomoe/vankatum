/**
 * Character-changing breaks as libhyphen NON-STANDARD hyphenation rules.
 *
 * Liang patterns are letter-preserving, so the .tex/.json/.hyb artifacts cannot
 * write the epenthetic ը inside a vowelless consonant cluster (գրել -> գը-րել,
 * հնդստան -> հըն-/հնդըս-). libhyphen's NON-STANDARD hyphenation can (it changes
 * characters at the break), so these rules go into hyph_hy_AM.dic only
 * (assembled by ./build.mjs).
 *
 * The other letter-changing break, և spelled out before a vowel (Ե-րե-վան), is
 * deliberately absent: it changes text AFTER the break, and LibreOffice Writer
 * cannot render that (see assertChangeBeforeBreak). Format (see SOURCES.md §F):
 *
 *     <pattern>/<replacement>,<start>,<cut>
 *
 * where the odd digit in <pattern> marks the break, <replacement> is the text
 * shown instead of the <cut> letters starting at 1-based letter <start> of the
 * pattern, with "=" at the line break. Verified end to end against the real
 * libhyphen by tools/emit/e2e/.
 */

import { syllabifyWithSchwa } from "../../../dist/index.js";

const SCHWA = "ը";
/** Max Liang level: beats every inhibiting pattern patgen may have learned at the gap. */
const PRIORITY = 9;

/**
 * The epenthetic-schwa breaks of a word: for each syllable boundary whose LEFT
 * syllable gained a ը, returns {breakAt, start, lo, ld} in original coordinates.
 */
function schwaBreaks(word) {
  const orig = [...word];
  const syllables = syllabifyWithSchwa(word);
  const breaks = [];
  let oi = 0;

  for (let s = 0; s < syllables.length; s++) {
    const display = [...syllables[s]];
    const start = oi; // original index where this syllable begins
    let lo = "";
    let epenthetic = false;
    for (const ch of display) {
      if (oi < orig.length && ch === orig[oi]) {
        lo += ch;
        oi += 1;
      } else if (ch === SCHWA) {
        epenthetic = true;
      }
    }
    if (epenthetic && s < syllables.length - 1 && lo.length > 0) {
      breaks.push({ breakAt: oi, start, lo, ld: syllables[s] });
    }
  }
  return breaks;
}

/**
 * Schwa rules. Each rule is WHOLE-WORD anchored (`.word.`) so it fires only on
 * that exact word — local (substring) rules interfere across words and cannot be
 * made mutually exclusive without patgen, which has no non-standard mode.
 * Whole-word anchoring collides on a word with two schwa breaks (same letter
 * key), so only single-schwa-break words are emitted; multi-break words fall
 * back to the runtime engine (safe under-hyphenation).
 */
export function buildSchwaLines(words) {
  const lines = [];
  for (const word of words) {
    const breaks = schwaBreaks(word);
    if (breaks.length !== 1) continue;
    const { breakAt, start, lo, ld } = breaks[0];
    const chars = [...word];
    const left = chars.slice(0, breakAt).join("");
    const right = chars.slice(breakAt).join("");
    lines.push(`.${left}${PRIORITY}${right}./${ld}=,${start + 1},${lo.length}`);
  }
  return lines.sort();
}

/**
 * Refuse a rule that changes letters after its break. LibreOffice Writer
 * (SvxGetAltSpelling, editeng/source/misc/unolingu.cxx) places the whole
 * replacement before the hyphen and keeps the original letters after it, so the
 * text after "=" must be exactly the word's own letters there. Every
 * non-standard rule LibreOffice ships fits (asz-szony, till-lata); a rule like
 * և9ա/ե=վա,1,2 does not, and Writer draws Երեվ-ան instead of Ե-րե-վան.
 */
export function assertChangeBeforeBreak(rule) {
  const match = /^([^/]+)\/([^,]*)=([^,]*),(\d+),(\d+)$/u.exec(rule);
  if (match === null) throw new Error(`not a non-standard rule: ${rule}`);
  const [, pattern, , after, start, cut] = match;
  const letters = [];
  let breakAt;
  for (const ch of pattern) {
    if (/\d/u.test(ch)) {
      if (Number(ch) % 2 === 1) breakAt = letters.length;
    } else if (ch !== ".") {
      letters.push(ch);
    }
  }
  if (breakAt === undefined) throw new Error(`no break in non-standard rule: ${rule}`);
  const cutEnd = Number(start) - 1 + Number(cut);
  const original = letters.slice(breakAt, cutEnd).join("");
  if (after !== original) {
    throw new Error(`rule changes letters after its break (LibreOffice cannot render it): ${rule}`);
  }
}
