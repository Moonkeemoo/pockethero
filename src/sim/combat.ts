import type { Fighter, FightState } from './types';
import type { EventBus } from './events';
import type { Rng } from './rng';
import type { Build } from '../derive/types';
import { makeFighter } from './fighter';
import { MOVES } from '../data/moves';
import { tickStatuses, speedMult, applyStatusFromDef, STATUS_DEF } from './status';

export const DT = 1 / 60; // fixed logical timestep (design P2)

const ATK_BASE = 6; // matches STAT.atkBase in deriveStats

// ---------------------------------------------------------------------------
// Tuning constants — named to match poc gauntlet/builder comments
// ---------------------------------------------------------------------------
const BASE_HIT_CHANCE    = 0.92;  // baseline hit probability before dodge/acc
const SLOW_DODGE_PENALTY = 0.07;  // dodge reduction while slowed
const CRIT_MULT          = 1.8;   // crit damage multiplier
const DOUBLE_HIT_CHANCE  = 0.85;  // probability of the fist double-hit firing
const ATB_FILL_SCALE     = 0.55;  // ATB fill rate scalar (poc line 961)
const CURSOR_WEIGHT_MULT = 3.0;   // cursor-slot weight multiplier in pickMove

export interface FighterSpec { id: string; name: string; side: -1 | 1; build: Build }

export function createFight(a: FighterSpec, b: FighterSpec): FightState {
  return {
    fighters: [makeFighter(a.id, a.name, a.side, a.build), makeFighter(b.id, b.name, b.side, b.build)],
    t: 0, phase: 'fight', winner: null,
  };
}

// ---------------------------------------------------------------------------
// pickMove — weighted cycle from poc/gauntlet.html line 371
// The fighter's own moveset cursor triples the current-cursor move's weight.
// ---------------------------------------------------------------------------
function pickMove(f: Fighter, rng: Rng): string {
  const ms = f.moveset;
  if (ms.length === 0) return 'fist'; // fallback (should never happen)
  const pool: string[] = [];
  for (let i = 0; i < ms.length; i++) {
    const k = ms[i]!;
    const move = MOVES[k];
    let w = move ? move.weight : 1.0;
    // cursor bias: the slot at moveCursor % ms.length gets CURSOR_WEIGHT_MULT weight
    if (i === f.moveCursor % ms.length) w *= CURSOR_WEIGHT_MULT;
    const slots = Math.round(w * 10);
    for (let j = 0; j < slots; j++) pool.push(k);
  }
  f.moveCursor++;
  return rng.pick(pool);
}

// ---------------------------------------------------------------------------
// effectivePower — port of poc gauntlet.html line 208
// phys: move.power + (atk - atkBase)   [i.e. the force-derived bonus only]
// magic: move.power + stats.magic
// ---------------------------------------------------------------------------
function effectivePower(f: Fighter, moveId: string): number {
  const move = MOVES[moveId];
  if (!move) return 0;
  if (move.school === 'magic') return move.power + f.stats.magic;
  return move.power + f.stats.atk - ATK_BASE;
}

// ---------------------------------------------------------------------------
// computeHit — shared damage pipeline for both primary and double hits
// (berserk/variance/armor/magResist/crit-multiply/shock-consume)
// Returns { dmg, isCrit }. Consumes exactly: crit roll + range(-2,3).
// ---------------------------------------------------------------------------
function computeHit(
  src: Fighter,
  tgt: Fighter,
  moveId: string,
  rng: Rng,
): { dmg: number; isCrit: boolean } {
  const move = MOVES[moveId]!;

  // --- crit roll (poc line 862) ---
  const critChance = src.stats.crit + (move.critBonus ?? 0);
  const isCrit = rng.next() < critChance;

  // --- base damage with variance (poc line 864): effectivePower + berserkBonus + floor(rRange(-2,3)) ---
  // berserk: not in presets but port it faithfully
  let berserkBonus = 0;
  if (src.stats.berserk > 0) {
    const missing = 1 - src.hp / src.stats.maxHP;
    berserkBonus = src.stats.berserk * missing;
  }
  let dmg = effectivePower(src, moveId) + berserkBonus + rng.range(-2, 3);

  // --- armor / magResist mitigation (poc line 865-870) ---
  if (move.school === 'phys') {
    const effArmor = tgt.stats.armor * (1 - (src.stats.pierce ?? 0));
    dmg = Math.max(1, dmg - effArmor);
  } else {
    dmg = Math.max(1, dmg * (1 - (tgt.stats.magResist ?? 0)));
  }

  // --- crit multiply (poc line 872) ---
  if (isCrit) dmg = Math.round(dmg * CRIT_MULT);

  // --- shock consume (poc line 873-876): STATUS_DEF.shock.dmgTakenMul ---
  const shockIdx = tgt.statuses.findIndex((s) => s.id === 'shock');
  if (shockIdx !== -1) {
    dmg = Math.round(dmg * (STATUS_DEF['shock']?.dmgTakenMul ?? 1.5));
    tgt.statuses.splice(shockIdx, 1);
  }

  dmg = Math.round(dmg);
  return { dmg, isCrit };
}

