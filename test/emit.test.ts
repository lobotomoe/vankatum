import { describe, expect, it } from "vitest";
import { compile, breakOffsets } from "../tools/emit/liang.mjs";
import { parseTex, offsetsFromMarked } from "../tools/emit/tex.mjs";

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
