import { describe, it, expect } from 'vitest';
import { createFight, runToEnd, makeRng, makeBus } from '../src/sim/index';
import { HERO_BUILD, BRUTE_BUILD } from '../src/builds/presets';

function logFor(seed: number): string {
  const bus = makeBus();
  const s = createFight(
    { id: 'a', name: 'A', side: -1, build: HERO_BUILD },
    { id: 'b', name: 'B', side: 1, build: BRUTE_BUILD },
  );
  runToEnd(s, makeRng(seed), bus, { maxSteps: 60 * 120 });
  return JSON.stringify(bus.drain());
}

describe('determinism', () => {
  it('same seed ⇒ identical event log', () => {
    expect(logFor(1337)).toBe(logFor(1337));
  });
  it('different seeds ⇒ different log', () => {
    expect(logFor(1)).not.toBe(logFor(2));
  });
});