// ---------------------------------------------------------------------------
// applyHitEffects — shared post-damage side-effects for both primary and
// double hits: applies dmg to tgt.hp, thorns, lifesteal+heal event, status
// application, and emits the hit event (with school field on both paths).
// ---------------------------------------------------------------------------
function applyHitEffects(
  src: Fighter,
  tgt: Fighter,
  dmg: number,
  isCrit: boolean,
  moveId: string,
  bus: EventBus,
  t: number,
): void {
  const move = MOVES[moveId]!;

  // --- apply damage ---
  tgt.hp = Math.max(0, tgt.hp - dmg);

  // emit hit event (school included on both primary and double-hit paths)
  bus.emit({
    type: 'hit',
    source: src.id,
    target: tgt.id,
    amount: dmg,
    crit: isCrit,
    school: move.magicSchool ?? (move.school === 'phys' ? undefined : move.school),
    t,
  });

  // --- thorns: reflect to attacker (poc line 882-886) ---
  if (tgt.stats.thorns > 0 && src.alive) {
    const refl = Math.max(1, Math.round(dmg * tgt.stats.thorns));
    src.hp = Math.max(0, src.hp - refl);
    // no dedicated thorns event in CombatEvent; emit as a hit from tgt→src
    // use heal event shape isn't right; skip — thorns damage is visible via hp change
  }

  // --- lifesteal: heal attacker (poc line 889-892) ---
  if (src.stats.lifesteal > 0 && src.alive && src.hp > 0) {
    const heal = Math.max(1, Math.round(dmg * src.stats.lifesteal));
    src.hp = Math.min(src.stats.maxHP, src.hp + heal);
    bus.emit({ type: 'heal', target: src.id, amount: heal, t });
  }

  // --- status apply (poc line 895) ---
  if (move.status) {
    applyStatusFromDef(tgt, move.status, bus, t);
  }
}

// ---------------------------------------------------------------------------
// resolveMove — ported from poc/builder.html resolveHit (lines 844-900)
// Order: block → dodge → crit roll → raw damage → armor/magResist →
//        crit multiply → shock consume → berserk? (skipped; no berserk in presets)
//        → applyDamage → thorns → lifesteal → status apply
// Regen handled separately in stepFight.
// ---------------------------------------------------------------------------
function resolveMove(
  src: Fighter,
  tgt: Fighter,
  moveId: string,
  rng: Rng,
  bus: EventBus,
  t: number,
): void {
  const move = MOVES[moveId];
  if (!move) return;

  // --- block check (builder poc line 846) ---
  if (tgt.stats.blockChance > 0 && rng.next() < tgt.stats.blockChance) {
    bus.emit({ type: 'block', target: tgt.id, t });
    return;
  }

  // --- dodge check (poc line 853-860) ---
  const slowed = tgt.statuses.some((s) => s.id === 'slow');
  const dodge = Math.max(0.02, tgt.stats.dodge - (slowed ? SLOW_DODGE_PENALTY : 0));
  const acc = src.stats.acc;
  const hitChance = BASE_HIT_CHANCE - dodge + acc;
  const isHit = rng.next() < hitChance;

  if (!isHit) {
    bus.emit({ type: 'dodge', target: tgt.id, t });
    return;
  }

  const { dmg, isCrit } = computeHit(src, tgt, moveId, rng);
  applyHitEffects(src, tgt, dmg, isCrit, moveId, bus, t);

  // --- double hit for fist (poc line 995-997): second hit synchronous in headless ---
  if (move.double && rng.next() < DOUBLE_HIT_CHANCE && tgt.alive) {
    resolveDoubleHit(src, tgt, moveId, rng, bus, t);
  }
}

