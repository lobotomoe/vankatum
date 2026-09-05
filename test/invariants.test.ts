/**
 * Property-based invariants — laws that must hold for EVERY input, verified by
 * fuzzing rather than examples. These certify the whole input space and protect
 * everything built on top of the core. See docs/SPEC.md.
 *
 * Structure: each LAW is defined once, then run over the generators that actually
 * stress it AND over both orthography variants (a law x generator x variant
 * matrix). This keeps the set of distinct laws minimal and orthogonal — no
 * copy-paste, no superseded duplicates — while guaranteeing that adding the
 * Western variant did not weaken any universal guarantee (conservation above all).
 *
 * Generator rationale:
 *   messy      — any string (letters, both cases, separators, intra-word marks,
 *                noise). For the universal laws this is a strict superset of
 *                `clean`, so `clean` is not re-run on them.
 *   structured — deliberately emits ու digraphs, the և ligature, յ-glides,
 *                (Western) եա/եօ glide-digraphs, consonant clusters and hiatus;
 *                the strongest stressor for the digraph/glide and onset laws.
 *   clean      — random Armenian lowercase. Its only unique contribution is
 *                zero-nucleus (all-consonant) words, which `structured` cannot
 *                produce (every structured syllable has a nucleus).
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { breakPoints, syllabify, EASTERN, resolveOrthography, type Variant } from "../src/index.js";
import { isArmenianWordMark, LIGATURE_EW, tokenize } from "../src/alphabet.js";

const RUNS = 5000;
const VARIANTS = ["eastern", "western"] as const satisfies ReadonlyArray<Variant>;

// Lowercase Armenian letters incl. ligature և and yiwn ւ (so ու digraphs form).
const LOWER = Array.from("աբգդեզէըթժիլխծկհձղճմյնշոչպջռսվտրցւփքօֆև");
const UPPER = Array.from("ԱԲԳԴԵԶԷԸԹԺԻԼԽԾԿՀՁՂՃՄՅՆՇՈՉՊՋՌՍՎՏՐՑՒՓՔՕՖ");
// The intra-word marks: transparent to syllabification, must be conserved.
const MARKS = Array.from("՛՜՞՚");
// 😀 is astral (2 UTF-16 units): catches any UTF-16/codepoint indexing drift.
const NOISE = Array.from(" -.,՝՜԰0123abcЖ😀\n\t");

const cleanWord = fc
  .array(fc.constantFrom(...LOWER), { minLength: 1, maxLength: 24 })
  .map((a) => a.join(""));

const upperWord = fc
  .array(fc.constantFrom(...UPPER), { minLength: 2, maxLength: 12 })
  .map((a) => a.join(""));

const messyText = fc
  .array(fc.constantFrom(...LOWER, ...UPPER, ...MARKS, ...NOISE), { minLength: 1, maxLength: 30 })
  .map((a) => a.join(""));

// Syllable-structured generator: deliberately produces digraphs (ու), the
// ligature (և), consonant clusters and hiatus, so the structural invariants get
// real coverage instead of relying on rare random collisions. Its nucleus pool is
// derived from the orthography config so the variants share one source of truth.
const CONSONANTS = Array.from("բգդզթժլխծկհձղճմյնշչպջռսվտրցփքֆ"); // includes յ (forms yod-glides)
const SINGLE_VOWELS = [...EASTERN.vowels];
const nucleiFor = (variant: Variant): string[] => [
  ...SINGLE_VOWELS,
  "ու",
  "և",
  ...resolveOrthography(variant).vowelDigraphs.map(([a, b]) => a + b),
];
const structuredWord = (variant: Variant) =>
  fc
    .array(
      fc.record({
        onset: fc.array(fc.constantFrom(...CONSONANTS), { minLength: 0, maxLength: 3 }),
        nucleus: fc.constantFrom(...nucleiFor(variant)),
        coda: fc.array(fc.constantFrom(...CONSONANTS), { minLength: 0, maxLength: 2 }),
      }),
      { minLength: 1, maxLength: 6 },
    )
    .map((sylls) => sylls.map((s) => s.onset.join("") + s.nucleus + s.coda.join("")).join(""));

const generatorsFor = (variant: Variant) =>
  ({
    messy: messyText,
    clean: cleanWord,
    structured: structuredWord(variant),
  }) as const;
type GeneratorName = keyof ReturnType<typeof generatorsFor>;

/**
 * Fragments a word must split into with no minima: one per nucleus, except a
 * vowel right after the ligature և — its boundary lies inside the ligature, so
 * no letter-preserving break exists there (docs/SPEC.md).
 */
