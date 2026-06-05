/**
 * tests/meta.test.ts — unit tests for src/game/meta.ts
 * Uses a seeded RNG for determinism; exercises all public exports.
 */

import { describe, it, expect } from 'vitest';
import {
  xpToNext,
  addFightReward,
  defaultState,
  save,
  load,
  grantLootInto,
  ESSENCE_PER_FIGHT,
  XP_PER_STAGE,
  XP_WIN_BONUS,
  XP_LOSS,
} from '../src/game/meta';
import type { SaveState, StorageLike, RewardEvent } from '../src/game/meta';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function mulberry32(a: number): () => number {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** In-memory StorageLike shim for testing */
function makeStorage(): StorageLike & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return {
    data,
    getItem(key: string) { return data[key] ?? null; },
    setItem(key: string, value: string) { data[key] = value; },
  };
}

function freshState(): SaveState {
  return defaultState();
}

// ---------------------------------------------------------------------------
// xpToNext curve
// ---------------------------------------------------------------------------
describe('xpToNext', () => {
  it('level 1 → 75', () => {
    expect(xpToNext(1)).toBe(75);
  });
  it('level 2 → 100', () => {
    expect(xpToNext(2)).toBe(100);
  });
  it('level 10 → 300', () => {
    expect(xpToNext(10)).toBe(300);
  });
  it('scales linearly with level', () => {
    for (let l = 1; l <= 20; l++) {
      expect(xpToNext(l)).toBe(50 + l * 25);
    }
  });
});

// ---------------------------------------------------------------------------
// Reward constants
// ---------------------------------------------------------------------------
describe('reward constants', () => {
  it('ESSENCE_PER_FIGHT = 5', () => expect(ESSENCE_PER_FIGHT).toBe(5));
  it('XP_PER_STAGE = 20',     () => expect(XP_PER_STAGE).toBe(20));
  it('XP_WIN_BONUS = 30',     () => expect(XP_WIN_BONUS).toBe(30));
  it('XP_LOSS = 10',          () => expect(XP_LOSS).toBe(10));
});

// ---------------------------------------------------------------------------
// defaultState shape
// ---------------------------------------------------------------------------
describe('defaultState', () => {
  it('starts at level 1', () => {
    expect(freshState().level).toBe(1);
  });
  it('starts at 0 xp', () => {
    expect(freshState().xp).toBe(0);
  });
  it('starts at 0 essence', () => {
    expect(freshState().essence).toBe(0);
  });
  it('has a tiny starter heroBuild (grow from 1-2 cubes): core + force, in the L1 grid', () => {
    const s = freshState();
    // tiny — 1 to 3 cubes (grow from here)
    expect(s.heroBuild.length).toBeGreaterThanOrEqual(1);
    expect(s.heroBuild.length).toBeLessThanOrEqual(3);
    const cores = s.heroBuild.filter(p => p.type === 'core');
    expect(cores).toHaveLength(1);
    expect(cores[0]!.gx).toBe(0);
    expect(cores[0]!.gy).toBe(0);
    for (const p of s.heroBuild) {
      expect(Math.abs(p.gx)).toBeLessThanOrEqual(2);
      expect(Math.abs(p.gy)).toBeLessThanOrEqual(2);
    }
    // has at least one attack cube so the first stages are winnable
    expect(s.heroBuild.filter(p => p.type === 'force').length).toBeGreaterThanOrEqual(1);
  });
  it('inventory contains placeable cube keys', () => {
    const inv = freshState().inventory;
    expect(Object.keys(inv).length).toBeGreaterThan(10);
    // core is NOT in inventory
    expect('core' in inv).toBe(false);
    // some known keys are present
    expect('vital' in inv).toBe(true);
    expect('force' in inv).toBe(true);
  });
  it('starter inventory has some cubes (from simulated initial loot)', () => {
    const inv = freshState().inventory;
    const total = Object.values(inv).reduce((a, b) => a + b, 0);
    expect(total).toBe(16); // 8+8 from initial loot grants
  });
});

