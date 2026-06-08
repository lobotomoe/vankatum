/**
 * Text-level hyphenation for the web delivery path.
 *
 * Walks arbitrary text, hyphenates each maximal run of Armenian letters with the
 * pure letter-preserving core, and leaves everything else (spaces, punctuation,
 * other scripts, digits) untouched. Breaks are marked with U+00AD SOFT HYPHEN so
 * the browser only renders a hyphen when it actually wraps the line — the input
 * letters are conserved exactly. See docs/SPEC.md.
 */

import { isArmenianLetter } from "./alphabet.js";
import { hyphenate, type HyphenateOptions } from "./hyphenate.js";

/** U+00AD: invisible unless the renderer breaks the line here. */
export const SOFT_HYPHEN = "\u00AD";

/** Text-mode options. The separator is fixed to the soft hyphen, so {@link HyphenateOptions.hyphen} is not accepted. */
export type TextOptions = Omit<HyphenateOptions, "hyphen">;

/**
 * Insert soft hyphens at every legal break inside each Armenian word of `text`.
 * Non-Armenian content passes through verbatim; removing all U+00AD from the
 * result yields the original text unchanged.
 */
export function hyphenateText(text: string, options: TextOptions = {}): string {
  let out = "";
  let word = "";

  const flush = (): void => {
    if (word.length > 0) {
      out += hyphenate(word, { ...options, hyphen: SOFT_HYPHEN });
      word = "";
    }
  };

  for (const ch of text) {
    if (isArmenianLetter(ch)) {
      word += ch;
    } else {
      flush();
      out += ch;
    }
  }
  flush();

  return out;
}
