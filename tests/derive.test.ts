import { describe, it, expect } from 'vitest';
import { CUBES, CUBE_IDS } from '../src/data/cubes';

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
