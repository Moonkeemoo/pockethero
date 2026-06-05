// tests/loop.test.ts
import { describe, it, expect } from 'vitest';
import { advance, MAX_STEPS } from '../src/render/loop';
import { DT } from '../src/index';

describe('fixed-step accumulator', () => {
  it('accumulates real dt into whole DT steps and reports leftover alpha in [0,1)', () => {
    const r = advance(0, DT * 1.5);
    expect(r.steps).toBe(1);
    expect(r.alpha).toBeGreaterThanOrEqual(0);
    expect(r.alpha).toBeLessThan(1);
    expect(Math.abs(r.alpha - 0.5)).toBeLessThan(1e-6);
  });

  it('runs multiple steps for a big frame and carries the remainder', () => {
    const r = advance(0, DT * 3.25);
    expect(r.steps).toBe(3);
    expect(Math.abs(r.alpha - 0.25)).toBeLessThan(1e-6);
  });

  it('clamps to MAX_STEPS to avoid a spiral of death on a long stall', () => {
    const r = advance(0, DT * 1000);
    expect(r.steps).toBe(MAX_STEPS);
    expect(r.acc).toBeLessThan(DT); // leftover drained, no unbounded backlog
  });
});
