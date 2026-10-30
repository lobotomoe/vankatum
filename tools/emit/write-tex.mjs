/**
 * Assemble the keystone hyph-hy.tex from a raw pypatgen export: provenance
 * header, the \patterns block as exported, and the \hyphenation exceptions with
 * the render minima applied (TeX and hypher apply exceptions verbatim, so an
 * exception must not break inside them). See docs/SOURCES.md §F.
 *
 * Usage: node tools/emit/write-tex.mjs <pypatgen-export> <word-count> <hyph-hy.tex>
 */

import { readFile, writeFile } from "node:fs/promises";
import { applyMinima, parseTex, RENDER_MINIMA } from "./tex.mjs";

async function main() {
  const [rawPath, words, outPath] = process.argv.slice(2);
  if (!rawPath || !words || !outPath) {
    throw new Error("usage: write-tex.mjs <pypatgen-export> <word-count> <hyph-hy.tex>");
  }
  const { patterns, exceptions } = parseTex(await readFile(rawPath, "utf8"));
  if (patterns.length === 0) throw new Error(`no patterns in ${rawPath}`);

  const date = new Date().toISOString().slice(0, 10);
  const lines = [
    "% vankatum -- Armenian (hy) hyphenation patterns",
    `% Generated ${date} from the vankatum rule engine over a ${words}-word`,
    "% corpus (ARLIS legal texts, Hunspell, Wikipedia, Wikisource, subtitles,",
    "% Wiktionary). DO NOT EDIT -- regenerate with",
    "% tools/emit/build-patterns.sh.",
    `% Recommended minima: \\lefthyphenmin=${RENDER_MINIMA.leftmin} \\righthyphenmin=${RENDER_MINIMA.rightmin}`,
    "% License: MIT (vankatum). Patterns are generated, not derived from hyph-hy.",
    "%",
    "\\patterns{",
    ...patterns,
    "}",
  ];
  if (exceptions.length > 0) {
    lines.push("\\hyphenation{", ...exceptions.map((marked) => applyMinima(marked)), "}");
  }
  await writeFile(outPath, lines.join("\n") + "\n", "utf8");
  console.log(`patterns: ${patterns.length}  exceptions: ${exceptions.length} -> ${outPath}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
