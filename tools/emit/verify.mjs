/**
 * Fidelity gate — proves an emitted TeX pattern file reproduces the engine.
 *
 * Parses \patterns{} and \hyphenation{} from a .tex file, applies them with the
 * standard Liang algorithm (the same one TeX, hypher, libhyphen and Minikin run),
 * and diffs the result against the engine's labelling over the corpus. Reports
 * recall (engine breaks reproduced), precision (predicted breaks that are real)
 * and exact whole-word agreement. See docs/SOURCES.md §F.
 *
 * Usage: node tools/emit/verify.mjs <patterns.tex> <dictionary.txt>
 */

import { readFile } from "node:fs/promises";
import { compile, breakOffsets } from "./liang.mjs";
import { parseTex, offsetsFromMarked } from "./tex.mjs";

const APPLY_OPTS = { leftmin: 1, rightmin: 1 };

async function main() {
  const [texPath, dictPath] = process.argv.slice(2);
  if (!texPath || !dictPath) throw new Error("usage: verify.mjs <patterns.tex> <dictionary.txt>");

  const tex = await readFile(texPath, "utf8");
  const parsed = parseTex(tex);
  const patterns = compile(parsed.patterns);
  const exceptions = new Map();
  for (const marked of parsed.exceptions) {
    exceptions.set(marked.replaceAll("-", ""), offsetsFromMarked(marked));
  }

  let missed = 0; // engine break not predicted
  let falsePos = 0; // predicted break the engine does not make
  let engineTotal = 0;
  let wordsExact = 0;
  let words = 0;

  for (const line of (await readFile(dictPath, "utf8")).split("\n")) {
    const marked = line.trim();
    if (!marked) continue;
    const word = marked.replaceAll("-", "");
    words++;
    const engine = new Set(offsetsFromMarked(marked));
    const predicted = new Set(exceptions.get(word) ?? breakOffsets(word, patterns, APPLY_OPTS));

    engineTotal += engine.size;
    let wordOk = true;
    for (const b of engine) if (!predicted.has(b)) { missed++; wordOk = false; }
    for (const b of predicted) if (!engine.has(b)) { falsePos++; wordOk = false; }
    if (wordOk) wordsExact++;
  }

  const recall = (100 * (engineTotal - missed)) / engineTotal;
  const predictedTotal = engineTotal - missed + falsePos;
  const precision = (100 * (engineTotal - missed)) / predictedTotal;
  console.log(`words:              ${words}`);
  console.log(`engine break points:${engineTotal}`);
  console.log(`missed (recall):    ${missed}  -> recall    ${recall.toFixed(3)}%`);
  console.log(`false (precision):  ${falsePos}  -> precision ${precision.toFixed(3)}%`);
  console.log(`exact whole-word:   ${wordsExact}/${words}  (${((100 * wordsExact) / words).toFixed(3)}%)`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
