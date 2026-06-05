import { describe, it, expect } from 'vitest';
import { fightLog } from '../tools/sim-runner';

describe('sim runner', () => {
  it('produces a non-empty UA combat log ending in a K.O. line', () => {
    const lines = fightLog('hero', 'brute', 1337);
    expect(lines.length).toBeGreaterThan(3);
    expect(lines.join('\n')).toMatch(/K\.O\.|Перемога|переміг/i);
  });
  it('is deterministic for a fixed seed', () => {
    expect(fightLog('hero', 'brute', 7)).toEqual(fightLog('hero', 'brute', 7));
  });
});
