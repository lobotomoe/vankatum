/**
 * Core Armenian syllabic hyphenation.
 *
 * Rule (docs/SPEC.md): between two nuclei the next syllable's onset is at most
 * one consonant — so for k consonants in the gap, only the last one moves to the
 * next line (k>=1), and adjacent vowels break between them (k=0).
 */

import { tokenize, type Unit } from "./alphabet.js";

export interface HyphenateOptions {
  /** Minimum characters before the first break. Default 1 (Armenian-specific). */
  leftmin?: number;
  /** Minimum characters after the last break. Default 2. */
  rightmin?: number;
  /** String inserted at each break point. Default "-". */
  hyphen?: string;
}

const DEFAULTS = { leftmin: 1, rightmin: 2, hyphen: "-" } as const;

/**
 * Break offsets (codepoint indices) where the word may be split, left to right.
 * A returned offset `b` means a break between char b-1 and char b.
 */
export function breakPoints(word: string, options: HyphenateOptions = {}): number[] {
  const leftmin = options.leftmin ?? DEFAULTS.leftmin;
  const rightmin = options.rightmin ?? DEFAULTS.rightmin;
  const total = [...word].length;

  const units = tokenize(word);
  const points: number[] = [];

  // Walk nucleus to nucleus within each separator-free segment.
  let prevNucleus = -1;
  for (let i = 0; i < units.length; i++) {
    const unit = units[i] as Unit;
    if (unit.kind === "separator") {
      prevNucleus = -1;
      continue;
    }
    if (unit.kind !== "vowel") continue;

    if (prevNucleus !== -1) {
      const consonants = units.slice(prevNucleus + 1, i).filter((u) => u.kind === "consonant");
      // onset of this syllable = last consonant of the gap (if any), else the vowel itself
      const onset = consonants.length > 0 ? (consonants[consonants.length - 1] as Unit) : unit;
      points.push(onset.start);
    }
    prevNucleus = i;
  }

  return points.filter((b) => b >= leftmin && total - b >= rightmin);
}

/** Split a word into its hyphenation fragments. */
export function syllabify(word: string, options: HyphenateOptions = {}): string[] {
  const points = breakPoints(word, options);
  if (points.length === 0) return [word];

  const chars = [...word];
  const fragments: string[] = [];
  let prev = 0;
  for (const b of points) {
    fragments.push(chars.slice(prev, b).join(""));
    prev = b;
  }
  fragments.push(chars.slice(prev).join(""));
  return fragments;
}

/** Hyphenate a single word, inserting the hyphen string at each break point. */
export function hyphenate(word: string, options: HyphenateOptions = {}): string {
  const hyphen = options.hyphen ?? DEFAULTS.hyphen;
  return syllabify(word, options).join(hyphen);
}
