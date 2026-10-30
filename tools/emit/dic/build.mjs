/**
 * Assemble hyph_hy_AM.dic, the libhyphen / Hunspell dictionary (LibreOffice,
 * OpenOffice, Scribus, Adobe InDesign's Hunspell provider).
 *
 * libhyphen is not TeX. Its matcher applies, at each letter, only the pattern of
 * the one automaton state it has reached, so every pattern must already carry
 * the values of all patterns embedded in it — that is what upstream's
 * substrings.pl computes, and a .dic without that step silently loses breaks.
 * libhyphen has no \hyphenation either, so exceptions become whole-word patterns.
 *
 *   1. TeX patterns + exceptions (as whole-word patterns) + non-standard rules
 *      (./nonstandard.mjs: the written schwa, the և -> ե-վ split).
 *   2. Patterns with the same letters are merged into one (digit-wise maximum),
 *      keeping the replacement of a non-standard rule; libhyphen would otherwise
 *      keep only the last line with that key.
 *   3. substrings.pl, with the non-standard rules FIRST and shortest first: it
 *      copies a rule's replacement into an enclosing pattern only if the rule
 *      was processed before it. Out of order, the replacement is dropped and the
 *      rule degrades into a plain break (Երև-ան).
 *
 * Usage: node tools/emit/dic/build.mjs <hyph-hy.tex> <hyph_hy_AM.dic>
 */

import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseTex, RENDER_MINIMA } from "../tex.mjs";
import { exceptionPattern, mergeByKey } from "./merge.mjs";
import { buildLigatureLines, buildSchwaLines } from "./nonstandard.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const WORDLIST = join(HERE, "../../../corpus/wordlist.txt");
const SUBSTRINGS = join(HERE, "../vendor/substrings.pl");
async function main() {
  const [texPath, dicPath] = process.argv.slice(2);
  if (!texPath || !dicPath) throw new Error("usage: dic/build.mjs <hyph-hy.tex> <hyph_hy_AM.dic>");

  const { patterns, exceptions } = parseTex(await readFile(texPath, "utf8"));
  if (patterns.length === 0) throw new Error(`no patterns in ${texPath}`);
  const words = (await readFile(WORDLIST, "utf8")).split("\n").filter(Boolean);
  const schwa = buildSchwaLines(words);
  const ligature = buildLigatureLines();

  const rules = mergeByKey([...patterns, ...exceptions.map(exceptionPattern), ...ligature, ...schwa]);

  const scratch = await mkdtemp(join(tmpdir(), "vankatum-dic-"));
  try {
    const input = join(scratch, "patterns.txt");
    await writeFile(input, rules.join("\n") + "\n", "utf8");
    // substrings.pl reports every embedding on stdout (hundreds of MB); only its
    // exit status and stderr matter.
    execFileSync(
      "perl",
      [SUBSTRINGS, input, dicPath, "UTF-8", String(RENDER_MINIMA.leftmin), String(RENDER_MINIMA.rightmin)],
      { stdio: ["ignore", "ignore", "inherit"] },
    );
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
  console.log(
    `dic: ${patterns.length} patterns + ${exceptions.length} exceptions + ` +
      `${ligature.length} ligature + ${schwa.length} schwa rules -> ${dicPath}`,
  );
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
