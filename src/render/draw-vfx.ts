// src/render/draw-vfx.ts
// Particle VFX system — verbatim port of poc/art-routes.html route-B VFX:
// chunk(), ring(), stepParts(), drawParts(), spawnVFX().
// Extended with projectiles, slash arcs, lightning bolts, floaters and status auras
// ported from poc/builder.html drawProjectiles/drawBolts/drawSlashFX/drawFloaters.
// Cosmetic Math.random is isolated here and never touches the sim.
import { lightenHex } from './draw-cube';

// ---- Particle types (match prototype's anonymous objects) ----
interface ChunkParticle {
  x: number; y: number; vx: number; vy: number;
  life: number; fade: number; grav: number;
  col: string; s: number;
  add: boolean; isRing: false;
  drag?: number;
}
interface RingParticle {
  x: number; y: number; r: number; grow: number; wd: number;
  col: string; life: number; fade: number; add: boolean; isRing: true;
}
type Particle = ChunkParticle | RingParticle;

// ---- Projectile (ported from poc/builder.html spawnProjectile / drawProjectiles) ----
export interface Projectile {
  /** move kind: 'bow'|'fire'|'frost'|'spark'|'venom'|'arc' */
  kind: string;
  /** magic school for non-bow ranged: 'fire'|'frost'|'spark'|'poison'|'arcane'|undefined */
  magicSchool: string | undefined;
  sx: number; sy: number;
  ex: number; ey: number;
  t: number; dur: number;
  arc: number;          // vertical arc height px
  /** pre-generated lightning bolt shape for spark */
  bolt: BoltShape | null;
}

interface BoltPt { x: number; y: number }
export interface BoltShape { main: BoltPt[]; forks: BoltPt[][] }

// ---- Slash arc (ported from poc/builder.html drawSlashFX) ----
export interface SlashFx {
  x: number; y: number;
  dir: number;    // +1 or -1
  t: number; life: number;
}

// ---- Lightning bolt overlay (ported from poc/builder.html drawBolts) ----
export interface BoltFx {
  bolt: BoltShape;
  t: number; life: number;
}

// ---- Floating damage number (ported from poc/builder.html drawFloaters / addFloater) ----
export interface Floater {
  x: number; y: number;
  text: string;
  col: string;
  big: boolean;
  t: number; life: number;
  vy: number;   // rising speed px/s
  pop: number;  // pop scale (decays)
}

export class VfxState {
  parts: Particle[] = [];
  projectiles: Projectile[] = [];
  slashes: SlashFx[] = [];
  bolts: BoltFx[] = [];
  floaters: Floater[] = [];
  shake = 0;    // current shake amplitude (px)
  hitstop = 0;  // seconds of frozen sim remaining
}

// ---- School colour table (ported from poc/builder.html SCHOOL) ----
const SCHOOL_COLS: Record<string, { col: string; col2: string }> = {
  fire:   { col: '#F07A1E', col2: '#ffd24a' },
  frost:  { col: '#39C6E8', col2: '#bff0ff' },
  spark:  { col: '#9B6BD6', col2: '#ffffff' },
  poison: { col: '#7bd64a', col2: '#d6ff9a' },
  arcane: { col: '#c060ff', col2: '#f0d0ff' },
};

// ---- Helpers ----

/** Verbatim from prototype chunk() (line 331) */
export function chunk(
  state: VfxState,
  x: number, y: number, col: string,
  dir: number, sp0: number,
  add: boolean, fast = false,
): void {
  const s = fast ? (2 + Math.random() * 3) : (3 + Math.random() * 4);
  const ang = (-Math.PI / 2) + (Math.random() - 0.5) * (fast ? 2.6 : 1.7);
  const sp = (sp0 || 3) + Math.random() * 4;
  state.parts.push({
    x, y,
    vx: Math.cos(ang) * sp * dir + dir * 1.2,
    vy: Math.sin(ang) * sp - 1.5,
    life: 1, fade: fast ? 2.4 : 1.6, grav: fast ? 20 : 60,
    col, s, add, isRing: false,
  } as ChunkParticle);
}

