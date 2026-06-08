/**
 * ARLIS corpus harvester.
 *
 * Fetches Armenian legal acts from the Armenian Legal Information System
 * (arlis.am), extracts the act body, and accumulates a unique lowercase word
 * list used as (a) vocabulary coverage for hyphenation-pattern generation and
 * (b) a real-text regression corpus. ARLIS text carries NO hyphenation, so it is
 * never an oracle — only a source of real words. See docs/SOURCES.md.
 *
 * Usage:  node tools/corpus/fetch-arlis.mjs [docids-file]
 * Output: playground/corpus/arlis/<docid>.txt  (raw extracted prose, gitignored)
 *         playground/corpus/arlis/wordlist.txt (sorted unique words, gitignored)
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, "../../playground/corpus/arlis");
const DOCIDS_FILE = process.argv[2] ?? join(HERE, "arlis-docids.txt");
const POLITE_DELAY_MS = 1500;
const ARMENIAN_WORD = /[Ա-Ֆա-ֆ]+/gu;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Extract the inner HTML of the first <div id="act_body"> via tag-depth matching. */
function extractActBody(html) {
  const marker = html.indexOf('id="act_body"');
  if (marker === -1) return undefined;
  const open = html.lastIndexOf("<div", marker);
  if (open === -1) return undefined;
  const start = html.indexOf(">", marker) + 1;

  let depth = 1;
  let i = start;
  const tag = /<\/?div\b/gi;
  tag.lastIndex = start;
  for (let m = tag.exec(html); m !== null; m = tag.exec(html)) {
    depth += m[0].startsWith("</") ? -1 : 1;
    if (depth === 0) {
      i = m.index;
      break;
    }
  }
  return html.slice(start, i);
}

function wordsFromHtml(bodyHtml) {
  const text = bodyHtml.replace(/<[^>]+>/g, " ");
  return (text.match(ARMENIAN_WORD) ?? []).map((w) => w.toLowerCase());
}

async function fetchAct(docid) {
  const url = `https://www.arlis.am/DocumentView.aspx?DocID=${docid}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (vankatum corpus harvester)" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for DocID=${docid}`);
  const html = await res.text();
  const body = extractActBody(html);
  if (body === undefined) throw new Error(`no act_body in DocID=${docid}`);
  return body;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const docids = (await readFile(DOCIDS_FILE, "utf8"))
    .split("\n")
    .map((l) => l.replace(/#.*/, "").trim())
    .filter((l) => /^\d+$/.test(l));

  const vocab = new Set();
  let ok = 0;
  for (const docid of docids) {
    try {
      const body = await fetchAct(docid);
      const words = wordsFromHtml(body);
      if (words.length === 0) throw new Error(`zero words in DocID=${docid}`);
      await writeFile(join(OUT_DIR, `${docid}.txt`), words.join("\n"), "utf8");
      for (const w of words) vocab.add(w);
      ok++;
      console.log(`  DocID=${docid}: ${words.length} tokens, vocab now ${vocab.size}`);
    } catch (err) {
      // Surface the failure loudly; never fabricate corpus data.
      console.error(`  FAILED DocID=${docid}: ${err.message}`);
    }
    await sleep(POLITE_DELAY_MS);
  }

  if (ok === 0) throw new Error("no acts harvested — check connectivity / docids");

  const sorted = [...vocab].sort((a, b) => a.localeCompare(b, "hy"));
  await writeFile(join(OUT_DIR, "wordlist.txt"), sorted.join("\n") + "\n", "utf8");
  console.log(`\nHarvested ${ok}/${docids.length} acts -> ${vocab.size} unique words`);
  console.log(`wordlist: ${join(OUT_DIR, "wordlist.txt")}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
