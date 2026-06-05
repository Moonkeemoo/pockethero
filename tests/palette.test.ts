// tests/palette.test.ts
import { describe, it, expect } from 'vitest';
import { rampFor, PALETTE, desat } from '../src/render/palette';
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

describe('desat', () => {
  it('t=0 returns the original colour unchanged', () => {
    expect(desat(0xff0000, 0)).toBe(0xff0000);
  });
  it('t=1 returns luminance-grey of pure red', () => {
    // red: r=255,g=0,b=0 → l = 0.3*255 = 76.5 → Math.round = 77
    expect(desat(0xff0000, 1)).toBe((77 << 16) | (77 << 8) | 77);
  });
  it('t=0.10 desaturates by 10% toward grey', () => {
    const out = desat(0xff0000, 0.10);
    const r = (out >> 16) & 255, g = (out >> 8) & 255, b = out & 255;
    expect(r).toBeGreaterThan(230); // slightly less than 255 (255 - 0.1*178.5 ≈ 237)
    expect(g).toBeGreaterThan(0);   // shifted away from 0
    expect(b).toBeGreaterThan(0);
  });
});