const expectedFragments = (w: string, variant: Variant): number => {
  let nuclei = 0;
  let suppressed = 0;
  let afterLigature = false;
  for (const u of tokenize(w, resolveOrthography(variant))) {
    if (u.kind !== "vowel") {
      afterLigature = false;
      continue;
    }
    nuclei++;
    if (afterLigature) suppressed++;
    afterLigature = u.text.toLowerCase() === LIGATURE_EW;
  }
  return Math.max(1, nuclei - suppressed);
};

const leadingConsonants = (fragment: string, variant: Variant): number => {
  let n = 0;
  for (const u of tokenize(fragment, resolveOrthography(variant))) {
    if (u.kind === "consonant") n++;
    else break;
  }
  return n;
};

// --- The laws -------------------------------------------------------------
// Each asserts by throwing (block body), so fast-check sees a void return and
// treats "no throw" as success — never a stray boolean. Every law takes the
// variant so the same guarantee is checked for both orthographies.

type Law = (w: string, variant: Variant) => void;

/** Fragments rejoin to the exact original — not one codepoint added, dropped or moved. */
const conservation: Law = (w, variant) => {
  expect(syllabify(w, { variant }).join("")).toBe(w);
};

/** No fragment is ever empty. */
const noEmpty: Law = (w, variant) => {
  for (const frag of syllabify(w, { variant })) expect([...frag].length).toBeGreaterThan(0);
};

/** The ու digraph is one nucleus and is never split across a break. */
const ouIntact: Law = (w, variant) => {
  const frags = syllabify(w, { variant });
  for (let i = 1; i < frags.length; i++) {
    const last = [...(frags[i - 1] as string)].at(-1)?.toLowerCase();
    const first = [...(frags[i] as string)][0]?.toLowerCase();
    expect(last === "ո" && first === "ւ").toBe(false);
  }
};

const GLIDE_VOWELS = new Set("աեէըիոօ");

/** A յ-glide (յ + vowel) is one nucleus and is never split across a break. */
const yodIntact: Law = (w, variant) => {
  const frags = syllabify(w, { variant });
  for (let i = 1; i < frags.length; i++) {
    const last = [...(frags[i - 1] as string)].at(-1)?.toLowerCase();
    const first = [...(frags[i] as string)][0]?.toLowerCase() ?? "";
    expect(last === "յ" && GLIDE_VOWELS.has(first)).toBe(false);
  }
};

const EA_EO_SECOND = new Set("աօ");

/** Western only: an եա / եօ glide-digraph is one nucleus and is never split. */
const eaEoIntact: Law = (w, variant) => {
  const frags = syllabify(w, { variant });
  for (let i = 1; i < frags.length; i++) {
    const last = [...(frags[i - 1] as string)].at(-1)?.toLowerCase();
    const first = [...(frags[i] as string)][0]?.toLowerCase() ?? "";
    expect(last === "ե" && EA_EO_SECOND.has(first)).toBe(false);
  }
};

/** The ligature և is never followed directly by a break into a vowel (no break inside the ligature). */
const ligatureIntact: Law = (w, variant) => {
  const frags = syllabify(w, { variant, leftmin: 0, rightmin: 0 });
  for (let i = 1; i < frags.length; i++) {
    const last = [...(frags[i - 1] as string)].at(-1)?.toLowerCase();
    const first = [...(frags[i] as string)][0]?.toLowerCase() ?? "";
    expect(last === LIGATURE_EW && (GLIDE_VOWELS.has(first) || first === LIGATURE_EW)).toBe(false);
  }
};

/** Every non-initial fragment carries an onset of at most one consonant. */
const onsetMax: Law = (w, variant) => {
  const frags = syllabify(w, { variant });
  for (let i = 1; i < frags.length; i++) {
    expect(leadingConsonants(frags[i] as string, variant)).toBeLessThanOrEqual(1);
  }
};

/** With no min constraints, there is exactly one fragment per breakable nucleus (>=1). */
const completeness: Law = (w, variant) => {
  const frags = syllabify(w, { variant, leftmin: 0, rightmin: 0 });
  expect(frags.length).toBe(expectedFragments(w, variant));
};

