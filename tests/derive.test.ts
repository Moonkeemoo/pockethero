import { describe, it, expect } from 'vitest';
import { CUBES, CUBE_IDS } from '../src/data/cubes';
import { MOVES, MOVE_IDS } from '../src/data/moves';
import { SYNERGY_DEFS, SHAPE_DEFS } from '../src/data/traits';

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
});