// Second hit for fist double — same resolution minus the double re-trigger check.
// Block/dodge rolls are still consumed (identical RNG sequence to original).
function resolveDoubleHit(
  src: Fighter,
  tgt: Fighter,
  moveId: string,
  rng: Rng,
  bus: EventBus,
  t: number,
): void {
  const move = MOVES[moveId];
  if (!move) return;

  // --- block check ---
  if (tgt.stats.blockChance > 0 && rng.next() < tgt.stats.blockChance) {
    bus.emit({ type: 'block', target: tgt.id, t });
    return;
  }

  // --- dodge check ---
  const slowed = tgt.statuses.some((s) => s.id === 'slow');
  const dodge = Math.max(0.02, tgt.stats.dodge - (slowed ? SLOW_DODGE_PENALTY : 0));
  const hitChance = BASE_HIT_CHANCE - dodge + src.stats.acc;
  if (rng.next() >= hitChance) {
    bus.emit({ type: 'dodge', target: tgt.id, t });
    return;
  }

  const { dmg, isCrit } = computeHit(src, tgt, moveId, rng);
  applyHitEffects(src, tgt, dmg, isCrit, moveId, bus, t);
}

// ---------------------------------------------------------------------------
// stepFight — fixed-step ATB tick (poc/builder.html simStep logic)
// ATB fill: f.atb += DT * f.speed * ATB_FILL_SCALE * (1 + haste) * speedMult(f)
// Regen: accumulated per-second (builder poc line 931-939)
// ---------------------------------------------------------------------------
export function stepFight(s: FightState, rng: Rng, bus: EventBus): void {
  if (s.phase === 'done') return;
  s.t += DT;

  for (const f of s.fighters) {
    if (!f.alive) continue;

    // --- regen (builder poc line 931-939) ---
    if (f.stats.regenPerSec > 0 && f.hp > 0 && f.hp < f.stats.maxHP) {
      f.regenAcc += DT;
      if (f.regenAcc >= 1) {
        f.regenAcc -= 1;
        const heal = Math.round(f.stats.regenPerSec);
        f.hp = Math.min(f.stats.maxHP, f.hp + heal);
        bus.emit({ type: 'heal', target: f.id, amount: heal, t: s.t });
      }
    }

    // --- status ticks (burn etc.) ---
    tickStatuses(f, DT, bus, s.t);

    // --- check burn/tick KO ---
    if (f.hp <= 0) {
      f.alive = false;
      bus.emit({ type: 'ko', target: f.id, t: s.t });
    }
  }

  // --- ATB fill + action (builder poc line 960-966) ---
  for (const f of s.fighters) {
    // phase may have become 'done' above (tick KO); cast avoids TS narrowing false-alarm
    if (!f.alive || (s.phase as string) === 'done') continue;
    // atbMul = (1 + haste) * speedMult (slow multiplier)
    const atbMul = (1 + (f.stats.haste ?? 0)) * speedMult(f);
    f.atb += f.stats.speed * ATB_FILL_SCALE * atbMul * DT;

    if (f.atb >= 1) {
      f.atb -= 1;
      // 1v1 assumption: the only other fighter is always the target
      const tgt = s.fighters.find((o) => o !== f)!;
      if (tgt.alive) {
        const mv = pickMove(f, rng);
        bus.emit({ type: 'move-start', actor: f.id, move: mv, t: s.t });
        resolveMove(f, tgt, mv, rng, bus, s.t);
        // check KO after move
        if (tgt.hp <= 0 && tgt.alive) {
          tgt.alive = false;
          bus.emit({ type: 'ko', target: tgt.id, t: s.t });
        }
        // check if attacker died from thorns
        if (f.hp <= 0 && f.alive) {
          f.alive = false;
          bus.emit({ type: 'ko', target: f.id, t: s.t });
        }
      }
    }
  }

  const dead = s.fighters.find((f) => !f.alive);
  if (dead) {
    s.phase = 'done';
    s.winner = s.fighters.find((f) => f.alive)?.id ?? null;
  }
}

export function runToEnd(
  s: FightState,
  rng: Rng,
  bus: EventBus,
  opts: { maxSteps: number },
): FightState {
  for (let i = 0; i < opts.maxSteps && s.phase === 'fight'; i++) stepFight(s, rng, bus);
  return s;
}
