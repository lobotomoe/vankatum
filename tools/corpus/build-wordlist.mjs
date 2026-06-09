/**
 * Build the committed corpus snapshot — the reproducible vocabulary that pattern
 * generation trains on. Unions every harvested source (playground/corpus/<src>/
 * wordlist.txt: arlis, wikipedia, wikisource, hunspell, frequencywords, ...) with
 * the Wiktionary headwords, deduped and lowercased, into corpus/wordlist.txt.
 *
 * A manual "refresh" step (run after re-harvesting): the snapshot is committed so
 * CI builds patterns without scraping any external site. Only bare words are
 * stored — no hyphenations, no source text. See docs/SOURCES.md.
 *
 * Usage: node tools/corpus/build-wordlist.mjs
 */

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../..");
const CORPUS = join(ROOT, "playground/corpus");
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

/** Add every VALID word from `lines` (mapped through `pick`) to `vocab`, return how many were new. */
function ingest(vocab, lines, pick) {
  const before = vocab.size;
  for (const line of lines) {
    const w = (pick(line) ?? "").trim().toLowerCase();
    if (VALID.test(w)) vocab.add(w);
  }
  return vocab.size - before;
}

async function main() {
  const vocab = new Set();

  // Every harvested source directory contributes its wordlist.txt.
  let sources = [];
  try {
    sources = await readdir(CORPUS, { withFileTypes: true });
  } catch {
    /* corpus dir may not exist yet */
  }
  for (const entry of sources) {
    if (!entry.isDirectory()) continue;
    const added = ingest(vocab, await readLines(join(CORPUS, entry.name, "wordlist.txt")), (l) => l);
    if (added > 0) console.log(`  ${entry.name}: +${added}`);
  }

  // Wiktionary headwords (first TSV column).
  const wikt = ingest(vocab, await readLines(WIKTIONARY), (l) => l.split("\t")[0]);
  if (wikt > 0) console.log(`  wiktionary: +${wikt}`);

  if (vocab.size === 0) {
    throw new Error("no source words — run the fetch-* harvesters first");
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