/** Verbatim from prototype ring() (line 334) */
export function ring(
  state: VfxState,
  x: number, y: number, col: string,
  wd: number, grow: number, add: boolean,
): void {
  state.parts.push({
    x, y, r: 4, grow, wd, col,
    life: 1, fade: add ? 2.4 : 3.0,
    add, isRing: true,
  } as RingParticle);
}

/**
 * Spawn a burst of particles — ported from poc/builder.html burst().
 * cols = array of colour strings; one is picked randomly per particle.
 */
export function burst(
  state: VfxState,
  x: number, y: number,
  n: number, cols: string[],
  spd: number, grav: number, sz: number,
): void {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.283;
    const s = spd * (0.3 + Math.random());
    const col = cols[Math.floor(Math.random() * cols.length)] ?? '#ffffff';
    state.parts.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 20,
      life: 0.4 + Math.random() * 0.6,
      fade: 1.4,
      grav,
      col, s: sz * (0.6 + Math.random()), add: false, isRing: false,
      drag: 0.05,
    } as ChunkParticle);
  }
}

/**
 * Spawn directional sparks — ported from poc/builder.html spark().
 */
export function spark(
  state: VfxState,
  x: number, y: number,
  n: number, col: string, spd: number,
): void {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.283;
    state.parts.push({
      x, y,
      vx: Math.cos(a) * spd * (0.4 + Math.random()),
      vy: Math.sin(a) * spd * (0.4 + Math.random()) - 40,
      life: 0.3 + Math.random() * 0.35,
      fade: 2.0,
      grav: 300,
      col, s: 2 + Math.random() * 3, add: false, isRing: false,
      drag: 0.02,
    } as ChunkParticle);
  }
}

/** Verbatim from prototype stepParts() (line 335–337) */
export function stepParts(state: VfxState, dt: number): void {
  // Step regular particles
  for (let i = state.parts.length - 1; i >= 0; i--) {
    const p = state.parts[i]!;
    p.life -= dt * p.fade;
    if (p.life <= 0) { state.parts.splice(i, 1); continue; }
    if (p.isRing) {
      (p as RingParticle).r += (p as RingParticle).grow * dt;
    } else {
      const cp = p as ChunkParticle;
      if (cp.drag != null) {
        const dragF = Math.pow(cp.drag, dt);
        cp.vx *= dragF; cp.vy *= dragF;
      }
      cp.vy += cp.grav * dt;
      cp.x += cp.vx * dt * 60;
      cp.y += cp.vy * dt * 60;
    }
  }

  // Step projectiles (advance time; impact handled in scene-canvas to spawn impact FX)
  for (const p of state.projectiles) p.t += dt;

  // Step slash FX
  for (let i = state.slashes.length - 1; i >= 0; i--) {
    const s = state.slashes[i]!;
    s.t += dt;
    if (s.t >= s.life) state.slashes.splice(i, 1);
  }

  // Step bolt overlays
  for (let i = state.bolts.length - 1; i >= 0; i--) {
    const b = state.bolts[i]!;
    b.t += dt;
    if (b.t >= b.life) state.bolts.splice(i, 1);
  }

  // Step floaters
  for (let i = state.floaters.length - 1; i >= 0; i--) {
    const fl = state.floaters[i]!;
    fl.t += dt;
    fl.y -= fl.vy * dt;
    fl.vy *= Math.pow(0.05, dt);
    fl.pop = Math.max(0, fl.pop - dt * 5);
    if (fl.t >= fl.life) state.floaters.splice(i, 1);
  }
}

