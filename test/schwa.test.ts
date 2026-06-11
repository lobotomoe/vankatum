import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { syllabifyWithSchwa } from "../src/index.js";

const s = (w: string) => syllabifyWithSchwa(w).join("-");

describe("schwa epenthesis (Dolatian 2023 right-to-left syllabification)", () => {
  const cases: Array<[string, string]> = [
    ["Զրադաշտ", "Զը-րա-դաշտ"],
    ["Ծղուկ", "Ծը-ղուկ"],
    ["Հրատ", "Հը-րատ"],
    ["Հնդստան", "Հըն-դըս-տան"],
    ["գրել", "գը-րել"],
    // word-initial sibilant + stop → schwa before the sibilant
    ["սկիզբ", "ըս-կիզբ"],
    ["զբոսանք", "ըզ-բո-սանք"],
    // sibilant + sonorant is NOT flipped
    ["սրահ", "սը-րահ"],
  ];
  for (const [word, expected] of cases) {
    it(`${word} -> ${expected}`, () => { expect(s(word)).toBe(expected); });
  }
});

describe("conservation modulo schwa (only ը may be added)", () => {
  const LETTERS = Array.from("աբգդեզէըթժիլխծկհձղճմյնշոչպջռսվտրցւփքօֆև");
  const cleanWord = fc
    .array(fc.constantFrom(...LETTERS), { minLength: 1, maxLength: 20 })
    .map((a) => a.join(""));
  const stripSchwa = (x: string) => [...x].filter((c) => c !== "ը").join("");

  it("never drops, reorders, or invents a non-schwa letter", () => {
    fc.assert(
      fc.property(cleanWord, (w) => {
        expect(stripSchwa(syllabifyWithSchwa(w).join(""))).toBe(stripSchwa(w));
      }),
      { numRuns: 5000 },
    );
  });
});
