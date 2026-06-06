/**
 * src/game/campaign.ts — pure, deterministic campaign logic.
 * No Pixi/DOM imports. No top-level side effects.
 */

import { CUBES } from '../index';
import type { Build } from '../index';
import { weightedCubePick } from './meta';

// ---------------------------------------------------------------------------
// Stage count per level
// ---------------------------------------------------------------------------
// Every level is a 20-stage run (boss on the last stage).
export function stageCount(_level: number): number {
  return 20;
}
const STAGES = 20;

// ---------------------------------------------------------------------------
// Stage tier
// ---------------------------------------------------------------------------
export type Tier = 'minor' | 'elite' | 'boss';

export function stageTier(_level: number, stage: number): Tier {
  if (stage === STAGES - 1) return 'boss';            // stage 20 = boss
  if (stage === 5 || stage === 10 || stage === 14) return 'elite'; // mid-run elite spikes
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
  archetype: string;   // melee | ranged | mage | tank — selects the enemy sprite
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

// Archetype → weighted cube pool. EVERY archetype guarantees an offense source
// (force or magic) so that a bigger enemy is RELIABLY stronger (fixes the
// "big tanky boss loses to 2 cubes" bug). Repeats = weight.
const ARCHETYPE_CUBES: Record<string, string[]> = {
  melee:  ['vital', 'vital', 'force', 'force', 'plate'],          // ~40% force
  ranged: ['vital', 'swift', 'force', 'focus', 'force'],          // force + focus crit
  mage:   ['vital', 'mana', 'ember', 'force', 'mana', 'frost'],   // magic dmg + a force
  tank:   ['vital', 'vital', 'plate', 'force', 'thorns', 'force'],// armored but still hits
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
  elite: 1.35,
  boss:  1.6,
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

  // Wavy difficulty curve over a 20-stage level (director: lose first at ~stage 3,
  // then rise in waves). base ramp + sine waviness, scaled by level + tier.
  const ramp = 0.4 + stage * 0.72;               // starts trivial, ramps across the run
  const wave = 1.4 * Math.sin(stage * 0.85);     // ±1.4 cube oscillation (the "waves")
  const levelMul = 1 + (level - 1) * 0.6;        // each level meaningfully tougher
  const rawTarget = (ramp + wave) * levelMul;
  const targetPixels = Math.max(1, Math.round(rawTarget * TIER_MUL[tier]));

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

  return { name, build, scale, boss, archetype };
}

// ---------------------------------------------------------------------------
// Stage reward
// ---------------------------------------------------------------------------
export function stageReward(
  level: number,
  stage: number,
): { xp: number; coins: number } {
  const tier = stageTier(level, stage);
  const tierMul = tier === 'boss' ? 4 : tier === 'elite' ? 2 : 1;

  const baseXp = 12 + level * 4 + stage * 2;
  const baseCoins = 6 + level * 3 + stage * 1.5;

  const xp = Math.round(baseXp * tierMul);
  const coins = Math.round(baseCoins * tierMul);

  return { xp, coins };
}

// ---------------------------------------------------------------------------
// Shop roll (§C) — 3 rarity-weighted placeable cube offers, deterministic
// per (level, stage). Reuses meta's weightedCubePick rarity weighting.
// ---------------------------------------------------------------------------
export function rollShop(level: number, stage: number): string[] {
  const rng = mulberry32(level * 1000 + stage * 7 + 31);
  const offers: string[] = [];
  for (let i = 0; i < 3; i++) offers.push(weightedCubePick(rng));
  return offers;
}

// ---------------------------------------------------------------------------
// Cube price (§C) — base by rarity, scaling slightly with stage.
// ---------------------------------------------------------------------------
const RARITY_PRICE: Record<string, number> = { common: 3, rare: 6, epic: 10, legendary: 16 };

export function cubePrice(type: string, stage: number): number {
  const rarity = CUBES[type]?.rarity ?? 'common';
  const base = RARITY_PRICE[rarity] ?? RARITY_PRICE['common']!;
  return Math.max(1, Math.round(base * (1 + stage * 0.08)));
}

// ---------------------------------------------------------------------------
// Stuck-stage hint (§C) — archetype-derived advice after repeated losses.
// ---------------------------------------------------------------------------
const STUCK_HINT_UA: Record<Archetype, string> = {
  melee:  'ворог бʼє зблизька — додай Тіло (зелені) та Броню',
  ranged: 'ворог стріляє — додай Тіло (зелені) або Спритність',
  mage:   'ворог маг — додай Тіло та Оберіг (магічний опір)',
  tank:   'ворог броньований — додай Силу/Пробій (червоні)',
};

/** Concrete advice for a stage the player keeps losing, from the enemy archetype. */
export function stuckHint(level: number, stage: number): string {
  const archetype = ARCHETYPES[(level + stage) % 4] as Archetype;
  return STUCK_HINT_UA[archetype];
}

// Re-export CUBES so tests can reference it if needed (noop, already from index)
export { CUBES };
