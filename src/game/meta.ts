/**
 * src/game/meta.ts — single source of truth for progression + persistence.
 * Pure logic + thin storage adapter. NO Pixi/DOM imports. No top-level side effects.
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
  level: number;
  xp: number;
  essence: number;
  inventory: Record<string, number>;
  heroBuild: Build;
  coins: number;
  campaign: { level: number; stage: number };
}

export interface FightResult {
  won: boolean;
  stagesCleared: number;
}

export type RewardEvent =
  | { kind: 'essence'; n: number }
  | { kind: 'xp'; n: number }
  | { kind: 'levelUp'; level: number }
  | { kind: 'loot'; cubes: string[] }
  | { kind: 'coins'; n: number }
  | { kind: 'cube'; cube: string }
  | { kind: 'info'; text: string };

// ---------------------------------------------------------------------------
// Reward constants (tunable)
// ---------------------------------------------------------------------------
export const CHEST_COST = 50;
export const ESSENCE_PER_FIGHT = 5;
export const XP_PER_STAGE      = 20;
export const XP_WIN_BONUS      = 30;
export const XP_LOSS           = 10;

export function xpToNext(level: number): number {
  return 50 + level * 25;
}

// ---------------------------------------------------------------------------
// Shared loot data — must mirror builder-view.ts constants exactly
// ---------------------------------------------------------------------------
const SEED_BASE = 1337;
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

function mulberry32(a: number): () => number {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Pick a random weighted cube type (shared by builder-view and meta).
 * Uses the same RARITY_WEIGHT table and PLACEABLE list.
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
 * Grant loot items into an inventory (n random cubes).
 * Returns the list of cube keys granted (for RewardEvent).
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

// Loot counter — used internally to seed loot rng uniquely per grant call.
// We store this as part of the computation, not in SaveState (pure function approach).
// Increment by passing a counter; we derive a counter from state.level + call count.
function makeLootRng(seed: number): () => number {
  return mulberry32(SEED_BASE * 7 + seed * 2654435761);
}

// ---------------------------------------------------------------------------
// Starter inventory (same 16 cubes the builder grants today: grantLoot([8,8]) twice)
// ---------------------------------------------------------------------------
export function defaultState(): SaveState {
  const inventory: Record<string, number> = {};
  for (const k of PLACEABLE) inventory[k] = 0;

  // Simulate the builder's initial loot: grantLoot([8,8]) twice = 16 cubes total
  // Builder calls grantLoot(LOOT_BATCH) with lootClicks++ (starts at 0, increments to 1, then 2)
  const r1 = makeLootRng(1);  // lootClicks = 1 after first call
  grantLootInto(inventory, 8, r1);
  const r2 = makeLootRng(2);  // lootClicks = 2 after second call
  grantLootInto(inventory, 8, r2);

  // Starter hero: TINY (grow from 1-2 cubes) — a core + one force, so it has a
  // small attack edge and reliably wins the first (trivial) stages, then the
  // player GROWS it by placing earned cubes. Balanced via tools/balance.ts sim.
  const heroBuild: Build = [
    { gx: 0, gy: 0, type: 'core' },
    { gx: 1, gy: 0, type: 'force' },
  ];

  return {
    level: 1,
    xp: 0,
    essence: 0,
    inventory,
    heroBuild,
    coins: 0,
    campaign: { level: 1, stage: 0 },
  };
}

// ---------------------------------------------------------------------------
// Shared level-up loop — mutates state.xp / state.level / state.inventory
// and appends levelUp + loot events.
// ---------------------------------------------------------------------------
function applyXpAndLevelUp(
  state: SaveState,
  xpGained: number,
  events: RewardEvent[],
  rng?: () => number,
): void {
  state.xp += xpGained;
  events.push({ kind: 'xp', n: xpGained });

  let lootCounter = state.level * 1000 + state.xp; // unique seed per state snapshot
  while (state.xp >= xpToNext(state.level)) {
    state.xp -= xpToNext(state.level);
    state.level++;

    // Per-level loot batch (1–2 cubes), using rng if provided, else seeded from level
    const levelRng = rng ?? makeLootRng(lootCounter++);
    const n = 1 + ((levelRng() * 2) | 0); // 1 or 2
    const granted = grantLootInto(state.inventory, n, levelRng);

    events.push({ kind: 'levelUp', level: state.level });
    if (granted.length > 0) {
      events.push({ kind: 'loot', cubes: granted });
    }
  }
}

// ---------------------------------------------------------------------------
// addFightReward — mutates state, returns events
// ---------------------------------------------------------------------------
export function addFightReward(
  state: SaveState,
  result: FightResult,
  rng?: () => number,
): { events: RewardEvent[] } {
  const events: RewardEvent[] = [];

  // Essence (always)
  state.essence += ESSENCE_PER_FIGHT;
  events.push({ kind: 'essence', n: ESSENCE_PER_FIGHT });

  // XP (delegates to shared helper)
  const xpGained =
    result.stagesCleared * XP_PER_STAGE + (result.won ? XP_WIN_BONUS : XP_LOSS);
  applyXpAndLevelUp(state, xpGained, events, rng);

  return { events };
}

// ---------------------------------------------------------------------------
// addKillReward — grant coins + optional cube + xp (with level-up loop)
// ---------------------------------------------------------------------------
export function addKillReward(
  state: SaveState,
  r: { xp: number; coins: number; cube?: string },
  rng?: () => number,
): { events: RewardEvent[] } {
  const events: RewardEvent[] = [];

  // Coins
  state.coins += r.coins;
  events.push({ kind: 'coins', n: r.coins });

  // Optional guaranteed cube
  if (r.cube !== undefined) {
    state.inventory[r.cube] = (state.inventory[r.cube] ?? 0) + 1;
    events.push({ kind: 'cube', cube: r.cube });
  }

  // XP + level-up loop (reuses shared helper)
  applyXpAndLevelUp(state, r.xp, events, rng);

  return { events };
}

// ---------------------------------------------------------------------------
// openChest — spend CHEST_COST coins, grant 1–3 random cubes
// ---------------------------------------------------------------------------
export function openChest(
  state: SaveState,
  rng?: () => number,
): { ok: boolean; cubes: string[]; events: RewardEvent[] } {
  if (state.coins < CHEST_COST) {
    return { ok: false, cubes: [], events: [] };
  }

  state.coins -= CHEST_COST;

  // One cube per chest (director: limit money-bought drop to 1).
  const effectiveRng = rng ?? mulberry32(state.level * 9999 + state.coins);
  const granted = grantLootInto(state.inventory, 1, effectiveRng);
  const events: RewardEvent[] = [{ kind: 'loot', cubes: granted }];

  return { ok: true, cubes: granted, events };
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------
const SAVE_KEY = 'pockethero.save';
// Bump when the save schema or the starter changes; older saves are reset to
// defaultState so everyone gets the current starter hero + balance.
const SAVE_VERSION = 4;

export function save(state: SaveState, storage?: StorageLike): void {
  const s: StorageLike | undefined = storage ?? (typeof globalThis !== 'undefined' && 'localStorage' in globalThis
    ? (globalThis as unknown as { localStorage: StorageLike }).localStorage
    : undefined);
  if (!s) return;
  try {
    s.setItem(SAVE_KEY, JSON.stringify({ ...state, __v: SAVE_VERSION }));
  } catch {
    // Storage may be unavailable (private browsing, quota exceeded, etc.)
  }
}

export function load(storage?: StorageLike): SaveState {
  const s: StorageLike | undefined = storage ?? (typeof globalThis !== 'undefined' && 'localStorage' in globalThis
    ? (globalThis as unknown as { localStorage: StorageLike }).localStorage
    : undefined);
  if (s) {
    try {
      const raw = s.getItem(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SaveState> & { __v?: number };
        // Reset pre-version-2 saves (old starter / schema) to the current default
        if (parsed.__v !== SAVE_VERSION) return defaultState();
        // Validate shape — fallback to default if malformed
        if (
          typeof parsed.level === 'number' &&
          typeof parsed.xp === 'number' &&
          typeof parsed.essence === 'number' &&
          typeof parsed.inventory === 'object' && parsed.inventory !== null &&
          Array.isArray(parsed.heroBuild)
        ) {
          return {
            level: parsed.level,
            xp: parsed.xp,
            essence: parsed.essence,
            inventory: parsed.inventory,
            heroBuild: parsed.heroBuild,
            // Tolerate old saves missing coins / campaign — fill defaults
            coins: typeof parsed.coins === 'number' ? parsed.coins : 0,
            campaign:
              parsed.campaign !== null &&
              typeof parsed.campaign === 'object' &&
              typeof (parsed.campaign as Record<string, unknown>)['level'] === 'number' &&
              typeof (parsed.campaign as Record<string, unknown>)['stage'] === 'number'
                ? { level: (parsed.campaign as { level: number; stage: number }).level, stage: (parsed.campaign as { level: number; stage: number }).stage }
                : { level: 1, stage: 0 },
          };
        }
      }
    } catch {
      // Malformed JSON or unavailable storage — fall through to default
    }
  }
  return defaultState();
}
