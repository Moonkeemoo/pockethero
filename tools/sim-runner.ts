import { createFight, runToEnd, makeRng, makeBus } from '../src/sim/index';
import type { CombatEvent } from '../src/sim/index';
import { PRESETS } from '../src/builds/presets';

function fmt(e: CombatEvent, nameOf: (id: string) => string): string | null {
  switch (e.type) {
    case 'move-start':     return `${nameOf(e.actor)} → ${e.move}`;
    case 'hit':            return `  ${nameOf(e.source)} б'є ${nameOf(e.target)} на ${e.amount}${e.crit ? ' ✦КРИТ' : ''}`;
    case 'block':          return `  ${nameOf(e.target)} блокує`;
    case 'dodge':          return `  ${nameOf(e.target)} ухиляється`;
    case 'status-applied': return `  ${nameOf(e.target)}: ${e.status}`;
    case 'status-tick':    return `  ${nameOf(e.target)} втрачає ${e.amount} (${e.status})`;
    case 'heal':           return `  ${nameOf(e.target)} +${e.amount} HP`;
    case 'ko':             return `K.O. — ${nameOf(e.target)} переможено`;
    default:               return null;
  }
}

export function fightLog(aId: string, bId: string, seed: number): string[] {
  const a = PRESETS[aId]!, b = PRESETS[bId]!;
  const names: Record<string, string> = { a: a.name, b: b.name };
  const nameOf = (id: string) => names[id] ?? id;
  const bus = makeBus();
  const s = createFight(
    { id: 'a', name: a.name, side: -1, build: a.build },
    { id: 'b', name: b.name, side: 1, build: b.build },
  );
  runToEnd(s, makeRng(seed), bus, { maxSteps: 60 * 120 });
  return bus.drain().map((e) => fmt(e, nameOf)).filter((l): l is string => l !== null);
}

// CLI: `npm run sim` (optionally `npm run sim -- hero mage 42`)
const [aId = 'hero', bId = 'brute', seedStr = '1337'] = process.argv.slice(2);
// Windows-safe guard: check if this file is the entry point by filename suffix
if (process.argv[1]?.endsWith('sim-runner.ts') || process.argv[1]?.endsWith('sim-runner.js')) {
  console.log(`PocketHero — ${PRESETS[aId]?.name} vs ${PRESETS[bId]?.name} (seed ${seedStr})\n`);
  console.log(fightLog(aId, bId, Number(seedStr)).join('\n'));
}
