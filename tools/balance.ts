// Balance simulator — runs the deterministic engine to measure hero win-rate
// vs each campaign stage enemy, so genEnemy / starter can be tuned data-driven.
import { createFight, runToEnd, makeRng, makeBus, deriveStats } from '../src/index';
import type { Build } from '../src/index';
import { genEnemy, stageCount, stageTier } from '../src/game/campaign';

const B = (rows: [number, number, string][]): Build => rows.map(([gx, gy, type]) => ({ gx, gy, type }));

// Candidate starter hero (a basic creature, not a lone core). Fits the L1 grid (-2..2).
const STARTER: Build = B([
  [0, 0, 'core'],
  [-1, 0, 'vital'], [-1, 1, 'vital'], [0, 1, 'vital'], [1, 1, 'vital'], [-1, -1, 'vital'],
  [1, 0, 'force'], [2, 0, 'force'], [1, -1, 'force'],
]);

function winRate(hero: Build, enemy: Build, n = 41): number {
  let wins = 0;
  for (let s = 0; s < n; s++) {
    const fs = createFight(
      { id: 'p1', name: 'h', side: -1, build: hero },
      { id: 'p2', name: 'e', side: 1, build: enemy },
    );
    runToEnd(fs, makeRng(1000 + s * 7), makeBus(), { maxSteps: 200000 });
    if (fs.winner === 'p1') wins++;
  }
  return wins / n;
}

// An UPGRADED hero (~18 cubes) the player would have after clearing L1 + a few level-ups.
const UPGRADED: Build = B([
  [0, 0, 'core'],
  [-1, 0, 'vital'], [0, 1, 'vital'], [-1, 1, 'vital'], [1, 1, 'vital'], [0, -1, 'vital'],
  [-1, 2, 'vital'], [0, 2, 'vital'], [1, 2, 'vital'], [-2, 1, 'plate'], [-2, 2, 'plate'],
  [1, 0, 'force'], [2, 0, 'force'], [3, 0, 'force'], [0, -2, 'focus'],
  [2, -1, 'ember'], [1, -1, 'mana'], [-1, 3, 'vital'],
]);

for (const [tag, hero] of [['STARTER', STARTER], ['UPGRADED', UPGRADED]] as const) {
  const hs = deriveStats(hero);
  console.log(`\n${tag} cubes=${hero.length} HP=${hs.maxHP} atk=${hs.atk} armor=${hs.armor} crit=${hs.crit.toFixed(2)} magic=${hs.magic}`);
  for (let lvl = 1; lvl <= 2; lvl++) {
    for (let st = 0; st < stageCount(lvl); st++) {
      const e = genEnemy(lvl, st);
      const es = deriveStats(e.build);
      const wr = winRate(hero, e.build);
      console.log(
        `  L${lvl} s${st} ${stageTier(lvl, st).padEnd(5)} ` +
        `enemy cubes=${String(e.build.length).padStart(2)} HP=${String(es.maxHP).padStart(3)} atk=${es.atk.toFixed(0)} ` +
        `| win=${(wr * 100).toFixed(0)}%`,
      );
    }
  }
}
