/**
 * Orthography variants — the single source of truth for which letters act as
 * syllable nuclei. The tokenizer reads one of these configs; the break rule and
 * the schwa sonority hierarchy are variant-independent and live elsewhere.
 *
 * See docs/SPEC.md. The two variants differ in exactly one way that matters to
 * syllabification: classical orthography writes the glide+vowel sequences /ja/
 * and /jo/ as the vowel digraphs `եա` / `եօ`, which must be read as one nucleus.
 * Reformed orthography spells the same sounds with the յ-glide (`յա` / `յո`),
 * already handled by the universal yod-glide rule.
 */

export type Variant = "eastern" | "western";

export interface Orthography {
  name: Variant;
  /** Single-codepoint vowels that act as syllable nuclei. Identical across variants. */
  vowels: ReadonlySet<string>;
  /**
   * Two-vowel sequences that form a single (glide) nucleus and must never split.
   * Ordered `[first, second]`, matched lowercased. Empty for reformed orthography.
   */
  vowelDigraphs: ReadonlyArray<readonly [string, string]>;
}

/** Single-codepoint nuclei — same inventory in both orthographies (see docs/SPEC.md §Vowel inventory). */
const VOWEL_SET: ReadonlySet<string> = new Set("աեէըիոօ");

/** Eastern Armenian, reformed (Abeghyan) orthography. The default. */
export const EASTERN: Orthography = {
  name: "eastern",
  vowels: VOWEL_SET,
  vowelDigraphs: [],
};

/**
 * Western Armenian, classical (Mashtotsian) orthography. Adds the glide-vowel
 * digraphs `եա` (/ja/, reformed `յա`) and `եօ` (/jo/, reformed `յո`) as single
 * nuclei. Standalone `ւ`, `յ`, and the `ոյ`/`իւ`/`եւ` sequences need no special
 * casing — they already syllabify correctly under the shared core because `ւ`/`յ`
 * are consonants there.
 */
export const WESTERN: Orthography = {
  name: "western",
  vowels: VOWEL_SET,
  vowelDigraphs: [
    ["ե", "ա"],
    ["ե", "օ"],
  ],
};

/** Resolve a variant name (default eastern) to its orthography config. */
export const resolveOrthography = (variant?: Variant): Orthography =>
  variant === "western" ? WESTERN : EASTERN;
