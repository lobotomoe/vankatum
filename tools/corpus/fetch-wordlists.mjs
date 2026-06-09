/**
 * Download word-list corpora and reduce each to a unique lowercase wordlist:
 *   frequencywords  OpenSubtitles frequency list (spoken/colloquial register)
 *   hunspell        Armenian Hunspell lexicon (curated spell-check vocabulary)
 *
 * These provide vocabulary coverage from registers the legal/encyclopedic
 * sources miss. No hyphenation — words only. See docs/SOURCES.md.
 *
 * Usage:  node tools/corpus/fetch-wordlists.mjs
 * Output: playground/corpus/<name>/wordlist.txt
 */

import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const CORPUS = join(HERE, "../../playground/corpus");
const VALID = /^[ա-ֆ]{2,}$/u;

const SOURCES = [
  {
    name: "frequencywords",
    url: "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/hy/hy_full.txt",
    // "word count" per line
    word: (line) => line.split(/\s+/)[0],
  },
  {
    name: "hunspell",
    url: "https://raw.githubusercontent.com/martakert/hyspell/master/hy_AM.dic",
    // first line is an entry count; the rest are "root/AFFIXFLAGS"
    word: (line) => line.split(/[/\s]/)[0],
  },
];

async function harvest({ name, url, word }) {
  const res = await fetch(url, { headers: { "User-Agent": "vankatum-corpus/1.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${name} (${url})`);
  const text = await res.text();

  const vocab = new Set();
  for (const line of text.split("\n")) {
    const w = (word(line.trim()) ?? "").toLowerCase();
    if (VALID.test(w)) vocab.add(w);
  }
  if (vocab.size === 0) throw new Error(`no words extracted for ${name}`);

  const dir = join(CORPUS, name);
  await mkdir(dir, { recursive: true });
  const sorted = [...vocab].sort((a, b) => a.localeCompare(b, "hy"));
  await writeFile(join(dir, "wordlist.txt"), sorted.join("\n") + "\n", "utf8");
  console.log(`  ${name}: ${vocab.size} unique words`);
}

async function main() {
  for (const source of SOURCES) {
    try {
      await harvest(source);
    } catch (err) {
      console.error(`  FAILED ${source.name}: ${err.message}`);
    }
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
