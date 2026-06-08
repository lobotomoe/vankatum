/**
 * Liang hyphenation: compile a TeX/Liang pattern list and apply it to words.
 *
 * This is the same algorithm every downstream consumer runs (TeX, hypher,
 * libhyphen, Minikin). We use it to independently verify that our emitted
 * patterns reproduce the engine's break decisions, and to drive the hypher
 * JSON emitter. Patterns use "." as the word-boundary marker and digits as
 * Liang priorities (odd = break). See docs/SOURCES.md §F.
 */

const DOT = ".";

/** Parse one pattern (e.g. "ա1բ") into its letters and per-gap priority values. */
function parsePattern(pattern) {
  const letters = [];
  const points = [0]; // points[k] = priority at the gap before letters[k]
  for (const ch of pattern) {
    if (ch >= "0" && ch <= "9") {
      points[points.length - 1] = Number(ch);
    } else {
      letters.push(ch);
      points.push(0);
    }
  }
  return { key: letters.join(""), points };
}

/** Compile a list of pattern strings into a lookup map. */
export function compile(patterns) {
  const map = new Map();
  for (const pattern of patterns) {
    const { key, points } = parsePattern(pattern);
    map.set(key, points);
  }
  return map;
}

/**
 * Break offsets (codepoint indices, like the engine's breakPoints) produced by
 * applying compiled patterns to `word`.
 */
export function breakOffsets(word, map, options = {}) {
  const leftmin = options.leftmin ?? 1;
  const rightmin = options.rightmin ?? 1;

  const chars = [...DOT + word + DOT];
  const n = chars.length;
  const levels = new Array(n + 1).fill(0);

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j <= n; j++) {
      const points = map.get(chars.slice(i, j).join(""));
      if (points === undefined) continue;
      for (let k = 0; k < points.length; k++) {
        const v = points[k];
        if (v > levels[i + k]) levels[i + k] = v;
      }
    }
  }

  // Gap before original word[b] is levels[b + 1] (chars[0] is the leading ".").
  const wordLen = [...word].length;
  const offsets = [];
  for (let b = 1; b < wordLen; b++) {
    if (levels[b + 1] % 2 === 1 && b >= leftmin && wordLen - b >= rightmin) {
      offsets.push(b);
    }
  }
  return offsets;
}
