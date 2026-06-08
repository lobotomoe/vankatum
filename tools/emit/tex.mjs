/**
 * Shared parsing for the emitted TeX pattern file (the keystone artifact).
 * Used by the fidelity gate and the downstream emitters. See docs/SOURCES.md §F.
 */

function block(tex, name) {
  const m = tex.match(new RegExp(`\\\\${name}\\{([\\s\\S]*?)\\n\\}`));
  return m ? m[1].split("\n").map((l) => l.trim()).filter(Boolean) : [];
}

/** Split hyph-hy.tex into its Liang patterns and its hyphenation exceptions. */
export function parseTex(tex) {
  return { patterns: block(tex, "patterns"), exceptions: block(tex, "hyphenation") };
}

/** Codepoint offsets of the "-" markers in a hyphen-marked word (e.g. ա-շա-կերտ). */
export function offsetsFromMarked(marked) {
  const offsets = [];
  let idx = 0;
  for (const ch of marked) {
    if (ch === "-") offsets.push(idx);
    else idx++;
  }
  return offsets;
}