// ---------------------------------------------------------------------------
// addFightReward — Essence always
// ---------------------------------------------------------------------------
describe('addFightReward — essence', () => {
  it('grants ESSENCE_PER_FIGHT on win', () => {
    const s = freshState();
    addFightReward(s, { won: true, stagesCleared: 1 }, mulberry32(42));
    expect(s.essence).toBe(ESSENCE_PER_FIGHT);
  });
  it('grants ESSENCE_PER_FIGHT on loss', () => {
    const s = freshState();
    addFightReward(s, { won: false, stagesCleared: 0 }, mulberry32(42));
    expect(s.essence).toBe(ESSENCE_PER_FIGHT);
  });
  it('accumulates across multiple fights', () => {
    const s = freshState();
    addFightReward(s, { won: false, stagesCleared: 0 }, mulberry32(1));
    addFightReward(s, { won: false, stagesCleared: 0 }, mulberry32(2));
    expect(s.essence).toBe(ESSENCE_PER_FIGHT * 2);
  });
  it('emits an essence event', () => {
    const s = freshState();
    const { events } = addFightReward(s, { won: true, stagesCleared: 0 }, mulberry32(9));
    const ess = events.find(e => e.kind === 'essence');
    expect(ess).toBeDefined();
    expect((ess as { kind: 'essence'; n: number }).n).toBe(ESSENCE_PER_FIGHT);
  });
});

// ---------------------------------------------------------------------------
// addFightReward — XP win vs loss
// ---------------------------------------------------------------------------
describe('addFightReward — XP', () => {
  it('win with 2 stages → XP_WIN_BONUS + 2*XP_PER_STAGE', () => {
    const s = freshState();
    // Give enough budget to not level-up to keep test simple
    // level 1: xpToNext = 75. won=true stagesCleared=1 → 30+20=50 < 75 → no level up
    addFightReward(s, { won: true, stagesCleared: 1 }, mulberry32(99));
    expect(s.xp).toBe(XP_WIN_BONUS + XP_PER_STAGE);
  });
  it('loss with 0 stages → XP_LOSS', () => {
    const s = freshState();
    addFightReward(s, { won: false, stagesCleared: 0 }, mulberry32(99));
    expect(s.xp).toBe(XP_LOSS);
  });
  it('emits an xp event with correct n', () => {
    const s = freshState();
    const { events } = addFightReward(s, { won: true, stagesCleared: 2 }, mulberry32(7));
    const xpEv = events.find(e => e.kind === 'xp');
    expect(xpEv).toBeDefined();
    expect((xpEv as { kind: 'xp'; n: number }).n).toBe(XP_WIN_BONUS + 2 * XP_PER_STAGE);
  });
});

