// src/render/gauntlet-fight.ts
// Verbatim TypeScript port of poc/gauntlet.html <script>.
// Self-contained: own Mulberry32 RNG, own sim, own Canvas2D render.
// Does NOT use the Slice-1 engine (src/sim). That is intentional.
// export startGauntlet() to boot from app/main.ts.
"use strict";

/* ============================================================================
   TYPES
   ========================================================================== */
interface PixDef { col: string; name: string }
interface SchoolDef { name: string; glyph: string; col: string; col2: string; light: string }
interface MoveDef {
  kind: string; icon: string; label: string;
  windUp: number; recover: number; power: number;
  type: 'phys' | 'magic'; ranged: boolean;
  double?: boolean; critBonus?: number; weight: number;
  school?: string; status?: string;
  req: (build: BuildPixel[]) => boolean;
}
interface StatusDef {
  uk: string; glyph: string; col: string; dur: number; tick: number; dmg: number;
  atbMul?: number; dmgTakenMul?: number;
}
interface BuildPixel { gx: number; gy: number; type: string }
interface DerivedStats {
  maxHP: number; armor: number; atk: number; speed: number;
  dodge: number; crit: number; acc: number; magic: number;
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
   PUBLIC ENTRY POINT
   ========================================================================== */
export function startGauntlet(): void {

/* ============================================================================
   0. TUNABLE CONSTANTS
   ========================================================================== */
const SEED_BASE   = 1337;
const PX          = 13;
const SPRING_K    = 240;
const SPRING_D    = 15;
const SHAKE_BASE  = 9;
const SHAKE_CRIT  = 22;
const HITSTOP_HIT = 0.055;
const SLOWMO_CRIT = 0.30;
const SLOWMO_KO   = 0.22;
const ZOOM_PUNCH  = 0.14;
const ZOOM_BREATH = 0.012;
const ATB_GLOBAL  = 1.0;

const CARD_DUR    = 2.5;
const RESULT_DUR  = 1.6;
const BOSS_SCALE  = 1.6;
const BOSS_CADENCE= 0.82;

/* ============================================================================
   1. SEEDED RNG — Mulberry32
   ========================================================================== */
function mulberry32(a: number): () => number {
  return function(): number {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let rng: () => number = mulberry32(SEED_BASE);
const rnd  = (): number => rng();
const rRange = (a: number, b: number): number => a + (b - a) * rng();
const rPick  = <T>(arr: T[]): T => arr[(rng() * arr.length) | 0]!;

/* ============================================================================
   2. PIXEL TYPES + COLOR PALETTE
   ========================================================================== */
const PIX: Record<string, PixDef> = {
  core:    { col:'#f2c14e', name:'Ядро' },
  vital:   { col:'#8a8f98', name:'Тіло' },
  plate:   { col:'#4a78c8', name:'Броня' },
  force:   { col:'#e0483f', name:'Сила' },
  swift:   { col:'#5fd38a', name:'Спритність' },
  focus:   { col:'#f0e36b', name:'Фокус' },
  ember:   { col:'#ff7a2a', name:'Жар' },
  frost:   { col:'#5ad6ff', name:'Мороз' },
  spark:   { col:'#c79bff', name:'Іскра' },
  mana:    { col:'#b06bd6', name:'Мана' },
  catalyst:{ col:'#ffd24a', name:'Каталізатор' },
};

const STAT = {
  hpBase: 60,  hpPerVital: 9,
  armorPerPlate: 2.4,
  atkBase: 6,  atkPerForce: 3.0,
  spdBase: 0.82, spdPerSwift: 0.05,
  dodgePerSwift: 0.035,  dodgeCap: 0.34,
  critPerFocus: 0.05,    critCap: 0.45,
  accPerFocus: 0.03,
  magPerElement: 5.0,    magPerCatalyst: 4.0, magCatalystMul: 0.18,
};

/* ============================================================================
   3. MOVESET DATA + SCHOOLS + STATUSES
   ========================================================================== */
const SCHOOL: Record<string, SchoolDef> = {
  fire:  { name:'Вогонь',    glyph:'🔥', col:'#ff7a2a', col2:'#ffd24a', light:'#ff5a1e' },
  frost: { name:'Лід',       glyph:'❄',  col:'#5ad6ff', col2:'#bff0ff', light:'#3aa6ff' },
  spark: { name:'Блискавка', glyph:'⚡',  col:'#c79bff', col2:'#ffffff', light:'#9b6bff' },
};

const MOVES: Record<string, MoveDef> = {
  fist:  { kind:'fist',  icon:'👊', label:"б'є кулаком",          windUp:0.10, recover:0.18, power:9,  type:'phys', ranged:false, double:true,  weight:3.0,
           req:()=>true },
  sword: { kind:'sword', icon:'⚔️', label:"б'є мечем",            windUp:0.28, recover:0.34, power:20, type:'phys', ranged:false, critBonus:0.22, weight:2.0,
           req:(c: BuildPixel[])=>count(c,'force')>=3 },
  bow:   { kind:'bow',   icon:'🏹', label:"стріляє з лука",       windUp:0.22, recover:0.26, power:15, type:'phys', ranged:true,  weight:1.6,
           req:(c: BuildPixel[])=>count(c,'swift')>=2 },
  fire:  { kind:'fire',  icon:'🔥', label:"кастує Вогняну кулю",  windUp:0.40, recover:0.36, power:18, type:'magic', ranged:true,  school:'fire',  status:'burn',  weight:1.3,
           req:(c: BuildPixel[])=>count(c,'ember')>=1 && count(c,'mana')>=1 },
  frost: { kind:'frost', icon:'❄️', label:"кастує Крижану стрілу",windUp:0.40, recover:0.36, power:14, type:'magic', ranged:true,  school:'frost', status:'slow',  weight:1.3,
           req:(c: BuildPixel[])=>count(c,'frost')>=1 && count(c,'mana')>=1 },
  spark: { kind:'spark', icon:'⚡', label:"б'є Розрядом",         windUp:0.34, recover:0.34, power:16, type:'magic', ranged:true,  school:'spark', status:'shock', weight:1.2,
           req:(c: BuildPixel[])=>count(c,'spark')>=1 && count(c,'mana')>=1 },
};
const MOVE_ORDER = ['fist','sword','bow','fire','frost','spark'];

const STATUS_DEF: Record<string, StatusDef> = {
  burn:  { uk:'Підпал',       glyph:'🔥', col:'#ff7a2a', dur:4.2, tick:1.0, dmg:6 },
  slow:  { uk:'Сповільнення', glyph:'❄',  col:'#5ad6ff', dur:5.0, tick:0,   dmg:0, atbMul:0.45 },
  shock: { uk:'Шок',          glyph:'⚡',  col:'#c79bff', dur:3.0, tick:0,   dmg:0, dmgTakenMul:1.5 },
};

/* ============================================================================
   4. BUILD -> CAPABILITIES
   ========================================================================== */
function count(build: BuildPixel[], type: string): number { let n=0; for(const p of build) if(p.type===type) n++; return n; }

function adjacent(a: BuildPixel, b: BuildPixel): boolean { return Math.abs(a.gx-b.gx)<=1 && Math.abs(a.gy-b.gy)<=1 && !(a.gx===b.gx&&a.gy===b.gy); }

function deriveStats(build: BuildPixel[]): DerivedStats {
  const c = (t: string) => count(build, t);
  const vital=c('vital'), plate=c('plate'), force=c('force'), swift=c('swift'),
        focus=c('focus'), catalyst=c('catalyst');
  const elements = c('ember') + c('frost') + c('spark');

  let mag = elements*STAT.magPerElement + catalyst*STAT.magPerCatalyst;
  if(catalyst>0 && elements>0){
    let adjEl=0;
    for(const p of build){
      if(p.type!=='ember'&&p.type!=='frost'&&p.type!=='spark') continue;
      for(const q of build){ if(q.type==='catalyst' && adjacent(p,q)){ adjEl++; break; } }
    }
    mag *= (1 + STAT.magCatalystMul*catalyst);
    mag += adjEl*3.0;
  }

  const maxHP  = Math.round(STAT.hpBase + vital*STAT.hpPerVital);
  const armor  = +(plate*STAT.armorPerPlate).toFixed(1);
  const atk    = STAT.atkBase + force*STAT.atkPerForce;
  const speed  = STAT.spdBase + swift*STAT.spdPerSwift;
  const dodge  = Math.min(STAT.dodgeCap, swift*STAT.dodgePerSwift);
  const crit   = Math.min(STAT.critCap, focus*STAT.critPerFocus);
  const acc    = focus*STAT.accPerFocus;

  return {
    maxHP, armor, atk, speed, dodge, crit, acc,
    magic:+mag.toFixed(1),
    counts:{ vital, plate, force, swift, focus, catalyst, elements },
  };
}

function deriveMoveset(build: BuildPixel[]): string[] {
  const set: string[] = [];
  for(const k of MOVE_ORDER){ if(MOVES[k]!.req(build)) set.push(k); }
  return set;
}

function effectivePower(f: Fighter, move: MoveDef): number {
  if(move.type==='magic') return move.power + f.stats.magic;
  return move.power + f.stats.atk - STAT.atkBase;
}

/* ============================================================================
   5. ROSTER
   ========================================================================== */
function B(rows: [number, number, string][]): BuildPixel[] { return rows.map(([gx,gy,type])=>({gx,gy,type})); }

const HERO_BUILD = B([
  [0,0,'core'],
  [-1,0,'vital'],[0,1,'vital'],[-1,1,'vital'],[1,1,'vital'],
  [-1,2,'vital'],[0,2,'vital'],[1,2,'vital'],
  [-2,1,'plate'],[-2,2,'plate'],
  [1,0,'force'],[2,0,'force'],[3,0,'force'],
  [0,-1,'focus'],
  [2,-1,'ember'],[1,-1,'mana'],
  [-1,3,'vital'],[1,3,'vital'],
]);

const BRUTE_BUILD = B([
  [0,0,'core'],
  [-1,0,'vital'],[1,0,'vital'],
  [-2,1,'vital'],[-1,1,'vital'],[0,1,'vital'],[1,1,'vital'],[2,1,'vital'],
  [-2,2,'vital'],[-1,2,'vital'],[0,2,'vital'],[1,2,'vital'],[2,2,'vital'],
  [-2,3,'vital'],[-1,3,'vital'],[0,3,'vital'],[1,3,'vital'],[2,3,'vital'],
  [-3,1,'plate'],[-3,2,'plate'],[-3,3,'plate'],
  [3,1,'plate'],[3,2,'plate'],[3,3,'plate'],
  [-1,-1,'plate'],[0,-1,'plate'],[1,-1,'plate'],
  [2,0,'force'],[3,0,'force'],[4,0,'force'],
  [-1,4,'vital'],[1,4,'vital'],
]);

const RANGER_BUILD = B([
  [0,0,'core'],
  [0,-1,'vital'],[0,1,'vital'],[0,2,'vital'],[0,3,'vital'],
  [-1,0,'swift'],[1,0,'swift'],[-1,1,'swift'],[1,2,'swift'],
  [0,-2,'focus'],[-1,-1,'focus'],[1,-1,'focus'],
  [1,1,'force'],[-1,2,'force'],
  [0,4,'plate'],
  [-1,4,'swift'],[1,4,'swift'],
]);

const MAGE_BUILD = B([
  [0,0,'core'],
  [0,1,'vital'],[-1,1,'vital'],[1,1,'vital'],
  [0,2,'vital'],
  [-1,0,'ember'],[1,0,'frost'],
  [-1,-1,'ember'],[1,-1,'frost'],
  [0,-1,'catalyst'],
  [-2,0,'mana'],[2,0,'mana'],
  [-1,2,'vital'],[1,2,'vital'],
]);

const COLOSSUS_BUILD = B([
  [0,0,'core'],
  [-1,0,'vital'],[1,0,'vital'],[-2,0,'vital'],[2,0,'vital'],
  [-2,1,'vital'],[-1,1,'vital'],[0,1,'vital'],[1,1,'vital'],[2,1,'vital'],
  [-2,2,'vital'],[-1,2,'vital'],[0,2,'vital'],[1,2,'vital'],[2,2,'vital'],
  [-2,3,'vital'],[-1,3,'vital'],[0,3,'vital'],[1,3,'vital'],[2,3,'vital'],
  [-3,0,'plate'],[-3,1,'plate'],[-3,2,'plate'],[-3,3,'plate'],
  [3,0,'plate'],[3,1,'plate'],[3,2,'plate'],[3,3,'plate'],
  [-1,-1,'plate'],[0,-1,'plate'],[1,-1,'plate'],
  [3,-1,'force'],[4,-1,'force'],[4,0,'force'],
  [-3,-1,'swift'],[-4,-1,'swift'],[-4,0,'swift'],
  [0,-2,'focus'],[-1,-2,'focus'],[1,-2,'focus'],
  [-2,-1,'ember'],[2,-1,'frost'],[0,-3,'spark'],
  [-1,-3,'mana'],[1,-3,'mana'],[0,-1,'mana'],
  [-1,-2,'catalyst'],[1,-2,'catalyst'],
  [-2,4,'vital'],[-1,4,'vital'],[1,4,'vital'],[2,4,'vital'],
]);

const ROSTER: Record<string, RosterEntry> = {
  hero:    { id:'hero',    name:'«Піксель»',  arch:'Універсал',   build:HERO_BUILD,     scale:1.0,        accent:'#add0ff', side:-1 },
  brute:   { id:'brute',   name:'«Громило»',  arch:'Громило',     build:BRUTE_BUILD,    scale:1.12,       accent:'#e08a5a', side:+1 as 1 },
  ranger:  { id:'ranger',  name:'«Стрілець»', arch:'Стрілець',    build:RANGER_BUILD,   scale:0.94,       accent:'#7fe0a0', side:+1 as 1 },
  mage:    { id:'mage',    name:'«Чаклун»',   arch:'Чаклун',      build:MAGE_BUILD,     scale:0.9,        accent:'#cfa0ff', side:+1 as 1 },
  colossus:{ id:'colossus',name:'«Колос»',    arch:'Колос (БОС)', build:COLOSSUS_BUILD, scale:BOSS_SCALE, accent:'#ff6b6b', side:+1 as 1, boss:true },
};
const STAGE_ORDER = ['brute','ranger','mage','colossus'];

/* ============================================================================
   6. SIM
   ========================================================================== */
const cv = document.createElement('canvas');
cv.style.cssText = 'display:block;width:100%;height:100%;image-rendering:pixelated;position:fixed;inset:0;';
document.body.style.cssText = 'margin:0;height:100%;background:#070a0f;overflow:hidden;font-family:"Segoe UI",system-ui,sans-serif;color:#cfd6e0';
document.body.appendChild(cv);
const ctx = cv.getContext('2d')!;
let W = 0, H = 0, ground = 0;
function resize(): void { W = cv.width = innerWidth; H = cv.height = innerHeight; ground = H*0.70; }
window.addEventListener('resize', resize); resize();

function colorOfType(type: string): string { return PIX[type]?.col ?? '#888'; }

function makeFighter(entry: RosterEntry): Fighter {
  const stats = deriveStats(entry.build);
  const moveset = deriveMoveset(entry.build);
  const side = entry.side;
  const scale = entry.scale;
  return {
    id: entry.id, name: entry.name, arch: entry.arch, accent: entry.accent,
    side, face: side<0 ? 1 : -1, scale, boss: !!entry.boss,
    homeX: side<0 ? W*0.30 : W*0.70,
    build: entry.build, stats, moveset,
    maxHP: stats.maxHP, hp: stats.maxHP, armor: stats.armor,
    speed: stats.speed * (entry.boss?BOSS_CADENCE:1) * (side<0?1.06:1.0),
    atb: side<0 ? 0.10 : 0.0,
    statuses: [],
    moveCursor: (side<0?0:1),
    px: entry.build.map(p => ({ gx:p.gx, gy:p.gy, t:p.type, ox:0,oy:0,vx:0,vy:0 })),
    advance:0, knock:0, knockV:0,
    hpShown:stats.maxHP, hpChip:stats.maxHP, chipDelay:0,
    flash:0, charge:0, chargeSchool:null, squash:0, alive:true,
  };
}

let hero: Fighter;
let enemy: Fighter;
let fighters: Fighter[];

const events: Record<string, unknown>[] = [];
function emit(e: Record<string, unknown>): void { events.push(e); }

let phase: 'card' | 'fight' | 'result' = 'card';
let winner: Fighter | null = null;
const actors: Actor[] = [];
const projectiles: Projectile[] = [];

function pickMove(f: Fighter): MoveDef {
  const ms = f.moveset;
  const pool: string[] = [];
  for(let i=0;i<ms.length;i++){
    const k = ms[i]!;
    let w = MOVES[k]!.weight;
    if(i === f.moveCursor % ms.length) w *= 3.0;
    for(let j=0;j<w*10;j++) pool.push(k);
  }
  f.moveCursor++;
  return MOVES[rPick(pool)]!;
}

function startAction(f: Fighter): void {
  const tgt = (f===hero) ? enemy : hero;
  const move = pickMove(f);
  actors.push({ f, tgt, move, t:0, stage:'windup', fired:false });
  f.squash = (move.type==='magic' || move.kind==='sword') ? 1 : 0.5;
  if(move.type==='magic'){ f.charge = 0.0001; f.chargeSchool = move.school ?? null; }
  emit({ kind:'telegraph', source:f, move });
}

function resolveHit(f: Fighter, tgt: Fighter, move: MoveDef): void {
  const slowed = tgt.statuses.some(s=>s.key==='slow');
  const dodge = Math.max(0.02, tgt.stats.dodge - (slowed?0.07:0));
  const acc   = f.stats.acc;
  const hitChance = 0.92 - dodge + acc;
  const isHit = rnd() < hitChance;
  if(!isHit){
    emit({ kind:'resolve', move, source:f, target:tgt, hit:false, dodge:true, crit:false, damage:0 });
    return;
  }
  const critChance = f.stats.crit + (move.critBonus||0);
  const isCrit = rnd() < critChance;
  let dmg = effectivePower(f, move) + Math.floor(rRange(-2,3));
  if(move.type==='phys') dmg = Math.max(1, dmg - tgt.armor);
  else                   dmg = Math.max(1, dmg);
  if(isCrit) dmg = Math.round(dmg * 1.8);
  const shock = tgt.statuses.find(s=>s.key==='shock');
  let shockAmp = false;
  if(shock){ dmg = Math.round(dmg * STATUS_DEF['shock']!.dmgTakenMul!); shockAmp = true;
             tgt.statuses.splice(tgt.statuses.indexOf(shock),1); }
  dmg = Math.round(dmg);
  applyDamage(tgt, dmg);

  let appliedStatus: string | null = null;
  if(move.status){ applyStatus(tgt, move.status); appliedStatus = move.status; }

  emit({ kind:'resolve', move, source:f, target:tgt, hit:true, dodge:false,
         crit:isCrit, damage:dmg, status:appliedStatus, shockAmp });

  if(tgt.hp<=0 && tgt.alive){ killFighter(tgt, f); }
}

function applyDamage(tgt: Fighter, dmg: number): void {
  tgt.hp = Math.max(0, tgt.hp - dmg);
  tgt.chipDelay = 0.45;
  tgt.flash = 1;
}

function applyStatus(tgt: Fighter, key: string): void {
  const def = STATUS_DEF[key]!;
  const existing = tgt.statuses.find(s=>s.key===key);
  if(existing){ existing.dur = def.dur; }
  else tgt.statuses.push({ key, dur:def.dur, tickT: def.tick });
}

function killFighter(tgt: Fighter, by: Fighter): void {
  tgt.alive = false; tgt.hp = 0;
  winner = by;
  triggerSlowmo(SLOWMO_KO, 1.1);
  shake = SHAKE_CRIT*1.3;
  const sc = depthScale(tgt) * tgt.scale;
  const cx = creatureScreenX(tgt), cy = ground - 3.2*PX*tgt.scale;
  for(const p of tgt.px){
    debris.push({ x: cx + p.gx*PX*sc, y: cy + p.gy*PX*sc,
      vx:(rnd()-.5)*520, vy:-(180+rnd()*420),
      c: colorOfType(p.t), life:1.4+rnd()*0.8, sz:PX*tgt.scale });
  }
  emit({ kind:'ko', winner:by, loser:tgt });
  startResult();
}

function simStep(dt: number): void {
  for(const f of fighters){
    if(!f.alive) continue;
    for(let i=f.statuses.length-1;i>=0;i--){
      const s = f.statuses[i]!; const def = STATUS_DEF[s.key]!;
      s.dur -= dt;
      if(def.tick>0){
        s.tickT -= dt;
        if(s.tickT<=0 && f.hp>0){
          s.tickT += def.tick;
          const dmg = def.dmg;
          f.hp = Math.max(0, f.hp - dmg); f.chipDelay=0.4; f.flash=0.6;
          emit({ kind:'statusTick', target:f, status:s.key, damage:dmg });
          if(f.hp<=0 && f.alive){ killFighter(f, (f===hero?enemy:hero)); }
        }
      }
      if(s.dur<=0) f.statuses.splice(i,1);
    }
    if(!f.alive) continue;
    let atbMul = 1;
    for(const s of f.statuses){ const d=STATUS_DEF[s.key]!; if(d.atbMul) atbMul*=d.atbMul; }
    const busy = actors.some(a=>a.f===f);
    if(!busy){
      f.atb += dt * f.speed * 0.55 * ATB_GLOBAL * atbMul;
      if(f.atb>=1){ f.atb=0; startAction(f); }
    }
  }
  stepActors(dt);
  stepProjectiles(dt);
}

function stepActors(dt: number): void {
  for(let i=actors.length-1;i>=0;i--){
    const a = actors[i]!; a.t += dt; const m = a.move;
    if(a.stage==='windup'){
      a.f.charge = (m.type==='magic') ? Math.min(1, a.t/m.windUp) : 0;
      if(a.t>=m.windUp){ a.stage='release'; a.t=0; a.f.charge=0; releaseMove(a); }
    } else if(a.stage==='release'){
      if(a.t>=0.06){ a.stage='recover'; a.t=0; }
    } else {
      if(a.t>=m.recover){ actors.splice(i,1); }
    }
  }
}

function releaseMove(a: Actor): void {
  const { f, tgt, move } = a;
  for(const p of f.px){ p.vx += f.face*120; }
  if(move.ranged){
    spawnProjectile(f, tgt, move);
  } else {
    resolveHit(f, tgt, move);
    if(move.double && rnd()<0.85){
      setTimeout2(0.12, ()=>{ if(tgt.alive && phase==='fight') resolveHit(f, tgt, move); });
    }
    meleeImpactFX(f, tgt, move);
  }
}

const delayed: Delayed[] = [];
function setTimeout2(sec: number, fn: () => void): void { delayed.push({ t:sec, fn }); }
function stepDelayed(dt: number): void {
  for(let i=delayed.length-1;i>=0;i--){ const d=delayed[i]!; d.t-=dt; if(d.t<=0){ d.fn(); delayed.splice(i,1);} }
}

function spawnProjectile(f: Fighter, tgt: Fighter, move: MoveDef): void {
  const sx = creatureScreenX(f) + f.face*22*f.scale;
  const sy = ground - 3.0*PX*f.scale;
  const ex = creatureScreenX(tgt);
  const ey = ground - 3.0*PX*tgt.scale;
  const dist = Math.abs(ex-sx);
  const speed = move.kind==='bow' ? 1300 : (move.kind==='spark'?1700:760);
  const dur = Math.max(0.04, dist/speed);
  projectiles.push({
    move, f, tgt, sx, sy, ex, ey, t:0, dur,
    arc: move.kind==='bow' ? 90 : (move.kind==='spark'?0:60),
    school: move.school,
    bolt: move.kind==='spark' ? makeBolt(sx,sy,ex,ey) : null,
  });
  if(move.school) emit({ kind:'cast', source:f, school:move.school });
}

function makeBolt(sx: number, sy: number, ex: number, ey: number): BoltShape {
  const segs = 9;
  const main: BoltPoint[] = [];
  for(let i=0;i<=segs;i++){
    const u=i/segs;
    const x=sx+(ex-sx)*u;
    const y=sy+(ey-sy)*u + (i>0&&i<segs ? (rnd()-0.5)*36 : 0);
    main.push({x,y});
  }
  const forks: BoltPoint[][] = [];
  for(let k=0;k<2;k++){
    const i = 2 + ((rnd()*(segs-3))|0);
    const o = main[i]!;
    forks.push([ {x:o.x,y:o.y},
                 {x:o.x+(rnd()-0.5)*40, y:o.y+(rnd()-0.5)*46},
                 {x:o.x+(rnd()-0.5)*70, y:o.y+(rnd()-0.5)*70} ]);
  }
  return { main, forks };
}

function stepProjectiles(dt: number): void {
  for(let i=projectiles.length-1;i>=0;i--){
    const p = projectiles[i]!; p.t += dt;
    const u = p.t/p.dur;
    if(u>=1){
      resolveHit(p.f, p.tgt, p.move);
      projectileImpactFX(p);
      projectiles.splice(i,1);
    }
  }
}

/* ============================================================================
   7. RENDER
   ========================================================================== */
let t = 0;
let shake = 0, hitstop = 0;
const debris: Debris[]    = [];
const particles: Particle[] = [];
const dust: Dust[]      = [];
const floaters: Floater[]  = [];
const slashFX: SlashFX[]   = [];
const bolts: Bolt[]     = [];
let lightFlash  = 0, lightCol = '#fff';

for(let i=0;i<46;i++){
  dust.push({ x:rnd()*innerWidth, y:rnd()*innerHeight*0.85,
    z:0.3+rnd()*0.7, sp:6+rnd()*16, ph:rnd()*7 });
}

function creatureScreenX(f: Fighter): number { return f.homeX + f.face*f.advance + f.knock; }
function depthScale(f: Fighter): number {
  const back = Math.max(0, f.knock * f.face);
  return 1 - Math.min(0.20, back*0.0017);
}

function physStep(dt: number): void {
  for(const f of fighters){
    for(const p of f.px){
      const ax = -SPRING_K*p.ox - SPRING_D*p.vx;
      const ay = -SPRING_K*p.oy - SPRING_D*p.vy;
      p.vx += ax*dt; p.vy += ay*dt; p.ox += p.vx*dt; p.oy += p.vy*dt;
    }
    const ka = -34*f.knock - 7.5*f.knockV;
    f.knockV += ka*dt; f.knock += f.knockV*dt;
    const a = actors.find(x=>x.f===f);
    let want = 0;
    if(a){
      if(a.stage==='windup')  want = -0.12;
      else if(a.stage==='release' && !a.move.ranged) want = 1.0;
      else if(a.stage==='release') want = 0.15;
    }
    const other = (f===hero?enemy:hero);
    const reach = (Math.abs(other.homeX - f.homeX) - 3.6*PX);
    f.advance += (want*reach - f.advance) * Math.min(1, 11*dt);
    f.flash  = Math.max(0, f.flash  - dt*7);
    f.squash = Math.max(0, f.squash - dt*5);
    f.hpShown += (f.hp - f.hpShown) * Math.min(1, 9*dt);
    if(f.chipDelay>0) f.chipDelay -= dt;
    else f.hpChip += (f.hp - f.hpChip) * Math.min(1, 4*dt);
  }
  for(let i=debris.length-1;i>=0;i--){ const d=debris[i]!;
    d.vy += 980*dt; d.x+=d.vx*dt; d.y+=d.vy*dt; d.life-=dt;
    if(d.y>ground){ d.y=ground; d.vy*=-0.35; d.vx*=0.6; }
    if(d.life<=0) debris.splice(i,1);
  }
  for(let i=particles.length-1;i>=0;i--){ const p=particles[i]!;
    p.vy += (p.grav||0)*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.life-=dt;
    p.vx*=Math.pow(p.drag||0.02,dt); p.vy*=Math.pow(p.drag||0.02,dt);
    if(p.life<=0) particles.splice(i,1);
  }
  for(const d of dust){ d.x += d.sp*dt*0.4; d.y -= d.sp*dt*0.12; if(d.x>W+5)d.x=-5; if(d.y<-5)d.y=H*0.85; }
  for(let i=floaters.length-1;i>=0;i--){ const fl=floaters[i]!;
    fl.t+=dt; fl.y -= (fl.vy||32)*dt; fl.vy=(fl.vy||32)*Math.pow(0.05,dt);
    fl.pop = Math.max(0, (fl.pop||0)-dt*5);
    if(fl.t>fl.life) floaters.splice(i,1);
  }
  for(let i=bolts.length-1;i>=0;i--){ bolts[i]!.t+=dt; if(bolts[i]!.t>=bolts[i]!.life) bolts.splice(i,1); }
  shake *= Math.pow(0.0001, dt);
  lightFlash = Math.max(0, lightFlash - dt*3.2);
}

function spark2(x: number, y: number, n: number, col: string, spd: number): void {
  for(let i=0;i<n;i++){ const a=rnd()*6.283;
    particles.push({ x,y, vx:Math.cos(a)*spd*(0.4+rnd()), vy:Math.sin(a)*spd*(0.4+rnd())-40,
      life:0.3+rnd()*0.35, col, sz:2+rnd()*3, grav:300, drag:0.02 }); }
}
function burst(x: number, y: number, n: number, cols: string[], spd: number, grav: number, sz: number): void {
  for(let i=0;i<n;i++){ const a=rnd()*6.283, s=spd*(0.3+rnd());
    particles.push({ x,y, vx:Math.cos(a)*s, vy:Math.sin(a)*s-20,
      life:0.4+rnd()*0.6, col:rPick(cols), sz:sz*(0.6+rnd()), grav:grav, drag:0.05 }); }
}

function meleeImpactFX(f: Fighter, tgt: Fighter, move: MoveDef): void {
  const ix = creatureScreenX(tgt) - f.face*18, iy = ground - 3.0*PX*tgt.scale;
  if(move.kind==='fist'){ spark2(ix,iy,6,'#ffffff',180); }
  else if(move.kind==='sword'){
    slashFX.push({ x:ix, y:iy, dir:f.face, t:0, life:0.22 });
    spark2(ix,iy,10,'#dfe7ff',260);
  }
}

function projectileImpactFX(p: Projectile): void {
  const ix=p.ex, iy=p.ey;
  if(p.move.kind==='bow'){
    spark2(ix,iy,9,'#e8d9a0',240);
    burst(ix,iy,6,['#caa15a','#8a6a30'],120,400,3);
  } else if(p.school==='fire'){
    burst(ix,iy,26,['#ff7a2a','#ffd24a','#ff3b1e','#9a2a10'],340,200,4);
    lightFlash=0.9; lightCol=SCHOOL['fire']!.light; shake=Math.max(shake,SHAKE_CRIT);
    triggerZoom(0.10);
  } else if(p.school==='frost'){
    burst(ix,iy,24,['#5ad6ff','#bff0ff','#3aa6ff','#dffaff'],280,120,4);
    for(let i=0;i<8;i++){ const a=-1.2-rnd()*0.7;
      particles.push({ x:ix,y:iy, vx:Math.cos(a)*(120+rnd()*120)*(rnd()<.5?-1:1),
        vy:Math.sin(a)*(180+rnd()*160), life:0.5+rnd()*0.4, col:'#bff0ff', sz:2+rnd()*2, grav:500, drag:0.05 }); }
    lightFlash=0.8; lightCol=SCHOOL['frost']!.light;
  } else if(p.school==='spark'){
    bolts.push({ bolt:p.bolt!, t:0, life:0.22 });
    burst(ix,iy,22,['#c79bff','#ffffff','#9b6bff','#e6d6ff'],300,40,3);
    for(let i=0;i<10;i++){ const a=rnd()*6.283;
      particles.push({ x:ix,y:iy, vx:Math.cos(a)*(160+rnd()*200), vy:Math.sin(a)*(160+rnd()*200)-30,
        life:0.25+rnd()*0.25, col:'#ffffff', sz:1+rnd()*2, grav:0, drag:0.01 }); }
    lightFlash=1.0; lightCol=SCHOOL['spark']!.light; shake=Math.max(shake,SHAKE_CRIT*0.8);
    triggerZoom(0.12);
  }
}

/* ============================================================================
   8. UI
   ========================================================================== */
const log: LogEntry[] = [];
function pushLog(text: string, col?: string): void { log.push({text, col:col||'#dfe6f0'}); if(log.length>9) log.shift(); }

function addFloater(f: Fighter, text: string, col: string, big: boolean): void {
  floaters.push({ x:creatureScreenX(f), y:ground-3.6*PX*f.scale-18, t:0, life: big?1.3:0.95,
    text, col, big:!!big, vy: big?20:34, pop: big?1:0.4 });
}

function consumeEvents(): void {
  while(events.length){
    const e = events.shift()!;
    if(e['kind']==='telegraph'){ /* squash/charge cue only */ }
    else if(e['kind']==='cast'){
      const school = e['school'] as string;
      const sc = SCHOOL[school]!;
      lightFlash=Math.max(lightFlash,0.5); lightCol=sc.light;
      const source = e['source'] as Fighter;
      const x=creatureScreenX(source), y=ground-3.0*PX*source.scale;
      burst(x,y,10,[sc.col,sc.col2],90,-20,3);
    }
    else if(e['kind']==='resolve'){
      const s=e['source'] as Fighter, tg=e['target'] as Fighter, m=e['move'] as MoveDef;
      if(e['dodge']){
        addFloater(tg, rnd()<0.5?'УХИЛ':'ПРОМАХ', '#9aa6b4', false);
        pushLog(`${tg.name} ${rnd()<0.5?'ухилився':'уник удару'}`, '#9aa6b4');
        spark2(creatureScreenX(tg), ground-3*PX*tg.scale, 4, '#7e8a99', 90);
      } else {
        const dmg = e['damage'] as number;
        const isCrit = e['crit'] as boolean;
        const shockAmp = e['shockAmp'] as boolean;
        if(isCrit){
          addFloater(tg, dmg+'', '#ffe24a', true);
          triggerSlowmo(SLOWMO_CRIT, 0.55); triggerZoom(ZOOM_PUNCH);
          shake=Math.max(shake,SHAKE_CRIT); hitstop=Math.max(hitstop,HITSTOP_HIT*2.2);
        } else {
          addFloater(tg, dmg+'', shockAmp?'#e6d6ff':'#ffffff', false);
          shake=Math.max(shake, SHAKE_BASE*Math.min(2, dmg/14));
          hitstop=Math.max(hitstop, HITSTOP_HIT*Math.min(2.2, 0.7+dmg/26));
        }
        let line = `${s.name} ${m.label}`;
        if(m.school) line += ` [${SCHOOL[m.school]!.name}]`;
        line += ` — ${dmg}`;
        if(isCrit) line += ' (КРИТ!)';
        if(shockAmp) line += ' ⚡(Шок!)';
        if(e['status']) line += `, накладено ${STATUS_DEF[e['status'] as string]!.uk}`;
        pushLog(line, isCrit ? '#ffe24a' : (m.school?SCHOOL[m.school]!.col:'#dfe6f0'));
        const dir = Math.sign(tg.homeX - s.homeX) || 1;
        tg.knockV += dir*(isCrit?620:380)/Math.max(0.7,tg.scale*0.7);
        for(const p of tg.px){ p.vx += dir*(180+dmg*6)+(rnd()-.5)*120; p.vy+=(rnd()-.7)*150; }
        if(dmg>14){
          const sc2=depthScale(tg)*tg.scale;
          const cx=creatureScreenX(tg), cy=ground-2*PX*tg.scale;
          for(let i=0;i<3;i++){ const pk=rPick(tg.px);
            debris.push({ x:cx+pk.gx*PX*sc2, y:cy+pk.gy*PX*sc2, vx:dir*(120+rnd()*180),
              vy:-(120+rnd()*220), c:colorOfType(pk.t), life:0.8+rnd()*0.4, sz:PX*tg.scale*0.8 }); }
        }
      }
    }
    else if(e['kind']==='statusTick'){
      const target = e['target'] as Fighter;
      const status = e['status'] as string;
      const dmg = e['damage'] as number;
      const def=STATUS_DEF[status]!;
      addFloater(target, dmg+'', def.col, false);
      pushLog(`${target.name} ${status==='burn'?'горить':'мерзне'} — ${dmg}`, def.col);
      const x=creatureScreenX(target), y=ground-2.4*PX*target.scale;
      if(status==='burn') burst(x,y,8,['#ff7a2a','#ffd24a'],80,-160,3);
    }
    else if(e['kind']==='ko'){
      const w = e['winner'] as Fighter;
      pushLog(`K.O. — ${w.name} переміг!`, '#ffd24a');
      lightFlash=1; lightCol='#fff';
    }
  }
}

/* ============================================================================
   9. CAMERA / JUICE
   ========================================================================== */
let timeScale = 1, slowmoT = 0, slowmoTarget = 1;
let zoom = 1, zoomPunch = 0;
function triggerSlowmo(scale: number, dur: number): void { slowmoTarget=scale; slowmoT=dur; }
function triggerZoom(amount: number): void { zoomPunch=Math.max(zoomPunch, amount); }

function cameraStep(rdt: number): void {
  if(slowmoT>0){ slowmoT-=rdt; timeScale += (slowmoTarget-timeScale)*Math.min(1,10*rdt); }
  else timeScale += (1-timeScale)*Math.min(1,6*rdt);
  zoomPunch *= Math.pow(0.0009, rdt);
  const breathe = 1 + ZOOM_BREATH*Math.sin(t*1.3);
  zoom += ((breathe+zoomPunch) - zoom) * Math.min(1, 8*rdt);
}

/* ============================================================================
   7b. DRAW ROUTINES
   ========================================================================== */
function drawArena(): void {
  const g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#141b27'); g.addColorStop(.55,'#10161f'); g.addColorStop(1,'#080b11');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  const hg = ctx.createRadialGradient(W*0.5, ground, 10, W*0.5, ground, W*0.7);
  hg.addColorStop(0,'rgba(60,90,140,0.18)'); hg.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=hg; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='rgba(120,150,190,0.10)'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(0,ground); ctx.lineTo(W,ground); ctx.stroke();
  ctx.fillStyle='#161d2a';
  ctx.beginPath();
  ctx.moveTo(W*0.5-60, ground); ctx.lineTo(W*0.5+60, ground);
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
  for(let i=1;i<8;i++){
    const u=i/8, y=ground+(H-ground)*u*u;
    ctx.strokeStyle=`rgba(70,100,150,${0.22*(1-u)})`; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
  }
  const vp=W*0.5;
  for(let i=-6;i<=6;i++){
    if(i===0) continue;
    const topX = vp + i*16, botX = vp + i*(W*0.5/3);
    ctx.strokeStyle='rgba(70,100,150,0.10)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(topX,ground); ctx.lineTo(botX,H); ctx.stroke();
  }
  for(const d of dust){
    ctx.globalAlpha=0.10+0.18*d.z;
    ctx.fillStyle='#bcd0ee';
    const s=1+d.z*2; ctx.fillRect(d.x, d.y, s, s);
  }
  ctx.globalAlpha=1;
}

function drawShadow(f: Fighter): void {
  const s=depthScale(f)*f.scale, sx=creatureScreenX(f);
  ctx.fillStyle='rgba(0,0,0,0.38)';
  ctx.beginPath(); ctx.ellipse(sx, ground+3, 36*s, 9*s, 0,0,7); ctx.fill();
}

function drawCreaturePixels(f: Fighter, sx: number, baseY: number, scaleMul: number, breathPhase: number): void {
  const s = depthScale(f) * f.scale * scaleMul;
  const breath=1+0.03*Math.sin(t*2.6+breathPhase);
  const sq=1 - f.squash*0.18, st=1 + f.squash*0.14;
  if(f.charge>0 && f.chargeSchool){
    const sc=SCHOOL[f.chargeSchool]!;
    const r=(14+f.charge*22)*f.scale;
    const gg=ctx.createRadialGradient(sx, baseY-3*PX*s, 2, sx, baseY-3*PX*s, r);
    gg.addColorStop(0, sc.col2); gg.addColorStop(0.5, sc.col); gg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.globalAlpha=0.6*f.charge; ctx.fillStyle=gg;
    ctx.beginPath(); ctx.arc(sx, baseY-3*PX*s, r, 0, 7); ctx.fill(); ctx.globalAlpha=1;
  }
  for(const p of f.px){
    const x = sx + (p.gx*PX*sq + p.ox)*s;
    const y = baseY - (3.2*PX*s) + ((p.gy*PX)*breath*st + p.oy)*s;
    const w = PX*s + 0.6;
    ctx.fillStyle = f.flash>0.15 ? '#ffffff' : colorOfType(p.t);
    ctx.fillRect(x-w/2, y-w/2, w, w);
    ctx.fillStyle='rgba(255,255,255,0.10)';
    ctx.fillRect(x-w/2, y-w/2, w, Math.max(1,w*0.18));
  }
  if(f.statuses.some(st2=>st2.key==='slow')){
    ctx.globalAlpha=0.18; ctx.fillStyle='#5ad6ff';
    ctx.fillRect(sx-30*s, baseY-3.4*PX*s-6, 60*s, 4.2*PX*s+6); ctx.globalAlpha=1;
  }
  if(f.statuses.some(st2=>st2.key==='shock')){
    ctx.globalAlpha=0.13+0.1*Math.abs(Math.sin(t*22)); ctx.fillStyle='#c79bff';
    ctx.fillRect(sx-30*s, baseY-3.4*PX*s-6, 60*s, 4.2*PX*s+6); ctx.globalAlpha=1;
  }
}

function drawCreature(f: Fighter): void {
  if(!f.alive) return;
  const sx=creatureScreenX(f);
  const lift=(1-depthScale(f))*120;
  const baseY=ground-lift;
  drawCreaturePixels(f, sx, baseY, 1, (f.face>0?1.5:0));
}

function drawProjectiles(): void {
  for(const p of projectiles){
    if(p.move.kind==='spark') continue;
    const u=p.t/p.dur;
    const x=p.sx+(p.ex-p.sx)*u;
    const y=p.sy+(p.ey-p.sy)*u - Math.sin(u*Math.PI)*p.arc;
    const ang=Math.atan2((p.ey-p.sy) - Math.cos(u*Math.PI)*p.arc*Math.PI, (p.ex-p.sx));
    ctx.save(); ctx.translate(x,y); ctx.rotate(ang);
    if(p.move.kind==='bow'){
      ctx.strokeStyle='rgba(230,210,150,0.4)'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(-26,0); ctx.lineTo(0,0); ctx.stroke();
      ctx.strokeStyle='#caa15a'; ctx.lineWidth=2.5;
      ctx.beginPath(); ctx.moveTo(-14,0); ctx.lineTo(8,0); ctx.stroke();
      ctx.fillStyle='#e8d9a0'; ctx.beginPath();
      ctx.moveTo(8,0); ctx.lineTo(2,-3); ctx.lineTo(2,3); ctx.closePath(); ctx.fill();
      ctx.strokeStyle='#caa15a'; ctx.beginPath(); ctx.moveTo(-14,0); ctx.lineTo(-18,-3);
      ctx.moveTo(-14,0); ctx.lineTo(-18,3); ctx.stroke();
    } else {
      const school = p.school!;
      const sc=SCHOOL[school]!;
      const gg=ctx.createRadialGradient(0,0,1,0,0,16);
      gg.addColorStop(0,sc.col2); gg.addColorStop(0.5,sc.col); gg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=gg; ctx.beginPath(); ctx.arc(0,0,16,0,7); ctx.fill();
      ctx.fillStyle=sc.col2; ctx.beginPath(); ctx.arc(0,0,4,0,7); ctx.fill();
      if(rnd()<0.8) particles.push({ x, y, vx:(rnd()-.5)*40, vy:(rnd()-.5)*40,
        life:0.3, col:sc.col, sz:2+rnd()*2, grav:p.school==='fire'?-120:60, drag:0.1 });
      ctx.restore();
      ctx.font='12px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillStyle='#fff'; ctx.fillText(sc.glyph, x, y);
      continue;
    }
    ctx.restore();
  }
}

function drawBolts(): void {
  for(const b of bolts){
    const a = 1 - b.t/b.life;
    const flick = 0.6+0.4*Math.abs(Math.sin(b.t*60));
    ctx.globalAlpha = a*flick;
    ctx.strokeStyle='rgba(199,155,255,0.5)'; ctx.lineWidth=7; ctx.lineJoin='round';
    strokePath(b.bolt.main);
    for(const fk of b.bolt.forks) strokePath(fk);
    ctx.strokeStyle='#ffffff'; ctx.lineWidth=2.4;
    strokePath(b.bolt.main);
    ctx.strokeStyle='#e6d6ff'; ctx.lineWidth=1.4;
    for(const fk of b.bolt.forks) strokePath(fk);
    ctx.globalAlpha=1;
  }
}
function strokePath(pts: BoltPoint[]): void {
  ctx.beginPath(); ctx.moveTo(pts[0]!.x, pts[0]!.y);
  for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i]!.x, pts[i]!.y);
  ctx.stroke();
}

function drawSlashFX(rdt: number): void {
  for(let i=slashFX.length-1;i>=0;i--){
    const sFx=slashFX[i]!; sFx.t+=rdt;
    const u=sFx.t/sFx.life; if(u>=1){ slashFX.splice(i,1); continue; }
    ctx.save(); ctx.translate(sFx.x, sFx.y);
    ctx.globalAlpha=(1-u)*0.95; ctx.strokeStyle='#eaf0ff'; ctx.lineWidth=6-u*4;
    ctx.beginPath();
    const a0=(-1.1)*sFx.dir, a1=(1.1)*sFx.dir;
    ctx.arc(0,0, 30, a0+u*0.6, a1+u*0.6, sFx.dir<0); ctx.stroke();
    ctx.globalAlpha=(1-u)*0.6; ctx.strokeStyle='#9fb6e0'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(0,0,30,a0+u*0.6,a1+u*0.6, sFx.dir<0); ctx.stroke();
    ctx.restore(); ctx.globalAlpha=1;
  }
}

function drawParticles(): void {
  for(const p of particles){
    ctx.globalAlpha=Math.min(1, p.life*3);
    ctx.fillStyle=p.col;
    ctx.fillRect(p.x-p.sz/2, p.y-p.sz/2, p.sz, p.sz);
  }
  ctx.globalAlpha=1;
  for(const d of debris){
    ctx.globalAlpha=Math.min(1,d.life*2); ctx.fillStyle=d.c;
    const s=d.sz||PX*0.8; ctx.fillRect(d.x-s/2, d.y-s/2, s, s);
  }
  ctx.globalAlpha=1;
}

let camX=0, camY=0;
function lift_(f: Fighter): number { return (1-depthScale(f))*120; }

function drawHPBar(f: Fighter): void {
  const sx=creatureScreenX(f)*zoom + (1-zoom)*W/2 + camX;
  const top=(ground-lift_(f)-3.4*PX*f.scale-46)*zoom + (1-zoom)*H/2 + camY;
  const bw=120*(f.boss?1.25:1), bh=11, x=sx-bw/2, y=top;
  ctx.font='bold 13px system-ui'; ctx.textAlign='left'; ctx.textBaseline='alphabetic';
  ctx.fillStyle = f.accent;
  ctx.fillText(f.name, x, y-6);
  ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(x-2,y-2,bw+4,bh+4);
  ctx.fillStyle='rgba(255,255,255,0.6)';
  ctx.fillRect(x, y, bw*Math.max(0,f.hpChip)/f.maxHP, bh);
  const frac=Math.max(0,f.hpShown)/f.maxHP;
  const col = frac>0.5?'#56d364':frac>0.25?'#e3b341':'#e5534b';
  ctx.fillStyle=col; ctx.fillRect(x, y, bw*frac, bh);
  ctx.font='9px system-ui'; ctx.fillStyle='#0a0d12';
  ctx.fillText(Math.ceil(Math.max(0,f.hpShown))+'', x+4, y+9);
  let ix=x;
  for(const st of f.statuses){
    const def=STATUS_DEF[st.key]!;
    const k=Math.max(0.2, st.dur/def.dur);
    ctx.fillStyle=def.col; ctx.globalAlpha=0.85;
    const sz=14*k+4;
    ctx.fillRect(ix, y+bh+3, sz, sz);
    ctx.globalAlpha=1; ctx.font=(sz*0.8|0)+'px system-ui'; ctx.fillStyle='#fff';
    ctx.textAlign='center'; ctx.fillText(def.glyph, ix+sz/2, y+bh+3+sz*0.78);
    ctx.textAlign='left';
    ix += 22;
  }
}

function drawFloaters(): void {
  ctx.textAlign='center'; ctx.textBaseline='middle';
  for(const fl of floaters){
    const a=Math.min(1, (fl.life-fl.t)*3);
    const x=fl.x*zoom + (1-zoom)*W/2 + camX;
    const y=fl.y*zoom + (1-zoom)*H/2 + camY;
    const pop=1+fl.pop*0.8;
    const size=(fl.big?30:18)*pop;
    ctx.globalAlpha=a;
    ctx.font=`bold ${size}px system-ui`;
    ctx.lineWidth=3; ctx.strokeStyle='rgba(0,0,0,0.7)';
    ctx.strokeText(fl.text, x, y);
    ctx.fillStyle=fl.col; ctx.fillText(fl.text, x, y);
  }
  ctx.globalAlpha=1; ctx.textAlign='left'; ctx.textBaseline='alphabetic';
}

function drawLog(): void {
  const w=340, x=W-w-14, lh=20, n=log.length, y0=H-14-n*lh;
  ctx.fillStyle='rgba(8,12,20,0.55)';
  ctx.fillRect(x-8, y0-22, w+8, n*lh+28);
  ctx.fillStyle='rgba(160,180,210,0.5)';
  ctx.font='bold 11px system-ui'; ctx.textAlign='left';
  ctx.fillText('БОЙОВИЙ ЛОГ', x, y0-8);
  ctx.font='13px system-ui';
  for(let i=0;i<n;i++){
    const e=log[i]!; const fade=0.4+0.6*((i+1)/n);
    ctx.globalAlpha=fade; ctx.fillStyle=e.col;
    ctx.fillText(e.text, x, y0+i*lh+8);
  }
  ctx.globalAlpha=1;
}

function drawATB(): void {
  for(const f of fighters){
    if(!f.alive) continue;
    const sx=creatureScreenX(f)*zoom+(1-zoom)*W/2+camX;
    const top=(ground-lift_(f)-3.4*PX*f.scale-46)*zoom+(1-zoom)*H/2+camY;
    const bw=120*(f.boss?1.25:1), x=sx-bw/2, y=top+16;
    ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fillRect(x,y,bw,4);
    ctx.fillStyle='#7fc8ff'; ctx.fillRect(x,y,bw*f.atb,4);
  }
}

function drawVignetteAndLight(): void {
  if(lightFlash>0){
    ctx.globalAlpha=lightFlash*0.5;
    const g=ctx.createRadialGradient(W/2,ground-100,40,W/2,H/2,W*0.7);
    g.addColorStop(0,lightCol); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H); ctx.globalAlpha=1;
  }
  const v=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*0.35,W/2,H/2,Math.max(W,H)*0.72);
  v.addColorStop(0,'rgba(0,0,0,0)'); v.addColorStop(1,'rgba(0,0,0,0.55)');
  ctx.fillStyle=v; ctx.fillRect(0,0,W,H);
}

