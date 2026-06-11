/** Type declarations for tex.mjs (kept in sync by hand — the module is plain JS). */

export interface TexBlocks {
  patterns: string[];
  exceptions: string[];
}

export function parseTex(tex: string): TexBlocks;

export function offsetsFromMarked(marked: string): number[];
