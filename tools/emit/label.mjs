/**
 * Corpus labeller — turns a raw Armenian wordlist into a patgen training
 * dictionary by hyphenating every word with the vankatum engine (the single
 * source of truth). Output is one hyphen-marked word per line, e.g. `ա-շա-կերտ`,
 * consumed by pypatgen to learn Liang patterns. See docs/SOURCES.md §F.
 *
 * Words are hyphenated at EVERY valid syllable boundary (leftmin=1, rightmin=1):
 * the patterns must encode all break points; the render-time minima
 * (lefthyphenmin=1, righthyphenmin=2) are a separate consumer setting.
 *
 * Usage:  node tools/emit/label.mjs
 * Output: playground/corpus/dictionary.txt
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { breakPoints } from "../../dist/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../..");
const WORDLIST = join(ROOT, "corpus/wordlist.txt");
const OUT = join(ROOT, "playground/corpus/dictionary.txt");

// Lowercase Armenian word, at least two letters (shorter words never break).
const VALID = /^[ա-ֆ]{2,}$/u;

const LABEL_OPTS = { leftmin: 1, rightmin: 1 };

/** Insert "-" at each break offset (codepoint index) of a word. */
function mark(word) {
  const points = breakPoints(word, LABEL_OPTS);
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
  let raw;
  try {
    raw = await readFile(WORDLIST, "utf8");
  } catch {
    throw new Error(`missing ${WORDLIST} — run tools/corpus/build-wordlist.mjs first`);
  }

  const words = raw
    .split("\n")
    .map((w) => w.trim())
    .filter((w) => VALID.test(w));

  if (words.length === 0) throw new Error(`no valid words in ${WORDLIST}`);
  let withBreak = 0;
  let totalBreaks = 0;
  const lines = words.map((w) => {
    const marked = mark(w);
    const breaks = marked.length - [...w].length; // one "-" per break
    if (breaks > 0) withBreak++;
    totalBreaks += breaks;
    return marked;
  });

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, lines.join("\n") + "\n", "utf8");
  console.log(`corpus words: ${words.length}`);
  console.log(`with >=1 break: ${withBreak} (${((100 * withBreak) / words.length).toFixed(1)}%)`);
  console.log(`total break points: ${totalBreaks}`);
  console.log(`dictionary: ${OUT}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