/* ============================================================================
   10. GAUNTLET SEQUENCER + VS CARD + result banner + HUD
   ========================================================================== */
let loopCount = 0;
let stageIdx  = 0;
let cardT = 0, resultT = 0;
let resultText = '', resultWinnerColor = '#ffe24a';

function curStageEntry(): RosterEntry { return ROSTER[STAGE_ORDER[stageIdx]!]!; }

function reseedForStage(): void {
  rng = mulberry32(SEED_BASE + loopCount*101 + stageIdx*13 + 7);
}

function buildStageFighters(): void {
  hero  = makeFighter(ROSTER['hero']!);
  enemy = makeFighter(curStageEntry());
  fighters = [hero, enemy];
}

function startCard(): void {
  phase='card'; cardT=CARD_DUR; winner=null;
  reseedForStage();
  buildStageFighters();
  actors.length=0; projectiles.length=0; delayed.length=0;
  particles.length=0; debris.length=0; floaters.length=0; bolts.length=0; slashFX.length=0;
  log.length=0;
  pushLog(`— Гонитва: Бій ${stageIdx+1}/${STAGE_ORDER.length} —`, '#9fb0c8');
  pushLog(`${hero.name} проти ${enemy.name}`, '#9fb0c8');
}

function startFight(): void {
  phase='fight';
  hero.atb=0.12; enemy.atb=0.0;
}

