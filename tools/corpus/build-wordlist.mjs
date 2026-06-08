/**
 * Build the committed corpus snapshot — the reproducible vocabulary that pattern
 * generation trains on. Combines the harvested ARLIS wordlist with the
 * Wiktionary headwords, deduped and lowercased, into corpus/wordlist.txt.
 *
 * This is a manual "refresh" step (run after re-harvesting ARLIS): the snapshot
 * is committed so CI can build patterns without scraping any external site. Only
 * bare words are stored — no hyphenations, no act text. See docs/SOURCES.md.
 *
 * Usage: node tools/corpus/build-wordlist.mjs
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../..");
const ARLIS = join(ROOT, "playground/corpus/arlis/wordlist.txt");
const WIKTIONARY = join(ROOT, "playground/reference/wiktionary/wiktionary-hy.tsv");
const OUT = join(ROOT, "corpus/wordlist.txt");

const VALID = /^[ա-ֆ]{2,}$/u;

async function readLines(path) {
  try {
    return (await readFile(path, "utf8")).split("\n");
  } catch {
    return [];
  }
}

async function main() {
  const vocab = new Set();

  for (const line of await readLines(ARLIS)) {
    const w = line.trim().toLowerCase();
    if (VALID.test(w)) vocab.add(w);
  }
  for (const line of await readLines(WIKTIONARY)) {
    const [word] = line.split("\t");
    const w = (word ?? "").trim().toLowerCase();
    if (VALID.test(w)) vocab.add(w);
  }

  if (vocab.size === 0) {
    throw new Error("no source words — run fetch-arlis.mjs and fetch-references.sh first");
  }

  const words = [...vocab].sort((a, b) => a.localeCompare(b, "hy"));
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, words.join("\n") + "\n", "utf8");
  console.log(`corpus/wordlist.txt: ${words.length} words`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
