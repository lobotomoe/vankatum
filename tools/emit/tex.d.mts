/** Type declarations for tex.mjs (kept in sync by hand — the module is plain JS). */

export interface TexBlocks {
  patterns: string[];
  exceptions: string[];
}

export function parseTex(tex: string): TexBlocks;

export function offsetsFromMarked(marked: string): number[];

export interface Minima {
  leftmin: number;
  rightmin: number;
}

export const RENDER_MINIMA: Minima;

export function applyMinima(marked: string, minima?: Minima): string;
