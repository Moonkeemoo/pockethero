import { describe, it, expect } from 'vitest';
import { makeFighter } from '../src/sim/fighter';
import { applyStatus, tickStatuses, speedMult } from '../src/sim/status';
import { makeBus } from '../src/sim/events';
import { HERO_BUILD } from '../src/builds/presets';

describe('fighter + status', () => {
  it('builds a fighter from a build', () => {
    const f = makeFighter('hero', 'Герой', -1, HERO_BUILD);
    expect(f.hp).toBe(f.stats.maxHP);
    expect(f.alive).toBe(true);
    expect(f.moveset.length).toBeGreaterThan(0);
  });

  it('burn ticks damage over time and expires', () => {
    const f = makeFighter('hero', 'Герой', -1, HERO_BUILD);
    const bus = makeBus();
    applyStatus(f, 'burn', 2, 3, bus);   // id, duration(s), magnitude
    const hp0 = f.hp;
    tickStatuses(f, 1, bus);             // advance 1s
    expect(f.hp).toBeLessThan(hp0);
    expect(bus.drain().some((e) => e.type === 'status-tick')).toBe(true);
  });

  it('slow reduces speedMult below 1', () => {
    const f = makeFighter('hero', 'Герой', -1, HERO_BUILD);
    const bus = makeBus();
    // POC semantics: slow's speed effect is the canonical atbMul=0.45, not the
    // instance magnitude. speedMult() reads STATUS_DEF['slow'].atbMul.
    applyStatus(f, 'slow', 2, 0.5, bus);
    expect(speedMult(f)).toBeLessThan(1);
  });

  it('slow expires after duration elapses', () => {
    const f = makeFighter('hero', 'Герой', -1, HERO_BUILD);
    const bus = makeBus();
    applyStatus(f, 'slow', 1, 0.5, bus);
    tickStatuses(f, 1.1, bus);
    expect(f.statuses.find((s) => s.id === 'slow')).toBeUndefined();
    expect(speedMult(f)).toBe(1);
  });

  it('burn status-applied event is emitted on apply', () => {
    const f = makeFighter('hero', 'Герой', -1, HERO_BUILD);
    const bus = makeBus();
    applyStatus(f, 'burn', 4.2, 6, bus);
    const events = bus.drain();
    expect(events.some((e) => e.type === 'status-applied' && e.status === 'burn')).toBe(true);
  });

  it('burn deals flat 6 dmg per tick (POC magnitude)', () => {
    const f = makeFighter('hero', 'Герой', -1, HERO_BUILD);
    const bus = makeBus();
    // Apply with canonical POC duration=4.2, magnitude=6
    applyStatus(f, 'burn', 4.2, 6, bus);
    bus.drain(); // clear applied event
    const hp0 = f.hp;
    tickStatuses(f, 1, bus);
    expect(hp0 - f.hp).toBe(6);  // exactly 6 flat (POC: def.dmg = 6)
    const events = bus.drain();
    const tick = events.find((e) => e.type === 'status-tick');
    expect(tick).toBeDefined();
    if (tick && tick.type === 'status-tick') {
      expect(tick.amount).toBe(6);
    }
  });

  it('shock does not affect speedMult (POC: it is a dmgTakenMul, not atbMul)', () => {
    const f = makeFighter('hero', 'Герой', -1, HERO_BUILD);
    const bus = makeBus();
    applyStatus(f, 'shock', 3, 1.5, bus);
    expect(speedMult(f)).toBe(1);   // shock has no atbMul in the POC
  });

  it('refreshes status duration on re-apply (POC: existing.dur = def.dur)', () => {
    const f = makeFighter('hero', 'Герой', -1, HERO_BUILD);
    const bus = makeBus();
    applyStatus(f, 'slow', 5, 0.5, bus);
    tickStatuses(f, 2, bus);   // remaining now ~3
    applyStatus(f, 'slow', 5, 0.5, bus);  // refresh
    const slow = f.statuses.find((s) => s.id === 'slow');
    expect(slow?.remaining).toBeGreaterThan(4);  // refreshed back to 5
    expect(f.statuses.filter((s) => s.id === 'slow').length).toBe(1); // no duplicate
  });
});
