import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { hyphenate, hyphenateText, SOFT_HYPHEN } from "../src/index.js";

const strip = (s: string) => s.replaceAll(SOFT_HYPHEN, "");

describe("hyphenateText — soft-hyphen insertion", () => {
  it("hyphenates a lone word the same as the core, with soft hyphens", () => {
    expect(hyphenateText("աշակերտ")).toBe(hyphenate("աշակերտ", { hyphen: SOFT_HYPHEN }));
    expect(strip(hyphenateText("աշակերտ"))).toBe("աշակերտ");
  });

  it("preserves spaces and Armenian punctuation between words", () => {
    const out = hyphenateText("Բարև Ձեզ։");
    expect(strip(out)).toBe("Բարև Ձեզ։");
    // each word independently hyphenated, the space and ։ untouched
    const [first, rest] = out.split(" ");
    expect(first).toBe(hyphenate("Բարև", { hyphen: SOFT_HYPHEN }));
    expect(rest).toBe(hyphenate("Ձեզ", { hyphen: SOFT_HYPHEN }) + "։");
  });

  it("leaves non-Armenian runs (Latin, digits) verbatim", () => {
    expect(hyphenateText("web 2024 app")).toBe("web 2024 app");
  });

  it("handles mixed Latin + Armenian without touching the Latin part", () => {
    const out = hyphenateText("HTML-ը");
    expect(strip(out)).toBe("HTML-ը");
    // "ը" is a single-letter word: no break possible
    expect(out).toBe("HTML-ը");
  });

  it("inserts no break when none is legal (monosyllable)", () => {
    expect(hyphenateText("որդ")).toBe("որդ");
  });

  it("honours leftmin / rightmin", () => {
    const tight = hyphenateText("աշակերտ", { rightmin: 5 });
    const loose = hyphenateText("աշակերտ", { rightmin: 2 });
    expect(strip(tight)).toBe("աշակերտ");
    expect((tight.match(new RegExp(SOFT_HYPHEN, "g")) ?? []).length).toBeLessThanOrEqual(
      (loose.match(new RegExp(SOFT_HYPHEN, "g")) ?? []).length,
    );
  });
});

describe("hyphenateText — conservation invariant", () => {
  it("removing every soft hyphen restores the original text exactly", () => {
    const segment = fc.oneof(
      fc
        .array(fc.constantFrom(...[..."աբգդեզէըթժիլխծկհձղճմյնշոչպջռսվտրցւփքօֆև"]), {
          minLength: 1,
          maxLength: 12,
        })
        .map((a) => a.join("")),
      fc.constantFrom(" ", "  ", "\n", "։", ", ", "web", "42", "(", ")"),
    );
    fc.assert(
      fc.property(fc.array(segment, { maxLength: 8 }), (parts) => {
        const text = parts.join("");
        expect(strip(hyphenateText(text))).toBe(text);
      }),
      { numRuns: 5000 },
    );
  });

  it("never emits a soft hyphen adjacent to a non-letter boundary", () => {
    const out = hyphenateText("ա, աշակերտ։");
    // no soft hyphen should sit next to the comma, space, or ։
    expect(out.includes(SOFT_HYPHEN + ",")).toBe(false);
    expect(out.includes(SOFT_HYPHEN + " ")).toBe(false);
    expect(out.includes(SOFT_HYPHEN + "։")).toBe(false);
    expect(out.includes(" " + SOFT_HYPHEN)).toBe(false);
  });
});
