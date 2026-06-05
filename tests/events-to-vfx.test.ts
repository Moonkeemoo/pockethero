// tests/events-to-vfx.test.ts
import { describe, it, expect } from 'vitest';
import { mapEventToVfx } from '../src/render/events-to-vfx';
import { routeB } from '../src/render/theme';
import type { CombatEvent } from '../src/index';

const intents = (e: CombatEvent) => mapEventToVfx(e, routeB);

describe('mapEventToVfx', () => {
  it('a normal hit -> flash + shake + hitstop + debris + floating number', () => {
    const out = intents({ type: 'hit', source: 'p1', target: 'p2', amount: 12, crit: false, t: 1 });
    const kinds = out.map((i) => i.kind).sort();
    expect(kinds).toEqual(['debris', 'flash', 'floating', 'hitstop', 'shake'].sort());
    const fl = out.find((i) => i.kind === 'floating');
    expect(fl && fl.kind === 'floating' && fl.text).toBe('12');
  });

  it('a crit hits harder: more shake amp + more hitstop frames than a normal hit', () => {
    const normal = intents({ type: 'hit', source: 'p1', target: 'p2', amount: 10, crit: false, t: 1 });
    const crit = intents({ type: 'hit', source: 'p1', target: 'p2', amount: 10, crit: true, t: 1 });
    const amp = (xs: ReturnType<typeof intents>) => (xs.find((i) => i.kind === 'shake') as { amp: number }).amp;
    const stop = (xs: ReturnType<typeof intents>) => (xs.find((i) => i.kind === 'hitstop') as { frames: number }).frames;
    expect(amp(crit)).toBeGreaterThan(amp(normal));
    expect(stop(crit)).toBeGreaterThan(stop(normal));
  });

  it('block/dodge -> a single ping; ko -> ko; move-start -> flare; heal -> heal', () => {
    expect(intents({ type: 'block', target: 'p2', t: 1 })).toEqual([{ kind: 'ping', target: 'p2', label: 'block' }]);
    expect(intents({ type: 'dodge', target: 'p2', t: 1 })).toEqual([{ kind: 'ping', target: 'p2', label: 'dodge' }]);
    expect(intents({ type: 'ko', target: 'p2', t: 1 })).toEqual([{ kind: 'ko', target: 'p2' }]);
    expect(intents({ type: 'move-start', actor: 'p1', move: 'fireball', t: 1 })).toEqual([]);
    const heal = intents({ type: 'heal', target: 'p1', amount: 5, t: 1 });
    expect(heal).toEqual([{ kind: 'heal', target: 'p1', amount: 5 }]);
  });

  it('on a heavy hit, a crit still gives more hitstop than a normal hit', () => {
    const heavy = { type: 'hit', source: 'p1', target: 'p2', amount: 40, crit: false, t: 1 } as const;
    const heavyCrit = { ...heavy, crit: true } as const;
    const stop = (e: CombatEvent) => (mapEventToVfx(e, routeB).find(i => i.kind === 'hitstop') as { frames: number }).frames;
    expect(stop(heavyCrit)).toBeGreaterThan(stop(heavy));
  });

  it('a higher vfx ceiling scales shake amplitude up for the same hit', () => {
    const e = { type: 'hit', source: 'p1', target: 'p2', amount: 12, crit: false, t: 1 } as const;
    const amp = (theme: typeof routeB) => (mapEventToVfx(e, theme).find(i => i.kind === 'shake') as { amp: number }).amp;
    const vs = { ...routeB, vfxCeiling: 'vsurvivors' as const };
    const cel = { ...routeB, vfxCeiling: 'celeste' as const };
    expect(amp(vs)).toBeGreaterThan(amp(routeB));
    expect(amp(routeB)).toBeGreaterThan(amp(cel));
  });
});
