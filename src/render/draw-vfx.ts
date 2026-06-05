// src/render/draw-vfx.ts
// Particle VFX system — verbatim port of poc/art-routes.html route-B VFX:
// chunk(), ring(), stepParts(), drawParts(), spawnVFX().
// Cosmetic Math.random is isolated here and never touches the sim.
import { lightenHex } from './draw-cube';

// ---- Particle types (match prototype's anonymous objects) ----
interface ChunkParticle {
  x: number; y: number; vx: number; vy: number;
  life: number; fade: number; grav: number;
  col: string; s: number;
  add: boolean; isRing: false;
}
interface RingParticle {
  x: number; y: number; r: number; grow: number; wd: number;
  col: string; life: number; fade: number; add: boolean; isRing: true;
}
type Particle = ChunkParticle | RingParticle;

export class VfxState {
  parts: Particle[] = [];
  shake = 0;    // current shake amplitude (px)
  hitstop = 0;  // seconds of frozen sim remaining
}

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

/** Verbatim from prototype stepParts() (line 335–337) */
export function stepParts(state: VfxState, dt: number): void {
  for (let i = state.parts.length - 1; i >= 0; i--) {
    const p = state.parts[i]!;
    p.life -= dt * p.fade;
    if (p.life <= 0) { state.parts.splice(i, 1); continue; }
    if (p.isRing) {
      (p as RingParticle).r += (p as RingParticle).grow * dt;
    } else {
      const cp = p as ChunkParticle;
      cp.vy += cp.grav * dt;
      cp.x += cp.vx * dt * 60;
      cp.y += cp.vy * dt * 60;
    }
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
