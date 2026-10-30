/**
 * Hyphenate a word list with hypher and hyphenation.hy.json, exactly as a web
 * page would load it. Output: one line per word, "-" at each break.
 *
 * Usage: node hypher.mjs <hyphenation.hy.json> <words.txt> <out.txt>
 */

import { readFile, writeFile } from "node:fs/promises";
import Hypher from "hypher";

const [jsonPath, wordsPath, outPath] = process.argv.slice(2);
if (!jsonPath || !wordsPath || !outPath) throw new Error("usage: hypher.mjs <json> <words> <out>");

const hypher = new Hypher(JSON.parse(await readFile(jsonPath, "utf8")));
const words = (await readFile(wordsPath, "utf8")).split("\n").filter(Boolean);
await writeFile(outPath, words.map((word) => hypher.hyphenate(word).join("-")).join("\n") + "\n", "utf8");
