/**
 * Score what real consumers did with the artifacts against the engine.
 *
 * Each output file holds one line per word: the word with "-" after a standard
 * break and "[replacement]" after a non-standard one. The expectation is the
 * engine under the render minima; the libhyphen .dic additionally promises its
 * non-standard breaks (the written schwa of single-schwa words, և -> ե=վ before
 * a vowel), which replace whatever plain break the engine has at that point.
 *
 * Exits 1 unless every word of every consumer matches exactly.
 *
 * Usage: node score.mjs <words.txt> <kind>:<label>:<output.txt> ...
 *   kind = plain (TeX, hypher) | dic (libhyphen)
 */

import { readFile } from "node:fs/promises";
import { breakPoints, EASTERN } from "../../../dist/index.js";
import { RENDER_MINIMA } from "../tex.mjs";
import { buildSchwaLines } from "../dic/nonstandard.mjs";

const LIGATURE = "և";
const LIGATURE_REPLACEMENT = "ե=վ";
const SHOWN_MISMATCHES = 10;

/** Break offset -> replacement (null for a plain break), from a consumer line. */
function parseLine(line) {
  const breaks = new Map();
  let letters = 0;
  for (let i = 0; i < line.length; ) {
    const ch = String.fromCodePoint(line.codePointAt(i));
    i += ch.length;
    if (ch === "-") {
      breaks.set(letters, null);
    } else if (ch === "[") {
      const close = line.indexOf("]", i);
      if (close === -1) throw new Error(`unterminated replacement in "${line}"`);
      breaks.set(letters, line.slice(i, close));
      i = close + 1;
    } else {
      letters++;
    }
  }
  return breaks;
}

/** The single schwa break the .dic carries for a word, if it carries one. */
function schwaBreak(word) {
  const [rule] = buildSchwaLines([word]);
  if (rule === undefined) return undefined;
  const [pattern, rest] = rule.split("/");
  const at = [...pattern.slice(1)].indexOf("9");
  const [replacement] = rest.split(",");
  return { at, replacement };
}

function expected(word, kind) {
  const breaks = new Map(breakPoints(word).map((b) => [b, null]));
  if (kind !== "dic") return breaks;
  const chars = [...word];
  const inMinima = (b) => b >= RENDER_MINIMA.leftmin && chars.length - b >= RENDER_MINIMA.rightmin;
  const schwa = schwaBreak(word);
  if (schwa !== undefined && inMinima(schwa.at)) breaks.set(schwa.at, schwa.replacement);
  // The split writes վ at the start of the next line, one letter more than the
  // letters after the break (առջե-վի is two letters on the new line).
  const ligatureInMinima = (b) => b >= RENDER_MINIMA.leftmin && chars.length - b + 1 >= RENDER_MINIMA.rightmin;
  chars.forEach((ch, k) => {
    const next = chars[k + 1];
    if (ch === LIGATURE && next !== undefined && EASTERN.vowels.has(next) && ligatureInMinima(k + 1)) {
      breaks.set(k + 1, LIGATURE_REPLACEMENT);
    }
  });
  return breaks;
}

function render(word, breaks) {
  return [...word].map((ch, i) => (i === 0 ? "" : breaks.has(i) ? (breaks.get(i) === null ? "-" : `[${breaks.get(i)}]`) : "") + ch).join("");
}

async function main() {
  const [wordsPath, ...consumers] = process.argv.slice(2);
  if (!wordsPath || consumers.length === 0) {
    throw new Error("usage: score.mjs <words.txt> <kind>:<label>:<output.txt> ...");
  }
  const words = (await readFile(wordsPath, "utf8")).split("\n").filter(Boolean);

  let failed = false;
  for (const spec of consumers) {
    const [kind, label, outPath] = spec.split(":");
    if (kind !== "plain" && kind !== "dic") throw new Error(`unknown consumer kind "${kind}"`);
    const lines = (await readFile(outPath, "utf8")).split("\n").filter(Boolean);
    if (lines.length !== words.length) {
      throw new Error(`${label}: ${lines.length} output lines for ${words.length} words`);
    }

    let exact = 0;
    const mismatches = [];
    words.forEach((word, i) => {
      const got = parseLine(lines[i]);
      const want = expected(word, kind);
      const same = got.size === want.size && [...want].every(([b, rep]) => got.has(b) && got.get(b) === rep);
      if (same) exact++;
      else mismatches.push(`${lines[i]}  (expected ${render(word, want)})`);
    });

    const percent = ((100 * exact) / words.length).toFixed(3);
    console.log(`${label.padEnd(10)} exact ${exact}/${words.length} (${percent}%)`);
    for (const line of mismatches.slice(0, SHOWN_MISMATCHES)) console.log(`  ${line}`);
    if (mismatches.length > 0) failed = true;
  }
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