/** Verbatim from prototype drawParts() (line 338–342) */
export function drawParts(ctx: CanvasRenderingContext2D, state: VfxState): void {
  for (const p of state.parts) {
    ctx.globalAlpha = Math.min(1, p.life * 1.3);
    if (p.add) ctx.globalCompositeOperation = 'lighter';
    if (p.isRing) {
      const rp = p as RingParticle;
      ctx.strokeStyle = rp.col;
      ctx.lineWidth = rp.wd;
      ctx.beginPath(); ctx.arc(rp.x, rp.y, rp.r, 0, 7); ctx.stroke();
    } else {
      const cp = p as ChunkParticle;
      ctx.fillStyle = cp.col;
      ctx.fillRect(cp.x - cp.s / 2, cp.y - cp.s / 2, cp.s, cp.s);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.globalAlpha = 1;
}

/**
 * Draw flying projectiles — ported from poc/builder.html drawProjectiles().
 * Call this each frame AFTER step (projectile.t has already advanced).
 */
export function drawProjectiles(ctx: CanvasRenderingContext2D, state: VfxState): void {
  for (const p of state.projectiles) {
    if (p.kind === 'spark') continue; // spark bolt drawn separately as drawBolts
    const u = p.t / p.dur;
    const x = p.sx + (p.ex - p.sx) * u;
    const y = p.sy + (p.ey - p.sy) * u - Math.sin(u * Math.PI) * p.arc;
    const ang = Math.atan2(
      (p.ey - p.sy) - Math.cos(u * Math.PI) * p.arc * Math.PI,
      (p.ex - p.sx),
    );

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);

    if (p.kind === 'bow') {
      // Arrow — ported from poc/builder.html lines 1562-1570
      ctx.strokeStyle = 'rgba(230,210,150,0.4)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(0, 0); ctx.stroke();
      ctx.strokeStyle = '#caa15a'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(8, 0); ctx.stroke();
      ctx.fillStyle = '#e8d9a0'; ctx.beginPath();
      ctx.moveTo(8, 0); ctx.lineTo(2, -3); ctx.lineTo(2, 3); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#caa15a'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-14, 0); ctx.lineTo(-18, -3);
      ctx.moveTo(-14, 0); ctx.lineTo(-18, 3);
      ctx.stroke();
    } else {
      // Magic orb — ported from poc/builder.html lines 1572-1582
      const school = p.magicSchool ?? 'arcane';
      const sc = SCHOOL_COLS[school] ?? { col: '#c060ff', col2: '#f0d0ff' };
      const gg = ctx.createRadialGradient(0, 0, 1, 0, 0, 16);
      gg.addColorStop(0, sc.col2);
      gg.addColorStop(0.5, sc.col);
      gg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gg;
      ctx.beginPath(); ctx.arc(0, 0, 16, 0, 7); ctx.fill();
      ctx.fillStyle = sc.col2;
      ctx.beginPath(); ctx.arc(0, 0, 4, 0, 7); ctx.fill();

      // trail particles — same as prototype does inline (cosmetic only)
      if (Math.random() < 0.8) {
        ctx.restore(); // restore before adding trail particle at world coords
        const trailCol = sc.col;
        state.parts.push({
          x: x, y: y,
          vx: (Math.random() - 0.5) * 40,
          vy: (Math.random() - 0.5) * 40,
          life: 0.3, fade: 2.0,
          grav: school === 'fire' ? -120 : 60,
          col: trailCol, s: 2 + Math.random() * 2, add: false, isRing: false,
          drag: 0.1,
        } as ChunkParticle);
        continue; // already restored
      }
    }

    ctx.restore();
  }
}

/**
 * Draw lightning bolt overlays — ported from poc/builder.html drawBolts().
 */
export function drawBolts(ctx: CanvasRenderingContext2D, state: VfxState): void {
  for (const b of state.bolts) {
    const a = 1 - b.t / b.life;
    const flick = 0.6 + 0.4 * Math.abs(Math.sin(b.t * 60));
    ctx.globalAlpha = a * flick;
    ctx.strokeStyle = 'rgba(199,155,255,0.5)'; ctx.lineWidth = 7; ctx.lineJoin = 'round';
    _strokePath(ctx, b.bolt.main);
    for (const fk of b.bolt.forks) _strokePath(ctx, fk);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.4;
    _strokePath(ctx, b.bolt.main);
    ctx.strokeStyle = '#e6d6ff'; ctx.lineWidth = 1.4;
    for (const fk of b.bolt.forks) _strokePath(ctx, fk);
    ctx.globalAlpha = 1;
  }
}

function _strokePath(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[]): void {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0]!.x, pts[0]!.y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y);
  ctx.stroke();
}

