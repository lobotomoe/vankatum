/**
 * Right-to-left syllabification with schwa (ը) epenthesis.
 *
 * Implements Dolatian 2023 (see docs/SPEC.md): max syllable (C)(j)V(C)(C), coda
 * <=2 with falling sonority, onset maximised. Stranded consonants receive an
 * epenthetic schwa as their nucleus. Returns syllables with the schwa MATERIALISED
 * as ը — i.e. this is the orthographic (character-changing) form, used to validate
 * the rule against the Wiktionary gold and, later, to drive the discretionary-break
 * output mode. The pure letter-preserving syllabify() lives in hyphenate.ts.
 */

import { tokenize, type Unit } from "./alphabet.js";

const SCHWA = "ը";

/** Sonority, high → low (5 = glide … 1 = stop/affricate). */
function sonority(text: string): number {
  const c = text.toLowerCase();
  if (c === "յ") return 5; // glide
  if ("րռլ".includes(c)) return 4; // liquid
  if ("մն".includes(c)) return 3; // nasal
  if ("վզսժշղխհֆ".includes(c)) return 2; // fricative
  return 1; // stop / affricate
}

/** A two-consonant coda C1C2 (C1 inner) is legal iff sonority falls outward. */
function fallingSonority(inner: string, outer: string): boolean {
  return sonority(inner) > sonority(outer);
}

/**
 * Syllabify a single Armenian word, inserting ը where the pronunciation requires
 * an epenthetic schwa. Letters other than the inserted ը are preserved.
 */
export function syllabifyWithSchwa(word: string): string[] {
  const units = tokenize(word);
  const syllables: string[] = [];
  let i = units.length - 1;

  while (i >= 0) {
    const right = units[i] as Unit;
    if (right.kind === "separator") {
      syllables.unshift(right.text);
      i--;
      continue;
    }

    // 1. Coda: up to two consonants from the right with falling sonority outward.
    const coda: Unit[] = [];
    while (i >= 0) {
      const u = units[i] as Unit;
      if (u.kind !== "consonant" || coda.length >= 2) break;
      const inner = coda[0];
      if (inner === undefined || fallingSonority(u.text, inner.text)) {
        coda.unshift(u);
        i--;
      } else break;
    }

    // 2. Nucleus + 3. onset (one consonant, onset maximisation).
    const onset: Unit[] = [];
    let nucleus: string;
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

    const text = onset.map((u) => u.text).join("") + nucleus + coda.map((u) => u.text).join("");
    syllables.unshift(text);
  }

  return applySibilantException(syllables);
}

const SIBILANTS = new Set([..."սշզժ"]);

/**
 * Word-initial sibilant + stop: #SəC → #əSC. A word-initial sibilant before a
 * stop/affricate syllabifies as a coda of the epenthetic schwa, not an onset
 * (RA orthography: ըս-կիզբ, ըս-տանալ, ըզ-բոսանք, ըշ-տապել). See docs/SPEC.md.
 */
function applySibilantException(syllables: string[]): string[] {
  const first = syllables[0];
  const next = syllables[1];
  if (first === undefined || next === undefined) return syllables;
  // first must be exactly <sibilant><schwa>, next must begin with a stop/affricate
  if ([...first].length === 2 && first.endsWith(SCHWA) && SIBILANTS.has(first[0]?.toLowerCase() ?? "")) {
    const nextOnset = [...next][0] ?? "";
    if (sonority(nextOnset) === 1) {
      syllables[0] = SCHWA + (first[0] ?? "");
    }
  }
  return syllables;
}