function startResult(): void {
  phase='result'; resultT=RESULT_DUR;
  const heroWon = winner===hero;
  resultText = heroWon ? `${hero.name} переміг!` : `${enemy.name} переміг!`;
  resultWinnerColor = heroWon ? '#7fd0ff' : enemy.accent;
}

function advanceStage(): void {
  stageIdx++;
  if(stageIdx>=STAGE_ORDER.length){ stageIdx=0; loopCount++; }
  startCard();
}

function drawVSCard(): void {
  ctx.fillStyle='rgba(6,9,15,0.82)'; ctx.fillRect(0,0,W,H);
  const headY=H*0.13;
  ctx.textAlign='center'; ctx.textBaseline='alphabetic';
  ctx.fillStyle='#9fb0c8'; ctx.font='bold 18px system-ui';
  ctx.fillText('ГОНИТВА', W/2, headY-26);
  ctx.fillStyle='#ffe24a'; ctx.font='bold 40px system-ui';
  ctx.fillText(`Бій ${stageIdx+1}/${STAGE_ORDER.length}`, W/2, headY+16);

  const leftX = W*0.27, rightX = W*0.73, cardBaseY = H*0.62;

  const vsPulse = 1 + 0.08*Math.sin(t*4);
  ctx.save();
  ctx.translate(W/2, H*0.5); ctx.scale(vsPulse, vsPulse);
  ctx.fillStyle='#fff'; ctx.font='bold 72px system-ui'; ctx.textAlign='center';
  ctx.strokeStyle='rgba(0,0,0,0.6)'; ctx.lineWidth=6;
  ctx.strokeText('VS',0,24); ctx.fillText('VS',0,24);
  ctx.restore();

  drawCardSide(hero,  leftX,  cardBaseY, +1);
  drawCardSide(enemy, rightX, cardBaseY, -1);

  ctx.textAlign='left'; ctx.textBaseline='alphabetic';
}

