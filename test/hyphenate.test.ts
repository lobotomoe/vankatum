import { describe, expect, it } from "vitest";
import { breakPoints, hyphenate, syllabify } from "../src/index.js";

const h = (w: string) => hyphenate(w, { hyphen: "-" });

describe("official RA examples (docs/SPEC.md)", () => {
  const cases: Array<[string, string]> = [
    // single consonant between vowels
    ["աշակերտ", "ա-շա-կերտ"],
    ["նկարել", "նկա-րել"],
    ["հասարակ", "հա-սա-րակ"],
    // two or more consonants: only the last moves
    ["կարդալ", "կար-դալ"],
    ["հաղթել", "հաղ-թել"],
    ["կանգնել", "կանգ-նել"],
    ["հարցնել", "հարց-նել"],
    ["թարգման", "թարգ-ման"],
    ["բերրի", "բեր-րի"],
    // hiatus + digraph + multi-syllable
    ["բուրժուական", "բուր-ժու-ա-կան"],
  ];
  for (const [word, expected] of cases) {
    it(`${word} -> ${expected}`, () => { expect(h(word)).toBe(expected); });
  }
});

describe("gold set", () => {
  const cases: Array<[string, string]> = [
    ["կատու", "կա-տու"],
    ["սովորել", "սո-վո-րել"],
    ["աթոռ", "ա-թոռ"],
    ["հազիվ", "հա-զիվ"],
    ["քաղաքական", "քա-ղա-քա-կան"],
    ["արձան", "ար-ձան"],
    ["ընկեր", "ըն-կեր"],
    ["հաստատ", "հաս-տատ"],
    ["որդի", "որ-դի"],
    ["մարդիկ", "մար-դիկ"],
    ["աշխատանք", "աշ-խա-տանք"],
    ["ուսանող", "ու-սա-նող"],
  ];
  for (const [word, expected] of cases) {
    it(`${word} -> ${expected}`, () => { expect(h(word)).toBe(expected); });
  }
});

describe("yod-glide: յ + vowel forms one nucleus (Cյ stays together)", () => {
  const cases: Array<[string, string]> = [
    ["ակնաղբյուր", "ակ-նաղ-բյուր"],
    ["ածանցյալ", "ա-ծան-ցյալ"],
    ["հոյակապ", "հո-յա-կապ"],
    ["Քոքոբելյան", "Քո-քո-բե-լյան"],
  ];
  for (const [word, expected] of cases) {
    it(`${word} -> ${expected}`, () => { expect(h(word)).toBe(expected); });
  }
});

describe("monosyllables are never broken", () => {
  for (const w of ["մարդ", "գիրք", "բույս", "ով"]) {
    it(w, () => { expect(h(w)).toBe(w); });
  }
});

describe("ու digraph is never split", () => {
  it("keeps ու intact", () => {
    expect(syllabify("ուսանող")).toEqual(["ու", "սա", "նող"]);
    expect(h("կատու")).toBe("կա-տու");
  });
});

describe("non-BMP separators keep break offsets codepoint-correct", () => {
  // Regression: Unit.start once advanced by UTF-16 length, so an astral
  // separator (2 UTF-16 units, 1 codepoint) shifted every later break point.
  it("breaks at the same syllable positions after an emoji", () => {
    expect(syllabify("😀աբակա")).toEqual(["😀ա", "բա", "կա"]);
    expect(breakPoints("😀աբակա")).toEqual([2, 4]);
  });
});

describe("leftmin=1 / rightmin=2", () => {
  it("allows a single leading vowel", () => { expect(h("աթոռ")).toBe("ա-թոռ"); });
  it("does not strand fewer than rightmin chars", () => {
    // last nucleus too close to the end leaves no valid break
    expect(h("քանի")).toBe("քա-նի");
  });
});
