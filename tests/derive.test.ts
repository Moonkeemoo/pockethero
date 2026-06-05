import { describe, it, expect } from 'vitest';
import { CUBES, CUBE_IDS } from '../src/data/cubes';
import { MOVES, MOVE_IDS } from '../src/data/moves';
import { SYNERGY_DEFS, SHAPE_DEFS } from '../src/data/traits';
import { deriveStats } from '../src/derive/deriveStats';
import { deriveMoveset } from '../src/derive/deriveMoveset';
import type { Build } from '../src/derive/types';

describe('cube registry', () => {
  it('has the full roster with valid fields', () => {
    expect(CUBE_IDS.length).toBeGreaterThanOrEqual(20);
    for (const id of CUBE_IDS) {
      const c = CUBES[id]!;
      expect(c.id).toBe(id);
      expect(c.cost).toBeGreaterThanOrEqual(0);
      expect(['body','attack','defense','agility','magic','special']).toContain(c.cat);
      expect(['common','rare','epic','legendary']).toContain(c.rarity);
      expect(c.name.length).toBeGreaterThan(0);
    }
  });
  it('includes the special core cube', () => {
    expect(CUBES['core']).toBeDefined();
  });
});

describe('moves & traits registries', () => {
  it('moves have a school and positive weight', () => {
    expect(MOVE_IDS.length).toBeGreaterThan(0);
    for (const id of MOVE_IDS) {
      const m = MOVES[id]!;
      expect(m.weight).toBeGreaterThan(0);
      expect(m.school.length).toBeGreaterThan(0);
    }
  });
  it('trait defs have unique keys', () => {
    const keys = [...SYNERGY_DEFS, ...SHAPE_DEFS].map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.length).toBeGreaterThanOrEqual(8);
  });
  it('a known move has faithful values', () => {
    expect(MOVES['fist']!.school).toBe('phys');
    expect(MOVES['fire']!.magicSchool).toBe('fire');
    expect(MOVES['sword']!.power).toBeGreaterThan(0);
  });
  it('req gating matches the POC thresholds', () => {
    const core = [{ gx: 0, gy: 0, type: 'core' }];
    expect(MOVES['fist']!.req?.(core) ?? true).toBe(true);          // always available
    expect(MOVES['sword']!.req?.(core) ?? true).toBe(false);        // needs 3x force
    const threeForce = [
      { gx:0,gy:0,type:'core' },{ gx:1,gy:0,type:'force' },
      { gx:0,gy:1,type:'force' },{ gx:1,gy:1,type:'force' },
    ];
    expect(MOVES['sword']!.req?.(threeForce) ?? true).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TITAN_BUILD — reconstructed from poc/builder.html lines 605-627 (B helper).
// ---------------------------------------------------------------------------
const TITAN_BUILD: Build = [
  { gx:  0, gy: 0, type: 'core' },
  { gx: -1, gy: 0, type: 'vital' }, { gx:  1, gy: 0, type: 'vital' },
  { gx: -2, gy: 0, type: 'vital' }, { gx:  2, gy: 0, type: 'vital' },
  { gx: -2, gy: 1, type: 'vital' }, { gx: -1, gy: 1, type: 'vital' },
  { gx:  0, gy: 1, type: 'vital' }, { gx:  1, gy: 1, type: 'vital' }, { gx: 2, gy: 1, type: 'vital' },
  { gx: -2, gy: 2, type: 'vital' }, { gx: -1, gy: 2, type: 'vital' },
  { gx:  0, gy: 2, type: 'vital' }, { gx:  1, gy: 2, type: 'vital' }, { gx: 2, gy: 2, type: 'vital' },
  { gx: -2, gy: 3, type: 'vital' }, { gx: -1, gy: 3, type: 'vital' },
  { gx:  0, gy: 3, type: 'vital' }, { gx:  1, gy: 3, type: 'vital' }, { gx: 2, gy: 3, type: 'vital' },
  { gx: -1, gy: 4, type: 'vital' }, { gx:  0, gy: 4, type: 'vital' }, { gx: 1, gy: 4, type: 'vital' },
  { gx: -3, gy: 0, type: 'plate' }, { gx: -4, gy: 0, type: 'plate' },
  { gx: -3, gy: 1, type: 'plate' }, { gx: -4, gy: 1, type: 'plate' },
  { gx:  3, gy: 0, type: 'plate' }, { gx:  4, gy: 0, type: 'plate' },
  { gx:  3, gy: 1, type: 'plate' }, { gx:  4, gy: 1, type: 'plate' },
  { gx: -3, gy: 2, type: 'plate' }, { gx: -3, gy: 3, type: 'plate' },
  { gx:  3, gy: 2, type: 'plate' }, { gx:  3, gy: 3, type: 'plate' },
  { gx: -1, gy:-1, type: 'plate' }, { gx:  0, gy:-1, type: 'plate' }, { gx: 1, gy:-1, type: 'plate' },
  { gx:  5, gy: 0, type: 'force' }, { gx:  6, gy: 0, type: 'force' }, { gx: 7, gy: 0, type: 'force' },
  { gx: -5, gy: 0, type: 'force' }, { gx: -6, gy: 0, type: 'force' }, { gx:-7, gy: 0, type: 'force' },
  { gx:  5, gy: 1, type: 'force' }, { gx: -5, gy: 1, type: 'force' },
  { gx:  2, gy:-1, type: 'swift' }, { gx:  3, gy:-1, type: 'swift' }, { gx: 4, gy:-1, type: 'swift' },
  { gx: -2, gy:-1, type: 'swift' }, { gx: -3, gy:-1, type: 'swift' }, { gx:-4, gy:-1, type: 'swift' },
  { gx:  0, gy:-2, type: 'focus' }, { gx: -1, gy:-2, type: 'focus' }, { gx: 1, gy:-2, type: 'focus' },
  { gx:  0, gy:-3, type: 'focus' },
  { gx: -2, gy:-2, type: 'ember' }, { gx: -2, gy:-3, type: 'mana' }, { gx:-3, gy:-2, type: 'mana' },
  { gx:  2, gy:-2, type: 'frost' }, { gx:  2, gy:-3, type: 'mana' }, { gx: 3, gy:-2, type: 'mana' },
  { gx:  0, gy:-4, type: 'spark' },
  { gx: -1, gy:-3, type: 'catalyst' }, { gx: 1, gy:-3, type: 'catalyst' },
  { gx: -3, gy:-3, type: 'catalyst' }, { gx: 3, gy:-3, type: 'catalyst' },
  { gx: -2, gy: 4, type: 'vital' }, { gx:  2, gy: 4, type: 'vital' },
  { gx: -1, gy: 5, type: 'vital' }, { gx:  0, gy: 5, type: 'vital' }, { gx: 1, gy: 5, type: 'vital' },
];

describe('deriveStats / deriveMoveset', () => {
  const core: Build = [{ gx: 0, gy: 0, type: 'core' }];

  it('bare core yields the base stat block', () => {
    const s = deriveStats(core);
    // hpBase=60, no vital → maxHP=60
    expect(s.maxHP).toBe(60);
    // atkBase=6, no force
    expect(s.atk).toBe(6);
    // spdBase=0.82
    expect(s.speed).toBe(0.82);
    expect(s.traits).toEqual([]);
    expect(s.traitDelta).toBeDefined();
    expect(s.cubeDelta).toBeDefined();
    // no special cubes → all zero
    expect(s.blockChance).toBe(0);
    expect(s.regenPerSec).toBe(0);
    expect(s.lifesteal).toBe(0);
    expect(s.pierce).toBe(0);
    expect(s.berserk).toBe(0);
    expect(s.thorns).toBe(0);
    expect(s.magResist).toBe(0);
    expect(s.haste).toBe(0);
  });

  it('moveset always contains the basic move on a bare core', () => {
    expect(deriveMoveset(core).length).toBeGreaterThan(0);
    expect(deriveMoveset(core)).toContain('fist');
  });

  // ---- Ported from poc self-tests lines 2995-3003 ----

  it('deriveStats: outpost present in withPlate build', () => {
    // poc line 2995: withPlate = B([[0,0,'core'],[0,1,'vital'],[0,2,'vital'],[1,1,'plate'],[1,2,'plate']])
    const withPlate: Build = [
      { gx: 0, gy: 0, type: 'core' },
      { gx: 0, gy: 1, type: 'vital' },
      { gx: 0, gy: 2, type: 'vital' },
      { gx: 1, gy: 1, type: 'plate' },
      { gx: 1, gy: 2, type: 'plate' },
    ];
    const s1 = deriveStats(withPlate);
    expect(s1.traits.some(x => x.key === 'outpost')).toBe(true);
  });

  it('deriveStats: blockChance 0 without bastion', () => {
    // poc line 2996: s0 = deriveStats(B([[0,0,'core'],[0,1,'vital'],[0,2,'vital']]))
    const s0 = deriveStats([
      { gx: 0, gy: 0, type: 'core' },
      { gx: 0, gy: 1, type: 'vital' },
      { gx: 0, gy: 2, type: 'vital' },
    ]);
    expect(s0.blockChance).toBe(0);
  });

  it('titan: >=6 traits active', () => {
    const s = deriveStats(TITAN_BUILD);
    expect(s.traits.length).toBeGreaterThanOrEqual(6);
  });

  it('titan: maxHP > base (60)', () => {
    const s = deriveStats(TITAN_BUILD);
    expect(s.maxHP).toBeGreaterThan(60);
  });

  it('titan: has bastion block > 0', () => {
    const s = deriveStats(TITAN_BUILD);
    expect(s.blockChance).toBeGreaterThan(0);
  });

  it('titan: has heart regen > 0', () => {
    const s = deriveStats(TITAN_BUILD);
    expect(s.regenPerSec).toBeGreaterThan(0);
  });

  // ---- New-cube fold checks (poc lines 3012-3019) ----

  it('regen cube -> regenPerSec > 0', () => {
    const s = deriveStats([{ gx: 0, gy: 0, type: 'core' }, { gx: 0, gy: 1, type: 'regen' }]);
    expect(s.regenPerSec).toBeGreaterThan(0);
  });

  it('lifesteal cube -> lifesteal > 0', () => {
    const s = deriveStats([{ gx: 0, gy: 0, type: 'core' }, { gx: 0, gy: 1, type: 'lifesteal' }]);
    expect(s.lifesteal).toBeGreaterThan(0);
  });

  it('pierce cube -> pierce > 0', () => {
    const s = deriveStats([{ gx: 0, gy: 0, type: 'core' }, { gx: 0, gy: 1, type: 'pierce' }]);
    expect(s.pierce).toBeGreaterThan(0);
  });

  it('block cube -> blockChance > 0', () => {
    const s = deriveStats([{ gx: 0, gy: 0, type: 'core' }, { gx: 0, gy: 1, type: 'block' }]);
    expect(s.blockChance).toBeGreaterThan(0);
  });

  it('thorns cube -> thorns > 0', () => {
    const s = deriveStats([{ gx: 0, gy: 0, type: 'core' }, { gx: 0, gy: 1, type: 'thorns' }]);
    expect(s.thorns).toBeGreaterThan(0);
  });

  it('ward cube -> magResist > 0', () => {
    const s = deriveStats([{ gx: 0, gy: 0, type: 'core' }, { gx: 0, gy: 1, type: 'ward' }]);
    expect(s.magResist).toBeGreaterThan(0);
  });

  it('haste cube -> haste > 0', () => {
    const s = deriveStats([{ gx: 0, gy: 0, type: 'core' }, { gx: 0, gy: 1, type: 'haste' }]);
    expect(s.haste).toBeGreaterThan(0);
  });

  it('evasion cube -> dodge raised above 0', () => {
    const s = deriveStats([{ gx: 0, gy: 0, type: 'core' }, { gx: 0, gy: 1, type: 'evasion' }]);
    expect(s.dodge).toBeGreaterThan(0);
  });

  it('arcane cube -> magic >= 10 (STAT.magPerElement + STAT.magPerArcane)', () => {
    // 1 arcane: elements=1 → mag=5.0 + 11.0 = 16.0
    const s = deriveStats([{ gx: 0, gy: 0, type: 'core' }, { gx: 0, gy: 1, type: 'arcane' }]);
    expect(s.magic).toBeGreaterThanOrEqual(10);
  });

  // ---- Moveset unlock checks (poc lines 3022-3023) ----

  it('arc move unlocks with arcane+mana', () => {
    const b: Build = [
      { gx: 0, gy: 0, type: 'core' },
      { gx: 0, gy: 1, type: 'arcane' },
      { gx: 0, gy: 2, type: 'mana' },
    ];
    expect(deriveMoveset(b)).toContain('arc');
  });

  it('venom move unlocks with poison+mana', () => {
    const b: Build = [
      { gx: 0, gy: 0, type: 'core' },
      { gx: 0, gy: 1, type: 'poison' },
      { gx: 0, gy: 2, type: 'mana' },
    ];
    expect(deriveMoveset(b)).toContain('venom');
  });

  // ---- Move ordering matches MOVE_ORDER (poc line 282) ----

  it('deriveMoveset returns moves in POC MOVE_ORDER', () => {
    const POC_MOVE_ORDER = ['fist', 'sword', 'bow', 'fire', 'frost', 'spark', 'venom', 'arc'];
    // Build that unlocks everything
    const allUnlocked: Build = [
      { gx: 0,  gy: 0,  type: 'core' },
      { gx: 1,  gy: 0,  type: 'force' }, { gx: 2, gy: 0, type: 'force' }, { gx: 3, gy: 0, type: 'force' },
      { gx: 0,  gy: 1,  type: 'swift' }, { gx: 0, gy: 2, type: 'swift' },
      { gx: 1,  gy: 1,  type: 'ember' },
      { gx: 1,  gy: 2,  type: 'frost' },
      { gx: 2,  gy: 1,  type: 'spark' },
      { gx: 2,  gy: 2,  type: 'poison' },
      { gx: 3,  gy: 1,  type: 'arcane' },
      { gx: -1, gy: 0,  type: 'mana' }, { gx: -2, gy: 0, type: 'mana' }, { gx:-3, gy:0, type:'mana' },
      { gx: -1, gy: 1,  type: 'mana' }, { gx: -2, gy: 1, type: 'mana' },
    ];
    const ms = deriveMoveset(allUnlocked);
    // verify ordering for items that appear
    const filtered = POC_MOVE_ORDER.filter(id => ms.includes(id));
    expect(ms).toEqual(filtered);
  });

  // ---- Stats shape: counts field present ----

  it('stats.counts has the expected keys', () => {
    const s = deriveStats(core);
    expect(s.counts).toBeDefined();
    expect(typeof s.counts.vital).toBe('number');
    expect(typeof s.counts.plate).toBe('number');
    expect(typeof s.counts.force).toBe('number');
    expect(typeof s.counts.swift).toBe('number');
    expect(typeof s.counts.focus).toBe('number');
    expect(typeof s.counts.catalyst).toBe('number');
    expect(typeof s.counts.elements).toBe('number');
  });
});
