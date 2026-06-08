/**
 * Property-based invariants — laws that must hold for EVERY input, verified by
 * fuzzing rather than examples. These certify the whole input space and protect
 * everything built on top of the core. See docs/SPEC.md.
 *
 * Structure: each LAW is defined once, then run over the generators that actually
 * stress it (a law x generator matrix). This keeps the set of distinct laws
 * minimal and orthogonal — no copy-paste, no superseded duplicates.
 *
 * Generator rationale:
 *   messy      — any string (letters, both cases, separators, noise). For the
 *                universal laws this is a strict superset of `clean`, so `clean`
 *                is not re-run on them.
 *   structured — deliberately emits ու digraphs, the և ligature, յ-glides,
 *                consonant clusters and hiatus; the strongest stressor for the
 *                digraph/glide and onset laws.
 *   clean      — random Armenian lowercase. Its only unique contribution is
 *                zero-nucleus (all-consonant) words, which `structured` cannot
 *                produce (every structured syllable has a nucleus).
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { breakPoints, syllabify } from "../src/index.js";
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

const GENERATORS = {
  messy: messyText,
  clean: cleanWord,
  structured: structuredWord,
} as const;
type GeneratorName = keyof typeof GENERATORS;

const nucleusCount = (w: string) => tokenize(w).filter((u) => u.kind === "vowel").length;

const leadingConsonants = (fragment: string): number => {
  let n = 0;
  for (const u of tokenize(fragment)) {
    if (u.kind === "consonant") n++;
    else break;
  }
  return n;
};

// --- The laws -------------------------------------------------------------
// Each asserts by throwing (block body), so fast-check sees a void return and
// treats "no throw" as success — never a stray boolean.

type Law = (w: string) => void;

/** Fragments rejoin to the exact original — not one codepoint added, dropped or moved. */
const conservation: Law = (w) => {
  expect(syllabify(w).join("")).toBe(w);
};

/** No fragment is ever empty. */
const noEmpty: Law = (w) => {
  for (const frag of syllabify(w)) expect([...frag].length).toBeGreaterThan(0);
};

/** The ու digraph is one nucleus and is never split across a break. */
const ouIntact: Law = (w) => {
  const frags = syllabify(w);
  for (let i = 1; i < frags.length; i++) {
    const last = [...(frags[i - 1] as string)].at(-1)?.toLowerCase();
    const first = [...(frags[i] as string)][0]?.toLowerCase();
    expect(last === "ո" && first === "ւ").toBe(false);
  }
};

const GLIDE_VOWELS = new Set([..."աեէըիոօ"]);

/** A յ-glide (յ + vowel) is one nucleus and is never split across a break. */
const yodIntact: Law = (w) => {
  const frags = syllabify(w);
  for (let i = 1; i < frags.length; i++) {
    const last = [...(frags[i - 1] as string)].at(-1)?.toLowerCase();
    const first = [...(frags[i] as string)][0]?.toLowerCase() ?? "";
    expect(last === "յ" && GLIDE_VOWELS.has(first)).toBe(false);
  }
};

/** Every non-initial fragment carries an onset of at most one consonant. */
const onsetMax: Law = (w) => {
  const frags = syllabify(w);
  for (let i = 1; i < frags.length; i++) {
    expect(leadingConsonants(frags[i] as string)).toBeLessThanOrEqual(1);
  }
};

/** With no min constraints, there is exactly one fragment per nucleus (>=1). */
const completeness: Law = (w) => {
  const frags = syllabify(w, { leftmin: 0, rightmin: 0 });
  expect(frags.length).toBe(Math.max(1, nucleusCount(w)));
};

// --- The matrix -----------------------------------------------------------
// Each law lists the generators whose distribution meaningfully exercises it.

interface LawSpec {
  name: string;
  law: Law;
  on: ReadonlyArray<GeneratorName>;
}

const LAWS: readonly LawSpec[] = [
  // Universal laws — messy covers clean's alphabet; structured reliably exercises
  // the digraph/glide merge paths where an offset bug would surface.
  { name: "letter conservation", law: conservation, on: ["messy", "structured"] },
  { name: "no empty fragment", law: noEmpty, on: ["messy", "structured"] },
  { name: "ու digraph never split", law: ouIntact, on: ["messy", "structured"] },
  { name: "yod-glide never split", law: yodIntact, on: ["messy", "structured"] },
  // Onset maximisation — `structured` is the strongest cluster stressor and
  // strictly supersedes `clean` here, so it runs there alone.
  { name: "non-initial onset <= 1 consonant", law: onsetMax, on: ["structured"] },
  // Completeness — `clean` uniquely reaches zero-nucleus words; `structured`
  // covers heavy digraph/glide/cluster words.
  { name: "fragments == nuclei (no mins)", law: completeness, on: ["clean", "structured"] },
];

describe("core syllabifier invariants", () => {
  for (const { name, law, on } of LAWS) {
    for (const gen of on) {
      it(`${name} [${gen}]`, () => {
        fc.assert(
          fc.property(GENERATORS[gen], (w) => {
            law(w);
          }),
          { numRuns: RUNS },
        );
      });
    }
  }
});

describe("leftmin / rightmin", () => {
  const minsArb = fc.record({
    leftmin: fc.integer({ min: 1, max: 5 }),
    rightmin: fc.integer({ min: 1, max: 5 }),
  });

  // Offset-level guarantee on breakPoints. The fragment-level guarantee (first
  // fragment >= leftmin, last >= rightmin) follows from this plus conservation,
  // so it is not fuzzed separately.
  it("every break offset honors both mins [clean]", () => {
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
