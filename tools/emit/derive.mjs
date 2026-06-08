/**
 * Downstream emitters — derive the ecosystem artifacts from the keystone
 * hyph-hy.tex (the engine-generated Liang patterns + exceptions):
 *
 *   hyph_hy_AM.dic       libhyphen / Hunspell  (Adobe InDesign, LibreOffice,
 *                        OpenOffice, Scribus, Firefox). Patterns only.
 *   hyphenation.hy.json  hypher / JS ecosystem. Patterns (bucketed by char
 *                        length) + exceptions, for exact reproduction.
 *
 * See docs/SOURCES.md §F. The Chromium .hyb is produced separately by the AOSP
 * mk_hyb_file.py tool fed with hyph-hy.tex.
 *
 * Usage: node tools/emit/derive.mjs <hyph-hy.tex> <out-dir>
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { parseTex } from "./tex.mjs";

const LEFTMIN = 1;
const RIGHTMIN = 2;

/** libhyphen / Hunspell dictionary: UTF-8 header + minima + bare patterns. */
function toDic(patterns) {
  return ["UTF-8", `LEFTHYPHENMIN ${LEFTMIN}`, `RIGHTHYPHENMIN ${RIGHTMIN}`, ...patterns].join("\n") + "\n";
}

/**
 * hypher pattern object. `patterns[k]` is every pattern of total length k
 * (letters + digits) concatenated; hypher slices each bucket into k-char chunks.
 * `exceptions` is a space-separated list of hyphen-marked words.
 */
function toHypher(patterns, exceptions) {
  const buckets = new Map();
  for (const pattern of patterns) {
    const len = [...pattern].length;
    const bucket = buckets.get(len) ?? [];
    bucket.push(pattern);
    buckets.set(len, bucket);
  }
  const patternsObj = {};
  for (const len of [...buckets.keys()].sort((a, b) => a - b)) {
    patternsObj[len] = buckets.get(len).join("");
  }
  return {
    id: "hy",
    leftmin: LEFTMIN,
    rightmin: RIGHTMIN,
    patterns: patternsObj,
    exceptions: exceptions.join(" "),
  };
}

/**
 * The Minikin "TeX trio" feeding mk_hyb_file.py -> .hyb (Chromium/Android):
 *   .pat.txt  bare patterns, one per line
 *   .chr.txt  one "<lower><upper>" case pair per line; line order = char index
 *   .hyp.txt  exceptions (hyphen-marked words), one per line
 */
function toPatTxt(patterns) {
  return patterns.join("\n") + "\n";
}

function toChrTxt(patterns) {
  const letters = new Set();
  for (const pattern of patterns) {
    for (const ch of pattern) {
      if (ch !== "." && !(ch >= "0" && ch <= "9")) letters.add(ch);
    }
  }
  // mk_hyb_file's load_chr keeps l[:1] when the upper form is multi-char (e.g. և),
  // so c.toUpperCase() is always safe even for letters without a single uppercase.
  return (
    [...letters]
      .sort((a, b) => a.codePointAt(0) - b.codePointAt(0))
      .map((c) => c + c.toUpperCase())
      .join("\n") + "\n"
  );
}

function toHypTxt(exceptions) {
  return exceptions.join("\n") + "\n";
}

async function main() {
  const [texPath, outDir] = process.argv.slice(2);
  if (!texPath || !outDir) throw new Error("usage: derive.mjs <hyph-hy.tex> <out-dir>");

  const { patterns, exceptions } = parseTex(await readFile(texPath, "utf8"));
  if (patterns.length === 0) throw new Error("no patterns parsed from " + texPath);
  await mkdir(outDir, { recursive: true });

  const dicPath = join(outDir, "hyph_hy_AM.dic");
  await writeFile(dicPath, toDic(patterns), "utf8");

  const jsonPath = join(outDir, "hyphenation.hy.json");
  await writeFile(jsonPath, JSON.stringify(toHypher(patterns, exceptions)) + "\n", "utf8");

  // Minikin trio for the .hyb build (mk_hyb_file.py derives chr/hyp names from pat).
  await writeFile(join(outDir, "hyph-hy.pat.txt"), toPatTxt(patterns), "utf8");
  await writeFile(join(outDir, "hyph-hy.chr.txt"), toChrTxt(patterns), "utf8");
  await writeFile(join(outDir, "hyph-hy.hyp.txt"), toHypTxt(exceptions), "utf8");

  console.log(`patterns: ${patterns.length}  exceptions: ${exceptions.length}`);
  console.log(`-> ${dicPath}`);
  console.log(`-> ${jsonPath}`);
  console.log(`-> ${join(outDir, "hyph-hy.{pat,chr,hyp}.txt")} (Minikin trio for .hyb)`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
