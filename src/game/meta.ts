/**
 * src/game/meta.ts — single source of truth for progression + persistence.
 * Pure logic + thin storage adapter. NO Pixi/DOM imports. No top-level side effects.
 *
 * Roguelite shop rework (SAVE_VERSION 5):
 *  - coins = permanent wallet (never burned on loss)
 *  - accountLevel / accountXp = meta progression → permanent HP bonus
 *  - run = the in-progress campaign attempt (level/stage/build), resets on loss/level-up
 */

import type { Build } from '../index';
import { CUBES } from '../index';

// ---------------------------------------------------------------------------
// Storage shim (injectable for tests)
// ---------------------------------------------------------------------------
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface SaveState {
  /** D1 — permanent wallet; never burned on loss. */
  coins: number;
  /** D3 — meta progression level (was `level`). */
  accountLevel: number;
  /** D3 — meta XP (was `xp`). */
  accountXp: number;
  /** The in-progress campaign attempt. */
  run: {
    level: number;   // campaign chapter (1+)
    stage: number;   // 0-based stage within the level
    build: Build;    // current hero; resets to [{gx:0,gy:0,type:'core'}]
  };
  /** Cube types the player has ever obtained (for the one-time "Новий тип" callout). */
  seenTypes?: string[];
  /** Consecutive losses on the same {level,stage} — drives the stuck-stage hint (§C). */
  lossStreak?: number;
  lossStage?: { level: number; stage: number };
}

export type RewardEvent =
  | { kind: 'xp'; n: number }
  | { kind: 'levelUp'; level: number }
  | { kind: 'coins'; n: number }
  | { kind: 'cube'; cube: string }
  | { kind: 'newType'; cube: string }
  | { kind: 'info'; text: string };

/**
 * Record cube types as "seen". Pushes a `newType` event for each first-ever type
 * so the UI can fire a one-time "Новий тип" callout. Mutates state.seenTypes.
 */
export function noteSeen(state: SaveState, types: string[], events: RewardEvent[]): void {
  if (!state.seenTypes) state.seenTypes = [];
  for (const ty of types) {
    if (!state.seenTypes.includes(ty)) {
      state.seenTypes.push(ty);
      events.push({ kind: 'newType', cube: ty });
    }
  }
}

// ---------------------------------------------------------------------------
// Progression constants (tunable)
// ---------------------------------------------------------------------------
/** Permanent max-HP granted to the hero per account level beyond 1 (D3). */
export const ACCOUNT_HP_PER_LEVEL = 3;

/** Account XP required to advance from `level` to `level+1`. */
export function accountXpToNext(level: number): number {
  return 50 + level * 25;
}

/** Permanent stat bonus from account progression, applied to the hero fighter. */
export function accountStatBonus(state: SaveState): { maxHpAdd: number } {
  return { maxHpAdd: ACCOUNT_HP_PER_LEVEL * (state.accountLevel - 1) };
}

// ---------------------------------------------------------------------------
// Shared rarity-weighted cube roll (reused by campaign's shop roll)
// ---------------------------------------------------------------------------
const RARITY_WEIGHT: Record<string, number> = { common: 60, rare: 26, epic: 11, legendary: 3 };
const TYPE_ORDER = [
  'core',
  'vital', 'regen', 'lifesteal',
  'force', 'focus', 'pierce', 'berserk',
  'plate', 'block', 'thorns', 'ward',
  'swift', 'haste', 'evasion',
  'mana', 'catalyst', 'ember', 'frost', 'spark', 'poison', 'arcane',
];
const PLACEABLE = TYPE_ORDER.filter(k => k !== 'core');

/**
 * Pick a random weighted cube type from the placeable pool (excludes 'core').
 * Uses RARITY_WEIGHT to choose a rarity bucket, then a uniform pick within it.
 */
export function weightedCubePick(r: () => number): string {
  let total = 0;
  for (const k in RARITY_WEIGHT) total += RARITY_WEIGHT[k]!;
  let roll = r() * total;
  let rar = 'common';
  for (const k in RARITY_WEIGHT) { roll -= RARITY_WEIGHT[k]!; if (roll <= 0) { rar = k; break; } }
  const pool = PLACEABLE.filter(k => (CUBES[k]?.rarity ?? 'common') === rar);
  if (pool.length === 0) return PLACEABLE[(r() * PLACEABLE.length) | 0]!;
  return pool[(r() * pool.length) | 0]!;
}

/**
 * Grant n random weighted cubes into an inventory map.
 * Returns the list of cube keys granted. Kept for callers that still bucket
 * loot into a Record (the shop rolls via campaign.rollShop, not this).
 */
export function grantLootInto(
  inventory: Record<string, number>,
  n: number,
  rng: () => number,
): string[] {
  const granted: string[] = [];
  for (let i = 0; i < n; i++) {
    const k = weightedCubePick(rng);
    inventory[k] = (inventory[k] ?? 0) + 1;
    granted.push(k);
  }
  return granted;
}

// ---------------------------------------------------------------------------
// Run build helpers
// ---------------------------------------------------------------------------
function starterBuild(): Build {
  return [{ gx: 0, gy: 0, type: 'core' }];
}

