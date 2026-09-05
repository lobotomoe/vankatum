/**
 * Core Armenian syllabic hyphenation.
 *
 * Rule (docs/SPEC.md): between two nuclei the next syllable's onset is at most
 * one consonant — so for k consonants in the gap, only the last one moves to the
 * next line (k>=1), and adjacent vowels break between them (k=0). Two things
 * never break: letter abbreviations (all-caps words, ԽՍՀՀ) and the ligature և
 * before a vowel (its syllable boundary lies inside the ligature, so no
 * letter-preserving break exists). Intra-word marks (ինչո՞ւ) are transparent.
 */

import {
  isArmenianUppercase,
  LIGATURE_EW,
  stripWordMarks,
  tokenize,
  type Unit,
} from "./alphabet.js";
import { resolveOrthography, type Variant } from "./orthography.js";

export interface HyphenateOptions {
  /** Minimum letters before the first break. Default 1 (Armenian-specific). A non-negative integer. */
  leftmin?: number;
  /** Minimum letters after the last break. Default 2. A non-negative integer. */
  rightmin?: number;
  /** String inserted at each break point. Default "-". */
  hyphen?: string;
  /** Orthography variant. Default "eastern" (reformed). "western" enables classical digraphs. */
  variant?: Variant;
}

const DEFAULTS = { leftmin: 1, rightmin: 2, hyphen: "-" } as const;

/** A letter abbreviation (ԽՍՀՄ, ԱՊՀ, ԵԱՀԿ) is at least this many letters, all uppercase. */
const ACRONYM_MIN_LETTERS = 2;

function resolveMin(name: "leftmin" | "rightmin", value: number | undefined): number {
  if (value === undefined) return DEFAULTS[name];
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer, got ${String(value)}`);
  }
  return value;
}

const codepoints = (unit: Unit): number => [...unit.text].length;

const isLigature = (unit: Unit): boolean => unit.text.toLowerCase() === LIGATURE_EW;

/** Separator-free runs of letter units — the words inside `units`. */
function words(units: readonly Unit[]): Unit[][] {
  const out: Unit[][] = [];
  let current: Unit[] = [];
  for (const unit of units) {
    if (unit.kind === "separator") {
      if (current.length > 0) out.push(current);
      current = [];
    } else {
      current.push(unit);
    }
  }
  if (current.length > 0) out.push(current);
  return out;
}

/** All-caps run of two or more letters: a letter abbreviation, never hyphenated. */
function isAcronym(word: readonly Unit[]): boolean {
  let letters = 0;
  for (const unit of word) {
    for (const ch of unit.text) {
      if (!isArmenianUppercase(ch)) return false;
      letters++;
    }
  }
  return letters >= ACRONYM_MIN_LETTERS;
}

/** Break offsets inside one word, in the coordinates of the tokenized string. */
function wordBreaks(word: readonly Unit[], leftmin: number, rightmin: number): number[] {
  const first = word[0];
  if (first === undefined || isAcronym(word)) return [];
  const wordStart = first.start;
  const wordLength = word.reduce((n, unit) => n + codepoints(unit), 0);

  const points: number[] = [];
  let prevNucleus: Unit | undefined;
  let gap: Unit[] = [];
  for (const unit of word) {
    if (unit.kind === "consonant") {
      gap.push(unit);
      continue;
    }
    if (prevNucleus !== undefined) {
      const onset = gap.at(-1);
      if (onset !== undefined) {
        // Onset of this syllable = the last consonant of the gap; only it moves.
        points.push(onset.start);
      } else if (!isLigature(prevNucleus)) {
        // Hiatus: break between the vowels. Not after և — its v coda would have
        // to move to the next line, and it cannot be detached from the ligature.
        points.push(unit.start);
      }
    }
    prevNucleus = unit;
    gap = [];
  }

  return points.filter((b) => {
    const before = b - wordStart;
    return before >= leftmin && wordLength - before >= rightmin;
  });
}

/**
 * Break offsets (codepoint indices) where the word may be split, left to right.
 * A returned offset `b` means a break between char b-1 and char b. Intra-word
 * marks stay with the letter before them, so a break never separates a vowel
 * from its ՞ / ՛ / ՜. leftmin / rightmin count letters, per word.
 */
export function breakPoints(word: string, options: HyphenateOptions = {}): number[] {
  const leftmin = resolveMin("leftmin", options.leftmin);
  const rightmin = resolveMin("rightmin", options.rightmin);
  const orthography = resolveOrthography(options.variant);

  const { chars, origin } = stripWordMarks(word);
  const units = tokenize(chars.join(""), orthography);

  const points: number[] = [];
  for (const unitRun of words(units)) {
    for (const b of wordBreaks(unitRun, leftmin, rightmin)) {
      // `b` is the start of a unit, so it always indexes into `origin`.
      points.push(origin[b] as number);
    }
  }
  return points;
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
