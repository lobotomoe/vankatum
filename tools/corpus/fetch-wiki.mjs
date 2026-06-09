/**
 * MediaWiki corpus harvester — pulls plaintext from random articles via the API
 * and accumulates a unique lowercase wordlist. Works for any MediaWiki host, so
 * one tool covers encyclopedic (hy.wikipedia.org) and literary (hy.wikisource.org)
 * registers. Text carries no hyphenation — vocabulary coverage only. See SOURCES.md.
 *
 * Usage:  node tools/corpus/fetch-wiki.mjs [host] [targetArticles]
 *   e.g.  node tools/corpus/fetch-wiki.mjs hy.wikipedia.org 600
 * Output: playground/corpus/<wikiname>/wordlist.txt
 */

import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HOST = process.argv[2] ?? "hy.wikipedia.org";
const TARGET = Number(process.argv[3] ?? 600);
const BATCH = 20; // exlimit cap for plaintext extracts
const POLITE_DELAY_MS = 1500;
const MAX_RETRIES = 5;
const ARMENIAN_WORD = /[Ա-Ֆա-ֆ]+/gu;
const UA = "vankatum-corpus/1.0 (Armenian hyphenation research; https://github.com/)";

const HERE = dirname(fileURLToPath(import.meta.url));
const NAME = HOST.split(".")[1] ?? HOST.replaceAll(".", "_");
const OUT_DIR = join(HERE, "../../playground/corpus", NAME);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Fetch one batch, honouring 429/503 backoff (Retry-After, else exponential). */
async function randomBatch() {
  // maxlag is Wikimedia best practice — asks the API to defer when replicas lag.
  const url =
    `https://${HOST}/w/api.php?action=query&format=json&formatversion=2&maxlag=5` +
    `&generator=random&grnnamespace=0&grnlimit=${BATCH}` +
    `&prop=extracts&explaintext=1&exlimit=${BATCH}`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.ok) {
      const data = await res.json();
      return data?.query?.pages ?? [];
    }
    if (res.status === 429 || res.status === 503) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000 * 2 ** attempt;
      await sleep(waitMs);
      continue;
    }
    throw new Error(`HTTP ${res.status} from ${HOST}`);
  }
  throw new Error(`giving up after ${MAX_RETRIES} retries (rate limited)`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const vocab = new Set();
  const requests = Math.ceil(TARGET / BATCH);

  for (let i = 0; i < requests; i++) {
    try {
      const pages = await randomBatch();
      for (const page of pages) {
        for (const w of (page.extract ?? "").match(ARMENIAN_WORD) ?? []) {
          vocab.add(w.toLowerCase());
        }
      }
      process.stdout.write(`\r  ${HOST}: batch ${i + 1}/${requests}, vocab ${vocab.size}   `);
    } catch (err) {
      console.error(`\n  batch ${i + 1} failed: ${err.message}`);
    }
    await sleep(POLITE_DELAY_MS);
  }

  if (vocab.size === 0) throw new Error(`no words harvested from ${HOST}`);

  const sorted = [...vocab].sort((a, b) => a.localeCompare(b, "hy"));
  await writeFile(join(OUT_DIR, "wordlist.txt"), sorted.join("\n") + "\n", "utf8");
  console.log(`\n${HOST} -> ${vocab.size} unique words -> ${join(OUT_DIR, "wordlist.txt")}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
