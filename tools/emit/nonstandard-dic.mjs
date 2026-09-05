/**
 * Schwa (ը) epenthesis as libhyphen non-standard hyphenation rules.
 *
 * Liang patterns are letter-preserving, so the .tex/.json/.hyb artifacts cannot
 * express the epenthetic ը that Armenian writes at a break inside a vowelless
 * consonant cluster (գրել -> գը-րել, հնդստան -> հըն-/հնդըս-). libhyphen's
 * NON-STANDARD hyphenation can (it changes characters at the break), so this
 * emitter appends schwa rules to hyph_hy_AM.dic only. Format (see SOURCES.md §F):
 *
 *     <left>C1<digit>C2/<displayed-left-syllable>=,<start>,<cut>
 *
 * Each schwa break becomes one LOCAL pattern keyed by its own cluster, so a word
 * with several schwa breaks (հըն-դըս-տան) gets several non-colliding rules.
 * Patterns whose key maps to conflicting changes anywhere in the corpus are
 * dropped (precision-first: never emit a rule that could insert a wrong schwa).
 *
 * Usage: node tools/emit/schwa-dic.mjs <hyph_hy_AM.dic>   (appends in place)
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { syllabifyWithSchwa } from "../../dist/index.js";

const SCHWA = "ը";
const HERE = dirname(fileURLToPath(import.meta.url));
const WORDLIST = join(HERE, "../../corpus/wordlist.txt");

/**
 * The epenthetic-schwa breaks of a word: for each syllable boundary whose LEFT
 * syllable gained a ը, returns {breakAt, start, lo, ld} in original coordinates.
 */
function schwaBreaks(word) {
  const orig = [...word];
  const syllables = syllabifyWithSchwa(word);
  const breaks = [];
  let oi = 0;

  for (let s = 0; s < syllables.length; s++) {
    const display = [...syllables[s]];
    const start = oi; // original index where this syllable begins
    let lo = "";
    let epenthetic = false;
    for (const ch of display) {
      if (oi < orig.length && ch === orig[oi]) {
        lo += ch;
        oi += 1;
      } else if (ch === SCHWA) {
        epenthetic = true;
      }
    }
    if (epenthetic && s < syllables.length - 1 && lo.length > 0) {
      breaks.push({ breakAt: oi, start, lo, ld: syllables[s] });
    }
  }
  return breaks;
}

/**
 * Build the non-standard .dic lines. Each rule is WHOLE-WORD anchored
 * (`.word.`) so it fires only on that exact word — local (substring) rules
 * interfere across words and cannot be made mutually exclusive without patgen,
 * which has no non-standard mode. Whole-word anchoring collides on a word with
 * two schwa breaks (same letter key), so we emit only single-schwa-break words;
 * multi-break words fall back to the runtime engine (safe under-hyphenation).
 * Priority 9 lets the schwa break beat standard inhibiting patterns.
 */
export function buildSchwaLines(words) {
  const lines = [];
  for (const word of words) {
    const breaks = schwaBreaks(word);
    if (breaks.length !== 1) continue;
    const { breakAt, start, lo, ld } = breaks[0];
    const chars = [...word];
    const left = chars.slice(0, breakAt).join("");
    const right = chars.slice(breakAt).join("");
    const pattern = `.${left}9${right}.`;
    lines.push(`${pattern}/${ld}=,${start + 1},${lo.length}`);
  }
  return lines.sort();
}

async function main() {
  const dicPath = process.argv[2];
  if (!dicPath) throw new Error("usage: schwa-dic.mjs <hyph_hy_AM.dic>");

  const words = (await readFile(WORDLIST, "utf8")).split("\n").filter(Boolean);
  const lines = buildSchwaLines(words);

  const dic = await readFile(dicPath, "utf8");
  const trimmed = dic.endsWith("\n") ? dic : dic + "\n";
  await writeFile(dicPath, trimmed + lines.join("\n") + "\n", "utf8");
  console.log(`schwa non-standard rules appended: ${lines.length} -> ${dicPath}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
