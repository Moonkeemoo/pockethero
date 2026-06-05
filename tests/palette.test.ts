// tests/palette.test.ts
import { describe, it, expect } from 'vitest';
import { rampFor, PALETTE } from '../src/render/palette';
import { CUBE_IDS } from '../src/index';

describe('palette', () => {
  it('resolves every cube type to a 4-stop ramp of distinct ints', () => {
    for (const id of CUBE_IDS) {
      const r = rampFor(id);
      expect(typeof r.base).toBe('number');
      expect(new Set([r.shadow, r.mid, r.base, r.highlight]).size).toBe(4);
      // value ordering: shadow darkest, highlight brightest (sum of channels)
      const lum = (n: number) => (n >> 16 & 255) + (n >> 8 & 255) + (n & 255);
      expect(lum(r.shadow)).toBeLessThan(lum(r.base));
      expect(lum(r.highlight)).toBeGreaterThan(lum(r.base));
    }
  });

  it('gives distinct base hues to the 6 categories (no two category exemplars equal)', () => {
    const exemplars = ['force', 'plate', 'vital', 'swift', 'ember', 'core'].map((t) => PALETTE.base(t));
    expect(new Set(exemplars).size).toBe(6);
  });
});
