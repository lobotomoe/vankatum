import { describe, expect, it } from "vitest";
import { armenianWords } from "../tools/corpus/words.mjs";
import { isArmenianLetter, isArmenianWordMark } from "../src/alphabet.js";

// The harvesters feed corpus/wordlist.txt, which trains every pattern artifact.
// Their tokenizer must agree with the engine on what a word is, or the corpus
// fills with fragments split at intra-word marks (ինչո + ւ).

describe("corpus tokenizer", () => {
  it("keeps words with intra-word marks whole and drops the marks", () => {
    expect(armenianWords("Ինչո՞ւ, իհա՛րկե։ Ա՜խ, կ՚ուզեմ")).toEqual([
      "ինչու",
      "իհարկե",
      "ախ",
      "կուզեմ",
    ]);
  });

  it("splits at the բութ, the full stop and non-Armenian text", () => {
    expect(armenianWords("Նա՝ գնաց։ hello Երևան-2")).toEqual(["նա", "գնաց", "երևան"]);
  });

  it("drops tokens made of marks alone", () => {
    expect(armenianWords("՞ ՛")).toEqual([]);
  });

  it("agrees with the engine on every Armenian-block codepoint", () => {
    // hyphenateText keeps a codepoint inside a word iff it is a letter or an
    // intra-word mark; the harvester must draw word boundaries the same way.
    for (let code = 0x0530; code <= 0x058f; code++) {
      const ch = String.fromCodePoint(code);
      const engineJoins = isArmenianLetter(ch) || isArmenianWordMark(ch);
      const harvested = armenianWords(`աշա${ch}կերտ`);
      expect(harvested.length === 1, `U+${code.toString(16).toUpperCase()}`).toBe(engineJoins);
    }
  });
});
