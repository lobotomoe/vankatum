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

describe("appendix ք closes any coda (no schwa before a final ք)", () => {
  // Wiktionary gold: 0 schwa insertions before a final ք across every non-falling
  // cluster (ցք, ծք, չք, թք, ջք, ...). The old plural/case suffix is extrasyllabic.
  const cases: Array<[string, string]> = [
    ["ոտք", "ոտք"],
    ["գնացք", "գը-նացք"],
    ["կռիչք", "կը-ռիչք"],
    ["աշխատանք", "աշ-խա-տանք"],
    // extrasyllabic: does not count towards the two-consonant coda limit
    ["առանցքներ", "ա-ռանցք-ներ"],
    // ք that is NOT the outermost consonant is an ordinary stop (գիրքս /giɹkʰəs/)
    ["ոտքս", "ոտ-քըս"],
  ];
  for (const [word, expected] of cases) {
    it(`${word} -> ${expected}`, () => { expect(s(word)).toBe(expected); });
  }
});

describe("intra-word marks stay attached to the letter they follow", () => {
  it("syllabifies the letters and re-inserts the mark", () => {
    expect(syllabifyWithSchwa("ինչո՞ւ")).toEqual(["ին", "չո՞ւ"]);
    expect(syllabifyWithSchwa("գրե՞լ")).toEqual(["գը", "րե՞լ"]);
    expect(syllabifyWithSchwa("՞")).toEqual(["՞"]);
  });
});

describe("conservation modulo schwa (only ը may be added)", () => {
  const LETTERS = Array.from("աբգդեզէըթժիլխծկհձղճմյնշոչպջռսվտրցւփքօֆև՞՛՜");
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