function drawCardSide(f: Fighter, cx: number, baseY: number, faceDir: 1 | -1): void {
  const cardScale = f.boss ? 1.25 : 1.1;
  const savedFace=f.face; f.face=faceDir;
  drawCreaturePixels(f, cx, baseY, cardScale, (faceDir>0?0:1.5));
  f.face=savedFace;

  ctx.textAlign='center';
  ctx.fillStyle=f.accent; ctx.font='bold 26px system-ui';
  ctx.fillText(f.name, cx, baseY+44);
  ctx.fillStyle='#cfd6e0'; ctx.font='15px system-ui';
  ctx.fillText(f.arch, cx, baseY+66);

  const icons = f.moveset.map(k=>MOVES[k]!.icon);
  ctx.font='26px system-ui';
  const gap=40, totalW=(icons.length-1)*gap;
  let ix=cx-totalW/2;
  ctx.fillStyle='rgba(255,255,255,0.06)';
  ctx.fillRect(cx-totalW/2-26, baseY+78, totalW+52, 36);
  for(const ic of icons){ ctx.fillText(ic, ix, baseY+104); ix+=gap; }

  ctx.font='14px system-ui'; ctx.fillStyle='#aeb9c8';
  const phys = Math.round(f.stats.atk);
  const mag  = Math.round(f.stats.magic);
  const dmgStr = mag>0 ? `${phys} / ✦${mag}` : `${phys}`;
  ctx.fillText(`HP ${f.maxHP}    Броня ${f.armor}    Шкода ${dmgStr}`, cx, baseY+136);
}

