/**
 * tests/campaign.test.ts — unit tests for src/game/campaign.ts (roguelite shop rework).
 */

import { describe, it, expect } from 'vitest';
import {
  stageCount,
  stageTier,
  genEnemy,
  stageReward,
  rollShop,
  cubePrice,
  stuckHint,
} from '../src/game/campaign';
import { CUBES } from '../src/index';

// ---------------------------------------------------------------------------
// stageCount
// ---------------------------------------------------------------------------
describe('stageCount', () => {
  it('every level has 20 stages', () => {
    expect(stageCount(1)).toBe(20);
    expect(stageCount(2)).toBe(20);
    expect(stageCount(10)).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// stageTier
// ---------------------------------------------------------------------------
describe('stageTier', () => {
  it('stage 19 is boss', () => {
    expect(stageTier(1, 19)).toBe('boss');
    expect(stageTier(2, 19)).toBe('boss');
  });
  it('stages 5, 10, 14 are elite (level-independent)', () => {
    for (const st of [5, 10, 14]) {
      expect(stageTier(1, st)).toBe('elite');
      expect(stageTier(2, st)).toBe('elite');
    }
  });
  it('other stages are minor', () => {
    for (const st of [0, 1, 2, 3, 4, 6, 7, 8, 9, 11, 15, 18]) {
      expect(stageTier(2, st)).toBe('minor');
    }
  });
});

// ---------------------------------------------------------------------------
// genEnemy — determinism + validity (unchanged behaviour)
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
    expect(JSON.stringify(genEnemy(1, 0).build)).not.toBe(JSON.stringify(genEnemy(1, 1).build));
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
      expect(new Set(coords).size).toBe(coords.length);
    }
  });

  it('build is connected (every non-core cell is adjacent to another)', () => {
    const e = genEnemy(2, 5);
    const occupied = new Set(e.build.map(c => `${c.gx},${c.gy}`));
    for (const cell of e.build) {
      if (cell.gx === 0 && cell.gy === 0) continue;
      let connected = false;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          if (occupied.has(`${cell.gx + dx},${cell.gy + dy}`)) connected = true;
        }
      }
      expect(connected).toBe(true);
    }
  });

  it('pixel count grows with level and stage', () => {
    expect(genEnemy(3, 8).build.length).toBeGreaterThan(genEnemy(1, 8).build.length);
    expect(genEnemy(2, 19).build.length).toBeGreaterThan(genEnemy(2, 0).build.length);
  });

  it('boss/elite/minor scales', () => {
    const boss = genEnemy(1, 19);
    expect(boss.boss).toBe(true);
    expect(boss.scale).toBe(1.6);
    const elite = genEnemy(1, 5);
    expect(elite.scale).toBe(1.15);
    expect(elite.boss).toBe(false);
    const minor = genEnemy(1, 0);
    expect(minor.scale).toBe(1.0);
    expect(minor.boss).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// stageReward — coins + xp only (no cube)
// ---------------------------------------------------------------------------
describe('stageReward', () => {
  it('returns only xp + coins (no cube field)', () => {
    const r = stageReward(1, 0);
    expect(Object.keys(r).sort()).toEqual(['coins', 'xp']);
    expect((r as Record<string, unknown>)['cube']).toBeUndefined();
  });

  it('minor reward baseline', () => {
    const r = stageReward(1, 0);
    // xp = 12+4+0 = 16, coins = round(6+3+0) = 9
    expect(r.xp).toBe(16);
    expect(r.coins).toBe(9);
  });

  it('elite reward exceeds the equivalent minor', () => {
    const minor = stageReward(1, 1);
    const elite = stageReward(1, 5);
    expect(elite.xp).toBeGreaterThan(minor.xp);
    expect(elite.coins).toBeGreaterThan(minor.coins);
  });

  it('boss reward is 4x base', () => {
    const boss = stageReward(1, 19);
    // xp base = 12+4+38 = 54, *4 = 216
    expect(boss.xp).toBe(216);
    // coins base = round((6+3+28.5)*4) = round(150) = 150
    expect(boss.coins).toBe(150);
  });

  it('rewards scale with level', () => {
    const l1 = stageReward(1, 0);
    const l2 = stageReward(2, 0);
    expect(l2.xp).toBeGreaterThan(l1.xp);
    expect(l2.coins).toBeGreaterThan(l1.coins);
  });

  it('no longer grants onboarding cubes at level 1', () => {
    for (let s = 0; s < 20; s++) {
      expect((stageReward(1, s) as Record<string, unknown>)['cube']).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// rollShop — 3 deterministic, valid, placeable offers
// ---------------------------------------------------------------------------
describe('rollShop', () => {
  it('returns exactly 3 offers', () => {
    expect(rollShop(1, 0)).toHaveLength(3);
    expect(rollShop(3, 7)).toHaveLength(3);
  });

  it('all offers are real, placeable (non-core) cube types', () => {
    for (const [lv, st] of [[1, 0], [1, 5], [2, 12], [4, 19]] as [number, number][]) {
      for (const ty of rollShop(lv, st)) {
        expect(ty).not.toBe('core');
        expect(CUBES[ty]).toBeDefined();
      }
    }
  });

  it('is deterministic per (level, stage)', () => {
    expect(rollShop(2, 3)).toEqual(rollShop(2, 3));
    expect(rollShop(5, 11)).toEqual(rollShop(5, 11));
  });

  it('differs across stages (not all rolls identical)', () => {
    const rolls = [rollShop(1, 0), rollShop(1, 1), rollShop(1, 2), rollShop(2, 0)]
      .map(r => r.join(','));
    expect(new Set(rolls).size).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// cubePrice — base by rarity, scaling with stage
// ---------------------------------------------------------------------------
describe('cubePrice', () => {
  it('base price by rarity at stage 0', () => {
    // vital=common(3), block=rare(6), berserk=epic(10), core=legendary(16)
    expect(cubePrice('vital', 0)).toBe(3);
    expect(cubePrice('block', 0)).toBe(6);
    expect(cubePrice('berserk', 0)).toBe(10);
    expect(cubePrice('core', 0)).toBe(16);
  });

  it('scales up with stage', () => {
    // common base 3 × (1 + 10*0.08 = 1.8) = 5.4 → round 5
    expect(cubePrice('vital', 10)).toBe(5);
    expect(cubePrice('vital', 19)).toBeGreaterThan(cubePrice('vital', 0));
  });

  it('is at least 1', () => {
    expect(cubePrice('vital', 0)).toBeGreaterThanOrEqual(1);
  });

  it('unknown type falls back to common pricing', () => {
    expect(cubePrice('not-a-cube', 0)).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// stuckHint (kept)
// ---------------------------------------------------------------------------
describe('stuckHint', () => {
  it('returns a non-empty advice string', () => {
    expect(stuckHint(1, 0).length).toBeGreaterThan(0);
  });
  it('is deterministic per (level, stage)', () => {
    expect(stuckHint(2, 5)).toBe(stuckHint(2, 5));
  });
});
