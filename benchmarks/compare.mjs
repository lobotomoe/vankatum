/**
 * Head-to-head: vankatum vs the existing Armenian hyphenation engines.
 *
 * hypher (+ hyphenation.hy) and hyphenopoly both wrap the same shared `hyph-hy`
 * pattern set that ships in TeX, Chromium, Android, LibreOffice, etc. — so this
 * one comparison stands in for the whole ecosystem. Run:
 *
 *     cd benchmarks && npm install && node compare.mjs
 *
 * Requires the engine to be built first (npm run build at the repo root).
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { hyphenate as vankatum } from "../dist/index.js";

const require = createRequire(import.meta.url);
const Hypher = require("hypher");
const hyPatterns = require("hyphenation.hy");
const hyphenopoly = require("hyphenopoly").default;

const HYPHEN = "-";
const hypher = new Hypher(hyPatterns);
const runHypher = (w) => hypher.hyphenate(w).join(HYPHEN);

const hyphenator = hyphenopoly.config({
  require: ["hy"],
  hyphen: HYPHEN,
  minWordLength: 3,
  loader: async (file, patDir) => {
    const { readFile } = await import("node:fs/promises");
    return readFile(new URL(file, patDir));
  },
});

const { cases } = JSON.parse(readFileSync(new URL("./gold.json", import.meta.url), "utf8"));
const pad = (s, n) => s + " ".repeat(Math.max(0, n - [...s].length));

const hpoly = await hyphenator.get("hy");
let v = 0;
let hp = 0;
let hyp = 0;

console.log(
  pad("word", 12) + pad("expected", 14) + pad("vankatum", 14) + pad("hypher", 14) + pad("hyphenopoly", 14),
);
console.log("-".repeat(78));
for (const c of cases) {
  const vk = vankatum(c.word, { hyphen: HYPHEN });
  const he = runHypher(c.word);
  const ho = hpoly(c.word);
  if (vk === c.expected) v++;
  if (he === c.expected) hyp++;
  if (ho === c.expected) hp++;
  const mark = (x) => (x === c.expected ? "OK " : "X  ");
  console.log(
    pad(c.word, 12) +
      pad(c.expected, 14) +
      pad(`${mark(vk)}${vk}`, 14) +
      pad(`${mark(he)}${he}`, 14) +
      pad(`${mark(ho)}${ho}`, 14),
  );
}
const n = cases.length;
console.log("-".repeat(78));
console.log(`vankatum:    ${v}/${n}`);
console.log(`hypher:      ${hyp}/${n}`);
console.log(`hyphenopoly: ${hp}/${n}`);
