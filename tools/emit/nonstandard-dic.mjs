/**
 * Character-changing breaks as libhyphen NON-STANDARD hyphenation rules.
 *
 * Liang patterns are letter-preserving, so the .tex/.json/.hyb artifacts cannot
 * express the two Armenian breaks that change letters:
 *
 *   - the epenthetic ը written inside a vowelless consonant cluster
 *     (գրել -> գը-րել, հնդստան -> հըն-/հնդըս-), and
 *   - the ligature և split before a vowel (Երևան -> Ե-րե-վան): the syllable
 *     boundary lies between its ե and վ, so the ligature is spelled out.
 *
 * libhyphen's NON-STANDARD hyphenation can (it changes characters at the break),
 * so this emitter appends both rule sets to hyph_hy_AM.dic only. Format (see
 * SOURCES.md §F):
 *
 *     <pattern>/<replacement>,<start>,<cut>
 *
 * where the odd digit in <pattern> marks the break, <replacement> is the text
 * shown instead of the <cut> letters starting at 1-based letter <start> of the
 * pattern, with "=" at the line break. Verified against libhyphen semantics via
 * pyphen (which implements the same rules).
 *
 * Usage: node tools/emit/nonstandard-dic.mjs <hyph_hy_AM.dic>   (appends in place)
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { syllabifyWithSchwa, EASTERN } from "../../dist/index.js";

const SCHWA = "ը";
const LIGATURE = "և";
/** Max Liang level: beats every inhibiting pattern patgen may have learned at the gap. */
const PRIORITY = 9;
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
 * Schwa rules. Each rule is WHOLE-WORD anchored (`.word.`) so it fires only on
 * that exact word — local (substring) rules interfere across words and cannot be
 * made mutually exclusive without patgen, which has no non-standard mode.
 * Whole-word anchoring collides on a word with two schwa breaks (same letter
 * key), so only single-schwa-break words are emitted; multi-break words fall
 * back to the runtime engine (safe under-hyphenation).
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
    lines.push(`.${left}${PRIORITY}${right}./${ld}=,${start + 1},${lo.length}`);
  }
  return lines.sort();
}

/**
 * Ligature rules. և before a vowel is always /ev/ + vowel with the վ as the next
 * syllable's onset (single consonant between vowels), so the break is ե-վ and
 * the rule is safe as a LOCAL pattern: one line per vowel that can follow և
 * (ու starts with ո). The engine's letter-preserving mode emits no break there
 * at all, so these rules add the break rather than moving one.
 */
export function buildLigatureLines() {
  return [...EASTERN.vowels].map((vowel) => `${LIGATURE}${PRIORITY}${vowel}/ե=վ,1,1`);
}

async function main() {
  const dicPath = process.argv[2];
  if (!dicPath) throw new Error("usage: nonstandard-dic.mjs <hyph_hy_AM.dic>");

  const words = (await readFile(WORDLIST, "utf8")).split("\n").filter(Boolean);
  const schwa = buildSchwaLines(words);
  const ligature = buildLigatureLines();

  const dic = await readFile(dicPath, "utf8");
  const trimmed = dic.endsWith("\n") ? dic : dic + "\n";
  await writeFile(dicPath, trimmed + [...ligature, ...schwa].join("\n") + "\n", "utf8");
  console.log(`non-standard rules appended: ${ligature.length} ligature (և) + ${schwa.length} schwa -> ${dicPath}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
