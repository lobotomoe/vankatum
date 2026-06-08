/**
 * Armenian alphabet classification for syllabification.
 * See docs/SPEC.md for the linguistic contract.
 */

/** Single-codepoint vowels that act as syllable nuclei (reformed orthography). */
export const VOWELS = new Set([..."աեէըիոօ"]);

/** ո + ւ — the /u/ digraph, one nucleus, never split. */
export const DIGRAPH_O = "ո";
export const YIWN = "ւ";

/** յ before a vowel is a glide forming a rising diphthong (e.g. բյուր, ցյալ). */
export const YOD = "յ";

/** Ligature և (/jɛv/) — a nucleus with an inherent v coda. */
export const LIGATURE_EW = "և";

export type UnitKind = "vowel" | "consonant" | "separator";

export interface Unit {
  text: string;
  /** Start offset in the original string (BMP: codepoint index === UTF-16 index). */
  start: number;
  kind: UnitKind;
}

const isArmenianLetter = (ch: string): boolean => {
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
function readVowelNucleus(chars: string[], j: number): { text: string; length: number } | undefined {
  const ch = chars[j];
  if (ch === undefined) return undefined;
  const lo = ch.toLowerCase();
  const after = chars[j + 1];
  if (lo === DIGRAPH_O && after !== undefined && after.toLowerCase() === YIWN) {
    return { text: ch + after, length: 2 };
  }
  if (VOWELS.has(lo)) return { text: ch, length: 1 };
  return undefined;
}

/**
 * Split a word into classified units. Merges the ու digraph, the yod-glide
 * (յ + vowel → one rising-diphthong nucleus, e.g. բյուր, ցյալ) and recognises
 * և. Case-insensitive classification; original characters are preserved.
 */
export function tokenize(word: string): Unit[] {
  const chars = [...word];
  const units: Unit[] = [];
  let offset = 0;

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i] as string;
    const lo = ch.toLowerCase();

    // Yod-glide: յ immediately before a vowel nucleus joins it as one nucleus.
    if (lo === YOD) {
      const glided = readVowelNucleus(chars, i + 1);
      if (glided !== undefined) {
        units.push({ text: ch + glided.text, start: offset, kind: "vowel" });
        offset += ch.length + glided.text.length;
        i += glided.length;
        continue;
      }
    }

    const nucleus = readVowelNucleus(chars, i);
    if (nucleus !== undefined) {
      units.push({ text: nucleus.text, start: offset, kind: "vowel" });
      offset += nucleus.text.length;
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
    units.push({ text: ch, start: offset, kind });
    offset += ch.length;
  }

  return units;
}