function drawResultBanner(): void {
  ctx.save();
  ctx.globalAlpha=0.92;
  ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(0,H*0.30,W,H*0.24);
  ctx.textAlign='center';
  ctx.font='bold 60px system-ui'; ctx.fillStyle='#ffe24a';
  ctx.fillText('K.O.', W/2, H*0.41);
  ctx.font='bold 30px system-ui'; ctx.fillStyle=resultWinnerColor;
  ctx.fillText(resultText, W/2, H*0.48);
  ctx.restore(); ctx.textAlign='left';
}

function drawHUD(): void {
  const e=curStageEntry();
  const txt=`Гонитва — Бій ${stageIdx+1}/${STAGE_ORDER.length}: ${ROSTER['hero']!.name} vs ${e.name}`
            + (loopCount>0?`  ·  цикл ${loopCount+1}`:'');
  ctx.textAlign='center'; ctx.textBaseline='alphabetic';
  ctx.font='bold 14px system-ui';
  const w=ctx.measureText(txt).width+24;
  ctx.fillStyle='rgba(8,12,20,0.6)'; ctx.fillRect(W/2-w/2, 8, w, 26);
  ctx.fillStyle='#cfe0ff'; ctx.fillText(txt, W/2, 26);
  ctx.textAlign='left';
}

