/**
 * tests/campaign.test.ts — unit tests for src/game/campaign.ts
 * and new meta.ts exports (addKillReward, openChest, load tolerance).
 */

import { describe, it, expect } from 'vitest';
import {
  stageCount,
  stageTier,
  genEnemy,
  stageReward,
} from '../src/game/campaign';
import {
  defaultState,
  addKillReward,
  openChest,
  load,
  save,
  CHEST_COST,
} from '../src/game/meta';
import type { StorageLike } from '../src/game/meta';

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

// ---------------------------------------------------------------------------
// stageCount
// ---------------------------------------------------------------------------
describe('stageCount', () => {
  it('level 1 has 20 stages', () => {
    expect(stageCount(1)).toBe(20);
  });
  it('level 2 has 20 stages', () => {
    expect(stageCount(2)).toBe(20);
  });
  it('level 3+ also has 20 stages', () => {
    expect(stageCount(3)).toBe(20);
    expect(stageCount(10)).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// stageTier
// ---------------------------------------------------------------------------
describe('stageTier', () => {
  it('stage 19 is boss (last stage in 20-stage run)', () => {
    expect(stageTier(1, 19)).toBe('boss');
    expect(stageTier(2, 19)).toBe('boss');
  });
  it('stages 5, 10, 14 are elite (level-independent)', () => {
    expect(stageTier(1, 5)).toBe('elite');
    expect(stageTier(1, 10)).toBe('elite');
    expect(stageTier(1, 14)).toBe('elite');
    expect(stageTier(2, 5)).toBe('elite');
    expect(stageTier(2, 10)).toBe('elite');
    expect(stageTier(2, 14)).toBe('elite');
  });
  it('stages 0, 1, 2, 3, 4 are minor', () => {
    expect(stageTier(1, 0)).toBe('minor');
    expect(stageTier(1, 1)).toBe('minor');
    expect(stageTier(1, 2)).toBe('minor');
    expect(stageTier(1, 3)).toBe('minor');
    expect(stageTier(1, 4)).toBe('minor');
  });
  it('non-elite non-boss stages (e.g. 6, 7, 8, 9, 11, 15) are minor', () => {
    expect(stageTier(2, 6)).toBe('minor');
    expect(stageTier(2, 7)).toBe('minor');
    expect(stageTier(2, 8)).toBe('minor');
    expect(stageTier(2, 9)).toBe('minor');
    expect(stageTier(2, 11)).toBe('minor');
    expect(stageTier(2, 15)).toBe('minor');
    expect(stageTier(2, 18)).toBe('minor');
  });
});

// ---------------------------------------------------------------------------
// genEnemy — determinism + validity
// ---------------------------------------------------------------------------
describe('genEnemy', () => {
  it('is deterministic: same inputs produce identical build', () => {
    const a = genEnemy(1, 0);
    const b = genEnemy(1, 0);
    expect(a.build).toEqual(b.build);
    expect(a.name).toBe(b.name);
    expect(a.scale).toBe(b.scale);
    expect(a.boss).toBe(b.boss);
  });

  it('different inputs produce different builds', () => {
    const a = genEnemy(1, 0);
    const b = genEnemy(1, 1);
    // At minimum pixel count should differ or build content differs
    const aStr = JSON.stringify(a.build);
    const bStr = JSON.stringify(b.build);
    expect(aStr).not.toBe(bStr);
  });

  it('build has exactly one core at [0,0]', () => {
    for (const [lv, st] of [[1, 0], [1, 2], [1, 4], [2, 0], [2, 9]] as [number, number][]) {
      const e = genEnemy(lv, st);
      const cores = e.build.filter(c => c.type === 'core');
      expect(cores).toHaveLength(1);
      expect(cores[0]!.gx).toBe(0);
      expect(cores[0]!.gy).toBe(0);
    }
  });

  it('no duplicate coords in build', () => {
    for (const [lv, st] of [[1, 0], [1, 2], [2, 3], [2, 9]] as [number, number][]) {
      const e = genEnemy(lv, st);
      const coords = e.build.map(c => `${c.gx},${c.gy}`);
      const unique = new Set(coords);
      expect(unique.size).toBe(coords.length);
    }
  });

  it('build is connected (every non-core is diagonally/orthogonally adjacent to at least one other cell)', () => {
    const e = genEnemy(2, 5);
    const occupied = new Set(e.build.map(c => `${c.gx},${c.gy}`));
    for (const cell of e.build) {
      if (cell.gx === 0 && cell.gy === 0) continue; // core is anchor
      let connected = false;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          if (occupied.has(`${cell.gx + dx},${cell.gy + dy}`)) {
            connected = true;
          }
        }
      }
      expect(connected).toBe(true);
    }
  });

  it('pixel count grows with level (compare mid-run stage where levelMul clearly separates)', () => {
    // stage 8: level 1 → ~7 pixels, level 3 → ~16 pixels (levelMul 1 vs 2.2)
    const lowLevel = genEnemy(1, 8);
    const highLevel = genEnemy(3, 8);
    expect(highLevel.build.length).toBeGreaterThan(lowLevel.build.length);
  });

  it('pixel count grows with stage (compare last stage 19 vs stage 0 at same level)', () => {
    const early = genEnemy(2, 0);
    const late = genEnemy(2, 19); // stage 19 = boss, large ramp
    expect(late.build.length).toBeGreaterThan(early.build.length);
  });

  it('boss has boss:true and scale 1.6', () => {
    const boss1 = genEnemy(1, 19); // stage 19 = boss in 20-stage run
    expect(boss1.boss).toBe(true);
    expect(boss1.scale).toBe(1.6);
  });

  it('elite has scale 1.15', () => {
    const elite = genEnemy(1, 5); // stage 5 is elite
    expect(elite.scale).toBe(1.15);
    expect(elite.boss).toBe(false);
  });

  it('minor has scale 1.0', () => {
    const minor = genEnemy(1, 0);
    expect(minor.scale).toBe(1.0);
    expect(minor.boss).toBe(false);
  });

  it('boss pixel count is larger than minor at same level/stage-equiv', () => {
    // Compare the boss (stage 19) to the first minor stage of same level
    const minor = genEnemy(1, 0);
    const boss = genEnemy(1, 19); // stage 19 = boss
    expect(boss.build.length).toBeGreaterThan(minor.build.length);
  });
});

// ---------------------------------------------------------------------------
// stageReward
// ---------------------------------------------------------------------------
describe('stageReward', () => {
  it('minor reward is baseline', () => {
    const r = stageReward(1, 0);
    // tier=minor (mul=1), xp = 12+1*4+0*2=16, coins=round(6+1*3+0*1.5)=9
    expect(r.xp).toBe(16);
    expect(r.coins).toBe(9);
  });

  it('elite reward is 2x minor', () => {
    const minor = stageReward(1, 1); // minor stage 1
    const elite = stageReward(1, 5); // stage 5 is elite
    // minor stage1: xp=18, elite stage5: xp=52
    expect(elite.xp).toBeGreaterThan(minor.xp);
    expect(elite.coins).toBeGreaterThan(minor.coins);
  });

  it('boss reward is 4x base', () => {
    const boss = stageReward(1, 19); // stage 19 = boss
    // xp base = 12+4+38=54, *4 = 216
    expect(boss.xp).toBe(216);
    // coins base = round(6+3+28.5)=round(37.5)*4 → round(37.5*4)=150
    expect(boss.coins).toBe(150);
  });

  it('L1 stage 0 grants cube "force"', () => {
    expect(stageReward(1, 0).cube).toBe('force');
  });
  it('L1 stage 1 grants cube "vital"', () => {
    expect(stageReward(1, 1).cube).toBe('vital');
  });
  it('L1 stage 2 grants cube "plate"', () => {
    expect(stageReward(1, 2).cube).toBe('plate');
  });
  it('L1 stage 3 grants cube "force"', () => {
    expect(stageReward(1, 3).cube).toBe('force');
  });
  it('L1 stage 4 grants cube "swift"', () => {
    expect(stageReward(1, 4).cube).toBe('swift');
  });
  it('L1 stage 5 grants cube "focus"', () => {
    expect(stageReward(1, 5).cube).toBe('focus');
  });
  it('L1 stage 6 grants cube "vital"', () => {
    expect(stageReward(1, 6).cube).toBe('vital');
  });
  it('L1 stage 7 grants cube "force"', () => {
    expect(stageReward(1, 7).cube).toBe('force');
  });
  it('L1 stage 8 grants cube "plate"', () => {
    expect(stageReward(1, 8).cube).toBe('plate');
  });
  it('L1 stage 9 grants cube "ember"', () => {
    expect(stageReward(1, 9).cube).toBe('ember');
  });
  it('L1 stage 10+ grants no cube', () => {
    for (let s = 10; s < 20; s++) {
      expect(stageReward(1, s).cube).toBeUndefined();
    }
  });
  it('L2 grants no onboarding cube', () => {
    for (let s = 0; s < 10; s++) {
      expect(stageReward(2, s).cube).toBeUndefined();
    }
  });

  it('rewards scale with level', () => {
    const l1 = stageReward(1, 0);
    const l2 = stageReward(2, 0);
    expect(l2.xp).toBeGreaterThan(l1.xp);
    expect(l2.coins).toBeGreaterThan(l1.coins);
  });
});

// ---------------------------------------------------------------------------
// meta: addKillReward
// ---------------------------------------------------------------------------
describe('addKillReward', () => {
  it('adds coins to state', () => {
    const s = defaultState();
    addKillReward(s, { xp: 10, coins: 15 }, mulberry32(1));
    expect(s.coins).toBe(15);
  });

  it('adds xp to state', () => {
    const s = defaultState();
    addKillReward(s, { xp: 10, coins: 5 }, mulberry32(1));
    expect(s.xp).toBe(10);
  });

  it('emits coins event', () => {
    const s = defaultState();
    const { events } = addKillReward(s, { xp: 0, coins: 20 }, mulberry32(1));
    const ev = events.find(e => e.kind === 'coins');
    expect(ev).toBeDefined();
    expect((ev as { kind: 'coins'; n: number }).n).toBe(20);
  });

  it('emits xp event', () => {
    const s = defaultState();
    const { events } = addKillReward(s, { xp: 30, coins: 5 }, mulberry32(1));
    const ev = events.find(e => e.kind === 'xp');
    expect(ev).toBeDefined();
    expect((ev as { kind: 'xp'; n: number }).n).toBe(30);
  });

  it('grants optional cube to inventory', () => {
    const s = defaultState();
    const before = s.inventory['force'] ?? 0;
    addKillReward(s, { xp: 5, coins: 5, cube: 'force' }, mulberry32(1));
    expect(s.inventory['force']).toBe(before + 1);
  });

  it('emits cube event when cube provided', () => {
    const s = defaultState();
    const { events } = addKillReward(s, { xp: 5, coins: 5, cube: 'plate' }, mulberry32(1));
    const ev = events.find(e => e.kind === 'cube');
    expect(ev).toBeDefined();
    expect((ev as { kind: 'cube'; cube: string }).cube).toBe('plate');
  });

  it('no cube event when cube not provided', () => {
    const s = defaultState();
    const { events } = addKillReward(s, { xp: 5, coins: 5 }, mulberry32(1));
    expect(events.find(e => e.kind === 'cube')).toBeUndefined();
  });

  it('can trigger multi-level-up', () => {
    const s = defaultState();
    // xpToNext(1)=75, xpToNext(2)=100 → need 175 xp to reach level 3
    addKillReward(s, { xp: 300, coins: 0 }, mulberry32(99));
    expect(s.level).toBeGreaterThanOrEqual(3);
  });

  it('emits levelUp events on multi-level-up', () => {
    const s = defaultState();
    const { events } = addKillReward(s, { xp: 300, coins: 0 }, mulberry32(99));
    const levelUps = events.filter(e => e.kind === 'levelUp');
    expect(levelUps.length).toBeGreaterThanOrEqual(3);
  });

  it('accumulates coins across multiple calls', () => {
    const s = defaultState();
    addKillReward(s, { xp: 0, coins: 10 }, mulberry32(1));
    addKillReward(s, { xp: 0, coins: 25 }, mulberry32(2));
    expect(s.coins).toBe(35);
  });
});

// ---------------------------------------------------------------------------
// meta: openChest
// ---------------------------------------------------------------------------
describe('openChest', () => {
  it('refuses when coins < CHEST_COST', () => {
    const s = defaultState();
    s.coins = CHEST_COST - 1;
    const result = openChest(s, mulberry32(1));
    expect(result.ok).toBe(false);
    expect(result.cubes).toHaveLength(0);
    expect(s.coins).toBe(CHEST_COST - 1); // unchanged
  });

  it('succeeds when coins >= CHEST_COST and grants exactly 1 cube', () => {
    const s = defaultState();
    s.coins = CHEST_COST;
    const result = openChest(s, mulberry32(42));
    expect(result.ok).toBe(true);
    expect(result.cubes.length).toBe(1);
    expect(s.coins).toBe(0);
  });

  it('spends exactly CHEST_COST coins', () => {
    const s = defaultState();
    s.coins = CHEST_COST + 30;
    openChest(s, mulberry32(7));
    expect(s.coins).toBe(30);
  });

  it('granted cubes are added to inventory', () => {
    const s = defaultState();
    s.coins = CHEST_COST;
    const before = Object.values(s.inventory).reduce((a, b) => a + b, 0);
    const result = openChest(s, mulberry32(42));
    const after = Object.values(s.inventory).reduce((a, b) => a + b, 0);
    expect(after).toBe(before + result.cubes.length);
  });

  it('returns a loot event', () => {
    const s = defaultState();
    s.coins = CHEST_COST;
    const { events } = openChest(s, mulberry32(42));
    const ev = events.find(e => e.kind === 'loot');
    expect(ev).toBeDefined();
  });

  it('CHEST_COST is 50', () => {
    expect(CHEST_COST).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// meta: load tolerance for old saves missing coins/campaign
// ---------------------------------------------------------------------------
describe('load — old save tolerance', () => {
  it('fills missing coins with 0', () => {
    const storage = makeStorage();
    // Old-style save without coins / campaign
    storage.setItem('pockethero.save', JSON.stringify({
      level: 3, xp: 10, essence: 5,
      inventory: { vital: 2, force: 1 },
      heroBuild: [{ gx: 0, gy: 0, type: 'core' }],
    }));
    const loaded = load(storage);
    expect(loaded.coins).toBe(0);
  });

  it('fills missing campaign with { level:1, stage:0 }', () => {
    const storage = makeStorage();
    storage.setItem('pockethero.save', JSON.stringify({
      level: 3, xp: 10, essence: 5,
      inventory: { vital: 2, force: 1 },
      heroBuild: [{ gx: 0, gy: 0, type: 'core' }],
    }));
    const loaded = load(storage);
    expect(loaded.campaign).toEqual({ level: 1, stage: 0 });
  });

  it('preserves existing coins if present in a current-version save', () => {
    const storage = makeStorage();
    storage.setItem('pockethero.save', JSON.stringify({
      __v: 4, // current save version (SAVE_VERSION = 4)
      level: 2, xp: 0, essence: 0,
      inventory: {}, heroBuild: [{ gx: 0, gy: 0, type: 'core' }],
      coins: 75, campaign: { level: 2, stage: 3 },
    }));
    const loaded = load(storage);
    expect(loaded.coins).toBe(75);
    expect(loaded.campaign).toEqual({ level: 2, stage: 3 });
  });

  it('resets a pre-version save (no __v) to the default starter', () => {
    const storage = makeStorage();
    storage.setItem('pockethero.save', JSON.stringify({
      level: 9, xp: 0, essence: 0, inventory: {},
      heroBuild: [{ gx: 0, gy: 0, type: 'core' }], coins: 999, campaign: { level: 2, stage: 8 },
    }));
    const loaded = load(storage);
    expect(loaded.level).toBe(1);
    expect(loaded.coins).toBe(0);
    expect(loaded.campaign).toEqual({ level: 1, stage: 0 });
  });

  it('save + load round-trips coins and campaign', () => {
    const storage = makeStorage();
    const s = defaultState();
    s.coins = 120;
    s.campaign = { level: 2, stage: 5 };
    save(s, storage);
    const loaded = load(storage);
    expect(loaded.coins).toBe(120);
    expect(loaded.campaign).toEqual({ level: 2, stage: 5 });
  });
});