/**
 * Draw slash arcs — ported from poc/builder.html drawSlashFX().
 */
export function drawSlashes(ctx: CanvasRenderingContext2D, state: VfxState): void {
  for (const sFx of state.slashes) {
    const u = sFx.t / sFx.life;
    ctx.save();
    ctx.translate(sFx.x, sFx.y);
    ctx.globalAlpha = (1 - u) * 0.95;
    ctx.strokeStyle = '#eaf0ff';
    ctx.lineWidth = 6 - u * 4;
    ctx.beginPath();
    const a0 = (-1.1) * sFx.dir;
    const a1 = (1.1) * sFx.dir;
    ctx.arc(0, 0, 30, a0 + u * 0.6, a1 + u * 0.6, sFx.dir < 0);
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

/**
 * Draw floating damage numbers — ported from poc/builder.html drawFloaters().
 */
export function drawFloaters(ctx: CanvasRenderingContext2D, state: VfxState): void {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const fl of state.floaters) {
    const a = Math.min(1, (fl.life - fl.t) * 3);
    const pop = 1 + fl.pop * 0.8;
    const size = (fl.big ? 30 : 18) * pop;
    ctx.globalAlpha = a;
    ctx.font = `bold ${size}px system-ui`;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(fl.text, fl.x, fl.y);
    ctx.fillStyle = fl.col;
    ctx.fillText(fl.text, fl.x, fl.y);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

/**
 * Draw status auras around a creature — ported from poc/builder.html drawCreaturePixels()
 * status overlay block (lines 1491–1506).
 * sx = creature screen X, bodyTop = top-of-body Y, bodyH = body height px, t = clock.
 */
export function drawStatusAuras(
  ctx: CanvasRenderingContext2D,
  statuses: ReadonlyArray<{ id: string; remaining: number }>,
  sx: number,
  bodyTop: number,
  bodyW: number,
  bodyH: number,
  t: number,
): void {
  if (statuses.length === 0) return;

  const x = sx - bodyW * 0.5;
  const y = bodyTop;
  const w = bodyW;
  const h = bodyH;

  for (const st of statuses) {
    switch (st.id) {
      case 'slow':
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = '#5ad6ff';
        ctx.fillRect(x, y, w, h);
        ctx.globalAlpha = 1;
        break;
      case 'shock':
        ctx.globalAlpha = 0.13 + 0.1 * Math.abs(Math.sin(t * 22));
        ctx.fillStyle = '#c79bff';
        ctx.fillRect(x, y, w, h);
        ctx.globalAlpha = 1;
        break;
      case 'poison':
        ctx.globalAlpha = 0.12 + 0.06 * Math.abs(Math.sin(t * 4));
        ctx.fillStyle = '#7bd64a';
        ctx.fillRect(x, y, w, h);
        ctx.globalAlpha = 1;
        break;
      case 'burn': {
        // Flickering orange glow — builder doesn't have 'burn' aura but we add one
        // using the fire colour pattern matching the other statuses
        ctx.globalAlpha = 0.14 + 0.10 * Math.abs(Math.sin(t * 8));
        ctx.fillStyle = '#ff7a2a';
        ctx.fillRect(x, y, w, h);
        ctx.globalAlpha = 1;
        // Extra rim glow
        const gg = ctx.createRadialGradient(sx, bodyTop + h * 0.5, h * 0.1, sx, bodyTop + h * 0.5, h * 0.8);
        gg.addColorStop(0, 'rgba(255,80,0,0)');
        gg.addColorStop(0.5, 'rgba(255,80,0,0.08)');
        gg.addColorStop(1, 'rgba(255,80,0,0.22)');
        ctx.globalAlpha = 0.6 + 0.4 * Math.abs(Math.sin(t * 6));
        ctx.fillStyle = gg;
        ctx.fillRect(x - w * 0.3, y - h * 0.1, w * 1.6, h * 1.2);
        ctx.globalAlpha = 1;
        break;
      }
      default:
        break;
    }
  }
}

/**
 * Spawn route-B VFX: ring + additive glow burst + chunky debris.
 * Verbatim from prototype spawnVFX(R==='B',...) line 327:
 *   ring(cx,cy,lighten(tint,0.3),3,200,true);
 *   for(let i=0;i<9;i++) chunk(cx,cy,lighten(tint,0.3),dir,4,true);
 */
export function spawnVfxB(
  state: VfxState,
  cx: number, cy: number,
  tintHex: string,
  dir: number,
): void {
  const col = lightenHex(tintHex, 0.3);
  ring(state, cx, cy, col, 3, 200, true);
  for (let i = 0; i < 9; i++) chunk(state, cx, cy, col, dir, 4, true);
}

// ---- School-specific impact bursts (ported from poc/builder.html projectileImpactFX) ----

/** Melee fist impact sparks */
export function spawnMeleeImpact(state: VfxState, kind: string, x: number, y: number, dir: number): void {
  if (kind === 'fist') {
    spark(state, x, y, 6, '#ffffff', 180);
  } else if (kind === 'sword') {
    state.slashes.push({ x, y, dir, t: 0, life: 0.22 });
    spark(state, x, y, 10, '#dfe7ff', 260);
  }
}

/** Bow impact sparks */
export function spawnBowImpact(state: VfxState, x: number, y: number): void {
  spark(state, x, y, 9, '#e8d9a0', 240);
  burst(state, x, y, 6, ['#caa15a', '#8a6a30'], 120, 400, 3);
}

/** Fire impact burst — ported from poc/builder.html projectileImpactFX fire branch */
export function spawnFireImpact(state: VfxState, x: number, y: number): void {
  burst(state, x, y, 26, ['#ff7a2a', '#ffd24a', '#ff3b1e', '#9a2a10'], 340, 200, 4);
}

/** Frost impact burst — ported from poc/builder.html projectileImpactFX frost branch */
export function spawnFrostImpact(state: VfxState, x: number, y: number): void {
  burst(state, x, y, 24, ['#5ad6ff', '#bff0ff', '#3aa6ff', '#dffaff'], 280, 120, 4);
  for (let i = 0; i < 8; i++) {
    const a = -1.2 - Math.random() * 0.7;
    state.parts.push({
      x, y,
      vx: Math.cos(a) * (120 + Math.random() * 120) * (Math.random() < 0.5 ? -1 : 1),
      vy: Math.sin(a) * (180 + Math.random() * 160),
      life: 0.5 + Math.random() * 0.4,
      fade: 1.6,
      grav: 500,
      col: '#bff0ff', s: 2 + Math.random() * 2, add: false, isRing: false,
      drag: 0.05,
    } as ChunkParticle);
  }
}

/** Spark impact burst + bolt — ported from poc/builder.html projectileImpactFX spark branch */
export function spawnSparkImpact(state: VfxState, x: number, y: number, boltShape: BoltShape | null): void {
  if (boltShape) state.bolts.push({ bolt: boltShape, t: 0, life: 0.22 });
  burst(state, x, y, 22, ['#c79bff', '#ffffff', '#9b6bff', '#e6d6ff'], 300, 40, 3);
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * 6.283;
    state.parts.push({
      x, y,
      vx: Math.cos(a) * (160 + Math.random() * 200),
      vy: Math.sin(a) * (160 + Math.random() * 200) - 30,
      life: 0.25 + Math.random() * 0.25,
      fade: 3.0,
      grav: 0,
      col: '#ffffff', s: 1 + Math.random() * 2, add: false, isRing: false,
      drag: 0.01,
    } as ChunkParticle);
  }
}

/** Poison impact burst — ported from poc/builder.html projectileImpactFX poison branch */
export function spawnPoisonImpact(state: VfxState, x: number, y: number): void {
  burst(state, x, y, 20, ['#7bd64a', '#a6ff6a', '#4a8a2a', '#d6ff9a'], 240, 160, 4);
  for (let i = 0; i < 6; i++) {
    const a = -1.0 - Math.random() * 1.1;
    state.parts.push({
      x, y,
      vx: Math.cos(a) * (80 + Math.random() * 90) * (Math.random() < 0.5 ? -1 : 1),
      vy: Math.sin(a) * (120 + Math.random() * 100),
      life: 0.6 + Math.random() * 0.5,
      fade: 1.4,
      grav: -30,
      col: '#a6ff6a', s: 2 + Math.random() * 2, add: false, isRing: false,
      drag: 0.06,
    } as ChunkParticle);
  }
}

/** Arcane impact burst — ported from poc/builder.html projectileImpactFX arcane branch */
export function spawnArcaneImpact(state: VfxState, x: number, y: number): void {
  burst(state, x, y, 28, ['#c060ff', '#f0d0ff', '#9030d0', '#ffffff'], 320, 60, 4);
  for (let i = 0; i < 12; i++) {
    const a = Math.random() * 6.283;
    state.parts.push({
      x, y,
      vx: Math.cos(a) * (140 + Math.random() * 160),
      vy: Math.sin(a) * (140 + Math.random() * 160) - 30,
      life: 0.4 + Math.random() * 0.4,
      fade: 1.8,
      grav: 0,
      col: '#f0d0ff', s: 1.5 + Math.random() * 2.5, add: false, isRing: false,
      drag: 0.03,
    } as ChunkParticle);
  }
}

/**
 * Generate a jagged lightning bolt shape — ported from poc/builder.html makeBolt().
 */
export function makeBolt(sx: number, sy: number, ex: number, ey: number): BoltShape {
  const segs = 9;
  const main: { x: number; y: number }[] = [];
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    const x = sx + (ex - sx) * u;
    const y = sy + (ey - sy) * u + (i > 0 && i < segs ? (Math.random() - 0.5) * 36 : 0);
    main.push({ x, y });
  }
  const forks: { x: number; y: number }[][] = [];
  for (let k = 0; k < 2; k++) {
    const i = 2 + Math.floor(Math.random() * (segs - 3));
    const o = main[i]!;
    forks.push([
      { x: o.x, y: o.y },
      { x: o.x + (Math.random() - 0.5) * 40, y: o.y + (Math.random() - 0.5) * 46 },
      { x: o.x + (Math.random() - 0.5) * 70, y: o.y + (Math.random() - 0.5) * 70 },
    ]);
  }
  return { main, forks };
}

/**
 * Spawn a projectile for a ranged move.
 * kind = move kind ('bow'|'fire'|'frost'|'spark'|'venom'|'arc')
 * magicSchool = move.magicSchool (element string or undefined)
 */
export function spawnProjectile(
  state: VfxState,
  kind: string,
  magicSchool: string | undefined,
  sx: number, sy: number,
  ex: number, ey: number,
): void {
  const dist = Math.abs(ex - sx);
  const speed = kind === 'bow' ? 1300 : kind === 'spark' ? 1700 : 760;
  const dur = Math.max(0.04, dist / speed);
  const arc = kind === 'bow' ? 90 : kind === 'spark' ? 0 : 60;
  const bolt = kind === 'spark' ? makeBolt(sx, sy, ex, ey) : null;
  state.projectiles.push({ kind, magicSchool, sx, sy, ex, ey, t: 0, dur, arc, bolt });
}

/**
 * Add a floating text label above a creature position.
 * ported from poc/builder.html addFloater().
 */
export function addFloater(
  state: VfxState,
  x: number, y: number,
  text: string,
  col: string,
  big: boolean,
): void {
  state.floaters.push({
    x, y,
    text, col, big,
    t: 0, life: big ? 1.3 : 0.95,
    vy: big ? 20 : 34,
    pop: big ? 1 : 0.4,
  });
}
