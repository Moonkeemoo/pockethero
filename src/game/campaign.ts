/**
 * src/game/campaign.ts — pure, deterministic campaign logic.
 * No Pixi/DOM imports. No top-level side effects.
 */

import { CUBES } from '../index';
import type { Build } from '../index';

// ---------------------------------------------------------------------------
// Stage count per level
// ---------------------------------------------------------------------------
export function stageCount(level: number): number {
  return level === 1 ? 5 : 10;
}

// ---------------------------------------------------------------------------
// Stage tier
// ---------------------------------------------------------------------------
export type Tier = 'minor' | 'elite' | 'boss';

export function stageTier(level: number, stage: number): Tier {
  const total = stageCount(level);
  if (stage === total - 1) return 'boss';
  if (level === 1 && stage === 2) return 'elite';
  if (level !== 1 && (stage === 3 || stage === 6)) return 'elite';
  return 'minor';
}

// ---------------------------------------------------------------------------
// Enemy spec
// ---------------------------------------------------------------------------
export interface EnemySpec {
  name: string;
  build: Build;
  scale: number;
  boss: boolean;
}

// Local mulberry32 (no external dep)
function mulberry32(a: number): () => number {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Archetype → cube pool (valid CUBES keys only, no 'core')
const ARCHETYPE_CUBES: Record<string, string[]> = {
  melee:  ['vital', 'plate', 'force'],
  ranged: ['vital', 'swift', 'focus'],
  mage:   ['vital', 'mana', 'ember', 'frost', 'catalyst'],
  tank:   ['vital', 'plate', 'thorns'],
};

const ARCHETYPES = ['melee', 'ranged', 'mage', 'tank'] as const;
type Archetype = typeof ARCHETYPES[number];

const ARCHETYPE_NAME_UA: Record<Archetype, string> = {
  melee:  'Боєць',
  ranged: 'Лучник',
  mage:   'Маг',
  tank:   'Броня',
};

const TIER_NAME_UA: Record<Tier, string> = {
  minor: 'Мінор',
  elite: 'Еліт',
  boss:  'Бос',
};

const TIER_MUL: Record<Tier, number> = {
  minor: 1.0,
  elite: 1.4,
  boss:  1.8,
};

/**
 * Generate a deterministic enemy for the given level + stage.
 * Seed = level * 100 + stage.
 */
export function genEnemy(level: number, stage: number): EnemySpec {
  const tier = stageTier(level, stage);
  const rng = mulberry32(level * 100 + stage);

  const archetypeIndex = (level + stage) % 4;
  const archetype = ARCHETYPES[archetypeIndex] as Archetype;
  const pool = ARCHETYPE_CUBES[archetype]!;

  const rawTarget = 6 + level * 4 + stage * 1.5;
  const targetPixels = Math.round(rawTarget * TIER_MUL[tier]);

  // Build a connected blob around [0,0]
  const build: Build = [{ gx: 0, gy: 0, type: 'core' }];
  const occupied = new Set<string>();
  occupied.add('0,0');

  // Grow until we hit target
  for (let i = 1; i < targetPixels; i++) {
    // Gather all frontier cells: orthogonally OR diagonally adjacent to any occupied cell
    const frontier = new Set<string>();
    for (const cell of occupied) {
      const [cx, cy] = cell.split(',').map(Number) as [number, number];
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          const key = `${cx + dx},${cy + dy}`;
          if (!occupied.has(key)) frontier.add(key);
        }
      }
    }

    // Pick a random frontier cell
    const frontierArr = Array.from(frontier);
    const pick = frontierArr[Math.floor(rng() * frontierArr.length)];
    if (!pick) break; // safety guard

    occupied.add(pick);
    const [nx, ny] = pick.split(',').map(Number) as [number, number];

    // Pick cube type from archetype pool
    const cubeType = pool[Math.floor(rng() * pool.length)]!;
    build.push({ gx: nx, gy: ny, type: cubeType });
  }

  const scale = tier === 'boss' ? 1.6 : tier === 'elite' ? 1.15 : 1.0;
  const boss = tier === 'boss';
  const name = `${TIER_NAME_UA[tier]}-${ARCHETYPE_NAME_UA[archetype]}`;

  return { name, build, scale, boss };
}

// ---------------------------------------------------------------------------
// Stage reward
// ---------------------------------------------------------------------------
export function stageReward(
  level: number,
  stage: number,
): { xp: number; coins: number; cube?: string } {
  const tier = stageTier(level, stage);
  const tierMul = tier === 'boss' ? 4 : tier === 'elite' ? 2 : 1;

  const baseXp = 15 + level * 5 + stage * 3;
  const baseCoins = 8 + level * 3 + stage * 2;

  const xp = Math.round(baseXp * tierMul);
  const coins = Math.round(baseCoins * tierMul);

  // Onboarding cube schedule: Level 1 only, one per stage
  const L1_CUBES = ['force', 'plate', 'swift', 'focus', 'ember'] as const;
  let cube: string | undefined;
  if (level === 1 && stage < L1_CUBES.length) {
    cube = L1_CUBES[stage];
  }

  return { xp, coins, cube };
}

// Re-export CUBES so tests can reference it if needed (noop, already from index)
export { CUBES };
