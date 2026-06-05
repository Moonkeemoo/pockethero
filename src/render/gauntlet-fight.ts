// src/render/gauntlet-fight.ts
// Verbatim TypeScript port of poc/gauntlet.html <script>.
// Self-contained: own Mulberry32 RNG, own sim, own Canvas2D render.
// Does NOT use the Slice-1 engine (src/sim). That is intentional.
// startCampaignBattle() is booted from app/main.ts.
"use strict";

import { CUBES } from '../index';
import { MOVES as PROD_MOVES } from '../index';
import { deriveStats as prodDeriveStats, deriveMoveset as prodDeriveMoveset } from '../index';
import type { Build } from '../index';
import type { SaveState, RewardEvent } from '../game/meta';
import { addKillReward } from '../game/meta';
import { genEnemy, stageCount, stageTier, stageReward } from '../game/campaign';

/* ============================================================================
   TYPES
   ========================================================================== */
interface SchoolDef { name: string; glyph: string; col: string; col2: string; light: string }
// The production Move type (imported via PROD_MOVES) has school/magicSchool instead of type/school.
// We alias it locally for brevity.
type MoveDef = (typeof PROD_MOVES)[string];
interface StatusDef {
  uk: string; glyph: string; col: string; dur: number; tick: number; dmg: number;
  atbMul?: number; dmgTakenMul?: number;
}
interface BuildPixel { gx: number; gy: number; type: string }
interface DerivedStats {
  maxHP: number; armor: number; atk: number; speed: number;
  dodge: number; crit: number; acc: number; magic: number;
  // extra production fields used in the gauntlet sim
  pierce: number; lifesteal: number; thorns: number; berserk: number;
  magResist: number; haste: number; regenPerSec: number; blockChance: number;
  counts: { vital: number; plate: number; force: number; swift: number; focus: number; catalyst: number; elements: number };
}
interface RosterEntry {
  id: string; name: string; arch: string;
  build: BuildPixel[]; scale: number; accent: string; side: -1 | 1;
  boss?: boolean;
}
interface StatusInstance { key: string; dur: number; tickT: number }
interface SpringPixel { gx: number; gy: number; t: string; ox: number; oy: number; vx: number; vy: number }
interface Fighter {
  id: string; name: string; arch: string; accent: string;
  side: -1 | 1; face: 1 | -1; scale: number; boss: boolean;
  homeX: number;
  build: BuildPixel[]; stats: DerivedStats; moveset: string[];
  maxHP: number; hp: number; armor: number;
  speed: number; atb: number;
  statuses: StatusInstance[];
  moveCursor: number;
  px: SpringPixel[];
  advance: number; knock: number; knockV: number;
  hpShown: number; hpChip: number; chipDelay: number;
  flash: number; charge: number; chargeSchool: string | null; squash: number; alive: boolean;
}
interface Actor { f: Fighter; tgt: Fighter; move: MoveDef; t: number; stage: 'windup' | 'release' | 'recover'; fired: boolean }
interface Projectile {
  move: MoveDef; f: Fighter; tgt: Fighter;
  sx: number; sy: number; ex: number; ey: number;
  t: number; dur: number; arc: number; school?: string;
  bolt: BoltShape | null;
}
interface BoltPoint { x: number; y: number }
interface BoltShape { main: BoltPoint[]; forks: BoltPoint[][] }
interface Bolt { bolt: BoltShape; t: number; life: number }
interface Debris { x: number; y: number; vx: number; vy: number; c: string; life: number; sz: number }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; col: string; sz: number; grav?: number; drag?: number }
interface Dust { x: number; y: number; z: number; sp: number; ph: number }
interface Floater { x: number; y: number; t: number; life: number; text: string; col: string; big: boolean; vy: number; pop: number }
interface SlashFX { x: number; y: number; dir: number; t: number; life: number }
interface Delayed { t: number; fn: () => void }
interface LogEntry { text: string; col: string }

/* ============================================================================
   MODULE-LEVEL STOP — lets startCampaignBattle tear down a previous instance
   ========================================================================== */
let _prevStop: (() => void) | null = null;

/* ============================================================================
   CAMPAIGN RESULT TYPE
   ========================================================================== */
export interface CampaignResult {
  outcome: 'levelCleared' | 'defeated';
  stagesWon: number;
  rewards: RewardEvent[];
}

/* ============================================================================
   startCampaignBattle — gauntlet juice driven by campaign stages + rewards
   ========================================================================== */
