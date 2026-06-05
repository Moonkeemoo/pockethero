// tests/softbody.test.ts
import { describe, it, expect } from 'vitest';
import { makeSpring, stepSpring, impulse } from '../src/render/softbody';

describe('softbody spring', () => {
  it('an impulse decays back toward rest within ~1s and stays finite', () => {
    const s = makeSpring();
    impulse(s, 8);
    for (let i = 0; i < 60; i++) stepSpring(s, 1 / 60);
    expect(Number.isFinite(s.x)).toBe(true);
    expect(Math.abs(s.x)).toBeLessThan(0.3);   // converged near rest
    expect(Math.abs(s.v)).toBeLessThan(0.5);
  });

  it('is stable (no explosion) when stepped at rest', () => {
    const s = makeSpring();
    for (let i = 0; i < 600; i++) stepSpring(s, 1 / 60);
    expect(s.x).toBe(0);
    expect(s.v).toBe(0);
  });

  it('overshoots before settling (it is springy, not damped-to-zero instantly)', () => {
    const s = makeSpring();
    impulse(s, 10);
    let crossed = false, prev = 0;
    for (let i = 0; i < 60; i++) { stepSpring(s, 1 / 60); if (prev > 0 && s.x < 0) crossed = true; prev = s.x; }
    expect(crossed).toBe(true); // velocity carried it through rest at least once
  });
});
