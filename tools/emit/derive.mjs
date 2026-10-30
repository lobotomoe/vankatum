/**
 * Downstream emitters — derive the ecosystem artifacts from the keystone
 * hyph-hy.tex (the engine-generated Liang patterns + exceptions):
 *
 *   hyphenation.hy.json  hypher / JS ecosystem. Patterns (bucketed by char
 *                        length) + exceptions, for exact reproduction.
 *
 * The libhyphen .dic needs more than a format change; see ./dic/build.mjs.
 * See docs/SOURCES.md §F. The Chromium .hyb is produced separately by the AOSP
 * mk_hyb_file.py tool fed with hyph-hy.tex.
 *
 * Usage: node tools/emit/derive.mjs <hyph-hy.tex> <out-dir>
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { parseTex, RENDER_MINIMA } from "./tex.mjs";

/** hypher pads each word with "_", not TeX's ".", before matching patterns. */
const HYPHER_BOUNDARY = "_";
/** hypher marks the breaks of an exception with U+2027 HYPHENATION POINT. */
const HYPHER_POINT = "\u2027";

/**
 * hypher pattern object. `patterns[k]` is every pattern of total length k
 * (letters + digits) concatenated; hypher slices each bucket into k-char chunks.
 * `exceptions` is a ", "-separated list of words with U+2027 at each break.
 */
function toHypher(patterns, exceptions) {
  const buckets = new Map();
  for (const texPattern of patterns) {
    const pattern = texPattern.replaceAll(".", HYPHER_BOUNDARY);
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
    leftmin: RENDER_MINIMA.leftmin,
    rightmin: RENDER_MINIMA.rightmin,
    patterns: patternsObj,
    exceptions: exceptions.map((marked) => marked.replaceAll("-", HYPHER_POINT)).join(", "),
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

  const jsonPath = join(outDir, "hyphenation.hy.json");
  await writeFile(jsonPath, JSON.stringify(toHypher(patterns, exceptions)) + "\n", "utf8");

  // Minikin trio for the .hyb build (mk_hyb_file.py derives chr/hyp names from pat).
  await writeFile(join(outDir, "hyph-hy.pat.txt"), toPatTxt(patterns), "utf8");
  await writeFile(join(outDir, "hyph-hy.chr.txt"), toChrTxt(patterns), "utf8");
  await writeFile(join(outDir, "hyph-hy.hyp.txt"), toHypTxt(exceptions), "utf8");

  console.log(`patterns: ${patterns.length}  exceptions: ${exceptions.length}`);
  console.log(`-> ${jsonPath}`);
  console.log(`-> ${join(outDir, "hyph-hy.{pat,chr,hyp}.txt")} (Minikin trio for .hyb)`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
