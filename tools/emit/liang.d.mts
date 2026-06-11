/** Type declarations for liang.mjs (kept in sync by hand — the module is plain JS). */

/** Compiled pattern lookup: letters key -> per-gap Liang priorities. */
export type PatternMap = Map<string, number[]>;

export function compile(patterns: Iterable<string>): PatternMap;

export interface BreakOffsetsOptions {
  leftmin?: number;
  rightmin?: number;
}

export function breakOffsets(
  word: string,
  map: PatternMap,
  options?: BreakOffsetsOptions,
): number[];
