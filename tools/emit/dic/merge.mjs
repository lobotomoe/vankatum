/**
 * Pure rule transforms for the libhyphen .dic (see ./build.mjs for why they are
 * needed): exceptions as whole-word patterns, and merging rules that share a
 * letter key into one, non-standard rules first and shortest first.
 */

import { offsetsFromMarked } from "../tex.mjs";

/** An exception's breaks win over every pattern; its other gaps lose to nothing below. */
const EXCEPTION_BREAK = 9;
const EXCEPTION_INHIBIT = 8;

/** ".ա8բ9բ8ա." — an exception as a whole-word pattern that forces exactly its breaks. */
export function exceptionPattern(marked) {
  const letters = [...marked.replaceAll("-", "")];
  const breaks = new Set(offsetsFromMarked(marked));
  const body = letters
    .map((ch, i) => (i === 0 ? "" : String(breaks.has(i) ? EXCEPTION_BREAK : EXCEPTION_INHIBIT)) + ch)
    .join("");
  return `.${body}.`;
}

/** Split "pat9tern/repl,start,cut" into the pattern and its (optional) replacement. */
function splitRule(line) {
  const slash = line.indexOf("/");
  return slash === -1
    ? { pattern: line, replacement: undefined }
    : { pattern: line.slice(0, slash), replacement: line.slice(slash + 1) };
}

/** Letters of a pattern (its key in libhyphen) and the digit at each gap. */
function decompose(pattern) {
  const letters = [];
  const values = [0];
  for (const ch of pattern) {
    if (ch >= "0" && ch <= "9") {
      values[letters.length] = Math.max(values[letters.length] ?? 0, Number(ch));
    } else {
      letters.push(ch);
      values[letters.length] = 0;
    }
  }
  return { letters, values };
}

function compose(letters, values) {
  let out = values[0] ? String(values[0]) : "";
  letters.forEach((ch, i) => {
    out += ch;
    const value = values[i + 1];
    if (value) out += String(value);
  });
  return out;
}

/**
 * Merge rules that share a letter key: digit-wise maximum, keeping the one
 * replacement. Two different replacements for the same key cannot both hold.
 */
export function mergeByKey(lines) {
  const merged = new Map();
  for (const line of lines) {
    const { pattern, replacement } = splitRule(line);
    const { letters, values } = decompose(pattern);
    const key = letters.join("");
    const seen = merged.get(key);
    if (seen === undefined) {
      merged.set(key, { letters, values, replacement });
      continue;
    }
    if (seen.replacement !== undefined && replacement !== undefined && seen.replacement !== replacement) {
      throw new Error(`conflicting replacements for "${key}": ${seen.replacement} vs ${replacement}`);
    }
    seen.values = seen.values.map((v, i) => Math.max(v, values[i] ?? 0));
    seen.replacement ??= replacement;
  }
  const nonStandard = [];
  const standard = [];
  for (const { letters, values, replacement } of merged.values()) {
    const pattern = compose(letters, values);
    if (replacement === undefined) standard.push(pattern);
    else nonStandard.push({ rule: `${pattern}/${replacement}`, length: letters.length });
  }
  // A rule embedded in another is shorter than it, so ascending length puts every
  // rule before the rules that contain it (stable: ties keep their input order).
  nonStandard.sort((a, b) => a.length - b.length);
  return [...nonStandard.map(({ rule }) => rule), ...standard];
}
