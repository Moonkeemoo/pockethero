// src/render/creature.ts
import { Container, Graphics, FillGradient } from 'pixi.js';
import type { Build } from '../index';
import { CUBES } from '../index';
import type { Theme } from './types';
import { lighten, darken, desat } from './palette';
import { drawGlyph } from './glyph';
import { behaviorMod } from './behavior';

const CELL = 14;       // base px per stat-pixel (depth-scaled by the scene)
const SWAY_AMP = 0.04; // fraction of CELL per row of distance from feet

// Convert a '#rrggbb' hex string to a 0xRRGGBB number
function hexToNum(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

interface CellNode {
  gx: number; gy: number; type: string;
  g: Graphics;      // baked cube geometry (gradient + edges + glyph)
  hi: Graphics;     // additive brightness overlay (white rect, blendMode='add')
}

export class Creature {
  readonly root = new Container();
  private cells: CellNode[] = [];

  readonly meta: {
    minX: number; maxX: number; minY: number; maxY: number;
    cx: number; cy: number; span: number; wCells: number; hCells: number;
  };

  private t = 0;
  private phase: number;    // fixed per-creature cosmetic phase (deterministic)
  private squash = 0;       // current squash scalar, decays each frame
  private wobble = 0;       // decays after react(), amplifies row-sway briefly
  private flashFrames = 0;
  private flareFrames = 0;
  facing: 1 | -1 = 1;

  constructor(private build: Build, private theme: Theme) {
    const gxs = build.map(p => p.gx), gys = build.map(p => p.gy);
    const minX = Math.min(...gxs), maxX = Math.max(...gxs);
    const minY = Math.min(...gys), maxY = Math.max(...gys);
    this.meta = {
      minX, maxX, minY, maxY,
      cx: (minX + maxX) / 2, cy: (minY + maxY) / 2,
      span: Math.max(maxX - minX, maxY - minY) / 2 + 0.5,
      wCells: maxX - minX + 1, hCells: maxY - minY + 1,
    };

    // Deterministic phase: derived from build length, no Math.random
    this.phase = (build.length * 1.3) % (Math.PI * 2);

    const present = new Set(build.map(p => p.gx + ',' + p.gy));

    for (let idx = 0; idx < build.length; idx++) {
      const p = build[idx]!;
      const g = new Graphics();
      this.bakeCube(g, p.gx, p.gy, p.type, present);
      this.root.addChild(g);

      // Additive brightness overlay — white rect same size, driven per-frame
      const hi = new Graphics();
      hi.rect(0, 0, CELL, CELL).fill({ color: 0xffffff, alpha: 1 });
      hi.blendMode = 'add';
      hi.alpha = 0;
      this.root.addChild(hi);

      this.cells.push({ gx: p.gx, gy: p.gy, type: p.type, g, hi });
    }
  }

  private lightFactor(gx: number, gy: number): number {
    const nx = (gx - this.meta.cx) / this.meta.span;
    const ny = (gy - this.meta.cy) / this.meta.span;
    // light direction from theme; routeB uses {x:-0.55, y:-0.75} (upper-left)
    return Math.max(-1, Math.min(1, -(nx * this.theme.light.x + ny * this.theme.light.y)));
  }

  /** Bake one cube into its Graphics (called once in constructor). */
  private bakeCube(g: Graphics, gx: number, gy: number, type: string, present: Set<string>): void {
    const ramp = this.theme.ramp(type);
    const lf = this.lightFactor(gx, gy);
    const base = ramp.base; // numeric 0xRRGGBB

    // Route-B gradient: top=lighten(desat(base,0.10), ...), bot=darken(desat(base,0.10), ...)
    const desatBase = desat(base, 0.10);
    const topColor = lighten(desatBase, 0.16 + 0.16 * Math.max(0, lf));
    const botColor = darken(desatBase, 0.18 - 0.10 * Math.max(0, lf));

    const gradient = new FillGradient({
      type: 'linear',
      start: { x: 0, y: 0 },
      end:   { x: 0, y: 1 },
      colorStops: [
        { offset: 0, color: topColor },
        { offset: 1, color: botColor },
      ],
    });

    g.rect(0, 0, CELL, CELL).fill(gradient);

    const has = (x: number, y: number) => present.has(x + ',' + y);
    const rim = Math.max(1, Math.round(CELL * 0.12));
    const shadow = Math.max(1, Math.round(CELL * 0.12));

    // Rim light on free top/left edges (point light upper-left)
    if (!has(gx, gy - 1)) g.rect(0, 0, CELL, rim).fill({ color: 0xfffaf0, alpha: 0.5 });
    if (!has(gx - 1, gy)) g.rect(0, 0, rim, CELL).fill({ color: 0xfffaf0, alpha: 0.5 });

    // Contact shadow on free bottom/right edges
    if (!has(gx, gy + 1)) g.rect(0, CELL - shadow, CELL, shadow).fill({ color: 0x000000, alpha: 0.28 });
    if (!has(gx + 1, gy)) g.rect(CELL - shadow, 0, shadow, CELL).fill({ color: 0x000000, alpha: 0.28 });

    // Glyph in the cube's dark tint colour (not ramp.shadow)
    const cubeTint = hexToNum(CUBES[type]?.tint ?? '#101010');
    drawGlyph(g, type, CELL / 2, CELL / 2, CELL, cubeTint, 0.9);
  }

  /** Hit reaction: bump squash + wobble for post-hit sway burst. */
  react(power: number): void {
    this.squash = Math.min(1, this.squash + 0.5 + power * 0.04);
    this.wobble = 1;
  }

  /** White-flash on hit. */
  flash(frames: number, color: number): void {
    this.flashFrames = frames;
    this.root.tint = color;
  }

  /** Warm-tint flare when the creature fires a move. */
  flare(durationFrames: number): void {
    this.flareFrames = durationFrames;
  }

  /** Per-frame: advance time, apply coordinated soft-body motion + behaviorMod. */
  update(dt: number): void {
    this.t += dt;
    this.squash *= Math.pow(0.0006, dt);
    this.wobble  *= Math.pow(0.01, dt);   // wobble decays quickly after hit

    const sq     = 1 - this.squash * 0.18;
    const st     = 1 + this.squash * 0.14;
    const breath = 1 + 0.03 * Math.sin(this.t * 2.6 + this.phase);
    const feet   = this.meta.maxY;
    const wobbleAmp = 1 + 2 * this.wobble;

    for (let idx = 0; idx < this.cells.length; idx++) {
      const c = this.cells[idx]!;
      // cellOffset drives the per-cell phase stagger
      const off = idx * 1.7;
      const bm  = behaviorMod(c.type, this.t, off);

      // Row-sway: rows further from feet sway more (upper body sways most)
      const rowDist = feet - c.gy;
      const sway = this.facing
        * Math.sin(this.t * 3.0 + this.phase + rowDist * 0.5)
        * SWAY_AMP * CELL * rowDist
        * wobbleAmp;

      const x = Math.round(c.gx * CELL * sq + sway + bm.sx * CELL);
      const y = Math.round(-rowDist * CELL * st * breath + bm.sy * CELL);

      c.g.position.set(x - CELL / 2, y - CELL / 2);
      c.hi.position.set(x - CELL / 2, y - CELL / 2);

      // Brightness overlay: bm.bright drives additive alpha
      c.hi.alpha = Math.max(0, bm.bright * 0.7);
    }

    // Apply facing via x-scale
    this.root.scale.x = Math.abs(this.root.scale.x) * this.facing;

    // Flash decay
    if (this.flashFrames > 0) {
      this.flashFrames--;
      if (this.flashFrames <= 0) this.root.tint = 0xffffff;
    }

    // Flare: warm pre-attack glow
    if (this.flareFrames > 0) {
      this.flareFrames--;
      if (this.flashFrames <= 0) this.root.tint = 0xfff4aa;
      if (this.flareFrames <= 0 && this.flashFrames <= 0) this.root.tint = 0xffffff;
    }
  }
}
