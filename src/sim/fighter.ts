import type { Build } from '../derive/types';
import type { Fighter } from './types';
import { deriveStats } from '../derive/deriveStats';
import { deriveMoveset } from '../derive/deriveMoveset';

export function makeFighter(id: string, name: string, side: -1 | 1, build: Build): Fighter {
  const stats = deriveStats(build);
  return {
    id, name, side, stats,
    moveset: deriveMoveset(build),
    hp: stats.maxHP, atb: side < 0 ? 0.1 : 0, moveCursor: side < 0 ? 0 : 1,
    statuses: [], alive: true,
  };
}