// --- The matrix -----------------------------------------------------------
// Each law lists the generators whose distribution meaningfully exercises it, and
// (optionally) the variants it applies to — default both.

interface LawSpec {
  name: string;
  law: Law;
  on: ReadonlyArray<GeneratorName>;
  variants?: ReadonlyArray<Variant>;
}

const LAWS: readonly LawSpec[] = [
  // Universal laws — messy covers clean's alphabet; structured reliably exercises
  // the digraph/glide merge paths where an offset bug would surface.
  { name: "letter conservation", law: conservation, on: ["messy", "structured"] },
  { name: "no empty fragment", law: noEmpty, on: ["messy", "structured"] },
  { name: "ու digraph never split", law: ouIntact, on: ["messy", "structured"] },
  { name: "yod-glide never split", law: yodIntact, on: ["messy", "structured"] },
  { name: "և never broken before a vowel", law: ligatureIntact, on: ["messy", "structured"] },
  // եա / եօ glide-digraph integrity — Western only (Eastern reads them as hiatus).
  { name: "եա/եօ digraph never split", law: eaEoIntact, on: ["messy", "structured"], variants: ["western"] },
  // Onset maximisation — `structured` is the strongest cluster stressor and
  // strictly supersedes `clean` here, so it runs there alone.
  { name: "non-initial onset <= 1 consonant", law: onsetMax, on: ["structured"] },
  // Completeness — `clean` uniquely reaches zero-nucleus words; `structured`
  // covers heavy digraph/glide/cluster/ligature words.
  { name: "fragments == breakable nuclei (no mins)", law: completeness, on: ["clean", "structured"] },
];

describe("core syllabifier invariants", () => {
  for (const variant of VARIANTS) {
    const GENERATORS = generatorsFor(variant);
    for (const { name, law, on, variants } of LAWS) {
      if (variants !== undefined && !variants.includes(variant)) continue;
      for (const gen of on) {
        it(`${name} [${gen}] (${variant})`, () => {
          fc.assert(
            fc.property(GENERATORS[gen], (w) => {
              law(w, variant);
            }),
            { numRuns: RUNS },
          );
        });
      }
    }
  }
});

// The laws below are variant-independent by construction (they act before or
// after tokenisation), so `eastern` covers them.

describe("letter abbreviations", () => {
  it("an all-caps word of >= 2 letters is never broken", () => {
    fc.assert(
      fc.property(upperWord, (w) => {
        expect(syllabify(w, { leftmin: 0, rightmin: 0 })).toEqual([w]);
      }),
      { numRuns: RUNS },
    );
  });
});

describe("intra-word marks", () => {
  // A word with marks inserted anywhere: strip the marks from its fragments and
  // you get exactly the fragments of the bare word — the marks change nothing
  // about where breaks fall, and they are conserved in place.
  const markedWord = fc
    .tuple(cleanWord, fc.array(fc.tuple(fc.nat(24), fc.constantFrom(...MARKS)), { maxLength: 3 }))
    .map(([word, inserts]) => {
      const chars = [...word];
      for (const [pos, mark] of [...inserts].sort((a, b) => b[0] - a[0])) {
        chars.splice(Math.min(pos, chars.length), 0, mark);
      }
      return { word, marked: chars.join("") };
    });
  const stripMarks = (s: string) => [...s].filter((c) => !isArmenianWordMark(c)).join("");

  it("are transparent to syllabification and conserved", () => {
    fc.assert(
      fc.property(markedWord, ({ word, marked }) => {
        const frags = syllabify(marked);
        expect(frags.join("")).toBe(marked);
        expect(frags.map(stripMarks)).toEqual(syllabify(word));
      }),
      { numRuns: RUNS },
    );
  });
});

describe("leftmin / rightmin", () => {
  const minsArb = fc.record({
    leftmin: fc.integer({ min: 1, max: 5 }),
    rightmin: fc.integer({ min: 1, max: 5 }),
  });

  // Offset-level guarantee on breakPoints. The fragment-level guarantee (first
  // fragment >= leftmin, last >= rightmin) follows from this plus conservation,
  // so it is not fuzzed separately. Variant-independent (the min filter runs after
  // tokenisation), so `eastern` covers it.
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
