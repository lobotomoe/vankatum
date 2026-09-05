import { describe, expect, it } from "vitest";
import { breakPoints, hyphenate, syllabify, type Variant } from "../src/index.js";

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

describe("ligature և: no letter-preserving break before a following vowel", () => {
  // The syllable boundary of ևV lies INSIDE the ligature (հե-տե-վել), so the only
  // correct break changes letters (ե-վ). The pure mode must not emit the wrong
  // "տև-ել" break instead; the .dic artifact carries the ե-վ decomposition.
  const cases: Array<[string, string]> = [
    ["Երևան", "Ե-րևան"],
    ["հետևել", "հե-տևել"],
    ["արևելք", "ա-րևելք"],
    ["տևել", "տևել"],
    ["ևայլն", "ևայլն"],
    // և followed by a consonant, or word-final: the ligature stays whole and breaks normally
    ["թևճակ", "թև-ճակ"],
    ["բարևներ", "բա-րև-ներ"],
    ["տերև", "տե-րև"],
    // spelled-out Եվ is plain letters
    ["Եվրոպա", "Եվ-րո-պա"],
  ];
  for (const [word, expected] of cases) {
    it(`${word} -> ${expected}`, () => { expect(h(word)).toBe(expected); });
  }
});

describe("letter abbreviations (all caps) are never hyphenated", () => {
  for (const w of ["ԵԱՀԿ", "ԱՊՀ", "ԽՍՀՄ", "ՄԱԿ", "ՆԱՍԱ", "ԱՕԿ", "ԵՐԵՐՆ"]) {
    it(w, () => { expect(h(w)).toBe(w); });
  }
  it("applies per word, so a suffixed abbreviation keeps its suffix rule", () => {
    expect(h("ՄԱԿ-ի")).toBe("ՄԱԿ-ի");
    expect(h("ԱՊՀ-ում")).toBe("ԱՊՀ-ում");
  });
  it("a capitalised (not all-caps) word hyphenates normally", () => {
    expect(h("Ուսանող")).toBe("Ու-սա-նող");
    expect(h("Երևան")).toBe("Ե-րևան");
  });
  it("sees through intra-word marks", () => {
    expect(h("ՄԱ՞Կ")).toBe("ՄԱ՞Կ");
  });
});

describe("intra-word marks (՞ ՛ ՜ ՚) are transparent and stay with their letter", () => {
  it("syllabifies the letters and keeps the mark on the vowel it follows", () => {
    expect(h("ինչո՞ւ")).toBe("ին-չո՞ւ");
    expect(breakPoints("ինչո՞ւ")).toEqual([2]);
    expect(h("բուրժուա՞կան")).toBe("բուր-ժու-ա՞-կան");
    expect(syllabify("ո՛ւր")).toEqual(["ո՛ւր"]);
  });
  it("reads the ու digraph across a mark placed on its ո", () => {
    // Without transparency ո and ւ would be separate letters and ւ could become an onset.
    expect(h("Ֆրանսո՞ւա")).toBe("Ֆրան-սո՞ւա");
    expect(h("հանրապետությո՞ւն")).toBe("հան-րա-պե-տու-թյո՞ւն");
  });
  it("treats the classical apostrophe as transparent (elided vowel)", () => {
    expect(syllabify("կ՚ուզեմ")).toEqual(["կ՚ու", "զեմ"]);
  });
  it("passes a marks-only or empty input through", () => {
    expect(syllabify("՞")).toEqual(["՞"]);
    expect(syllabify("")).toEqual([""]);
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
  it("applies per word when the input holds several words", () => {
    expect(breakPoints("ապա ապա")).toEqual([1, 5]);
  });
});

describe("option validation", () => {
  it("rejects negative, fractional and non-numeric minima", () => {
    expect(() => breakPoints("աշակերտ", { leftmin: -1 })).toThrow(RangeError);
    expect(() => breakPoints("աշակերտ", { rightmin: 1.5 })).toThrow(RangeError);
    expect(() => breakPoints("աշակերտ", { leftmin: Number.NaN })).toThrow(RangeError);
  });
  it("accepts zero (no constraint)", () => {
    expect(syllabify("աշակերտներ", { leftmin: 0, rightmin: 0 })).toEqual(["ա", "շա", "կերտ", "ներ"]);
  });
  it("rejects an unknown orthography variant instead of silently defaulting", () => {
    const bogus = "klingon" as Variant;
    expect(() => hyphenate("աշակերտ", { variant: bogus })).toThrow(RangeError);
  });
});
