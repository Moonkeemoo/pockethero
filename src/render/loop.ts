// src/render/loop.ts
// Pure fixed-step accumulator. The Pixi ticker feeds real frame dt; this decides
// how many whole DT sim steps to run and the leftover interpolation fraction.
// The sim itself never sees wall-clock (determinism, design P2).
import { DT } from '../index';

export const MAX_STEPS = 5; // cap steps per frame (spiral-of-death guard)

export interface Advance { acc: number; steps: number; alpha: number }

export function advance(acc: number, realDt: number): Advance {
  let a = acc + Math.max(0, realDt);
  let steps = 0;
  while (a >= DT && steps < MAX_STEPS) { a -= DT; steps++; }
  if (steps === MAX_STEPS) a = a % DT;        // drop backlog beyond the cap
  return { acc: a, steps, alpha: a / DT };
}
