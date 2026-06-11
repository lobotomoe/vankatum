/**
 * Armenian alphabet classification for syllabification.
 * See docs/SPEC.md for the linguistic contract.
 *
 * Which single letters are nuclei is owned by the orthography config
 * (./orthography.ts). The digraph / glide / ligature merges below are universal:
 * they hold for both the Eastern (reformed) and Western (classical) variants.
 */

import { type Orthography, EASTERN } from "./orthography.js";

/** ո + ւ — the /u/ digraph, one nucleus, never split. Universal. */
export const DIGRAPH_O = "ո";
export const YIWN = "ւ";

/** յ before a vowel is a glide forming a rising diphthong (e.g. բյուր, ցյալ). */
export const YOD = "յ";

/** Ligature և (/jɛv/) — a nucleus with an inherent v coda. Valid in both variants. */
export const LIGATURE_EW = "և";

export type UnitKind = "vowel" | "consonant" | "separator";

export interface Unit {
  text: string;
  /** Start offset in the original string, in codepoints (the indexing of `[...word]`). */
  start: number;
  kind: UnitKind;
}

export const isArmenianLetter = (ch: string): boolean => {
  const code = ch.codePointAt(0) ?? 0;
  // uppercase Ա–Ֆ, lowercase ա–ֆ, ligature և, plus ֈ
  return (
    (code >= 0x0531 && code <= 0x0556) ||
    (code >= 0x0561 && code <= 0x0588)
  );
};

/**
 * If a plain vowel nucleus starts at `j`, return its text and length: a single
 * vowel, or the ու digraph (ո+ւ). Excludes յ and և, which are handled by the
 * caller. Used both as the main token reader and as yod-glide lookahead.
 */
function readVowelNucleus(
  chars: string[],
  j: number,
  vowels: ReadonlySet<string>,
): { text: string; length: number } | undefined {
  const ch = chars[j];
  if (ch === undefined) return undefined;
  const lo = ch.toLowerCase();
  const after = chars[j + 1];
  if (lo === DIGRAPH_O && after !== undefined && after.toLowerCase() === YIWN) {
    return { text: ch + after, length: 2 };
  }
  if (vowels.has(lo)) return { text: ch, length: 1 };
  return undefined;
}

/**
 * If a configured vowel digraph (classical `եա` / `եօ`) starts at `j`, return its
 * text and length. These two-vowel sequences form one glide nucleus that must
 * never be split. Empty for reformed orthography, so this never fires there.
 */
function readVowelDigraph(
  chars: string[],
  j: number,
  orthography: Orthography,
): { text: string; length: number } | undefined {
  const ch = chars[j];
  const after = chars[j + 1];
  if (ch === undefined || after === undefined) return undefined;
  const lo = ch.toLowerCase();
  const afterLo = after.toLowerCase();
  for (const [first, second] of orthography.vowelDigraphs) {
    if (lo === first && afterLo === second) return { text: ch + after, length: 2 };
  }
  return undefined;
}

/**
 * Split a word into classified units. Merges the ու digraph, the yod-glide
 * (յ + vowel → one rising-diphthong nucleus, e.g. բյուր, ցյալ), the classical
 * vowel digraphs (եա / եօ, Western only) and recognises և. Case-insensitive
 * classification; original characters are preserved.
 */
export function tokenize(word: string, orthography: Orthography = EASTERN): Unit[] {
  const chars = [...word];
  const { vowels } = orthography;
  const units: Unit[] = [];

  // `chars` holds one codepoint per element, so `i` IS the codepoint offset.
  // (Counting UTF-16 units here would drift after any astral separator, e.g. an
  // emoji, and misplace every later break point.)
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i] as string;
    const lo = ch.toLowerCase();

    // Yod-glide: յ immediately before a vowel nucleus joins it as one nucleus.
    // A configured vowel digraph (եա / եօ) outranks the glide: in `յեա` the եա
    // digraph is the nucleus and յ is a plain onset (one syllable, like կեանք),
    // not a `յե` glide with ա stranded.
    if (lo === YOD && readVowelDigraph(chars, i + 1, orthography) === undefined) {
      const glided = readVowelNucleus(chars, i + 1, vowels);
      if (glided !== undefined) {
        units.push({ text: ch + glided.text, start: i, kind: "vowel" });
        i += glided.length;
        continue;
      }
    }

    // Classical vowel digraph (եա / եօ): two vowels read as one glide nucleus.
    const digraph = readVowelDigraph(chars, i, orthography);
    if (digraph !== undefined) {
      units.push({ text: digraph.text, start: i, kind: "vowel" });
      i += digraph.length - 1;
      continue;
    }

    const nucleus = readVowelNucleus(chars, i, vowels);
    if (nucleus !== undefined) {
      units.push({ text: nucleus.text, start: i, kind: "vowel" });
      i += nucleus.length - 1;
      continue;
    }

    let kind: UnitKind;
    if (lo === LIGATURE_EW) {
      kind = "vowel";
    } else if (isArmenianLetter(ch)) {
      kind = "consonant";
    } else {
      kind = "separator";
    }
    units.push({ text: ch, start: i, kind });
  }

  return units;
}
