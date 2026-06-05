export interface Rng {
  /** float in [0,1) */
  next(): number;
  /** int in [lo, hi) */
  range(lo: number, hi: number): number;
  /** uniform element */
  pick<T>(arr: readonly T[]): T;
  /** independent copy resuming the same stream (for snapshots) */
  clone(): Rng;
  /** raw 32-bit state, for serialisation */
  state(): number;
}

export function makeRng(seed: number): Rng {
  let a = seed | 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng: Rng = {
    next,
    range: (lo, hi) => lo + Math.floor(next() * (hi - lo)),
    pick: (arr) => arr[Math.floor(next() * arr.length)]!,
    clone: () => makeRng(a),
    state: () => a,
  };
  return rng;
}
