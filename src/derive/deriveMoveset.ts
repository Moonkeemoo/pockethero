/**
 * deriveMoveset — ported faithfully from poc/builder.html lines 558-561.
 * Iterates MOVE_ORDER, includes a move id when its req predicate passes (or
 * when it has no req, which defaults to true).
 */
import type { Build } from './types';
import { MOVES } from '../data/moves';

/** POC line 282: const MOVE_ORDER = ['fist','sword','bow','fire','frost','spark','venom','arc']; */
const MOVE_ORDER = ['fist', 'sword', 'bow', 'fire', 'frost', 'spark', 'venom', 'arc'] as const;

export function deriveMoveset(build: Build): string[] {
  const set: string[] = [];
  for (const k of MOVE_ORDER) {
    const move = MOVES[k];
    if (!move) continue;
    if (move.req ? move.req(build) : true) {
      set.push(k);
    }
  }
  return set;
}