/* ============================================================================
   11. MAIN LOOP
   ============================================================================ */
startCard();

let prevTs = 0;
function frame(ts: number): void {
  const rawDt = Math.min(0.05, prevTs ? (ts - prevTs) / 1000 : 16 / 1000);
  prevTs = ts;
  t += rawDt;

  cameraStep(rawDt);
  let simDt = rawDt * timeScale;
  if(hitstop>0){ hitstop -= rawDt; simDt = 0; }

  if(phase==='card'){
    cardT -= rawDt;
    if(cardT<=0) startFight();
  } else if(phase==='fight'){
    if(simDt>0){ stepDelayed(simDt); simStep(simDt); }
    consumeEvents();
  } else if(phase==='result'){
    consumeEvents();
    resultT -= rawDt;
    if(resultT<=0) advanceStage();
  }

  physStep((phase==='fight' && hitstop>0) ? 0 : simDt);

  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,W,H);

  const shx=(rnd()-.5)*shake, shy=(rnd()-.5)*shake;
  camX=shx; camY=shy;
  drawArena();

  if(phase==='card'){
    drawVSCard();
    drawHUD();
    requestAnimationFrame(frame);
    return;
  }

  ctx.save();
  ctx.translate(W/2+shx, H/2+shy);
  ctx.scale(zoom, zoom);
  ctx.translate(-W/2, -H/2);

  for(const f of fighters) drawShadow(f);
  const order=[...fighters].sort((a,b)=>depthScale(a)-depthScale(b));
  for(const f of order) drawCreature(f);
  drawProjectiles();
  drawBolts();
  drawSlashFX(rawDt);
  drawParticles();
  ctx.restore();

  drawVignetteAndLight();

  for(const f of fighters){ if(f.alive) drawHPBar(f); }
  drawATB();
  drawFloaters();
  drawLog();
  drawHUD();
  if(phase==='result') drawResultBanner();

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

} // end startGauntlet
