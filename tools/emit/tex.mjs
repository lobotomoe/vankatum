/**
 * Shared parsing for the emitted TeX pattern file (the keystone artifact).
 * Used by the fidelity gate and the downstream emitters. See docs/SOURCES.md §F.
 */

/**
 * Render-time minima every artifact declares (\lefthyphenmin / LEFTHYPHENMIN /
 * hypher leftmin ...). Armenian allows one letter before a break; two after.
 */
export const RENDER_MINIMA = { leftmin: 1, rightmin: 2 };

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

/**
 * Drop the breaks of a hyphen-marked word that fall inside the minima. Patterns
 * are trained on every syllable boundary, but an exception is applied verbatim
 * by TeX and hypher, so it has to carry the render minima itself.
 */
export function applyMinima(marked, { leftmin, rightmin } = RENDER_MINIMA) {
  const chars = [...marked.replaceAll("-", "")];
  const keep = new Set(
    offsetsFromMarked(marked).filter((b) => b >= leftmin && chars.length - b >= rightmin),
  );
  return chars.map((ch, i) => (keep.has(i) ? "-" : "") + ch).join("");
}
