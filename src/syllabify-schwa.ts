/**
 * Right-to-left syllabification with schwa (ը) epenthesis.
 *
 * Implements Dolatian 2023 (see docs/SPEC.md): max syllable (C)(j)V(C)(C), coda
 * <=2 with falling sonority, onset maximised. Stranded consonants receive an
 * epenthetic schwa as their nucleus. Returns syllables with the schwa MATERIALISED
 * as ը — i.e. this is the orthographic (character-changing) form, used to validate
 * the rule against the Wiktionary gold and to drive the libhyphen non-standard
 * rules in the .dic artifact. The pure letter-preserving syllabify() lives in
 * hyphenate.ts.
 */

import { stripWordMarks, tokenize, type Unit } from "./alphabet.js";
import { resolveOrthography, type Variant } from "./orthography.js";

const SCHWA = "ը";

/**
 * Word-final ք (the old plural / case suffix) is an appendix: it closes any coda
 * regardless of sonority — ոտք, գնացք, կռիչք, աշխատանք — instead of taking a
 * schwa of its own. Zero counter-examples in the Wiktionary gold (docs/SPEC.md).
 */
const APPENDIX = "ք";
const MAX_CODA = 2;

const GLIDES = new Set("յւ"); // ւ occurs standalone in classical orthography
const LIQUIDS = new Set("րռլ");
const NASALS = new Set("մն");
const FRICATIVES = new Set("վզսժշղխհֆ");
const STOPS = new Set("բպփգկքդտթձծցջճչ");
const SIBILANTS = new Set("սշզժ");

/** Sonority, high → low (5 = glide … 1 = stop/affricate). */
function sonority(consonant: string): number {
  const c = consonant.toLowerCase();
  if (GLIDES.has(c)) return 5;
  if (LIQUIDS.has(c)) return 4;
  if (NASALS.has(c)) return 3;
  if (FRICATIVES.has(c)) return 2;
  return 1;
}

const isAppendix = (unit: Unit): boolean => unit.text.toLowerCase() === APPENDIX;

/**
 * May consonant `inner` stand before `coda` (the consonants already collected
 * to its right, innermost first)? Codas fall in sonority outward and hold at
 * most two consonants; an appendix ք is extrasyllabic — anything may precede it
 * and it does not count towards the limit (ոտք, առանցք-ներ).
 */
function extendsCoda(inner: Unit, coda: readonly Unit[]): boolean {
  const innermost = coda[0];
  if (innermost === undefined) return true;
  if (isAppendix(innermost)) return true;
  const outermost = coda[coda.length - 1];
  const core = outermost !== undefined && isAppendix(outermost) ? coda.length - 1 : coda.length;
  if (core >= MAX_CODA) return false;
  return sonority(inner.text) > sonority(innermost.text);
}

function syllabifyUnits(units: readonly Unit[]): string[] {
  const syllables: string[] = [];
  let i = units.length - 1;

  while (i >= 0) {
    const right = units[i] as Unit;
    if (right.kind === "separator") {
      syllables.unshift(right.text);
      i--;
      continue;
    }

    // 1. Coda: up to two consonants from the right.
    const coda: Unit[] = [];
    while (i >= 0) {
      const u = units[i] as Unit;
      if (u.kind !== "consonant" || !extendsCoda(u, coda)) break;
      coda.unshift(u);
      i--;
    }

    // 2. Nucleus + 3. onset (one consonant, onset maximisation).
    const onset: Unit[] = [];
    let nucleus: string;
    let epenthetic = false;
    const cur = i >= 0 ? (units[i] as Unit) : undefined;

    if (cur !== undefined && cur.kind === "vowel") {
      nucleus = cur.text;
      i--;
      const left = i >= 0 ? (units[i] as Unit) : undefined;
      if (left !== undefined && left.kind === "consonant") {
        onset.unshift(left);
        i--;
      }
    } else {
      nucleus = SCHWA;
      epenthetic = true;
      if (cur !== undefined && cur.kind === "consonant") {
        onset.unshift(cur);
        i--;
      } else {
        // No onset available (word edge): pull the innermost coda consonant to be
        // the onset, so a lone consonant surfaces as Cə, not əC (onset > coda).
        const inner = coda.shift();
        if (inner !== undefined) onset.unshift(inner);
      }
    }

    const onsetText = onset.map((u) => u.text).join("");
    const codaText = coda.map((u) => u.text).join("");
    const atWordStart = i < 0 || (units[i] as Unit).kind === "separator";
    const flip =
      epenthetic && atWordStart && codaText === "" && isSibilantBeforeStop(onsetText, syllables[0]);
    syllables.unshift(flip ? SCHWA + onsetText : onsetText + nucleus + codaText);
  }

  return syllables;
}

/**
 * Word-initial sibilant + stop: #SəC → #əSC. A word-initial sibilant whose
 * nucleus is an EPENTHETIC schwa, followed by a syllable that begins with a
 * stop/affricate, syllabifies as a coda of that schwa, not as an onset (RA
 * orthography: ըս-կիզբ, ըս-տանալ, ըզ-բոսանք, ըշ-տապել). See docs/SPEC.md.
 */
function isSibilantBeforeStop(onset: string, nextSyllable: string | undefined): boolean {
  if (nextSyllable === undefined || !SIBILANTS.has(onset.toLowerCase())) return false;
  const nextOnset = [...nextSyllable][0];
  return nextOnset !== undefined && STOPS.has(nextOnset.toLowerCase());
}

/**
 * Put the intra-word marks back after the letters they followed. The syllables
 * differ from `chars` only by inserted ը, so a greedy alignment is exact.
 */
function reattachMarks(
  word: string,
  chars: readonly string[],
  origin: readonly number[],
  syllables: readonly string[],
): string[] {
  const original = [...word];
  // Marks before the first kept character belong to the first syllable.
  const leading = original.slice(0, origin[0] ?? original.length).join("");
  let k = 0;
  return syllables.map((syllable, s) => {
    let text = s === 0 ? leading : "";
    for (const ch of syllable) {
      const at = origin[k];
      if (at !== undefined && ch === chars[k]) {
        const to = origin[k + 1] ?? original.length;
        text += ch + original.slice(at + 1, to).join("");
        k++;
      } else if (ch === SCHWA) {
        text += ch; // an inserted ը
      } else {
        throw new Error(`syllables of "${word}" do not align with its letters at "${ch}"`);
      }
    }
    return text;
  });
}

/**
 * Syllabify a single Armenian word, inserting ը where the pronunciation requires
 * an epenthetic schwa. Letters other than the inserted ը are preserved; intra-word
 * marks stay attached to the letter they follow (ինչո՞ւ → ին, չո՞ւ).
 */
export function syllabifyWithSchwa(word: string, variant?: Variant): string[] {
  const { chars, origin } = stripWordMarks(word);
  const syllables = syllabifyUnits(tokenize(chars.join(""), resolveOrthography(variant)));
  if (syllables.length === 0) return [word];
  if (origin.length === [...word].length) return syllables;
  return reattachMarks(word, chars, origin, syllables);
}
