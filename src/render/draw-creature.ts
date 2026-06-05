// src/render/draw-creature.ts
// Creature renderer — verbatim port of poc/art-routes.html drawCreature().
// Uses BEHAV_AMP=1.0 and FLARE_INTENSITY=1.0 (prototype constants, not configurable).
import type { Build } from '../index';
import { CUBES } from '../index';
import { behaviorMod } from './behavior';
import { drawCubeB, lightenHex } from './draw-cube';
import type { Neighbours } from './draw-cube';

const FLARE_INTENSITY = 1.0;

export interface CreatureMeta {
  set: Set<string>;
  minX: number; maxX: number; minY: number; maxY: number;
  cxg: number; cyg: number; span: number;
  wCells: number; hCells: number;
}

/** Pre-compute stable per-build metadata (call once per build, cache result). */
export function buildMeta(build: Build): CreatureMeta {
  const set = new Set(build.map(p => p.gx + ',' + p.gy));
  const gxs = build.map(p => p.gx), gys = build.map(p => p.gy);
  const minX = Math.min(...gxs), maxX = Math.max(...gxs);
  const minY = Math.min(...gys), maxY = Math.max(...gys);
  const cxg = (minX + maxX) / 2, cyg = (minY + maxY) / 2;
  const span = Math.max(maxX - minX, maxY - minY) / 2 + 0.5;
  return { set, minX, maxX, minY, maxY, cxg, cyg, span, wCells: maxX - minX + 1, hCells: maxY - minY + 1 };
}

export interface ActorAnim {
  t: number;       // clock
  phase: number;   // per-creature phase offset
  squash: number;  // current squash scalar [0..1], decays each frame
  flare: number;   // attack flare [0..1]
  lunge: number;   // lunge offset scalar
  attack: number;  // attack progress [0..2.2+], 0=idle
  dir: 1 | -1;     // facing direction
}

/**
 * Draw one creature.
 * cx = screen X of the creature's horizontal center.
 * groundY = Y of the floor (feet anchor).
 * cell = pixel size of one cube.
 */
export function drawCreature(
  ctx: CanvasRenderingContext2D,
  build: Build,
  meta: CreatureMeta,
  cx: number,
  groundY: number,
  cell: number,
  a: ActorAnim,
): void {
  const m = meta;
  const lightF = (gx: number, gy: number): number =>
    Math.max(-1, Math.min(1, -(((gx - m.cxg) / m.span) * 0.55 + ((gy - m.cyg) / m.span) * 0.75)));

  // Punchier motion: deeper squash + stronger breath (director: more impact)
  const squash = a.squash ?? 0;
  const sq = 1 - squash * 0.28;   // was 0.18 — deeper horizontal squash
  const st = 1 + squash * 0.22;   // was 0.14 — taller vertical stretch on impact
  const breath = 1 + 0.05 * Math.sin(a.t * 2.6 + a.phase);  // was 0.03 — livelier idle
  const dir = a.dir ?? 1;

  // Drop shadow (verbatim prototype line 291–292, route B uses 0.45)
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.ellipse(cx, groundY + cell * 0.18, cell * m.wCells * 0.42, cell * 0.42, 0, 0, 7);
  ctx.fill();

  // Soft glow behind (verbatim prototype lines 294–298, route B branch)
  {
    const gr = cell * m.span * 2.2;
    const cyB = groundY - (m.maxY - m.cyg) * cell;
    const gg = ctx.createRadialGradient(cx, cyB, 2, cx, cyB, gr);
    const nonCore = build.find(p => p.type !== 'core');
    const tintCol = lightenHex(CUBES[nonCore?.type ?? 'force']?.col ?? '#E0483F', 0.2);
    gg.addColorStop(0, 'rgba(255,220,170,0.14)');
    gg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gg;
    ctx.beginPath(); ctx.arc(cx, cyB, gr, 0, 7); ctx.fill();
  }

  // Pixel cubes — punchier motion: stronger sway burst on attack, larger lunge
  for (let idx = 0; idx < build.length; idx++) {
    const p = build[idx]!;
    const bm = behaviorMod(p.type, a.t, idx * 1.7);
    const sway = dir
      * Math.sin(a.t * 3.0 + a.phase + (m.maxY - p.gy) * 0.5)
      * (0.6 + (a.attack > 0 ? 3.5 * Math.exp(-((a.attack - 1) ** 2) * 6) : 0))
      * (m.maxY - p.gy) * 0.05 * cell;

    const x = cx + (p.gx * cell * sq) + bm.sx * cell + sway
              + dir * (a.lunge ?? 0) * (m.maxY - p.gy) * cell * 0.16;
    const y = groundY - ((m.maxY - p.gy) * cell) * st * breath + bm.sy * cell;

    const cat = CUBES[p.type]?.cat ?? 'body';
    const fl = (a.flare ?? 0) * FLARE_INTENSITY
      * ((cat === 'attack' || cat === 'magic' || p.type === 'core') ? 1 : 0.15);
    const pop = 1 + fl * 0.4;
    const w = (cell + 0.8) * pop;
    const lf = lightF(p.gx, p.gy);

    const N: Neighbours = {
      U: m.set.has(p.gx + ',' + (p.gy - 1)),
      D: m.set.has(p.gx + ',' + (p.gy + 1)),
      L: m.set.has((p.gx - 1) + ',' + p.gy),
      R: m.set.has((p.gx + 1) + ',' + p.gy),
    };

    drawCubeB(ctx, x, y, w, p.type, fl, N, lf, true, bm.bright);
  }
  // No eye — director LOCKED "No faces" (route B: STATE.faces is false)
}