export function startCampaignBattle(opts: {
  state: SaveState;
  onExit: (result: CampaignResult) => void;
}): () => void {

  // Teardown any previous run
  if (_prevStop) { _prevStop(); _prevStop = null; }

  /* --------------------------------------------------------------------------
     0. TUNABLE CONSTANTS (identical to startGauntlet)
     ------------------------------------------------------------------------ */
  const SEED_BASE2   = 1337;
  const PX2          = 13;
  const SPRING_K2    = 240;
  const SPRING_D2    = 15;
  const SHAKE_BASE2  = 9;
  const SHAKE_CRIT2  = 22;
  const HITSTOP_HIT2 = 0.055;
  const SLOWMO_CRIT2 = 0.30;
  const SLOWMO_KO2   = 0.22;
  const ZOOM_PUNCH2  = 0.14;
  const ZOOM_BREATH2 = 0.012;
  const ATB_GLOBAL2  = 1.0;
  const CARD_DUR2    = 2.5;
  const RESULT_DUR2  = 2.2;   // defeat banner — long enough to read + tap
  const WIN_POP_DUR2 = 1.15;  // §D.1 stage-win heartbeat — short & punchy
  const LEVELCLEAR_DUR2 = 3.0;// §D.2 level-complete ceremony — a beat to celebrate
  const BOSS_SCALE2  = 1.6;
  const BOSS_CADENCE2= 0.82;

  /* --------------------------------------------------------------------------
     1. SEEDED RNG — Mulberry32 (identical)
     ------------------------------------------------------------------------ */
  function mulberry32b(a: number): () => number {
    return function(): number {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let tb = Math.imul(a ^ (a >>> 15), 1 | a);
      tb = (tb + Math.imul(tb ^ (tb >>> 7), 61 | tb)) ^ tb;
      return ((tb ^ (tb >>> 14)) >>> 0) / 4294967296;
    };
  }
  let rng2: () => number = mulberry32b(SEED_BASE2);
  const rnd2   = (): number => rng2();
  const rRange2 = (a: number, b: number): number => a + (b - a) * rng2();
  const rPick2  = <T>(arr: T[]): T => arr[(rng2() * arr.length) | 0]!;

  /* --------------------------------------------------------------------------
     2. COLOR helper
     ------------------------------------------------------------------------ */
  function colorOfType2(type: string): string { return CUBES[type]?.col ?? '#888'; }

  /* --------------------------------------------------------------------------
     3. MOVESET / SCHOOL / STATUS (identical tables)
     ------------------------------------------------------------------------ */
  const SCHOOL2: Record<string, SchoolDef> = {
    fire:   { name:'Вогонь',    glyph:'🔥', col:'#ff7a2a', col2:'#ffd24a', light:'#ff5a1e' },
    frost:  { name:'Лід',       glyph:'❄',  col:'#5ad6ff', col2:'#bff0ff', light:'#3aa6ff' },
    spark:  { name:'Блискавка', glyph:'⚡',  col:'#c79bff', col2:'#ffffff', light:'#9b6bff' },
    poison: { name:'Отрута',    glyph:'☣',  col:'#7bd64a', col2:'#d4f7a0', light:'#5ac830' },
    arcane: { name:'Аркана',    glyph:'✦',  col:'#c060ff', col2:'#f0c0ff', light:'#9930ee' },
  };
  const MOVES2 = PROD_MOVES;
  const STATUS_DEF2: Record<string, StatusDef> = {
    burn:   { uk:'Підпал',       glyph:'🔥', col:'#ff7a2a', dur:4.2, tick:1.0, dmg:6 },
    slow:   { uk:'Сповільнення', glyph:'❄',  col:'#5ad6ff', dur:5.0, tick:0,   dmg:0, atbMul:0.45 },
    shock:  { uk:'Шок',          glyph:'⚡',  col:'#c79bff', dur:3.0, tick:0,   dmg:0, dmgTakenMul:1.5 },
    poison: { uk:'Отруєння',     glyph:'☣',  col:'#7bd64a', dur:5.0, tick:1.0, dmg:5 },
  };

  /* --------------------------------------------------------------------------
     4. BUILD → CAPABILITIES
     ------------------------------------------------------------------------ */
  function deriveStats2(build: BuildPixel[]): DerivedStats {
    const s = prodDeriveStats(build as Build);
    return {
      maxHP: s.maxHP, armor: s.armor, atk: s.atk, speed: s.speed,
      dodge: s.dodge, crit: s.crit, acc: s.acc, magic: s.magic,
      pierce: s.pierce, lifesteal: s.lifesteal, thorns: s.thorns, berserk: s.berserk,
      magResist: s.magResist, haste: s.haste, regenPerSec: s.regenPerSec,
      blockChance: s.blockChance, counts: s.counts,
    };
  }
  function deriveMoveset2(build: BuildPixel[]): string[] {
    return prodDeriveMoveset(build as Build);
  }
  function effectivePower2(f: Fighter, move: MoveDef): number {
    if (move.school === 'magic') return move.power + f.stats.magic;
    return move.power + f.stats.atk - 6;
  }

  /* --------------------------------------------------------------------------
     5. CANVAS
     ------------------------------------------------------------------------ */
  const cv2 = document.createElement('canvas');
  cv2.style.cssText = 'display:block;width:100%;height:100%;image-rendering:pixelated;position:fixed;inset:0;z-index:10;touch-action:none;';
  document.body.style.cssText = 'margin:0;height:100%;background:#070a0f;overflow:hidden;font-family:"Segoe UI",system-ui,sans-serif;color:#cfd6e0';
  document.body.appendChild(cv2);
  const ctx2 = cv2.getContext('2d')!;
  let W2 = 0, H2 = 0, ground2 = 0;
  function resize2(): void {
    W2 = innerWidth; H2 = innerHeight;
    cv2.width = W2; cv2.height = H2;
    cv2.style.width = W2 + 'px'; cv2.style.height = H2 + 'px';
    ground2 = H2 * 0.70;
  }
  window.addEventListener('resize', resize2); resize2();

  /* --------------------------------------------------------------------------
     6. FIGHTER FACTORY
     ------------------------------------------------------------------------ */
  function makeFighter2(entry: RosterEntry): Fighter {
    const stats = deriveStats2(entry.build);
    const moveset = deriveMoveset2(entry.build);
    const side = entry.side;
    const scale = entry.scale;
    return {
      id: entry.id, name: entry.name, arch: entry.arch, accent: entry.accent,
      side, face: side < 0 ? 1 : -1, scale, boss: !!entry.boss,
      homeX: side < 0 ? W2 * 0.30 : W2 * 0.70,
      build: entry.build, stats, moveset,
      maxHP: stats.maxHP, hp: stats.maxHP, armor: stats.armor,
      speed: stats.speed * (entry.boss ? BOSS_CADENCE2 : 1) * (side < 0 ? 1.06 : 1.0),
      atb: side < 0 ? 0.10 : 0.0,
      statuses: [],
      moveCursor: (side < 0 ? 0 : 1),
      px: entry.build.map(p => ({ gx: p.gx, gy: p.gy, t: p.type, ox: 0, oy: 0, vx: 0, vy: 0 })),
      advance: 0, knock: 0, knockV: 0,
      hpShown: stats.maxHP, hpChip: stats.maxHP, chipDelay: 0,
      flash: 0, charge: 0, chargeSchool: null, squash: 0, alive: true,
    };
  }

  let hero2: Fighter;
  let enemy2: Fighter;
  let fighters2: Fighter[];

  const events2: Record<string, unknown>[] = [];
  function emit2(e: Record<string, unknown>): void { events2.push(e); }

  let phase2: 'card' | 'fight' | 'result' = 'card';
  let winner2: Fighter | null = null;
  const actors2: Actor[] = [];
  const projectiles2: Projectile[] = [];

  /* --------------------------------------------------------------------------
     SIM FUNCTIONS
     ------------------------------------------------------------------------ */
  function pickMove2(f: Fighter): MoveDef {
    const ms = f.moveset;
    const pool: string[] = [];
    for (let i = 0; i < ms.length; i++) {
      const k = ms[i]!;
      const m = MOVES2[k];
      if (!m) continue;
      let w = m.weight;
      if (i === f.moveCursor % ms.length) w *= 3.0;
      for (let j = 0; j < w * 10; j++) pool.push(k);
    }
    f.moveCursor++;
    return MOVES2[rPick2(pool)]!;
  }

  function startAction2(f: Fighter): void {
    const tgt = (f === hero2) ? enemy2 : hero2;
    const move = pickMove2(f);
    actors2.push({ f, tgt, move, t: 0, stage: 'windup', fired: false });
    f.squash = (move.school === 'magic' || move.kind === 'sword') ? 1 : 0.5;
    if (move.school === 'magic') { f.charge = 0.0001; f.chargeSchool = move.magicSchool ?? null; }
    emit2({ kind: 'telegraph', source: f, move });
  }

  function applyDamage2(tgt: Fighter, dmg: number): void {
    tgt.hp = Math.max(0, tgt.hp - dmg);
    tgt.chipDelay = 0.45;
    tgt.flash = 1;
  }

  function applyStatus2(tgt: Fighter, key: string): void {
    const def = STATUS_DEF2[key];
    if (!def) return;
    const existing = tgt.statuses.find(s => s.key === key);
    if (existing) { existing.dur = def.dur; }
    else tgt.statuses.push({ key, dur: def.dur, tickT: def.tick });
  }

  function killFighter2(tgt: Fighter, by: Fighter): void {
    tgt.alive = false; tgt.hp = 0;
    winner2 = by;
    triggerSlowmo2(SLOWMO_KO2, 1.1);
    shake2 = SHAKE_CRIT2 * 1.3;
    const sc = depthScale2(tgt) * tgt.scale;
    const cxk = creatureScreenX2(tgt), cyk = ground2 - 3.2 * PX2 * tgt.scale;
    for (const p of tgt.px) {
      debris2.push({ x: cxk + p.gx * PX2 * sc, y: cyk + p.gy * PX2 * sc,
        vx: (rnd2() - .5) * 520, vy: -(180 + rnd2() * 420),
        c: colorOfType2(p.t), life: 1.4 + rnd2() * 0.8, sz: PX2 * tgt.scale });
    }
    emit2({ kind: 'ko', winner: by, loser: tgt });
    startResult2();
  }

  function resolveHit2(f: Fighter, tgt: Fighter, move: MoveDef): void {
    const slowed = tgt.statuses.some(s => s.key === 'slow');
    const dodge = Math.max(0.02, tgt.stats.dodge - (slowed ? 0.07 : 0));
    const hitChance = 0.92 - dodge + f.stats.acc;
    const isHit = rnd2() < hitChance;
    if (!isHit) {
      emit2({ kind: 'resolve', move, source: f, target: tgt, hit: false, dodge: true, crit: false, damage: 0 });
      return;
    }
    const isCrit = rnd2() < (f.stats.crit + (move.critBonus || 0));
    let dmg = effectivePower2(f, move) + Math.floor(rRange2(-2, 3));
    if (move.school === 'phys') {
      dmg = Math.max(1, dmg - tgt.armor * (1 - (f.stats.pierce ?? 0)));
    } else {
      dmg = Math.max(1, dmg * (1 - (tgt.stats.magResist ?? 0)));
    }
    if (isCrit) dmg = Math.round(dmg * 1.8);
    if (f.stats.berserk && f.stats.berserk > 0) {
      const hpFrac = f.hp / f.maxHP;
      if (hpFrac < 0.5) dmg += f.stats.berserk * (1 - hpFrac * 2);
    }
    const shock = tgt.statuses.find(s => s.key === 'shock');
    let shockAmp = false;
    if (shock) {
      dmg = Math.round(dmg * STATUS_DEF2['shock']!.dmgTakenMul!);
      shockAmp = true;
      tgt.statuses.splice(tgt.statuses.indexOf(shock), 1);
    }
    dmg = Math.round(dmg);
    applyDamage2(tgt, dmg);
    if (f.stats.lifesteal && f.stats.lifesteal > 0) {
      const heal = Math.round(dmg * f.stats.lifesteal);
      if (heal > 0) { f.hp = Math.min(f.maxHP, f.hp + heal); f.hpShown = Math.min(f.maxHP, f.hpShown + heal); }
    }
    if (tgt.stats.thorns && tgt.stats.thorns > 0) {
      const reflect = Math.max(1, Math.round(dmg * tgt.stats.thorns));
      f.hp = Math.max(0, f.hp - reflect); f.chipDelay = 0.3;
      if (f.hp <= 0 && f.alive) { killFighter2(f, tgt); return; }
    }
    let appliedStatus: string | null = null;
    if (move.status) { applyStatus2(tgt, move.status); appliedStatus = move.status; }
    emit2({ kind: 'resolve', move, source: f, target: tgt, hit: true, dodge: false,
      crit: isCrit, damage: dmg, status: appliedStatus, shockAmp });
    if (tgt.hp <= 0 && tgt.alive) { killFighter2(tgt, f); }
  }

  const delayed2: Delayed[] = [];
  function setTimeout22(sec: number, fn: () => void): void { delayed2.push({ t: sec, fn }); }
  function stepDelayed2(dt: number): void {
    for (let i = delayed2.length - 1; i >= 0; i--) {
      const d = delayed2[i]!; d.t -= dt; if (d.t <= 0) { d.fn(); delayed2.splice(i, 1); }
    }
  }

  function creatureScreenX2(f: Fighter): number { return f.homeX + f.face * f.advance + f.knock; }
  function depthScale2(f: Fighter): number {
    const back = Math.max(0, f.knock * f.face);
    return 1 - Math.min(0.20, back * 0.0017);
  }

  function makeBolt2(sx: number, sy: number, ex: number, ey: number): BoltShape {
    const segs = 9;
    const main: BoltPoint[] = [];
    for (let i = 0; i <= segs; i++) {
      const u = i / segs;
      const x2 = sx + (ex - sx) * u;
      const y2 = sy + (ey - sy) * u + (i > 0 && i < segs ? (rnd2() - 0.5) * 36 : 0);
      main.push({ x: x2, y: y2 });
    }
    const forks2: BoltPoint[][] = [];
    for (let k = 0; k < 2; k++) {
      const i = 2 + ((rnd2() * (segs - 3)) | 0);
      const o = main[i]!;
      forks2.push([{ x: o.x, y: o.y },
                   { x: o.x + (rnd2() - 0.5) * 40, y: o.y + (rnd2() - 0.5) * 46 },
                   { x: o.x + (rnd2() - 0.5) * 70, y: o.y + (rnd2() - 0.5) * 70 }]);
    }
    return { main, forks: forks2 };
  }

  function spawnProjectile2(f: Fighter, tgt: Fighter, move: MoveDef): void {
    const sx = creatureScreenX2(f) + f.face * 22 * f.scale;
    const sy = ground2 - 3.0 * PX2 * f.scale;
    const ex = creatureScreenX2(tgt);
    const ey = ground2 - 3.0 * PX2 * tgt.scale;
    const dist = Math.abs(ex - sx);
    let speed = 760;
    if (move.kind === 'bow') speed = 1300;
    else if (move.kind === 'spark') speed = 1700;
    else if (move.kind === 'arc') speed = 1400;
    else if (move.kind === 'venom') speed = 680;
    const dur = Math.max(0.04, dist / speed);
    let projArc = 60;
    if (move.kind === 'bow') projArc = 90;
    else if (move.kind === 'spark') projArc = 0;
    else if (move.kind === 'arc') projArc = 30;
    else if (move.kind === 'venom') projArc = 80;
    projectiles2.push({ move, f, tgt, sx, sy, ex, ey, t: 0, dur, arc: projArc,
      school: move.magicSchool, bolt: move.kind === 'spark' ? makeBolt2(sx, sy, ex, ey) : null });
    if (move.magicSchool) emit2({ kind: 'cast', source: f, school: move.magicSchool });
  }

  function stepProjectiles2(dt: number): void {
    for (let i = projectiles2.length - 1; i >= 0; i--) {
      const p = projectiles2[i]!; p.t += dt;
      if (p.t / p.dur >= 1) {
        resolveHit2(p.f, p.tgt, p.move);
        projectileImpactFX2(p);
        projectiles2.splice(i, 1);
      }
    }
  }

  function releaseMove2(a: Actor): void {
    const { f, tgt, move } = a;
    for (const p of f.px) { p.vx += f.face * 120; }
    if (move.ranged) {
      spawnProjectile2(f, tgt, move);
    } else {
      resolveHit2(f, tgt, move);
      if (move.double && rnd2() < 0.85) {
        setTimeout22(0.12, () => { if (tgt.alive && phase2 === 'fight') resolveHit2(f, tgt, move); });
      }
      meleeImpactFX2(f, tgt, move);
    }
  }

  function stepActors2(dt: number): void {
    for (let i = actors2.length - 1; i >= 0; i--) {
      const a = actors2[i]!; a.t += dt; const m = a.move;
      if (a.stage === 'windup') {
        a.f.charge = (m.school === 'magic') ? Math.min(1, a.t / m.windUp) : 0;
        if (a.t >= m.windUp) { a.stage = 'release'; a.t = 0; a.f.charge = 0; releaseMove2(a); }
      } else if (a.stage === 'release') {
        if (a.t >= 0.06) { a.stage = 'recover'; a.t = 0; }
      } else {
        if (a.t >= m.recover) { actors2.splice(i, 1); }
      }
    }
  }

  function simStep2(dt: number): void {
    for (const f of fighters2) {
      if (!f.alive) continue;
      if (f.stats.regenPerSec && f.stats.regenPerSec > 0 && f.hp > 0 && f.hp < f.maxHP) {
        f.hp = Math.min(f.maxHP, f.hp + f.stats.regenPerSec * dt);
      }
      for (let i = f.statuses.length - 1; i >= 0; i--) {
        const s = f.statuses[i]!; const def = STATUS_DEF2[s.key]!;
        s.dur -= dt;
        if (def.tick > 0) {
          s.tickT -= dt;
          if (s.tickT <= 0 && f.hp > 0) {
            s.tickT += def.tick;
            f.hp = Math.max(0, f.hp - def.dmg); f.chipDelay = 0.4; f.flash = 0.6;
            emit2({ kind: 'statusTick', target: f, status: s.key, damage: def.dmg });
            if (f.hp <= 0 && f.alive) { killFighter2(f, (f === hero2 ? enemy2 : hero2)); }
          }
        }
        if (s.dur <= 0) f.statuses.splice(i, 1);
      }
      if (!f.alive) continue;
      let atbMul = 1;
      for (const s of f.statuses) { const d = STATUS_DEF2[s.key]!; if (d?.atbMul) atbMul *= d.atbMul; }
      const hasteMul = 1 + (f.stats.haste ?? 0);
      const busy = actors2.some(a => a.f === f);
      if (!busy) {
        f.atb += dt * f.speed * 0.55 * ATB_GLOBAL2 * atbMul * hasteMul;
        if (f.atb >= 1) { f.atb = 0; startAction2(f); }
      }
    }
    stepActors2(dt);
    stepProjectiles2(dt);
  }

  /* --------------------------------------------------------------------------
     RENDER OBJECTS
     ------------------------------------------------------------------------ */
  let t2 = 0;
  let shake2 = 0, hitstop2 = 0;
  const debris2: Debris[]    = [];
  const particles2: Particle[] = [];
  const dust2: Dust[]        = [];
  const floaters2: Floater[] = [];
  const slashFX2: SlashFX[]  = [];
  const bolts2: Bolt[]       = [];
  let lightFlash2 = 0, lightCol2 = '#fff';

  for (let i = 0; i < 46; i++) {
    dust2.push({ x: rnd2() * innerWidth, y: rnd2() * innerHeight * 0.85,
      z: 0.3 + rnd2() * 0.7, sp: 6 + rnd2() * 16, ph: rnd2() * 7 });
  }

  /* --------------------------------------------------------------------------
     VISUAL HELPERS
     ------------------------------------------------------------------------ */
  function spark22(x: number, y: number, n: number, col: string, spd: number): void {
    for (let i = 0; i < n; i++) {
      const a = rnd2() * 6.283;
      particles2.push({ x, y, vx: Math.cos(a) * spd * (0.4 + rnd2()), vy: Math.sin(a) * spd * (0.4 + rnd2()) - 40,
        life: 0.3 + rnd2() * 0.35, col, sz: 2 + rnd2() * 3, grav: 300, drag: 0.02 });
    }
  }
  function burst2(x: number, y: number, n: number, cols: string[], spd: number, grav: number, sz: number): void {
    for (let i = 0; i < n; i++) {
      const a = rnd2() * 6.283, s = spd * (0.3 + rnd2());
      particles2.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20,
        life: 0.4 + rnd2() * 0.6, col: rPick2(cols), sz: sz * (0.6 + rnd2()), grav, drag: 0.05 });
    }
  }

  function meleeImpactFX2(f: Fighter, tgt: Fighter, move: MoveDef): void {
    const ix = creatureScreenX2(tgt) - f.face * 18, iy = ground2 - 3.0 * PX2 * tgt.scale;
    if (move.kind === 'fist') { spark22(ix, iy, 6, '#ffffff', 180); }
    else if (move.kind === 'sword') {
      slashFX2.push({ x: ix, y: iy, dir: f.face, t: 0, life: 0.22 });
      spark22(ix, iy, 10, '#dfe7ff', 260);
    }
  }

  function projectileImpactFX2(p: Projectile): void {
    const ix = p.ex, iy = p.ey;
    if (p.move.kind === 'bow') {
      spark22(ix, iy, 9, '#e8d9a0', 240);
      burst2(ix, iy, 6, ['#caa15a', '#8a6a30'], 120, 400, 3);
    } else if (p.school === 'fire') {
      burst2(ix, iy, 26, ['#ff7a2a', '#ffd24a', '#ff3b1e', '#9a2a10'], 340, 200, 4);
      lightFlash2 = 0.9; lightCol2 = SCHOOL2['fire']!.light; shake2 = Math.max(shake2, SHAKE_CRIT2);
      triggerZoom2(0.10);
    } else if (p.school === 'frost') {
      burst2(ix, iy, 24, ['#5ad6ff', '#bff0ff', '#3aa6ff', '#dffaff'], 280, 120, 4);
      for (let i = 0; i < 8; i++) {
        const a = -1.2 - rnd2() * 0.7;
        particles2.push({ x: ix, y: iy, vx: Math.cos(a) * (120 + rnd2() * 120) * (rnd2() < .5 ? -1 : 1),
          vy: Math.sin(a) * (180 + rnd2() * 160), life: 0.5 + rnd2() * 0.4, col: '#bff0ff', sz: 2 + rnd2() * 2, grav: 500, drag: 0.05 });
      }
      lightFlash2 = 0.8; lightCol2 = SCHOOL2['frost']!.light;
    } else if (p.school === 'spark') {
      bolts2.push({ bolt: p.bolt!, t: 0, life: 0.22 });
      burst2(ix, iy, 22, ['#c79bff', '#ffffff', '#9b6bff', '#e6d6ff'], 300, 40, 3);
      for (let i = 0; i < 10; i++) {
        const a = rnd2() * 6.283;
        particles2.push({ x: ix, y: iy, vx: Math.cos(a) * (160 + rnd2() * 200), vy: Math.sin(a) * (160 + rnd2() * 200) - 30,
          life: 0.25 + rnd2() * 0.25, col: '#ffffff', sz: 1 + rnd2() * 2, grav: 0, drag: 0.01 });
      }
      lightFlash2 = 1.0; lightCol2 = SCHOOL2['spark']!.light; shake2 = Math.max(shake2, SHAKE_CRIT2 * 0.8);
      triggerZoom2(0.12);
    } else if (p.school === 'poison') {
      burst2(ix, iy, 24, ['#7bd64a', '#d4f7a0', '#4aaa1e', '#56d364'], 260, 180, 4);
      for (let i = 0; i < 6; i++) {
        const a = rnd2() * 6.283;
        particles2.push({ x: ix, y: iy, vx: Math.cos(a) * (80 + rnd2() * 100), vy: Math.sin(a) * (80 + rnd2() * 120) - 20,
          life: 0.6 + rnd2() * 0.4, col: '#7bd64a', sz: 3 + rnd2() * 3, grav: 300, drag: 0.06 });
      }
      lightFlash2 = 0.65; lightCol2 = SCHOOL2['poison']!.light; shake2 = Math.max(shake2, SHAKE_BASE2 * 1.2);
    } else if (p.school === 'arcane') {
      burst2(ix, iy, 28, ['#c060ff', '#f0c0ff', '#9930ee', '#ffffff'], 360, 60, 4);
      for (let i = 0; i < 12; i++) {
        const a = rnd2() * 6.283;
        particles2.push({ x: ix, y: iy, vx: Math.cos(a) * (180 + rnd2() * 220), vy: Math.sin(a) * (180 + rnd2() * 220) - 30,
          life: 0.3 + rnd2() * 0.3, col: rnd2() < 0.5 ? '#f0c0ff' : '#ffffff', sz: 1 + rnd2() * 2, grav: 0, drag: 0.01 });
      }
      lightFlash2 = 1.0; lightCol2 = SCHOOL2['arcane']!.light; shake2 = Math.max(shake2, SHAKE_CRIT2 * 0.9);
      triggerZoom2(0.13);
    }
  }

  /* --------------------------------------------------------------------------
     LOG + FLOATERS
     ------------------------------------------------------------------------ */
  const log2: LogEntry[] = [];
  function pushLog2(text: string, col?: string): void {
    log2.push({ text, col: col || '#dfe6f0' }); if (log2.length > 9) log2.shift();
  }
  function addFloater2(f: Fighter, text: string, col: string, big: boolean): void {
    floaters2.push({ x: creatureScreenX2(f), y: ground2 - 3.6 * PX2 * f.scale - 18, t: 0,
      life: big ? 1.3 : 0.95, text, col, big: !!big, vy: big ? 20 : 34, pop: big ? 1 : 0.4 });
  }

  function consumeEvents2(): void {
    while (events2.length) {
      const e = events2.shift()!;
      if (e['kind'] === 'cast') {
        const school = e['school'] as string;
        const sc = SCHOOL2[school];
        if (sc) {
          lightFlash2 = Math.max(lightFlash2, 0.5); lightCol2 = sc.light;
          const source = e['source'] as Fighter;
          const x2 = creatureScreenX2(source), y2 = ground2 - 3.0 * PX2 * source.scale;
          burst2(x2, y2, 10, [sc.col, sc.col2], 90, -20, 3);
        }
      } else if (e['kind'] === 'resolve') {
        const s = e['source'] as Fighter, tg = e['target'] as Fighter, m = e['move'] as MoveDef;
        if (e['dodge']) {
          addFloater2(tg, rnd2() < 0.5 ? 'УХИЛ' : 'ПРОМАХ', '#9aa6b4', false);
          pushLog2(`${tg.name} ${rnd2() < 0.5 ? 'ухилився' : 'уник удару'}`, '#9aa6b4');
          spark22(creatureScreenX2(tg), ground2 - 3 * PX2 * tg.scale, 4, '#7e8a99', 90);
        } else {
          const dmg = e['damage'] as number;
          const isCrit = e['crit'] as boolean;
          const shockAmp = e['shockAmp'] as boolean;
          if (isCrit) {
            addFloater2(tg, dmg + '', '#ffe24a', true);
            triggerSlowmo2(SLOWMO_CRIT2, 0.55); triggerZoom2(ZOOM_PUNCH2);
            shake2 = Math.max(shake2, SHAKE_CRIT2); hitstop2 = Math.max(hitstop2, HITSTOP_HIT2 * 2.2);
          } else {
            addFloater2(tg, dmg + '', shockAmp ? '#e6d6ff' : '#ffffff', false);
            shake2 = Math.max(shake2, SHAKE_BASE2 * Math.min(2, dmg / 14));
            hitstop2 = Math.max(hitstop2, HITSTOP_HIT2 * Math.min(2.2, 0.7 + dmg / 26));
          }
          let line = `${s.name} ${m.label}`;
          const magSchool = m.magicSchool;
          const sc2b = magSchool ? SCHOOL2[magSchool] : undefined;
          if (magSchool && sc2b) line += ` [${sc2b.name}]`;
          line += ` — ${dmg}`;
          if (isCrit) line += ' (КРИТ!)';
          if (shockAmp) line += ' ⚡(Шок!)';
          if (e['status']) line += `, накладено ${STATUS_DEF2[e['status'] as string]?.uk ?? e['status']}`;
          pushLog2(line, isCrit ? '#ffe24a' : (magSchool && sc2b ? sc2b.col : '#dfe6f0'));
          const dir2 = Math.sign(tg.homeX - s.homeX) || 1;
          tg.knockV += dir2 * (isCrit ? 620 : 380) / Math.max(0.7, tg.scale * 0.7);
          for (const p of tg.px) { p.vx += dir2 * (180 + dmg * 6) + (rnd2() - .5) * 120; p.vy += (rnd2() - .7) * 150; }
          if (dmg > 14) {
            const sc3b = depthScale2(tg) * tg.scale;
            const cxd = creatureScreenX2(tg), cyd = ground2 - 2 * PX2 * tg.scale;
            for (let i = 0; i < 3; i++) {
              const pk = rPick2(tg.px);
              debris2.push({ x: cxd + pk.gx * PX2 * sc3b, y: cyd + pk.gy * PX2 * sc3b,
                vx: dir2 * (120 + rnd2() * 180), vy: -(120 + rnd2() * 220),
                c: colorOfType2(pk.t), life: 0.8 + rnd2() * 0.4, sz: PX2 * tg.scale * 0.8 });
            }
          }
        }
      } else if (e['kind'] === 'statusTick') {
        const target = e['target'] as Fighter;
        const status = e['status'] as string;
        const dmg = e['damage'] as number;
        const def = STATUS_DEF2[status]!;
        addFloater2(target, dmg + '', def.col, false);
        let tickMsg = `${target.name} `;
        if (status === 'burn') tickMsg += 'горить';
        else if (status === 'poison') tickMsg += 'отруєний';
        else tickMsg += 'страждає';
        tickMsg += ` — ${dmg}`;
        pushLog2(tickMsg, def.col);
        const xt = creatureScreenX2(target), yt = ground2 - 2.4 * PX2 * target.scale;
        if (status === 'burn') burst2(xt, yt, 8, ['#ff7a2a', '#ffd24a'], 80, -160, 3);
        if (status === 'poison') burst2(xt, yt, 7, ['#7bd64a', '#d4f7a0', '#4aaa1e'], 70, -100, 3);
      } else if (e['kind'] === 'ko') {
        const w2 = e['winner'] as Fighter;
        pushLog2(`K.O. — ${w2.name} переміг!`, '#ffd24a');
        lightFlash2 = 1; lightCol2 = '#fff';
      }
    }
  }

  /* --------------------------------------------------------------------------
     CAMERA / JUICE
     ------------------------------------------------------------------------ */
  let timeScale2 = 1, slowmoT2 = 0, slowmoTarget2 = 1;
  let zoom2 = 1, zoomPunch2 = 0;
  function triggerSlowmo2(scale: number, dur: number): void { slowmoTarget2 = scale; slowmoT2 = dur; }
  function triggerZoom2(amount: number): void { zoomPunch2 = Math.max(zoomPunch2, amount); }

  function cameraStep2(rdt: number): void {
    if (slowmoT2 > 0) { slowmoT2 -= rdt; timeScale2 += (slowmoTarget2 - timeScale2) * Math.min(1, 10 * rdt); }
    else timeScale2 += (1 - timeScale2) * Math.min(1, 6 * rdt);
    zoomPunch2 *= Math.pow(0.0009, rdt);
    const breathe = 1 + ZOOM_BREATH2 * Math.sin(t2 * 1.3);
    zoom2 += ((breathe + zoomPunch2) - zoom2) * Math.min(1, 8 * rdt);
  }

  /* --------------------------------------------------------------------------
     PHYSICS
     ------------------------------------------------------------------------ */
  function physStep2(dt: number): void {
    for (const f of fighters2) {
      for (const p of f.px) {
        const ax = -SPRING_K2 * p.ox - SPRING_D2 * p.vx;
        const ay = -SPRING_K2 * p.oy - SPRING_D2 * p.vy;
        p.vx += ax * dt; p.vy += ay * dt; p.ox += p.vx * dt; p.oy += p.vy * dt;
      }
      const ka = -34 * f.knock - 7.5 * f.knockV;
      f.knockV += ka * dt; f.knock += f.knockV * dt;
      const a2 = actors2.find(x => x.f === f);
      let want = 0;
      if (a2) {
        if (a2.stage === 'windup') want = -0.12;
        else if (a2.stage === 'release' && !a2.move.ranged) want = 1.0;
        else if (a2.stage === 'release') want = 0.15;
      }
      const other2 = (f === hero2 ? enemy2 : hero2);
      const reach2 = (Math.abs(other2.homeX - f.homeX) - 3.6 * PX2);
      f.advance += (want * reach2 - f.advance) * Math.min(1, 11 * dt);
      f.flash  = Math.max(0, f.flash  - dt * 7);
      f.squash = Math.max(0, f.squash - dt * 5);
      f.hpShown += (f.hp - f.hpShown) * Math.min(1, 9 * dt);
      if (f.chipDelay > 0) f.chipDelay -= dt;
      else f.hpChip += (f.hp - f.hpChip) * Math.min(1, 4 * dt);
    }
    for (let i = debris2.length - 1; i >= 0; i--) {
      const d = debris2[i]!;
      d.vy += 980 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.life -= dt;
      if (d.y > ground2) { d.y = ground2; d.vy *= -0.35; d.vx *= 0.6; }
      if (d.life <= 0) debris2.splice(i, 1);
    }
    for (let i = particles2.length - 1; i >= 0; i--) {
      const p = particles2[i]!;
      p.vy += (p.grav || 0) * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      p.vx *= Math.pow(p.drag || 0.02, dt); p.vy *= Math.pow(p.drag || 0.02, dt);
      if (p.life <= 0) particles2.splice(i, 1);
    }
    for (const d2 of dust2) { d2.x += d2.sp * dt * 0.4; d2.y -= d2.sp * dt * 0.12; if (d2.x > W2 + 5) d2.x = -5; if (d2.y < -5) d2.y = H2 * 0.85; }
    for (let i = floaters2.length - 1; i >= 0; i--) {
      const fl = floaters2[i]!;
      fl.t += dt; fl.y -= (fl.vy || 32) * dt; fl.vy = (fl.vy || 32) * Math.pow(0.05, dt);
      fl.pop = Math.max(0, (fl.pop || 0) - dt * 5);
      if (fl.t > fl.life) floaters2.splice(i, 1);
    }
    for (let i = bolts2.length - 1; i >= 0; i--) {
      bolts2[i]!.t += dt; if (bolts2[i]!.t >= bolts2[i]!.life) bolts2.splice(i, 1);
    }
    shake2 *= Math.pow(0.0001, dt);
    lightFlash2 = Math.max(0, lightFlash2 - dt * 3.2);
  }

  /* --------------------------------------------------------------------------
     DRAW ROUTINES (identical visual to startGauntlet)
     ------------------------------------------------------------------------ */
  function drawArena2(): void {
    const g = ctx2.createLinearGradient(0, 0, 0, H2);
    g.addColorStop(0, '#141b27'); g.addColorStop(.55, '#10161f'); g.addColorStop(1, '#080b11');
    ctx2.fillStyle = g; ctx2.fillRect(0, 0, W2, H2);
    const hg = ctx2.createRadialGradient(W2 * 0.5, ground2, 10, W2 * 0.5, ground2, W2 * 0.7);
    hg.addColorStop(0, 'rgba(60,90,140,0.18)'); hg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx2.fillStyle = hg; ctx2.fillRect(0, 0, W2, H2);
    ctx2.strokeStyle = 'rgba(120,150,190,0.10)'; ctx2.lineWidth = 2;
    ctx2.beginPath(); ctx2.moveTo(0, ground2); ctx2.lineTo(W2, ground2); ctx2.stroke();
    ctx2.fillStyle = '#161d2a';
    ctx2.beginPath();
    ctx2.moveTo(W2 * 0.5 - 60, ground2); ctx2.lineTo(W2 * 0.5 + 60, ground2);
    ctx2.lineTo(W2, H2); ctx2.lineTo(0, H2); ctx2.closePath(); ctx2.fill();
    for (let i = 1; i < 8; i++) {
      const u = i / 8, y = ground2 + (H2 - ground2) * u * u;
      ctx2.strokeStyle = `rgba(70,100,150,${0.22 * (1 - u)})`; ctx2.lineWidth = 1;
      ctx2.beginPath(); ctx2.moveTo(0, y); ctx2.lineTo(W2, y); ctx2.stroke();
    }
    const vp = W2 * 0.5;
    for (let i = -6; i <= 6; i++) {
      if (i === 0) continue;
      const topX = vp + i * 16, botX = vp + i * (W2 * 0.5 / 3);
      ctx2.strokeStyle = 'rgba(70,100,150,0.10)'; ctx2.lineWidth = 1;
      ctx2.beginPath(); ctx2.moveTo(topX, ground2); ctx2.lineTo(botX, H2); ctx2.stroke();
    }
    for (const d of dust2) {
      ctx2.globalAlpha = 0.10 + 0.18 * d.z;
      ctx2.fillStyle = '#bcd0ee';
      const s = 1 + d.z * 2; ctx2.fillRect(d.x, d.y, s, s);
    }
    ctx2.globalAlpha = 1;
  }

  function drawShadow2(f: Fighter): void {
    const s = depthScale2(f) * f.scale, sx = creatureScreenX2(f);
    ctx2.fillStyle = 'rgba(0,0,0,0.38)';
    ctx2.beginPath(); ctx2.ellipse(sx, ground2 + 3, 36 * s, 9 * s, 0, 0, 7); ctx2.fill();
  }

  function drawCreaturePixels2(f: Fighter, sx: number, baseY: number, scaleMul: number, breathPhase: number): void {
    const s = depthScale2(f) * f.scale * scaleMul;
    const breath = 1 + 0.03 * Math.sin(t2 * 2.6 + breathPhase);
    const sq = 1 - f.squash * 0.18, st = 1 + f.squash * 0.14;
    if (f.charge > 0 && f.chargeSchool) {
      const sc = SCHOOL2[f.chargeSchool];
      if (sc) {
        const r = (14 + f.charge * 22) * f.scale;
        const gg = ctx2.createRadialGradient(sx, baseY - 3 * PX2 * s, 2, sx, baseY - 3 * PX2 * s, r);
        gg.addColorStop(0, sc.col2); gg.addColorStop(0.5, sc.col); gg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx2.globalAlpha = 0.6 * f.charge; ctx2.fillStyle = gg;
        ctx2.beginPath(); ctx2.arc(sx, baseY - 3 * PX2 * s, r, 0, 7); ctx2.fill(); ctx2.globalAlpha = 1;
      }
    }
    for (const p of f.px) {
      const x2 = sx + (p.gx * PX2 * sq + p.ox) * s;
      const y2 = baseY - (3.2 * PX2 * s) + ((p.gy * PX2) * breath * st + p.oy) * s;
      const w2 = PX2 * s + 0.6;
      ctx2.fillStyle = f.flash > 0.15 ? '#ffffff' : colorOfType2(p.t);
      ctx2.fillRect(x2 - w2 / 2, y2 - w2 / 2, w2, w2);
      ctx2.fillStyle = 'rgba(255,255,255,0.10)';
      ctx2.fillRect(x2 - w2 / 2, y2 - w2 / 2, w2, Math.max(1, w2 * 0.18));
    }
    if (f.statuses.some(st2b => st2b.key === 'slow')) {
      ctx2.globalAlpha = 0.18; ctx2.fillStyle = '#5ad6ff';
      ctx2.fillRect(sx - 30 * s, baseY - 3.4 * PX2 * s - 6, 60 * s, 4.2 * PX2 * s + 6); ctx2.globalAlpha = 1;
    }
    if (f.statuses.some(st2b => st2b.key === 'shock')) {
      ctx2.globalAlpha = 0.13 + 0.1 * Math.abs(Math.sin(t2 * 22)); ctx2.fillStyle = '#c79bff';
      ctx2.fillRect(sx - 30 * s, baseY - 3.4 * PX2 * s - 6, 60 * s, 4.2 * PX2 * s + 6); ctx2.globalAlpha = 1;
    }
    if (f.statuses.some(st2b => st2b.key === 'poison')) {
      ctx2.globalAlpha = 0.13 + 0.10 * Math.abs(Math.sin(t2 * 8)); ctx2.fillStyle = '#7bd64a';
      ctx2.fillRect(sx - 30 * s, baseY - 3.4 * PX2 * s - 6, 60 * s, 4.2 * PX2 * s + 6); ctx2.globalAlpha = 1;
      if (rnd2() < 0.12) particles2.push({
        x: sx + (rnd2() - .5) * 30 * s, y: baseY - (1 + rnd2() * 2.5) * PX2 * s,
        vx: (rnd2() - .5) * 18, vy: -(14 + rnd2() * 20),
        life: 0.5 + rnd2() * 0.5, col: '#7bd64a', sz: 2 + rnd2() * 2, grav: -30, drag: 0.2,
      });
    }
  }

  function drawCreature2(f: Fighter): void {
    if (!f.alive) return;
    const sx = creatureScreenX2(f);
    const lift2 = (1 - depthScale2(f)) * 120;
    const baseY = ground2 - lift2;
    drawCreaturePixels2(f, sx, baseY, 1, (f.face > 0 ? 1.5 : 0));
  }

  function drawProjectiles2(): void {
    for (const p of projectiles2) {
      if (p.move.kind === 'spark') continue;
      const u = p.t / p.dur;
      const x2 = p.sx + (p.ex - p.sx) * u;
      const y2 = p.sy + (p.ey - p.sy) * u - Math.sin(u * Math.PI) * p.arc;
      const ang = Math.atan2((p.ey - p.sy) - Math.cos(u * Math.PI) * p.arc * Math.PI, (p.ex - p.sx));
      ctx2.save(); ctx2.translate(x2, y2); ctx2.rotate(ang);
      if (p.move.kind === 'bow') {
        ctx2.strokeStyle = 'rgba(230,210,150,0.4)'; ctx2.lineWidth = 2;
        ctx2.beginPath(); ctx2.moveTo(-26, 0); ctx2.lineTo(0, 0); ctx2.stroke();
        ctx2.strokeStyle = '#caa15a'; ctx2.lineWidth = 2.5;
        ctx2.beginPath(); ctx2.moveTo(-14, 0); ctx2.lineTo(8, 0); ctx2.stroke();
        ctx2.fillStyle = '#e8d9a0'; ctx2.beginPath();
        ctx2.moveTo(8, 0); ctx2.lineTo(2, -3); ctx2.lineTo(2, 3); ctx2.closePath(); ctx2.fill();
        ctx2.strokeStyle = '#caa15a'; ctx2.beginPath(); ctx2.moveTo(-14, 0); ctx2.lineTo(-18, -3);
        ctx2.moveTo(-14, 0); ctx2.lineTo(-18, 3); ctx2.stroke();
      } else {
        const school2 = p.school!;
        const sc = SCHOOL2[school2]!;
        const gg = ctx2.createRadialGradient(0, 0, 1, 0, 0, 16);
        gg.addColorStop(0, sc.col2); gg.addColorStop(0.5, sc.col); gg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx2.fillStyle = gg; ctx2.beginPath(); ctx2.arc(0, 0, 16, 0, 7); ctx2.fill();
        ctx2.fillStyle = sc.col2; ctx2.beginPath(); ctx2.arc(0, 0, 4, 0, 7); ctx2.fill();
        if (rnd2() < 0.8) particles2.push({ x: x2, y: y2, vx: (rnd2() - .5) * 40, vy: (rnd2() - .5) * 40,
          life: 0.3, col: sc.col, sz: 2 + rnd2() * 2,
          grav: school2 === 'fire' ? -120 : (school2 === 'poison' ? -60 : 60), drag: 0.1 });
        ctx2.restore();
        ctx2.font = '12px system-ui'; ctx2.textAlign = 'center'; ctx2.textBaseline = 'middle';
        ctx2.fillStyle = '#fff'; ctx2.fillText(sc.glyph, x2, y2);
        continue;
      }
      ctx2.restore();
    }
  }

  function strokePath2(pts: BoltPoint[]): void {
    ctx2.beginPath(); ctx2.moveTo(pts[0]!.x, pts[0]!.y);
    for (let i = 1; i < pts.length; i++) ctx2.lineTo(pts[i]!.x, pts[i]!.y);
    ctx2.stroke();
  }
  function drawBolts2(): void {
    for (const b of bolts2) {
      const a = 1 - b.t / b.life;
      const flick = 0.6 + 0.4 * Math.abs(Math.sin(b.t * 60));
      ctx2.globalAlpha = a * flick;
      ctx2.strokeStyle = 'rgba(199,155,255,0.5)'; ctx2.lineWidth = 7; ctx2.lineJoin = 'round';
      strokePath2(b.bolt.main);
      for (const fk of b.bolt.forks) strokePath2(fk);
      ctx2.strokeStyle = '#ffffff'; ctx2.lineWidth = 2.4;
      strokePath2(b.bolt.main);
      ctx2.strokeStyle = '#e6d6ff'; ctx2.lineWidth = 1.4;
      for (const fk of b.bolt.forks) strokePath2(fk);
      ctx2.globalAlpha = 1;
    }
  }
  function drawSlashFX2(rdt: number): void {
    for (let i = slashFX2.length - 1; i >= 0; i--) {
      const sFx = slashFX2[i]!; sFx.t += rdt;
      const u = sFx.t / sFx.life; if (u >= 1) { slashFX2.splice(i, 1); continue; }
      ctx2.save(); ctx2.translate(sFx.x, sFx.y);
      ctx2.globalAlpha = (1 - u) * 0.95; ctx2.strokeStyle = '#eaf0ff'; ctx2.lineWidth = 6 - u * 4;
      ctx2.beginPath();
      const a0 = (-1.1) * sFx.dir, a1 = (1.1) * sFx.dir;
      ctx2.arc(0, 0, 30, a0 + u * 0.6, a1 + u * 0.6, sFx.dir < 0); ctx2.stroke();
      ctx2.globalAlpha = (1 - u) * 0.6; ctx2.strokeStyle = '#9fb6e0'; ctx2.lineWidth = 2;
      ctx2.beginPath(); ctx2.arc(0, 0, 30, a0 + u * 0.6, a1 + u * 0.6, sFx.dir < 0); ctx2.stroke();
      ctx2.restore(); ctx2.globalAlpha = 1;
    }
  }
  function drawParticles2(): void {
    for (const p of particles2) {
      ctx2.globalAlpha = Math.min(1, p.life * 3);
      ctx2.fillStyle = p.col;
      ctx2.fillRect(p.x - p.sz / 2, p.y - p.sz / 2, p.sz, p.sz);
    }
    ctx2.globalAlpha = 1;
    for (const d of debris2) {
      ctx2.globalAlpha = Math.min(1, d.life * 2); ctx2.fillStyle = d.c;
      const sz2 = d.sz || PX2 * 0.8; ctx2.fillRect(d.x - sz2 / 2, d.y - sz2 / 2, sz2, sz2);
    }
    ctx2.globalAlpha = 1;
  }

  let camX2 = 0, camY2 = 0;
  function lift2_(f: Fighter): number { return (1 - depthScale2(f)) * 120; }

  function drawHPBar2(f: Fighter): void {
    const sx = creatureScreenX2(f) * zoom2 + (1 - zoom2) * W2 / 2 + camX2;
    const top = (ground2 - lift2_(f) - 3.4 * PX2 * f.scale - 46) * zoom2 + (1 - zoom2) * H2 / 2 + camY2;
    const bw = 120 * (f.boss ? 1.25 : 1), bh = 11, x = sx - bw / 2, y = top;
    ctx2.font = 'bold 13px system-ui'; ctx2.textAlign = 'left'; ctx2.textBaseline = 'alphabetic';
    ctx2.fillStyle = f.accent; ctx2.fillText(f.name, x, y - 6);
    ctx2.fillStyle = 'rgba(0,0,0,0.55)'; ctx2.fillRect(x - 2, y - 2, bw + 4, bh + 4);
    ctx2.fillStyle = 'rgba(255,255,255,0.6)';
    ctx2.fillRect(x, y, bw * Math.max(0, f.hpChip) / f.maxHP, bh);
    const frac = Math.max(0, f.hpShown) / f.maxHP;
    const col = frac > 0.5 ? '#56d364' : frac > 0.25 ? '#e3b341' : '#e5534b';
    ctx2.fillStyle = col; ctx2.fillRect(x, y, bw * frac, bh);
    ctx2.font = '9px system-ui'; ctx2.fillStyle = '#0a0d12';
    ctx2.fillText(Math.ceil(Math.max(0, f.hpShown)) + '', x + 4, y + 9);
    let ix = x;
    for (const st of f.statuses) {
      const def = STATUS_DEF2[st.key];
      if (!def) continue;
      const k = Math.max(0.2, st.dur / def.dur);
      ctx2.fillStyle = def.col; ctx2.globalAlpha = 0.85;
      const sz2 = 14 * k + 4;
      ctx2.fillRect(ix, y + bh + 3, sz2, sz2);
      ctx2.globalAlpha = 1; ctx2.font = (sz2 * 0.8 | 0) + 'px system-ui'; ctx2.fillStyle = '#fff';
      ctx2.textAlign = 'center'; ctx2.fillText(def.glyph, ix + sz2 / 2, y + bh + 3 + sz2 * 0.78);
      ctx2.textAlign = 'left';
      ix += 22;
    }
  }
  function drawATB2(): void {
    for (const f of fighters2) {
      if (!f.alive) continue;
      const sx = creatureScreenX2(f) * zoom2 + (1 - zoom2) * W2 / 2 + camX2;
      const top = (ground2 - lift2_(f) - 3.4 * PX2 * f.scale - 46) * zoom2 + (1 - zoom2) * H2 / 2 + camY2;
      const bw = 120 * (f.boss ? 1.25 : 1), x = sx - bw / 2, y = top + 16;
      ctx2.fillStyle = 'rgba(0,0,0,0.4)'; ctx2.fillRect(x, y, bw, 4);
      ctx2.fillStyle = '#7fc8ff'; ctx2.fillRect(x, y, bw * f.atb, 4);
    }
  }
  function drawFloaters2(): void {
    ctx2.textAlign = 'center'; ctx2.textBaseline = 'middle';
    for (const fl of floaters2) {
      const a = Math.min(1, (fl.life - fl.t) * 3);
      const x2 = fl.x * zoom2 + (1 - zoom2) * W2 / 2 + camX2;
      const y2 = fl.y * zoom2 + (1 - zoom2) * H2 / 2 + camY2;
      const pop = 1 + fl.pop * 0.8;
      const size = (fl.big ? 30 : 18) * pop;
      ctx2.globalAlpha = a;
      ctx2.font = `bold ${size}px system-ui`;
      ctx2.lineWidth = 3; ctx2.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx2.strokeText(fl.text, x2, y2);
      ctx2.fillStyle = fl.col; ctx2.fillText(fl.text, x2, y2);
    }
    ctx2.globalAlpha = 1; ctx2.textAlign = 'left'; ctx2.textBaseline = 'alphabetic';
  }
  function drawLog2(): void {
    const maxLogW = Math.min(340, W2 * 0.48);
    const w = maxLogW, x = W2 - w - 14, lh = 18;
    const maxEntries = W2 < 480 ? 4 : 9;
    const shown = log2.slice(Math.max(0, log2.length - maxEntries));
    const ns = shown.length;
    const y0s = H2 - 14 - ns * lh;
    ctx2.fillStyle = 'rgba(8,12,20,0.55)';
    ctx2.fillRect(x - 8, y0s - 22, w + 8, ns * lh + 28);
    ctx2.fillStyle = 'rgba(160,180,210,0.5)';
    ctx2.font = 'bold 11px system-ui'; ctx2.textAlign = 'left';
    ctx2.fillText('БОЙОВИЙ ЛОГ', x, y0s - 8);
    ctx2.font = W2 < 480 ? '11px system-ui' : '13px system-ui';
    ctx2.save();
    ctx2.beginPath(); ctx2.rect(x - 8, y0s - 22, w + 8, ns * lh + 28); ctx2.clip();
    for (let i = 0; i < ns; i++) {
      const e = shown[i]!; const fade = 0.4 + 0.6 * ((i + 1) / ns);
      ctx2.globalAlpha = fade; ctx2.fillStyle = e.col;
      let text = e.text;
      if (W2 < 480) {
        ctx2.font = '11px system-ui';
        while (text.length > 4 && ctx2.measureText(text).width > w - 4) text = text.slice(0, -2);
        if (text !== e.text) text = text.slice(0, -1) + '…';
      }
      ctx2.fillText(text, x, y0s + i * lh + 8);
    }
    ctx2.restore();
    ctx2.globalAlpha = 1;
  }
  function drawVignetteAndLight2(): void {
    if (lightFlash2 > 0) {
      ctx2.globalAlpha = lightFlash2 * 0.5;
      const g = ctx2.createRadialGradient(W2 / 2, ground2 - 100, 40, W2 / 2, H2 / 2, W2 * 0.7);
      g.addColorStop(0, lightCol2); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx2.fillStyle = g; ctx2.fillRect(0, 0, W2, H2); ctx2.globalAlpha = 1;
    }
    const v = ctx2.createRadialGradient(W2 / 2, H2 / 2, Math.min(W2, H2) * 0.35, W2 / 2, H2 / 2, Math.max(W2, H2) * 0.72);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx2.fillStyle = v; ctx2.fillRect(0, 0, W2, H2);
  }

  /* --------------------------------------------------------------------------
     CAMPAIGN SEQUENCER STATE
     ------------------------------------------------------------------------ */
  const { state } = opts;
  const campaignLevel = state.campaign.level;
  const totalStages = stageCount(campaignLevel);
  let currentStageIdx = state.campaign.stage; // 0-based, from checkpoint
  let stagesWon = 0;
  const rewards: RewardEvent[] = [];
  let sessionOver = false;
  let exitFired = false; // guard against double-exit (tap + auto-timer)

  // Card / result banner state
  let cardT2 = 0, resultT2 = 0;
  let resultText2 = '', resultWinnerColor2 = '#ffe24a';
  let stageHeroWon2 = false;

  /* --------------------------------------------------------------------------
     REWARD-POP CHOREOGRAPHY (§D.1 stage-win pop · §C loss tally · §D.3 level-up)
     A small homing-token system: on a stage win, coins + a cube fly from the
     dead enemy to the run-tally pills (top-right), which scale-bump on landing.
     ------------------------------------------------------------------------ */
  interface RewardToken { x: number; y: number; sx: number; sy: number; tx: number; ty: number; t: number; dur: number; col: string; kind: 'coin' | 'cube' }
  const rewardTokens2: RewardToken[] = [];
  let runCoins2 = 0;        // coins earned this run (display tally; lerps up as tokens land)
  let runCubes2 = 0;        // cubes earned this run
  let coinShare2 = 0;       // coins added per landing coin-token (so tally hits exact total)
  let coinPillBump2 = 0;    // scale-bump clock for the coin pill
  let cubePillBump2 = 0;    // scale-bump clock for the cube pill
  let winPopT2 = 0;         // "Етап пройдено!" scale-in clock
  let nodeTickT2 = 0;       // green ✓ tick-pop clock on the just-cleared node
  const levelUpPops2: Array<{ level: number; t: number; delay: number }> = []; // §D.3

  function coinPillPos2(): { x: number; y: number } { return { x: W2 - 16, y: 88 }; }
  function cubePillPos2(): { x: number; y: number } { return { x: W2 - 16, y: 110 }; }

  function spawnRewardSpray2(reward: { xp: number; coins: number; cube?: string }): void {
    winPopT2 = 0.0001;
    const ex = creatureScreenX2(enemy2);
    const ey = ground2 - 3 * PX2 * enemy2.scale;
    const nCoins = Math.max(4, Math.min(14, Math.round(reward.coins / 3)));
    coinShare2 = reward.coins / nCoins;
    const cp = coinPillPos2();
    for (let i = 0; i < nCoins; i++) {
      const jx = (rnd2() - 0.5) * 56, jy = (rnd2() - 0.5) * 40;
      rewardTokens2.push({
        x: ex + jx, y: ey + jy, sx: ex + jx, sy: ey + jy,
        tx: cp.x, ty: cp.y, t: -0.10 - i * 0.028, dur: 0.55, col: '#ffd24a', kind: 'coin',
      });
    }
    if (reward.cube) {
      const ct = cubePillPos2();
      rewardTokens2.push({
        x: ex, y: ey, sx: ex, sy: ey, tx: ct.x, ty: ct.y,
        t: -0.20, dur: 0.62, col: CUBES[reward.cube]?.col ?? '#9fd0ff', kind: 'cube',
      });
    }
  }

  function stepRewardOverlay2(dt: number): void {
    if (winPopT2 > 0) winPopT2 += dt;
    if (nodeTickT2 > 0) nodeTickT2 += dt;
    if (coinPillBump2 > 0) coinPillBump2 -= dt;
    if (cubePillBump2 > 0) cubePillBump2 -= dt;
    for (let i = rewardTokens2.length - 1; i >= 0; i--) {
      const tk = rewardTokens2[i]!;
      tk.t += dt;
      if (tk.t < 0) continue;
      const u = Math.min(1, tk.t / tk.dur);
      const e = u * u * (3 - 2 * u);                 // smoothstep ease
      tk.x = tk.sx + (tk.tx - tk.sx) * e;
      tk.y = tk.sy + (tk.ty - tk.sy) * e - Math.sin(u * Math.PI) * 46; // arc lift
      if (u >= 1) {
        if (tk.kind === 'coin') { runCoins2 += coinShare2; coinPillBump2 = 0.28; }
        else { runCubes2 += 1; cubePillBump2 = 0.32; }
        rewardTokens2.splice(i, 1);
      }
    }
    for (let i = levelUpPops2.length - 1; i >= 0; i--) {
      const p = levelUpPops2[i]!;
      if (p.delay > 0) { p.delay -= dt; continue; }
      p.t += dt;
      if (p.t > 1.6) levelUpPops2.splice(i, 1);
    }
  }

  function drawRewardOverlay2(): void {
    // Run-tally pills (top-right), with landing scale-bump
    if (runCoins2 > 0 || rewardTokens2.some(t => t.kind === 'coin')) {
      const cp = coinPillPos2();
      const cb = 1 + (coinPillBump2 > 0 ? 0.24 * (coinPillBump2 / 0.28) : 0);
      ctx2.save();
      ctx2.translate(cp.x, cp.y); ctx2.scale(cb, cb);
      ctx2.font = 'bold 14px system-ui'; ctx2.textAlign = 'right'; ctx2.textBaseline = 'middle';
      ctx2.fillStyle = '#ffe070';
      ctx2.fillText(`⬡ ${Math.round(runCoins2)}`, 0, 0);
      ctx2.restore();
    }
    if (runCubes2 > 0 || rewardTokens2.some(t => t.kind === 'cube')) {
      const bp = cubePillPos2();
      const bb = 1 + (cubePillBump2 > 0 ? 0.24 * (cubePillBump2 / 0.32) : 0);
      ctx2.save();
      ctx2.translate(bp.x, bp.y); ctx2.scale(bb, bb);
      ctx2.font = 'bold 13px system-ui'; ctx2.textAlign = 'right'; ctx2.textBaseline = 'middle';
      ctx2.fillStyle = '#bfe0ff';
      ctx2.fillText(`◼ ${runCubes2}`, 0, 0);
      ctx2.restore();
    }
    // Flying tokens
    for (const tk of rewardTokens2) {
      if (tk.t < 0) continue;
      ctx2.save();
      ctx2.globalAlpha = 0.96;
      if (tk.kind === 'coin') {
        ctx2.fillStyle = tk.col;
        ctx2.beginPath(); ctx2.arc(tk.x, tk.y, 4, 0, Math.PI * 2); ctx2.fill();
        ctx2.fillStyle = 'rgba(255,255,255,0.55)';
        ctx2.beginPath(); ctx2.arc(tk.x - 1.2, tk.y - 1.2, 1.4, 0, Math.PI * 2); ctx2.fill();
      } else {
        ctx2.fillStyle = tk.col;
        ctx2.fillRect(tk.x - 5, tk.y - 5, 10, 10);
        ctx2.fillStyle = 'rgba(255,255,255,0.32)';
        ctx2.fillRect(tk.x - 5, tk.y - 5, 10, 3);
      }
      ctx2.restore();
    }
    // Level-up badges (§D.3) — centred, stacked, staggered
    let shown = 0;
    for (const p of levelUpPops2) {
      if (p.delay > 0) continue;
      const u = Math.min(1, p.t / 0.22);
      const sc = 0.5 + 0.5 * (1 - Math.pow(1 - u, 3)) + (p.t > 0.9 ? 0 : 0);
      const fade = p.t > 1.2 ? Math.max(0, (1.6 - p.t) / 0.4) : 1;
      const yy = H2 * 0.30 + shown * 34;
      ctx2.save();
      ctx2.globalAlpha = fade;
      ctx2.translate(W2 / 2, yy); ctx2.scale(sc, sc);
      ctx2.textAlign = 'center'; ctx2.textBaseline = 'middle';
      ctx2.font = 'bold 22px system-ui'; ctx2.fillStyle = '#ffe24a';
      ctx2.shadowColor = 'rgba(0,0,0,0.6)'; ctx2.shadowBlur = 6;
      ctx2.fillText(`РІВЕНЬ ↑ ${p.level}`, 0, 0);
      ctx2.shadowBlur = 0;
      ctx2.font = 'bold 12px system-ui'; ctx2.fillStyle = '#bfe0ff';
      ctx2.fillText('+1 кубик у білдер', 0, 18);
      ctx2.restore();
      shown++;
    }
    ctx2.textAlign = 'left'; ctx2.textBaseline = 'alphabetic'; ctx2.globalAlpha = 1;
  }

  /* --------------------------------------------------------------------------
     STAGE BANNER (lighter than full VS card — shows tier + stage number)
     ------------------------------------------------------------------------ */
  function drawStageBanner2(): void {
    ctx2.fillStyle = 'rgba(6,9,15,0.82)'; ctx2.fillRect(0, 0, W2, H2);
    const headY = H2 * 0.13;
    ctx2.textAlign = 'center'; ctx2.textBaseline = 'alphabetic';
    const tier = stageTier(campaignLevel, currentStageIdx);
    const tierLabel = tier === 'boss' ? 'БОС' : tier === 'elite' ? 'ЕЛІТ' : 'МІНОР';
    const tierCol = tier === 'boss' ? '#ff6b6b' : tier === 'elite' ? '#e3b341' : '#7fd0ff';
    ctx2.fillStyle = '#9fb0c8'; ctx2.font = 'bold 18px system-ui';
    ctx2.fillText(`Рівень ${campaignLevel}`, W2 / 2, headY - 26);
    ctx2.fillStyle = '#ffe24a'; ctx2.font = 'bold 40px system-ui';
    ctx2.fillText(`Етап ${currentStageIdx + 1}/${totalStages}`, W2 / 2, headY + 16);
    ctx2.fillStyle = tierCol; ctx2.font = 'bold 26px system-ui';
    ctx2.fillText(tierLabel, W2 / 2, headY + 52);

    const leftX = W2 * 0.27, rightX = W2 * 0.73, cardBaseY = H2 * 0.62;
    const vsPulse = 1 + 0.08 * Math.sin(t2 * 4);
    ctx2.save();
    ctx2.translate(W2 / 2, H2 * 0.5); ctx2.scale(vsPulse, vsPulse);
    ctx2.fillStyle = '#fff'; ctx2.font = 'bold 72px system-ui'; ctx2.textAlign = 'center';
    ctx2.strokeStyle = 'rgba(0,0,0,0.6)'; ctx2.lineWidth = 6;
    ctx2.strokeText('VS', 0, 24); ctx2.fillText('VS', 0, 24);
    ctx2.restore();

    drawCardSide2(hero2, leftX, cardBaseY, +1 as 1);
    drawCardSide2(enemy2, rightX, cardBaseY, -1 as 1);

    ctx2.textAlign = 'left'; ctx2.textBaseline = 'alphabetic';
  }

  function drawCardSide2(f: Fighter, cx: number, baseY: number, faceDir: 1 | -1): void {
    const cardScale = f.boss ? 1.25 : 1.1;
    const savedFace = f.face; f.face = faceDir;
    drawCreaturePixels2(f, cx, baseY, cardScale, (faceDir > 0 ? 0 : 1.5));
    f.face = savedFace;
    ctx2.textAlign = 'center';
    ctx2.fillStyle = f.accent; ctx2.font = 'bold 26px system-ui';
    ctx2.fillText(f.name, cx, baseY + 44);
    ctx2.fillStyle = '#cfd6e0'; ctx2.font = '15px system-ui';
    ctx2.fillText(f.arch, cx, baseY + 66);
    const icons = f.moveset.map(k => MOVES2[k]?.icon ?? '?');
    ctx2.font = '26px system-ui';
    const gap = 40, totalW = (icons.length - 1) * gap;
    let ix = cx - totalW / 2;
    ctx2.fillStyle = 'rgba(255,255,255,0.06)';
    ctx2.fillRect(cx - totalW / 2 - 26, baseY + 78, totalW + 52, 36);
    for (const ic of icons) { ctx2.fillText(ic, ix, baseY + 104); ix += gap; }
    ctx2.font = '14px system-ui'; ctx2.fillStyle = '#aeb9c8';
    const phys = Math.round(f.stats.atk);
    const mag = Math.round(f.stats.magic);
    const dmgStr = mag > 0 ? `${phys} / ✦${mag}` : `${phys}`;
    ctx2.fillText(`HP ${f.maxHP}    Броня ${f.armor}    Шкода ${dmgStr}`, cx, baseY + 136);
  }

  // Loss-screen button rects (shared by draw + pointer handlers, §C)
  function lossBtnImprove2(): { x: number; y: number; w: number; h: number } {
    const w = Math.min(220, W2 * 0.6), h = 44; return { x: W2 / 2 - w / 2, y: H2 * 0.52, w, h };
  }
  function lossBtnRetry2(): { x: number; y: number; w: number; h: number } {
    const w = Math.min(150, W2 * 0.42), h = 34; return { x: W2 / 2 - w / 2, y: H2 * 0.52 + 54, w, h };
  }

  // Summarise this run's banked haul for the loss tally (§C)
  function runHaulLine2(): string {
    let xp = 0, coins = 0, cubes = 0;
    for (const ev of rewards) {
      if (ev.kind === 'xp') xp += ev.n;
      else if (ev.kind === 'coins') coins += ev.n;
      else if (ev.kind === 'cube') cubes += 1;
      else if (ev.kind === 'loot') cubes += ev.cubes.length;
    }
    const parts: string[] = [];
    if (xp > 0) parts.push(`+${xp} XP`);
    if (coins > 0) parts.push(`⬡ ${coins}`);
    if (cubes > 0) parts.push(`${cubes} кубик${cubes > 1 ? 'ів' : ''}`);
    return parts.length ? parts.join('   ·   ') : 'нічого — спробуй ще!';
  }

  function drawResultBanner2(): void {
    const isLast = currentStageIdx === totalStages - 1;

    // ---- §D.1 STAGE-WIN POP (minor/elite win) — short, fight stays visible ----
    if (stageHeroWon2 && !isLast) {
      ctx2.save();
      const pop = winPopT2 > 0 ? Math.min(1, winPopT2 / 0.18) : 0;
      const settle = winPopT2 > 0.18 ? Math.max(0, 1 - (winPopT2 - 0.18) * 3) : 0;
      const scale = 0.6 + 0.4 * (1 - Math.pow(1 - pop, 3)) + 0.08 * settle * Math.sin((winPopT2) * 26);
      const tier = stageTier(campaignLevel, currentStageIdx);
      const bandCol = tier === 'elite' ? 'rgba(120,90,20,0.42)' : 'rgba(30,70,120,0.40)';
      const txtCol  = tier === 'elite' ? '#ffd86a' : '#7fd0ff';
      ctx2.globalAlpha = Math.min(1, winPopT2 * 5) * 0.85;
      ctx2.fillStyle = bandCol; ctx2.fillRect(0, H2 * 0.40, W2, H2 * 0.10);
      ctx2.globalAlpha = Math.min(1, winPopT2 * 6);
      ctx2.save();
      ctx2.translate(W2 / 2, H2 * 0.45); ctx2.scale(scale, scale);
      ctx2.textAlign = 'center'; ctx2.textBaseline = 'middle';
      ctx2.font = 'bold 34px system-ui'; ctx2.fillStyle = txtCol;
      ctx2.shadowColor = 'rgba(0,0,0,0.55)'; ctx2.shadowBlur = 6;
      ctx2.fillText('Етап пройдено!', 0, 0);
      ctx2.shadowBlur = 0;
      ctx2.restore();
      ctx2.restore(); ctx2.textAlign = 'left'; ctx2.textBaseline = 'alphabetic';
      return;
    }

    // ---- §D.2 LEVEL-COMPLETE CEREMONY (boss cleared) ----
    if (stageHeroWon2 && isLast) {
      ctx2.save();
      const ct = LEVELCLEAR_DUR2 - resultT2; // seconds since ceremony start
      ctx2.globalAlpha = Math.min(1, ct * 2) * 0.6;
      ctx2.fillStyle = 'rgba(0,0,0,0.6)'; ctx2.fillRect(0, 0, W2, H2);
      ctx2.globalAlpha = 1;
      ctx2.textAlign = 'center'; ctx2.textBaseline = 'middle';
      // Title with scale-in + shimmer sweep
      const tp = Math.min(1, ct / 0.3);
      const tScale = 0.5 + 0.5 * (1 - Math.pow(1 - tp, 3));
      ctx2.save();
      ctx2.translate(W2 / 2, H2 * 0.34); ctx2.scale(tScale, tScale);
      ctx2.font = 'bold 46px system-ui';
      ctx2.fillStyle = '#ffd24a'; ctx2.shadowColor = 'rgba(255,180,40,0.5)'; ctx2.shadowBlur = 18;
      ctx2.fillText(`РІВЕНЬ ${campaignLevel} ПРОЙДЕНО`, 0, 0);
      ctx2.shadowBlur = 0;
      // shimmer sweep
      const sweepX = (-0.5 + (ct * 0.6) % 1.3) * 360;
      const grd = ctx2.createLinearGradient(sweepX - 40, 0, sweepX + 40, 0);
      grd.addColorStop(0, 'rgba(255,255,255,0)');
      grd.addColorStop(0.5, 'rgba(255,255,255,0.5)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      ctx2.globalCompositeOperation = 'overlay';
      ctx2.fillStyle = grd; ctx2.font = 'bold 46px system-ui';
      ctx2.fillText(`РІВЕНЬ ${campaignLevel} ПРОЙДЕНО`, 0, 0);
      ctx2.globalCompositeOperation = 'source-over';
      ctx2.restore();
      // Reward roll-up (count-up) after 0.5s — the boss reward (4× tier). It is
      // banked in handleStageEnd *after* this window, so read it directly here.
      if (ct > 0.5) {
        const rr = Math.min(1, (ct - 0.5) / 0.7);
        const br = stageReward(campaignLevel, currentStageIdx);
        const cubes = br.cube ? 1 : 0;
        ctx2.font = 'bold 22px system-ui'; ctx2.fillStyle = '#dfe7f4';
        ctx2.fillText(`Здобуто:  +${Math.round(br.xp * rr)} XP   ⬡ ${Math.round(br.coins * rr)}${cubes ? `   ${Math.round(cubes * rr)} куб.` : ''}`, W2 / 2, H2 * 0.47);
      }
      // Next-level preview after 1.2s
      if (ct > 1.2) {
        ctx2.globalAlpha = Math.min(1, (ct - 1.2) * 2);
        ctx2.font = 'bold 18px system-ui'; ctx2.fillStyle = '#8fd0ff';
        ctx2.fillText(`Далі: Рівень ${campaignLevel + 1} →`, W2 / 2, H2 * 0.56);
        ctx2.globalAlpha = 1;
      }
      ctx2.restore(); ctx2.textAlign = 'left'; ctx2.textBaseline = 'alphabetic';
      return;
    }

    // ---- §C DEFEAT — "almost, not over" ----
    ctx2.save();
    ctx2.globalAlpha = Math.min(1, (RESULT_DUR2 - resultT2 + 0.2) * 2) * 0.6;
    ctx2.fillStyle = 'rgba(0,0,0,0.6)'; ctx2.fillRect(0, 0, W2, H2);
    ctx2.globalAlpha = 1;
    ctx2.textAlign = 'center'; ctx2.textBaseline = 'middle';
    // Headline (factual, numbered)
    ctx2.font = 'bold 38px system-ui'; ctx2.fillStyle = '#ff8a6a';
    ctx2.fillText(`Поразка на Етапі ${currentStageIdx + 1}`, W2 / 2, H2 * 0.30);
    // Reframe: "Майже! Ти зібрав:" + run haul
    ctx2.font = 'bold 22px system-ui'; ctx2.fillStyle = '#ffe24a';
    ctx2.fillText('Майже! Ти зібрав:', W2 / 2, H2 * 0.385);
    ctx2.font = 'bold 19px system-ui'; ctx2.fillStyle = '#cfe0ff';
    ctx2.fillText(runHaulLine2(), W2 / 2, H2 * 0.435);
    // Checkpoint reassurance
    ctx2.font = '13px system-ui'; ctx2.fillStyle = '#90a4c0';
    ctx2.fillText(`Чекпоінт збережено · Етап ${currentStageIdx + 1}`, W2 / 2, H2 * 0.475);
    // Primary button: "Покращити героя →"
    const bi = lossBtnImprove2();
    const bg = ctx2.createLinearGradient(bi.x, bi.y, bi.x, bi.y + bi.h);
    bg.addColorStop(0, '#2f6bbf'); bg.addColorStop(1, '#1b3d72');
    ctx2.fillStyle = bg;
    ctx2.beginPath(); ctx2.roundRect(bi.x, bi.y, bi.w, bi.h, 10); ctx2.fill();
    ctx2.strokeStyle = '#7fb0ff'; ctx2.lineWidth = 1.5;
    ctx2.beginPath(); ctx2.roundRect(bi.x, bi.y, bi.w, bi.h, 10); ctx2.stroke();
    ctx2.font = 'bold 17px system-ui'; ctx2.fillStyle = '#eaf2ff';
    ctx2.fillText('Покращити героя →', W2 / 2, bi.y + bi.h / 2 + 1);
    // Secondary button: "Ще раз"
    const br = lossBtnRetry2();
    ctx2.fillStyle = 'rgba(28,36,54,0.85)';
    ctx2.beginPath(); ctx2.roundRect(br.x, br.y, br.w, br.h, 8); ctx2.fill();
    ctx2.strokeStyle = 'rgba(120,150,200,0.45)'; ctx2.lineWidth = 1.2;
    ctx2.beginPath(); ctx2.roundRect(br.x, br.y, br.w, br.h, 8); ctx2.stroke();
    ctx2.font = 'bold 14px system-ui'; ctx2.fillStyle = '#aac4e6';
    ctx2.fillText('↺ Ще раз', W2 / 2, br.y + br.h / 2 + 1);
    ctx2.restore(); ctx2.textAlign = 'left'; ctx2.textBaseline = 'alphabetic';
  }

  /* --------------------------------------------------------------------------
     STAGE PROGRESS BAR — Capybara-Go style row of stage nodes at screen top
     ------------------------------------------------------------------------ */
  function drawStageProgressBar2(): void {
    // Position: top of screen, below the HUD label (which is ~34px tall)
    const BAR_TOP = 40;
    const BAR_H   = 28; // total height of the bar strip
    const PAD_X   = 12; // horizontal margin
    const barW    = W2 - PAD_X * 2;

    // Background strip
    ctx2.fillStyle = 'rgba(6,10,18,0.72)';
    ctx2.fillRect(PAD_X - 4, BAR_TOP - 2, barW + 8, BAR_H + 4);

    // Progress track line
    const trackY  = BAR_TOP + BAR_H / 2;
    const trackX0 = PAD_X + 8;
    const trackX1 = PAD_X + barW - 8;
    const trackLen = trackX1 - trackX0;

    ctx2.strokeStyle = 'rgba(80,110,160,0.5)';
    ctx2.lineWidth   = 3;
    ctx2.beginPath(); ctx2.moveTo(trackX0, trackY); ctx2.lineTo(trackX1, trackY); ctx2.stroke();

    // Filled portion (stages already cleared this run + current)
    const clearedUpTo = currentStageIdx; // 0-based: stages 0..clearedUpTo-1 done, clearedUpTo is current
    if (clearedUpTo > 0) {
      const fillX1 = trackX0 + (clearedUpTo / (totalStages - 1)) * trackLen;
      ctx2.strokeStyle = '#4488cc';
      ctx2.lineWidth   = 3;
      ctx2.beginPath(); ctx2.moveTo(trackX0, trackY); ctx2.lineTo(Math.min(fillX1, trackX1), trackY); ctx2.stroke();
    }

    // Stage nodes — on narrow screens (<480px) only show milestones; wide screens get all 20 dots
    const useDotsAll = W2 >= 480;
    const nodeRadius = useDotsAll ? 5 : 6;

    for (let s = 0; s < totalStages; s++) {
      const tier = stageTier(campaignLevel, s);
      const nx   = trackX0 + (s / (totalStages - 1)) * trackLen;

      // Skip minor non-milestone nodes on narrow screens (show every 5th, elites, boss, current)
      const isMilestone = (s === 0) || (s % 5 === 0) || tier !== 'minor' || s === currentStageIdx;
      if (!useDotsAll && !isMilestone) continue;

      // During a stage-win result, the current node is "just cleared" — show it
      // filled with a popping ✓ even before currentStageIdx advances (§D.1).
      const justCleared = phase2 === 'result' && stageHeroWon2 && s === currentStageIdx;
      const cleared  = s < currentStageIdx || justCleared;
      const isCurrent = s === currentStageIdx && !justCleared;
      const isBoss   = tier === 'boss';    // stage 19
      const isElite  = tier === 'elite';   // stages 5, 10, 14

      // Pick colour / size
      let nodeCol: string;
      let r = nodeRadius;
      if (isBoss) {
        nodeCol = cleared ? '#cc4444' : isCurrent ? '#ff6b6b' : '#663333';
        r = useDotsAll ? 8 : 10;
      } else if (isElite) {
        nodeCol = cleared ? '#b8912a' : isCurrent ? '#e3b341' : '#5a4818';
        r = useDotsAll ? 7 : 9;
      } else {
        nodeCol = cleared ? '#2a6a9a' : isCurrent ? '#7fd0ff' : '#1a3550';
      }

      // Draw node
      if (isBoss) {
        // Diamond shape for boss
        const d = r + 2;
        ctx2.save();
        ctx2.translate(nx, trackY);
        ctx2.rotate(Math.PI / 4);
        ctx2.fillStyle = nodeCol;
        ctx2.fillRect(-d / 1.5, -d / 1.5, d * 1.33, d * 1.33);
        ctx2.restore();
        // Skull icon on top (small text)
        ctx2.font = `${r + 6}px system-ui`;
        ctx2.textAlign = 'center'; ctx2.textBaseline = 'middle';
        ctx2.fillStyle = '#fff';
        ctx2.fillText('💀', nx, trackY);
        ctx2.textBaseline = 'alphabetic';
      } else if (isElite) {
        // Diamond shape for elite
        const d = r + 2;
        ctx2.save();
        ctx2.translate(nx, trackY);
        ctx2.rotate(Math.PI / 4);
        ctx2.fillStyle = nodeCol;
        ctx2.fillRect(-d / 1.5, -d / 1.5, d * 1.33, d * 1.33);
        ctx2.restore();
      } else {
        // Circle for minor stages
        ctx2.fillStyle = nodeCol;
        ctx2.beginPath(); ctx2.arc(nx, trackY, r, 0, Math.PI * 2); ctx2.fill();
      }

      // Pulsing ring on current stage
      if (isCurrent) {
        const pulse = 0.5 + 0.5 * Math.sin(t2 * 6);
        ctx2.globalAlpha = 0.6 * pulse;
        ctx2.strokeStyle = isBoss ? '#ff6b6b' : isElite ? '#e3b341' : '#7fd0ff';
        ctx2.lineWidth = 2;
        ctx2.beginPath(); ctx2.arc(nx, trackY, r + 4, 0, Math.PI * 2); ctx2.stroke();
        ctx2.globalAlpha = 1;
      }

      // Checkmark on cleared nodes (only on wide screens, every 5th or special)
      if (cleared && (useDotsAll || isMilestone)) {
        // Just-cleared node pops its ✓ in from the node-tick clock
        const pop = justCleared && nodeTickT2 > 0 ? Math.min(1, nodeTickT2 / 0.22) : 1;
        const tickScale = 0.4 + 0.6 * (1 - Math.pow(1 - pop, 3));
        ctx2.save();
        ctx2.globalAlpha = 0.85;
        ctx2.translate(nx, trackY); ctx2.scale(tickScale, tickScale);
        ctx2.font = `${r * 1.5 | 0}px system-ui`;
        ctx2.textAlign = 'center'; ctx2.textBaseline = 'middle';
        ctx2.fillStyle = justCleared ? '#baffba' : '#a0e0a0';
        ctx2.fillText('✓', 0, 0);
        ctx2.restore();
        ctx2.textBaseline = 'alphabetic';
        ctx2.globalAlpha = 1;
      }
    }

    // Label: «Рівень L · Етап S/20»
    const labelTxt = `Рівень ${campaignLevel} · Етап ${currentStageIdx + 1}/${totalStages}`;
    ctx2.font = 'bold 11px system-ui';
    ctx2.textAlign = 'center'; ctx2.textBaseline = 'alphabetic';
    ctx2.fillStyle = 'rgba(180,200,230,0.75)';
    ctx2.fillText(labelTxt, W2 / 2, BAR_TOP - 4);
    ctx2.textAlign = 'left'; ctx2.textBaseline = 'alphabetic';
  }

  function drawHUD2(): void {
    const txt = `${hero2?.name ?? '?'} vs ${enemy2?.name ?? '?'}`;
    ctx2.textAlign = 'center'; ctx2.textBaseline = 'alphabetic';
    ctx2.font = 'bold 13px system-ui';
    const tw = ctx2.measureText(txt).width + 20;
    ctx2.fillStyle = 'rgba(8,12,20,0.6)'; ctx2.fillRect(W2 / 2 - tw / 2, 8, tw, 22);
    ctx2.fillStyle = '#cfe0ff'; ctx2.fillText(txt, W2 / 2, 24);
    ctx2.textAlign = 'left';
  }

  /* --------------------------------------------------------------------------
     STAGE LIFECYCLE
     ------------------------------------------------------------------------ */
  function reseedForCampaignStage(): void {
    // Seed from level + stage for deterministic RNG per attempt
    rng2 = mulberry32b(campaignLevel * 500 + currentStageIdx * 17 + 3);
  }

  function buildCampaignFighters(): void {
    // Hero from saved build
    const heroEntry: RosterEntry = {
      id: 'hero', name: 'Твій герой', arch: 'Герой',
      build: state.heroBuild as BuildPixel[],
      scale: 1.0, accent: '#add0ff', side: -1,
    };
    // Enemy from campaign generator
    const spec = genEnemy(campaignLevel, currentStageIdx);
    const enemyEntry: RosterEntry = {
      id: `enemy-${currentStageIdx}`,
      name: spec.name,
      arch: spec.name,
      build: spec.build as BuildPixel[],
      scale: spec.scale,
      accent: spec.boss ? '#ff6b6b' : spec.scale >= 1.15 ? '#e3b341' : '#e08a5a',
      side: +1 as 1,
      boss: spec.boss,
    };
    hero2 = makeFighter2(heroEntry);
    enemy2 = makeFighter2(enemyEntry);
    fighters2 = [hero2, enemy2];
  }

  function startCard2(): void {
    phase2 = 'card'; cardT2 = CARD_DUR2; winner2 = null;
    reseedForCampaignStage();
    buildCampaignFighters();
    actors2.length = 0; projectiles2.length = 0; delayed2.length = 0;
    particles2.length = 0; debris2.length = 0; floaters2.length = 0;
    bolts2.length = 0; slashFX2.length = 0;
    log2.length = 0;
    const tier = stageTier(campaignLevel, currentStageIdx);
    const tierLabel = tier === 'boss' ? 'БОС' : tier === 'elite' ? 'ЕЛІТ' : 'МІНОР';
    pushLog2(`— Рівень ${campaignLevel} · Етап ${currentStageIdx + 1}/${totalStages} [${tierLabel}] —`, '#9fb0c8');
    pushLog2(`${hero2.name} проти ${enemy2.name}`, '#9fb0c8');
  }

  function startFight2(): void {
    phase2 = 'fight';
    hero2.atb = 0.12; enemy2.atb = 0.0;
  }

  function startResult2(): void {
    phase2 = 'result';
    stageHeroWon2 = winner2 === hero2;
    resultText2 = stageHeroWon2 ? `${hero2.name} переміг!` : `${enemy2.name} переміг!`;
    resultWinnerColor2 = stageHeroWon2 ? '#7fd0ff' : enemy2.accent;
    const isLast = currentStageIdx === totalStages - 1;
    if (stageHeroWon2 && !isLast) {
      // §D.1 stage-win heartbeat — short window, coin/cube spray + node tick
      resultT2 = WIN_POP_DUR2;
      hitstop2 = Math.max(hitstop2, 0.08);
      spawnRewardSpray2(stageReward(campaignLevel, currentStageIdx));
      nodeTickT2 = 0.0001;
    } else if (stageHeroWon2 && isLast) {
      // §D.2 boss cleared → level-complete ceremony (longer beat)
      resultT2 = LEVELCLEAR_DUR2;
      spawnRewardSpray2(stageReward(campaignLevel, currentStageIdx));
    } else {
      // Defeat — full banner, time to read + tap
      resultT2 = RESULT_DUR2;
    }
  }

  function handleStageEnd(): void {
    if (sessionOver) return;
    if (stageHeroWon2) {
      // Grant reward, mutate state
      const reward = stageReward(campaignLevel, currentStageIdx);
      const { events: rewardEvents } = addKillReward(state, reward);
      rewards.push(...rewardEvents);
      stagesWon++;
      state.campaign.stage = currentStageIdx + 1;

      // §D.3 — queue a level-up pop per levelUp event (staggered)
      let luDelay = 0.15;
      for (const ev of rewardEvents) {
        if (ev.kind === 'levelUp') { levelUpPops2.push({ level: ev.level, t: 0, delay: luDelay }); luDelay += 0.28; }
      }

      if (currentStageIdx === totalStages - 1) {
        // BOSS cleared → level complete. Ceremony already played during the
        // result window; exit shortly after (player may tap to skip).
        state.campaign.level = campaignLevel + 1;
        state.campaign.stage = 0;
        sessionOver = true;
        setTimeout2c(0.3, () => {
          if (exitFired) return; exitFired = true;
          stop2();
          opts.onExit({ outcome: 'levelCleared', stagesWon, rewards });
        });
      } else {
        // Advance to next stage
        currentStageIdx++;
        startCard2();
      }
    } else {
      // Hero defeated — checkpoint stays at current stage. No auto-exit: the
      // "almost, not over" banner waits for the player to pick a path (§C).
      sessionOver = true;
    }
  }

  // §C — retry the current stage in place (checkpoint kept, banked rewards kept)
  function retryStage2(): void {
    sessionOver = false; exitFired = false;
    rewardTokens2.length = 0; levelUpPops2.length = 0;
    winPopT2 = 0; nodeTickT2 = 0;
    startCard2();
  }

  const delayed2c: Delayed[] = [];
  function setTimeout2c(sec: number, fn: () => void): void { delayed2c.push({ t: sec, fn }); }
  function stepDelayed2c(dt: number): void {
    for (let i = delayed2c.length - 1; i >= 0; i--) {
      const d = delayed2c[i]!; d.t -= dt; if (d.t <= 0) { d.fn(); delayed2c.splice(i, 1); }
    }
  }

  /* --------------------------------------------------------------------------
     POINTER HANDLER — loss-screen buttons (Покращити героя / Ще раз) + skip
     ------------------------------------------------------------------------ */
  function inRect2(cx: number, cy: number, r: { x: number; y: number; w: number; h: number }): boolean {
    return cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h;
  }
  function exitToLobby2(): void {
    if (exitFired) return; exitFired = true;
    stop2();
    opts.onExit({ outcome: stageHeroWon2 ? 'levelCleared' : 'defeated', stagesWon, rewards });
  }
  // Resolve a tap during the result phase. Returns true if it consumed the tap.
  function handleResultTap2(cx: number, cy: number): boolean {
    if (phase2 !== 'result') return false;
    const isLast = currentStageIdx === totalStages - 1;
    if (!stageHeroWon2) {
      // Defeat banner — two choices
      if (inRect2(cx, cy, lossBtnRetry2())) { retryStage2(); return true; }
      if (inRect2(cx, cy, lossBtnImprove2())) { exitToLobby2(); return true; }
      return false;
    }
    if (stageHeroWon2 && isLast && sessionOver) {
      // Level-complete ceremony — tap anywhere skips to lobby
      exitToLobby2(); return true;
    }
    return false;
  }
  let _c2PdX = -1, _c2PdY = -1;
  function handlePointerDown2(ev: PointerEvent): void {
    ev.preventDefault();
    _c2PdX = ev.clientX; _c2PdY = ev.clientY;
  }
  function handlePointerUp2(ev: PointerEvent): void {
    ev.preventDefault();
    const dx = ev.clientX - _c2PdX, dy = ev.clientY - _c2PdY;
    const moved = _c2PdX < 0 || dx * dx + dy * dy > 400;
    _c2PdX = -1; _c2PdY = -1;
    if (moved) return;
    handleResultTap2(ev.clientX, ev.clientY);
  }
  window.addEventListener('pointerdown', handlePointerDown2);
  window.addEventListener('pointerup', handlePointerUp2);
  // Legacy click fallback
  function handleClick2(ev: MouseEvent): void {
    if (_c2PdX >= 0) return; // pointer events already handled
    handleResultTap2(ev.clientX, ev.clientY);
  }
  window.addEventListener('click', handleClick2);

  /* --------------------------------------------------------------------------
     MAIN LOOP
     ------------------------------------------------------------------------ */
  startCard2();
  let running2 = true;
  let rafId2 = 0;
  let prevTs2 = 0;

  function frame2(ts: number): void {
    if (!running2) return;
    const rawDt = Math.min(0.05, prevTs2 ? (ts - prevTs2) / 1000 : 16 / 1000);
    prevTs2 = ts;
    t2 += rawDt;

    cameraStep2(rawDt);
    let simDt = rawDt * timeScale2;
    if (hitstop2 > 0) { hitstop2 -= rawDt; simDt = 0; }

    // Always tick delayed2c so auto-exit fires even during result phase
    stepDelayed2c(rawDt);
    stepRewardOverlay2(rawDt);

    if (phase2 === 'card') {
      cardT2 -= rawDt;
      if (cardT2 <= 0) startFight2();
    } else if (phase2 === 'fight') {
      if (simDt > 0) { stepDelayed2(simDt); simStep2(simDt); }
      consumeEvents2();
    } else if (phase2 === 'result') {
      consumeEvents2();
      resultT2 -= rawDt;
      if (resultT2 <= 0 && !sessionOver) {
        handleStageEnd();
      }
    }

    physStep2((phase2 === 'fight' && hitstop2 > 0) ? 0 : simDt);

    ctx2.setTransform(1, 0, 0, 1, 0, 0);
    ctx2.clearRect(0, 0, W2, H2);

    const shx = (rnd2() - .5) * shake2, shy = (rnd2() - .5) * shake2;
    camX2 = shx; camY2 = shy;
    drawArena2();

    if (phase2 === 'card') {
      drawStageBanner2();
      drawHUD2();
      drawStageProgressBar2();
      drawRewardOverlay2();
      rafId2 = requestAnimationFrame(frame2);
      return;
    }

    ctx2.save();
    ctx2.translate(W2 / 2 + shx, H2 / 2 + shy);
    ctx2.scale(zoom2, zoom2);
    ctx2.translate(-W2 / 2, -H2 / 2);

    for (const f of fighters2) drawShadow2(f);
    const order2 = [...fighters2].sort((a, b) => depthScale2(a) - depthScale2(b));
    for (const f of order2) drawCreature2(f);
    drawProjectiles2();
    drawBolts2();
    drawSlashFX2(rawDt);
    drawParticles2();
    ctx2.restore();

    drawVignetteAndLight2();
    for (const f of fighters2) { if (f.alive) drawHPBar2(f); }
    drawATB2();
    drawFloaters2();
    drawLog2();
    drawHUD2();
    drawStageProgressBar2();
    if (phase2 === 'result') drawResultBanner2();
    drawRewardOverlay2();

    rafId2 = requestAnimationFrame(frame2);
  }
  rafId2 = requestAnimationFrame(frame2);

  /* --------------------------------------------------------------------------
     DISPOSER
     ------------------------------------------------------------------------ */
  function stop2(): void {
    if (!running2) return;
    running2 = false;
    cancelAnimationFrame(rafId2);
    cv2.remove();
    window.removeEventListener('resize', resize2);
    window.removeEventListener('click', handleClick2);
    window.removeEventListener('pointerdown', handlePointerDown2);
    window.removeEventListener('pointerup', handlePointerUp2);
  }
  _prevStop = stop2;
  return stop2;

} // end startCampaignBattle
