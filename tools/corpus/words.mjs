/**
 * Shared tokenizer for the corpus harvesters.
 *
 * Armenian writes its intonation marks INSIDE the word (ինչո՞ւ, իհա՛րկե,
 * կ՚ուզեմ), so a plain letter-run regex splits such a word into junk fragments
 * (ինչո + ւ, իհա + րկե). Match letters together with the intra-word marks, then
 * drop the marks — the same set the engine treats as transparent (src/alphabet.ts
 * WORD_MARKS). The բութ ՝ and the full stop ։ separate words and stay excluded.
 */

const WORD = /[Ա-Ֆա-ֈՙ-՜՞՟]+/gu;
const MARKS = /[ՙ-՜՞՟]/gu;

/** Every Armenian word in `text`, lowercased, with intra-word marks removed. */
export function armenianWords(text) {
  const out = [];
  for (const token of text.match(WORD) ?? []) {
    const word = token.replace(MARKS, "").toLowerCase();
    if (word.length > 0) out.push(word);
  }
  return out;
}
