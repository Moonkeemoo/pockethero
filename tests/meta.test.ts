/**
 * tests/meta.test.ts — unit tests for src/game/meta.ts (roguelite shop rework).
 * Uses a seeded RNG for determinism; exercises the new public exports.
 */

import { describe, it, expect } from 'vitest';
import {
  accountXpToNext,
  accountStatBonus,
  ACCOUNT_HP_PER_LEVEL,
  defaultState,
  resetRunBuild,
  winStage,
  completeLevel,
  loseRun,
  buyCube,
  noteSeen,
  weightedCubePick,
  grantLootInto,
  save,
  load,
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
// accountXpToNext curve
// ---------------------------------------------------------------------------
describe('accountXpToNext', () => {
  it('level 1 → 75', () => expect(accountXpToNext(1)).toBe(75));
  it('level 2 → 100', () => expect(accountXpToNext(2)).toBe(100));
  it('level 10 → 300', () => expect(accountXpToNext(10)).toBe(300));
  it('scales linearly with level', () => {
    for (let l = 1; l <= 20; l++) {
      expect(accountXpToNext(l)).toBe(50 + l * 25);
    }
  });
});

// ---------------------------------------------------------------------------
// defaultState shape
// ---------------------------------------------------------------------------
describe('defaultState', () => {
  it('starts with 0 coins', () => expect(freshState().coins).toBe(0));
  it('starts at accountLevel 1', () => expect(freshState().accountLevel).toBe(1));
  it('starts at 0 accountXp', () => expect(freshState().accountXp).toBe(0));
  it('run starts at level 1, stage 0', () => {
    const s = freshState();
    expect(s.run.level).toBe(1);
    expect(s.run.stage).toBe(0);
  });
  it('run.build is a single core at [0,0]', () => {
    const s = freshState();
    expect(s.run.build).toHaveLength(1);
    expect(s.run.build[0]).toEqual({ gx: 0, gy: 0, type: 'core' });
  });
  it('seenTypes seeded with core', () => {
    expect(freshState().seenTypes).toEqual(['core']);
  });
  it('lossStreak starts at 0', () => expect(freshState().lossStreak).toBe(0));
  it('has no persistent inventory / heroBuild / essence / campaign', () => {
    const s = freshState() as unknown as Record<string, unknown>;
    expect(s['inventory']).toBeUndefined();
    expect(s['heroBuild']).toBeUndefined();
    expect(s['essence']).toBeUndefined();
    expect(s['campaign']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// resetRunBuild
// ---------------------------------------------------------------------------
describe('resetRunBuild', () => {
  it('resets stage to 0 and build to a single core', () => {
    const s = freshState();
    s.run.stage = 7;
    s.run.build = [
      { gx: 0, gy: 0, type: 'core' },
      { gx: 1, gy: 0, type: 'force' },
    ];
    resetRunBuild(s);
    expect(s.run.stage).toBe(0);
    expect(s.run.build).toEqual([{ gx: 0, gy: 0, type: 'core' }]);
  });
});

// ---------------------------------------------------------------------------
// winStage
// ---------------------------------------------------------------------------
describe('winStage', () => {
  it('adds coins to the wallet and emits a coins event', () => {
    const s = freshState();
    const { events } = winStage(s, { xp: 0, coins: 15 });
    expect(s.coins).toBe(15);
    const ev = events.find(e => e.kind === 'coins');
    expect((ev as { kind: 'coins'; n: number }).n).toBe(15);
  });

  it('adds accountXp and emits an xp event', () => {
    const s = freshState();
    const { events } = winStage(s, { xp: 30, coins: 0 });
    expect(s.accountXp).toBe(30);
    const ev = events.find(e => e.kind === 'xp');
    expect((ev as { kind: 'xp'; n: number }).n).toBe(30);
  });

  it('advances run.stage', () => {
    const s = freshState();
    winStage(s, { xp: 0, coins: 0 });
    expect(s.run.stage).toBe(1);
    winStage(s, { xp: 0, coins: 0 });
    expect(s.run.stage).toBe(2);
  });

  it('accumulates coins across multiple stages', () => {
    const s = freshState();
    winStage(s, { xp: 0, coins: 10 });
    winStage(s, { xp: 0, coins: 25 });
    expect(s.coins).toBe(35);
  });

  it('levels up the account when accountXp crosses the threshold', () => {
    const s = freshState();
    s.accountXp = accountXpToNext(1) - 1; // 74
    winStage(s, { xp: 10, coins: 0 });    // 84 → level up, leftover 9
    expect(s.accountLevel).toBe(2);
    expect(s.accountXp).toBe(9);
  });

  it('emits a levelUp event with the new account level', () => {
    const s = freshState();
    s.accountXp = accountXpToNext(1) - 1;
    const { events } = winStage(s, { xp: 5, coins: 0 });
    const ev = events.find(e => e.kind === 'levelUp');
    expect((ev as { kind: 'levelUp'; level: number }).level).toBe(2);
  });

  it('handles multi-level-up in one reward', () => {
    const s = freshState();
    // xpToNext(1)=75, (2)=100, (3)=125 → 300 total to reach level 4
    const { events } = winStage(s, { xp: 320, coins: 0 });
    expect(s.accountLevel).toBeGreaterThanOrEqual(4);
    const levelUps = events.filter(e => e.kind === 'levelUp');
    expect(levelUps.length).toBeGreaterThanOrEqual(3);
  });

  it('grants NO loot on level-up (only HP bonus via accountStatBonus)', () => {
    const s = freshState();
    const { events } = winStage(s, { xp: 320, coins: 0 });
    expect(events.find(e => e.kind === 'cube')).toBeUndefined();
    // RewardEvent union no longer has a 'loot' variant — assert via kinds.
    const kinds = events.map(e => e.kind);
    expect(kinds).not.toContain('loot');
  });
});

// ---------------------------------------------------------------------------
// completeLevel
// ---------------------------------------------------------------------------
describe('completeLevel', () => {
  it('advances run.level and resets stage + build', () => {
    const s = freshState();
    s.run.stage = 19;
    s.run.build = [
      { gx: 0, gy: 0, type: 'core' },
      { gx: 1, gy: 0, type: 'force' },
    ];
    completeLevel(s);
    expect(s.run.level).toBe(2);
    expect(s.run.stage).toBe(0);
    expect(s.run.build).toEqual([{ gx: 0, gy: 0, type: 'core' }]);
  });

  it('does not touch coins or account progression', () => {
    const s = freshState();
    s.coins = 99;
    s.accountLevel = 4;
    s.accountXp = 12;
    completeLevel(s);
    expect(s.coins).toBe(99);
    expect(s.accountLevel).toBe(4);
    expect(s.accountXp).toBe(12);
  });
});

// ---------------------------------------------------------------------------
// loseRun
// ---------------------------------------------------------------------------
describe('loseRun', () => {
  it('resets the build but keeps coins', () => {
    const s = freshState();
    s.coins = 50;
    s.run.stage = 6;
    s.run.build = [
      { gx: 0, gy: 0, type: 'core' },
      { gx: 1, gy: 0, type: 'force' },
    ];
    loseRun(s);
    expect(s.coins).toBe(50);
    expect(s.run.stage).toBe(0);
    expect(s.run.build).toEqual([{ gx: 0, gy: 0, type: 'core' }]);
  });

  it('first loss at a stage sets lossStreak 1 and lossStage', () => {
    const s = freshState();
    s.run.level = 1;
    s.run.stage = 3;
    loseRun(s);
    expect(s.lossStreak).toBe(1);
    expect(s.lossStage).toEqual({ level: 1, stage: 3 });
  });

  it('repeated loss at the same stage increments lossStreak', () => {
    const s = freshState();
    s.run.level = 1;
    s.run.stage = 3;
    loseRun(s); // resets stage to 0, so we set it back to mimic re-reaching stage 3
    s.run.stage = 3;
    loseRun(s);
    s.run.stage = 3;
    loseRun(s);
    expect(s.lossStreak).toBe(3);
    expect(s.lossStage).toEqual({ level: 1, stage: 3 });
  });

  it('loss at a different stage resets lossStreak to 1', () => {
    const s = freshState();
    s.run.level = 1;
    s.run.stage = 3;
    loseRun(s);
    expect(s.lossStreak).toBe(1);
    s.run.stage = 5;
    loseRun(s);
    expect(s.lossStreak).toBe(1);
    expect(s.lossStage).toEqual({ level: 1, stage: 5 });
  });
});

// ---------------------------------------------------------------------------
// buyCube
// ---------------------------------------------------------------------------
describe('buyCube', () => {
  it('succeeds and deducts coins when affordable', () => {
    const s = freshState();
    s.coins = 10;
    expect(buyCube(s, 6)).toBe(true);
    expect(s.coins).toBe(4);
  });

  it('succeeds at exact price', () => {
    const s = freshState();
    s.coins = 6;
    expect(buyCube(s, 6)).toBe(true);
    expect(s.coins).toBe(0);
  });

  it('fails and leaves coins untouched when unaffordable', () => {
    const s = freshState();
    s.coins = 5;
    expect(buyCube(s, 6)).toBe(false);
    expect(s.coins).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// accountStatBonus
// ---------------------------------------------------------------------------
describe('accountStatBonus', () => {
  it('is 0 at account level 1', () => {
    const s = freshState();
    expect(accountStatBonus(s)).toEqual({ maxHpAdd: 0 });
  });
  it('grants ACCOUNT_HP_PER_LEVEL per level above 1', () => {
    const s = freshState();
    s.accountLevel = 5;
    expect(accountStatBonus(s)).toEqual({ maxHpAdd: ACCOUNT_HP_PER_LEVEL * 4 });
  });
  it('ACCOUNT_HP_PER_LEVEL is 3', () => expect(ACCOUNT_HP_PER_LEVEL).toBe(3));
});

// ---------------------------------------------------------------------------
// noteSeen
// ---------------------------------------------------------------------------
describe('noteSeen', () => {
  it('emits newType for first-ever types and records them', () => {
    const s = freshState(); // seenTypes = ['core']
    const events: RewardEvent[] = [];
    noteSeen(s, ['force', 'core', 'vital'], events);
    const newTypes = events.filter(e => e.kind === 'newType').map(e => (e as { cube: string }).cube);
    expect(newTypes).toEqual(['force', 'vital']);
    expect(s.seenTypes).toContain('force');
    expect(s.seenTypes).toContain('vital');
  });
});

// ---------------------------------------------------------------------------
// weightedCubePick / grantLootInto (kept exports)
// ---------------------------------------------------------------------------
describe('weightedCubePick', () => {
  it('never returns core', () => {
    const rng = mulberry32(123);
    for (let i = 0; i < 200; i++) {
      expect(weightedCubePick(rng)).not.toBe('core');
    }
  });
  it('is deterministic for a given seed', () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    for (let i = 0; i < 20; i++) expect(weightedCubePick(a)).toBe(weightedCubePick(b));
  });
});

describe('grantLootInto', () => {
  it('adds exactly n cubes to inventory', () => {
    const inv: Record<string, number> = {};
    const cubes = grantLootInto(inv, 5, mulberry32(99));
    expect(cubes).toHaveLength(5);
    const total = Object.values(inv).reduce((a, b) => a + b, 0);
    expect(total).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// save / load round-trip (__v:5)
// ---------------------------------------------------------------------------
describe('save/load round-trip', () => {
  it('save then load returns the same state', () => {
    const storage = makeStorage();
    const s = freshState();
    s.coins = 120;
    s.accountLevel = 3;
    s.accountXp = 42;
    s.run = {
      level: 2,
      stage: 5,
      build: [
        { gx: 0, gy: 0, type: 'core' },
        { gx: 1, gy: 0, type: 'force' },
      ],
    };
    s.lossStreak = 2;
    s.lossStage = { level: 2, stage: 5 };
    save(s, storage);
    const loaded = load(storage);
    expect(loaded.coins).toBe(120);
    expect(loaded.accountLevel).toBe(3);
    expect(loaded.accountXp).toBe(42);
    expect(loaded.run.level).toBe(2);
    expect(loaded.run.stage).toBe(5);
    expect(loaded.run.build).toHaveLength(2);
    expect(loaded.lossStreak).toBe(2);
    expect(loaded.lossStage).toEqual({ level: 2, stage: 5 });
  });

  it('writes schema version 5', () => {
    const storage = makeStorage();
    save(freshState(), storage);
    const raw = JSON.parse(storage.data['pockethero.save']!);
    expect(raw.__v).toBe(5);
  });

  it('load with empty storage returns defaultState', () => {
    const loaded = load(makeStorage());
    expect(loaded.coins).toBe(0);
    expect(loaded.accountLevel).toBe(1);
    expect(loaded.run.level).toBe(1);
  });

  it('load with malformed JSON returns defaultState', () => {
    const storage = makeStorage();
    storage.setItem('pockethero.save', '{ invalid json {{{{');
    expect(load(storage).accountLevel).toBe(1);
  });

  it('load with missing fields returns defaultState', () => {
    const storage = makeStorage();
    storage.setItem('pockethero.save', JSON.stringify({ __v: 5, coins: 5 }));
    expect(load(storage).coins).toBe(0); // falls back to default
  });

  it('resets a pre-v5 (old schema) save to the default', () => {
    const storage = makeStorage();
    storage.setItem('pockethero.save', JSON.stringify({
      __v: 4,
      level: 9, xp: 0, essence: 0, inventory: {},
      heroBuild: [{ gx: 0, gy: 0, type: 'core' }],
      coins: 999, campaign: { level: 2, stage: 8 },
    }));
    const loaded = load(storage);
    expect(loaded.coins).toBe(0);
    expect(loaded.accountLevel).toBe(1);
    expect(loaded.run).toEqual({ level: 1, stage: 0, build: [{ gx: 0, gy: 0, type: 'core' }] });
  });

  it('resets a save with no __v to the default', () => {
    const storage = makeStorage();
    storage.setItem('pockethero.save', JSON.stringify({
      coins: 50, accountLevel: 3, accountXp: 0,
      run: { level: 2, stage: 1, build: [{ gx: 0, gy: 0, type: 'core' }] },
    }));
    expect(load(storage).coins).toBe(0);
  });

  it('seeds seenTypes from build types when missing in a v5 save', () => {
    const storage = makeStorage();
    storage.setItem('pockethero.save', JSON.stringify({
      __v: 5,
      coins: 0, accountLevel: 1, accountXp: 0,
      run: { level: 1, stage: 0, build: [
        { gx: 0, gy: 0, type: 'core' },
        { gx: 1, gy: 0, type: 'force' },
      ] },
    }));
    const loaded = load(storage);
    expect(loaded.seenTypes).toEqual(expect.arrayContaining(['core', 'force']));
  });

  it('save is idempotent', () => {
    const storage = makeStorage();
    const s = freshState();
    s.coins = 7;
    save(s, storage);
    save(s, storage);
    expect(load(storage).coins).toBe(7);
  });
});
