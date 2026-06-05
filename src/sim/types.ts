import type { Stats } from '../derive/deriveStats';

export interface StatusInstance { id: string; remaining: number; magnitude: number; tickT: number }

export interface Fighter {
  id: string;
  name: string;
  side: -1 | 1;
  stats: Stats;
  moveset: string[];
  hp: number;
  atb: number;          // 0..1 action gauge
  moveCursor: number;
  statuses: StatusInstance[];
  alive: boolean;
}

export interface FightState {
  fighters: [Fighter, Fighter];
  t: number;            // accumulated sim time (fixed-step)
  phase: 'fight' | 'done';
  winner: string | null;
}
