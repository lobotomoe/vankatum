/**
 * Property-based invariants — laws that must hold for EVERY input, verified by
 * fuzzing rather than examples. These certify the whole input space and protect
 * everything built on top of the core. See docs/SPEC.md.
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { breakPoints, hyphenate, syllabify } from "../src/index.js";
import { tokenize } from "../src/alphabet.js";

const RUNS = 5000;

// Lowercase Armenian letters incl. ligature և and yiwn ւ (so ու digraphs form).
const LOWER = [..."աբգդեզէըթժիլխծկհձղճմյնշոչպջռսվտրցւփքօֆև"];
const UPPER = [..."ԱԲԳԴԵԶԷԸԹԺԻԼԽԾԿՀՁՂՃՄՅՆՇՈՉՊՋՌՍՎՏՐՑՒՓՔՕՖ"];
const NOISE = [..." -.,՝՜԰0123abcЖ\n\t"];

const cleanWord = fc
  .array(fc.constantFrom(...LOWER), { minLength: 1, maxLength: 24 })
  .map((a) => a.join(""));

const messyText = fc
  .array(fc.constantFrom(...LOWER, ...UPPER, ...NOISE), { minLength: 1, maxLength: 30 })
  .map((a) => a.join(""));

// Syllable-structured generator: deliberately produces digraphs (ու), the
// ligature (և), consonant clusters and hiatus, so the structural invariants get
// real coverage instead of relying on rare random collisions.
const CONSONANTS = [..."բգդզթժլխծկհձղճմյնշչպջռսվտրցփքֆ"]; // includes յ (forms yod-glides)
const NUCLEI = [..."աեէըիոօ", "ու", "և"];
const syllable = fc.record({
  onset: fc.array(fc.constantFrom(...CONSONANTS), { minLength: 0, maxLength: 3 }),
  nucleus: fc.constantFrom(...NUCLEI),
  coda: fc.array(fc.constantFrom(...CONSONANTS), { minLength: 0, maxLength: 2 }),
});
const structuredWord = fc
  .array(syllable, { minLength: 1, maxLength: 6 })
  .map((sylls) => sylls.map((s) => s.onset.join("") + s.nucleus + s.coda.join("")).join(""));

const nucleusCount = (w: string) => tokenize(w).filter((u) => u.kind === "vowel").length;

const leadingConsonants = (fragment: string): number => {
  let n = 0;
  for (const u of tokenize(fragment)) {
    if (u.kind === "consonant") n++;
    else break;
  }
  return n;
};

describe("safety invariants (hold for ANY string)", () => {
  it("letter conservation: fragments rejoin to the exact original", () => {
    fc.assert(
      fc.property(messyText, (w) => {
        expect(syllabify(w).join("")).toBe(w);
      }),
      { numRuns: RUNS },
    );
  });

  it("no empty fragment is ever produced", () => {
    fc.assert(
      fc.property(messyText, (w) => {
        for (const frag of syllabify(w)) expect([...frag].length).toBeGreaterThan(0);
      }),
      { numRuns: RUNS },
    );
  });

  it("never breaks inside the ու digraph", () => {
    fc.assert(
      fc.property(messyText, (w) => {
        const frags = syllabify(w);
        for (let i = 0; i < frags.length - 1; i++) {
          const prev = frags[i] as string;
          const next = frags[i + 1] as string;
          const endsWithO = prev.endsWith("ո") || prev.endsWith("Ո");
          const startsWithYiwn = next.startsWith("ւ") || next.startsWith("Ւ");
          expect(endsWithO && startsWithYiwn).toBe(false);
        }
      }),
      { numRuns: RUNS },
    );
  });

  it("is deterministic", () => {
    fc.assert(
      fc.property(messyText, (w) => {
        expect(hyphenate(w)).toBe(hyphenate(w));
      }),
      { numRuns: RUNS },
    );
  });
});

describe("structural invariants (clean Armenian words)", () => {
  it("every non-initial fragment has an onset of at most one consonant", () => {
    fc.assert(
      fc.property(cleanWord, (w) => {
        const frags = syllabify(w);
        for (let i = 1; i < frags.length; i++) {
          expect(leadingConsonants(frags[i] as string)).toBeLessThanOrEqual(1);
        }
      }),
      { numRuns: RUNS },
    );
  });

  it("never produces more fragments than there are nuclei", () => {
    fc.assert(
      fc.property(cleanWord, (w) => {
        expect(syllabify(w).length).toBeLessThanOrEqual(Math.max(1, nucleusCount(w)));
      }),
      { numRuns: RUNS },
    );
  });

  it("with no min constraints, fragment count equals nucleus count", () => {
    fc.assert(
      fc.property(cleanWord, (w) => {
        const frags = syllabify(w, { leftmin: 0, rightmin: 0 });
        expect(frags.length).toBe(Math.max(1, nucleusCount(w)));
      }),
      { numRuns: RUNS },
    );
  });
});

describe("structured words (heavy ու / և / cluster / hiatus coverage)", () => {
  it("letter conservation holds", () => {
    fc.assert(
      fc.property(structuredWord, (w) => {
        expect(syllabify(w).join("")).toBe(w);
      }),
      { numRuns: RUNS },
    );
  });

  it("never splits ու or և, never empty", () => {
    fc.assert(
      fc.property(structuredWord, (w) => {
        const frags = syllabify(w);
        for (let i = 0; i < frags.length; i++) {
          const frag = frags[i] as string;
          expect([...frag].length).toBeGreaterThan(0);
          if (i > 0) {
            const prev = frags[i - 1] as string;
            // ու digraph never split
            expect(prev.endsWith("ո") && frag.startsWith("ւ")).toBe(false);
            // yod-glide never split: a fragment must not start with the vowel
            // whose յ ended the previous fragment
            expect(prev.endsWith("յ") && /^[աեէըիոօ]/.test(frag)).toBe(false);
          }
        }
      }),
      { numRuns: RUNS },
    );
  });

  it("onset of every non-initial fragment is at most one consonant", () => {
    fc.assert(
      fc.property(structuredWord, (w) => {
        const frags = syllabify(w);
        for (let i = 1; i < frags.length; i++) {
          expect(leadingConsonants(frags[i] as string)).toBeLessThanOrEqual(1);
        }
      }),
      { numRuns: RUNS },
    );
  });

  it("with no min constraints, fragment count equals nucleus count", () => {
    fc.assert(
      fc.property(structuredWord, (w) => {
        expect(syllabify(w, { leftmin: 0, rightmin: 0 }).length).toBe(nucleusCount(w));
      }),
      { numRuns: RUNS },
    );
  });
});

describe("leftmin / rightmin invariants", () => {
  const minsArb = fc.record({
    leftmin: fc.integer({ min: 1, max: 5 }),
    rightmin: fc.integer({ min: 1, max: 5 }),
  });

  it("respects leftmin and rightmin on the extreme fragments", () => {
    fc.assert(
      fc.property(cleanWord, minsArb, (w, mins) => {
        const frags = syllabify(w, mins);
        if (frags.length > 1) {
          expect([...(frags[0] as string)].length).toBeGreaterThanOrEqual(mins.leftmin);
          expect([...(frags[frags.length - 1] as string)].length).toBeGreaterThanOrEqual(mins.rightmin);
        }
      }),
      { numRuns: RUNS },
    );
  });

  it("every break offset honors both mins", () => {
    fc.assert(
      fc.property(cleanWord, minsArb, (w, mins) => {
        const total = [...w].length;
        for (const b of breakPoints(w, mins)) {
          expect(b).toBeGreaterThanOrEqual(mins.leftmin);
          expect(total - b).toBeGreaterThanOrEqual(mins.rightmin);
        }
      }),
      { numRuns: RUNS },
    );
  });
});
