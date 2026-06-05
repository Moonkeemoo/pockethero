import { describe, it, expect } from 'vitest';
import { makeRng } from '../src/sim/rng';

describe('makeRng', () => {
  it('is deterministic for a fixed seed', () => {
    const a = makeRng(1337), b = makeRng(1337);
    const seqA = Array.from({ length: 5 }, () => a.next());
    const seqB = Array.from({ length: 5 }, () => b.next());
    expect(seqA).toEqual(seqB);
    expect(seqA[0]).toBeGreaterThanOrEqual(0);
    expect(seqA[0]).toBeLessThan(1);
  });
  it('different seeds diverge', () => {
    expect(makeRng(1).next()).not.toEqual(makeRng(2).next());
  });
  it('clone resumes the exact stream', () => {
    const r = makeRng(42); r.next(); r.next();
    const c = r.clone();
    expect(c.next()).toEqual(r.next());
  });
  it('pick and range respect bounds', () => {
    const r = makeRng(7);
    expect(['x', 'y']).toContain(r.pick(['x', 'y']));
    const v = r.range(2, 5);
    expect(v).toBeGreaterThanOrEqual(2);
    expect(v).toBeLessThan(5);
  });
});
