/**
 * Held-out generalisation eval for the generated Liang patterns.
 *
 * The build pipeline (build-patterns.sh) trains on the WHOLE corpus and verifies
 * the patterns reproduce the engine on that same corpus (~100%, by construction).
 * That says nothing about UNSEEN words. This script does: it splits the corpus by
 * a content hash into train (~90%) and held-out test (~10%), trains patterns on
 * train ONLY with the same pypatgen schedule, then applies them to the held-out
 * words and measures recall/precision against the engine. The test words are
 * never in the training dictionary, so pypatgen exceptions cannot memorise them —
 * this is pure pattern generalisation.
 *
 * Reproducible: `node tools/emit/holdout.mjs` (needs pypatgen, like the build).
 * Override the binary with PYPATGEN=/path/to/pypatgen.
 */

import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { breakPoints } from "../../dist/index.js";
import { compile, breakOffsets } from "./liang.mjs";
import { parseTex } from "./tex.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../..");
const WORDLIST = join(ROOT, "corpus/wordlist.txt");
const WORKDIR = join(ROOT, "playground/holdout");
const PYPATGEN = process.env.PYPATGEN ?? join(ROOT, "playground/.venv/bin/pypatgen");

// Same lowercase-Armenian, >=2-letter filter as the labeller.
const VALID = /^[ա-ֆ]{2,}$/u;
// Same pattern-training schedule as build-patterns.sh — must match for the number
// to describe the shipped patterns.
const SCHEDULE = ["2-4 1:2:20", "2-4 2:1:8", "2-6 1:4:8", "2-6 3:2:4", "2-8 1:2:3", "2-8 3:1:1"];
const APPLY_OPTS = { leftmin: 1, rightmin: 1 };
const TEST_BUCKET = 0; // hash % 10 === 0 -> held out (~10%)

/** Deterministic FNV-1a, so the split is stable across runs and machines. */
function hash(word) {
  let h = 0x811c9dc5;
  for (const ch of word) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** Insert "-" at each engine break offset of a word (patgen dictionary line). */
function label(word) {
  const points = breakPoints(word, APPLY_OPTS);
  if (points.length === 0) return word;
  const chars = [...word];
  const out = [];
  let prev = 0;
  for (const b of points) {
    out.push(chars.slice(prev, b).join(""), "-");
    prev = b;
  }
  out.push(chars.slice(prev).join(""));
  return out.join("");
}

async function main() {
  const raw = await readFile(WORDLIST, "utf8");
  const words = raw.split("\n").map((w) => w.trim()).filter((w) => VALID.test(w));
  if (words.length === 0) throw new Error(`no valid words in ${WORDLIST}`);

  const train = [];
  const test = [];
  for (const w of words) (hash(w) % 10 === TEST_BUCKET ? test : train).push(w);

  await mkdir(WORKDIR, { recursive: true });
  const trainDict = join(WORKDIR, "train.txt");
  const proj = join(WORKDIR, "holdout.proj");
  await writeFile(trainDict, train.map(label).join("\n") + "\n", "utf8");

  // Train on the train split only, mirroring build-patterns.sh.
  await rm(proj, { force: true });
  const run = (args) => execFileSync(PYPATGEN, args, { stdio: ["ignore", "ignore", "inherit"] });
  run([proj, "new", trainDict, "-m", "1,1"]);
  for (const spec of SCHEDULE) {
    const [range, selector] = spec.split(" ");
    run([proj, "train", "-r", range, "-s", selector, "-c"]);
  }
  // export refuses to overwrite an existing file (but exits 0) — use a fresh path.
  const texPath = join(tmpdir(), `vankatum-holdout-${process.pid}.tex`);
  await rm(texPath, { force: true });
  run([proj, "export", texPath]);
  const tex = await readFile(texPath, "utf8");
  await rm(texPath, { force: true });

  const patterns = compile(parseTex(tex).patterns);

  // Measure on held-out words ONLY (never in the training dictionary).
  let missed = 0;
  let falsePos = 0;
  let engineTotal = 0;
  let wordsExact = 0;
  let wordsWithBreak = 0;
  for (const word of test) {
    const engine = new Set(breakPoints(word, APPLY_OPTS));
    const predicted = new Set(breakOffsets(word, patterns, APPLY_OPTS));
    if (engine.size > 0) wordsWithBreak++;
    engineTotal += engine.size;
    let ok = true;
    for (const b of engine) if (!predicted.has(b)) { missed++; ok = false; }
    for (const b of predicted) if (!engine.has(b)) { falsePos++; ok = false; }
    if (ok) wordsExact++;
  }

  const recall = (100 * (engineTotal - missed)) / engineTotal;
  const precision = (100 * (engineTotal - missed)) / (engineTotal - missed + falsePos);
  console.log(`corpus words:        ${words.length}`);
  console.log(`train / held-out:    ${train.length} / ${test.length}  (split by FNV-1a hash %10)`);
  console.log(`held-out break pts:  ${engineTotal}  across ${wordsWithBreak} multi-syllable words`);
  console.log(`missed:              ${missed}   -> recall    ${recall.toFixed(2)}%`);
  console.log(`false positives:     ${falsePos}   -> precision ${precision.toFixed(2)}%`);
  console.log(`exact whole-word:    ${wordsExact}/${test.length}  (${((100 * wordsExact) / test.length).toFixed(2)}%)`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