export function defaultState(): SaveState {
  return {
    coins: 0,
    accountLevel: 1,
    accountXp: 0,
    run: { level: 1, stage: 0, build: starterBuild() },
    seenTypes: ['core'],
    lossStreak: 0,
  };
}

/** Reset the run's stage + build to the level start (used on level start + loss). */
export function resetRunBuild(state: SaveState): void {
  state.run.stage = 0;
  state.run.build = starterBuild();
}

// ---------------------------------------------------------------------------
// winStage — grant stage-win rewards (coins + account XP), advance the stage.
// ---------------------------------------------------------------------------
export function winStage(
  state: SaveState,
  reward: { xp: number; coins: number },
  _rng?: () => number,
): { events: RewardEvent[] } {
  const events: RewardEvent[] = [];

  // Coins (permanent wallet)
  state.coins += reward.coins;
  events.push({ kind: 'coins', n: reward.coins });

  // Account XP + level-up loop. Account level's only effect is the HP bonus —
  // NO loot on level-up.
  state.accountXp += reward.xp;
  events.push({ kind: 'xp', n: reward.xp });
  while (state.accountXp >= accountXpToNext(state.accountLevel)) {
    state.accountXp -= accountXpToNext(state.accountLevel);
    state.accountLevel++;
    events.push({ kind: 'levelUp', level: state.accountLevel });
  }

  // Advance to the next stage of the run.
  state.run.stage++;

  return { events };
}

// ---------------------------------------------------------------------------
// completeLevel — boss cleared: advance chapter, reset the build.
// ---------------------------------------------------------------------------
export function completeLevel(state: SaveState): void {
  state.run.level++;
  resetRunBuild(state);
}

// ---------------------------------------------------------------------------
// loseRun — roguelite restart: update stuck tracking, reset the build.
// Coins are NOT touched.
// ---------------------------------------------------------------------------
export function loseRun(state: SaveState): void {
  const here = { level: state.run.level, stage: state.run.stage };
  if (
    state.lossStage &&
    state.lossStage.level === here.level &&
    state.lossStage.stage === here.stage
  ) {
    state.lossStreak = (state.lossStreak ?? 0) + 1;
  } else {
    state.lossStreak = 1;
    state.lossStage = here;
  }
  resetRunBuild(state);
}

// ---------------------------------------------------------------------------
// buyCube — spend coins. Placement on the grid is the caller's job
// (mutating run.build + calling noteSeen).
// ---------------------------------------------------------------------------
export function buyCube(state: SaveState, price: number): boolean {
  if (state.coins >= price) {
    state.coins -= price;
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------
const SAVE_KEY = 'pockethero.save';
// Bump when the save schema or the starter changes; older saves are reset to
// defaultState so everyone gets the current shape + balance.
const SAVE_VERSION = 5;

function resolveStorage(storage?: StorageLike): StorageLike | undefined {
  return storage ?? (typeof globalThis !== 'undefined' && 'localStorage' in globalThis
    ? (globalThis as unknown as { localStorage: StorageLike }).localStorage
    : undefined);
}

export function save(state: SaveState, storage?: StorageLike): void {
  const s = resolveStorage(storage);
  if (!s) return;
  try {
    s.setItem(SAVE_KEY, JSON.stringify({ ...state, __v: SAVE_VERSION }));
  } catch {
    // Storage may be unavailable (private browsing, quota exceeded, etc.)
  }
}

export function load(storage?: StorageLike): SaveState {
  const s = resolveStorage(storage);
  if (s) {
    try {
      const raw = s.getItem(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SaveState> & { __v?: number };
        // Reset any non-v5 save (old schema) to the current default.
        if (parsed.__v !== SAVE_VERSION) return defaultState();

        const run = parsed.run as SaveState['run'] | undefined;
        if (
          typeof parsed.coins === 'number' &&
          typeof parsed.accountLevel === 'number' &&
          typeof parsed.accountXp === 'number' &&
          run !== undefined && run !== null && typeof run === 'object' &&
          typeof run.level === 'number' &&
          typeof run.stage === 'number' &&
          Array.isArray(run.build)
        ) {
          const build = run.build as Build;
          const seenTypes = Array.isArray(parsed.seenTypes)
            ? parsed.seenTypes
            : [...new Set(build.map(p => p.type))];
          return {
            coins: parsed.coins,
            accountLevel: parsed.accountLevel,
            accountXp: parsed.accountXp,
            run: { level: run.level, stage: run.stage, build },
            seenTypes,
            lossStreak: typeof parsed.lossStreak === 'number' ? parsed.lossStreak : 0,
            lossStage:
              parsed.lossStage !== null &&
              typeof parsed.lossStage === 'object' &&
              typeof (parsed.lossStage as Record<string, unknown>)['level'] === 'number' &&
              typeof (parsed.lossStage as Record<string, unknown>)['stage'] === 'number'
                ? {
                    level: (parsed.lossStage as { level: number; stage: number }).level,
                    stage: (parsed.lossStage as { level: number; stage: number }).stage,
                  }
                : undefined,
          };
        }
      }
    } catch {
      // Malformed JSON or unavailable storage — fall through to default
    }
  }
  return defaultState();
}
