import { describe, expect, it } from "vitest";
import { hyphenate } from "../src/index.js";
import { WESTERN_GOLD } from "./western.gold.js";

const w = (word: string) => hyphenate(word, { variant: "western", hyphen: "-" });
const e = (word: string) => hyphenate(word, { variant: "eastern", hyphen: "-" });

describe("Western / classical gold set (docs/SPEC.md, provisional)", () => {
  for (const [word, expected, gloss] of WESTERN_GOLD) {
    it(`${word} -> ${expected}  (${gloss})`, () => expect(w(word)).toBe(expected));
  }
});

describe("εα / εօ glide-digraphs: Western merges, Eastern splits as hiatus", () => {
  // The defining delta. The same string must hyphenate differently per variant.
  const cases: Array<[string, string, string]> = [
    ["ատեան", "ա-տեան", "ա-տե-ան"],
    ["Սարգսեան", "Սարգ-սեան", "Սարգ-սե-ան"],
    ["եօթ", "եօթ", "ե-օթ"],
    ["կեանք", "կեանք", "կե-անք"],
  ];
  for (const [word, west, east] of cases) {
    it(`${word}: western ${west} vs eastern ${east}`, () => {
      expect(w(word)).toBe(west);
      expect(e(word)).toBe(east);
    });
  }
});

describe("shared core: words with no Western delta hyphenate identically", () => {
  for (const word of ["կարդալ", "աշխատանք", "ուսանող", "որդի", "մարդ", "ընկեր"]) {
    it(`${word}: western === eastern`, () => expect(w(word)).toBe(e(word)));
  }
});
