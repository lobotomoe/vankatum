import { describe, expect, it } from "vitest";
import { compile, breakOffsets } from "../tools/emit/liang.mjs";
import { applyMinima, parseTex, offsetsFromMarked } from "../tools/emit/tex.mjs";
import { exceptionPattern, mergeByKey } from "../tools/emit/dic/merge.mjs";

// The emit tooling is the pattern-generation path: liang.mjs is the Liang applier
// every downstream consumer (TeX/hypher/libhyphen/Minikin) effectively runs, and
// tex.mjs parses the keystone .tex artifact. These exercise them in isolation,
// independent of the engine and of pypatgen, on hand-built inputs.

describe("liang applier", () => {
  it("breaks at an odd priority between letters", () => {
    const map = compile(["a1b"]);
    expect(breakOffsets("ab", map)).toEqual([1]);
  });

  it("does not break at an even priority", () => {
    const map = compile(["a2b"]);
    expect(breakOffsets("ab", map)).toEqual([]);
  });

  it("takes the max priority across overlapping patterns (even inhibits odd)", () => {
    // "a1b" alone would break a|b; the higher even "a2bc" wins at that gap.
    expect(breakOffsets("abc", compile(["a1b"]))).toEqual([1]);
    expect(breakOffsets("abc", compile(["a1b", "a2bc"]))).toEqual([]);
  });

  it("respects leftmin and rightmin", () => {
    const map = compile(["a1b"]);
    expect(breakOffsets("ab", map, { leftmin: 1, rightmin: 2 })).toEqual([]);
    expect(breakOffsets("ab", map, { leftmin: 2, rightmin: 1 })).toEqual([]);
  });

  it("anchors patterns at the word boundary marker", () => {
    // ".a" only matches word-initial; "1b" inside ".ab." gives the break.
    expect(breakOffsets("ab", compile([".a1b"]))).toEqual([1]);
    expect(breakOffsets("cab", compile([".a1b"]))).toEqual([]);
  });

  it("works on Armenian codepoints (the real alphabet)", () => {
    expect(breakOffsets("աբ", compile(["ա1բ"]))).toEqual([1]);
  });
});

describe("tex parser", () => {
  const tex = ["\\patterns{", ".ա2բ", "ա3բ", "}", "\\hyphenation{", "ա-շա-կերտ", "}"].join("\n");

  it("splits patterns and exceptions blocks", () => {
    const { patterns, exceptions } = parseTex(tex);
    expect(patterns).toEqual([".ա2բ", "ա3բ"]);
    expect(exceptions).toEqual(["ա-շա-կերտ"]);
  });

  it("returns empty blocks when absent", () => {
    expect(parseTex("nothing here")).toEqual({ patterns: [], exceptions: [] });
  });

  it("reads codepoint offsets from a hyphen-marked word", () => {
    expect(offsetsFromMarked("ա-շա-կերտ")).toEqual([1, 3]);
    expect(offsetsFromMarked("մարդ")).toEqual([]);
  });
});

describe("exception minima", () => {
  it("drops breaks that leave fewer than rightmin letters on the new line", () => {
    expect(applyMinima("ա-լե-լու-ի-ա")).toBe("ա-լե-լու-իա");
  });

  it("keeps a single letter before the break (leftmin 1)", () => {
    expect(applyMinima("ա-շա-կերտ")).toBe("ա-շա-կերտ");
  });
});

describe("libhyphen .dic rules", () => {
  it("turns an exception into a whole-word pattern forcing exactly its breaks", () => {
    expect(exceptionPattern("աբ-բա")).toBe(".ա8բ9բ8ա.");
  });

  it("merges rules with the same letters, keeping the replacement", () => {
    // libhyphen keeps only the last line per key, so the merge must happen first.
    expect(mergeByKey(["ևա1", "և9ա/ե=վ,1,1"])).toEqual(["և9ա1/ե=վ,1,1"]);
  });

  it("lists non-standard rules first, shortest first, then standard patterns", () => {
    // substrings.pl carries a replacement into a containing rule only if the
    // contained rule was processed earlier.
    const merged = mergeByKey(["ա1բ", ".ա9րևե./ըր=,1,1", "և9ե/ե=վ,1,1"]);
    expect(merged).toEqual(["և9ե/ե=վ,1,1", ".ա9րևե./ըր=,1,1", "ա1բ"]);
  });

  it("refuses two different replacements for the same letters", () => {
    expect(() => mergeByKey(["և9ա/ե=վ,1,1", "և9ա/x=,1,1"])).toThrow(/conflicting replacements/);
  });
});