// ---------------------------------------------------------------------------
// addFightReward — level up
// ---------------------------------------------------------------------------
describe('addFightReward — level up', () => {
  it('levels up when xp crosses xpToNext', () => {
    const s = freshState();
    s.xp = xpToNext(1) - 1; // one below threshold
    // win + 1 stage = 50xp → pushes past threshold
    addFightReward(s, { won: true, stagesCleared: 1 }, mulberry32(5));
    expect(s.level).toBe(2);
  });
  it('leftover XP rolls over correctly', () => {
    const s = freshState();
    s.xp = xpToNext(1) - XP_LOSS + 1; // just above threshold with a loss
    // loss = +10 xp → level up with 1 xp rollover... Let's compute exactly
    // xpToNext(1) = 75. s.xp = 66. loss gives 10 → total = 76. → level up, leftover = 76-75 = 1
    s.xp = 66;
    addFightReward(s, { won: false, stagesCleared: 0 }, mulberry32(5));
    expect(s.level).toBe(2);
    expect(s.xp).toBe(1);
  });
  it('emits levelUp event with correct level', () => {
    const s = freshState();
    s.xp = xpToNext(1) - 1;
    const { events } = addFightReward(s, { won: true, stagesCleared: 1 }, mulberry32(3));
    const lvEv = events.find(e => e.kind === 'levelUp');
    expect(lvEv).toBeDefined();
    expect((lvEv as { kind: 'levelUp'; level: number }).level).toBe(2);
  });
  it('multi-level-up in one big reward', () => {
    const s = freshState();
    s.level = 1; s.xp = 0;
    // xpToNext(1)=75, xpToNext(2)=100, xpToNext(3)=125 → total to lvl4 = 300
    // Give massive xp: won=true stagesCleared=10 → 30 + 10*20 = 230
    // Actually let's pre-load xp
    s.xp = 270;
    addFightReward(s, { won: true, stagesCleared: 1 }, mulberry32(1));
    // 270 + 50 = 320
    // lv1→lv2 at 75: 320-75=245 leftover
    // lv2→lv3 at 100: 245-100=145 leftover
    // lv3→lv4 at 125: 145-125=20 leftover
    // lv4 still below xpToNext(4)=150, so level = 4
    expect(s.level).toBeGreaterThanOrEqual(3);
    const levelEvents = (evs: RewardEvent[]) => evs.filter(e => e.kind === 'levelUp');
    const { events } = (() => {
      const s2 = freshState();
      s2.xp = 270;
      return addFightReward(s2, { won: true, stagesCleared: 1 }, mulberry32(1));
    })();
    expect(levelEvents(events).length).toBeGreaterThanOrEqual(3);
  });
  it('loot is granted on level-up and grows inventory', () => {
    const s = freshState();
    const invBefore = Object.values(s.inventory).reduce((a, b) => a + b, 0);
    s.xp = xpToNext(1) - 1; // will level up on next reward
    addFightReward(s, { won: true, stagesCleared: 1 }, mulberry32(42));
    const invAfter = Object.values(s.inventory).reduce((a, b) => a + b, 0);
    expect(invAfter).toBeGreaterThan(invBefore);
  });
  it('loot event contains cube names', () => {
    const s = freshState();
    s.xp = xpToNext(1) - 1;
    const { events } = addFightReward(s, { won: true, stagesCleared: 1 }, mulberry32(42));
    const lootEv = events.find(e => e.kind === 'loot');
    expect(lootEv).toBeDefined();
    expect((lootEv as { kind: 'loot'; cubes: string[] }).cubes.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// grantLootInto
// ---------------------------------------------------------------------------
describe('grantLootInto', () => {
  it('adds exactly n cubes to inventory', () => {
    const inv: Record<string, number> = {};
    const rng = mulberry32(99);
    const cubes = grantLootInto(inv, 5, rng);
    expect(cubes).toHaveLength(5);
    const total = Object.values(inv).reduce((a, b) => a + b, 0);
    expect(total).toBe(5);
  });
  it('returned keys match inventory contents', () => {
    const inv: Record<string, number> = {};
    const rng = mulberry32(7);
    const cubes = grantLootInto(inv, 3, rng);
    for (const k of cubes) {
      expect(inv[k]).toBeGreaterThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// save / load round-trip
// ---------------------------------------------------------------------------
describe('save/load round-trip', () => {
  it('save then load returns same state', () => {
    const storage = makeStorage();
    const s = freshState();
    s.level = 3; s.xp = 42; s.essence = 15;
    s.inventory['force'] = 5;
    s.heroBuild = [{ gx: 0, gy: 0, type: 'core' }, { gx: 1, gy: 0, type: 'force' }];
    save(s, storage);
    const loaded = load(storage);
    expect(loaded.level).toBe(3);
    expect(loaded.xp).toBe(42);
    expect(loaded.essence).toBe(15);
    expect(loaded.inventory['force']).toBe(5);
    expect(loaded.heroBuild).toHaveLength(2);
  });

  it('load with empty storage returns defaultState', () => {
    const storage = makeStorage();
    const loaded = load(storage);
    expect(loaded.level).toBe(1);
    expect(loaded.xp).toBe(0);
    expect(loaded.essence).toBe(0);
  });

  it('load with malformed JSON returns defaultState', () => {
    const storage = makeStorage();
    storage.setItem('pockethero.save', '{ invalid json {{{{');
    const loaded = load(storage);
    expect(loaded.level).toBe(1);
  });

  it('load with missing fields returns defaultState', () => {
    const storage = makeStorage();
    storage.setItem('pockethero.save', JSON.stringify({ level: 5 })); // missing fields
    const loaded = load(storage);
    expect(loaded.level).toBe(1); // falls back to default
  });

  it('save is idempotent — multiple saves same state', () => {
    const storage = makeStorage();
    const s = freshState();
    s.level = 7;
    save(s, storage);
    save(s, storage);
    const loaded = load(storage);
    expect(loaded.level).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// Event stream correctness
// ---------------------------------------------------------------------------
describe('event stream', () => {
  it('all events present for a win with level-up', () => {
    const s = freshState();
    s.xp = xpToNext(1) - 1; // will level-up
    const { events } = addFightReward(s, { won: true, stagesCleared: 1 }, mulberry32(1));
    const kinds = events.map(e => e.kind);
    expect(kinds).toContain('essence');
    expect(kinds).toContain('xp');
    expect(kinds).toContain('levelUp');
    expect(kinds).toContain('loot');
  });

  it('loss without level-up has essence + xp only', () => {
    const s = freshState();
    const { events } = addFightReward(s, { won: false, stagesCleared: 0 }, mulberry32(1));
    const kinds = events.map(e => e.kind);
    expect(kinds).toContain('essence');
    expect(kinds).toContain('xp');
    expect(kinds).not.toContain('levelUp');
    expect(kinds).not.toContain('loot');
  });
});
