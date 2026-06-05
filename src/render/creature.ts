// src/render/creature.ts
import { Container, Graphics } from 'pixi.js';
import type { Build } from '../index';
import type { Theme } from './types';
import { lighten, darken } from './palette';
import { drawGlyph } from './glyph';
import { makeSpring, stepSpring, impulse } from './softbody';
import type { Spring } from './softbody';

const CELL = 14; // base px per stat-pixel (depth-scaled by the scene, never bitmap-stretched)

interface Cell { gx: number; gy: number; type: string; g: Graphics; springX: Spring; springY: Spring }

export class Creature {
  readonly root = new Container();
  private cells: Cell[] = [];
  readonly meta: { minX: number; maxX: number; minY: number; maxY: number; cx: number; cy: number; span: number; wCells: number; hCells: number };
  private t = 0;
  private squash = 0;
  private flashFrames = 0;
  private flareFrames = 0;   // causal flare brightness timer
  facing: 1 | -1 = 1;

  constructor(private build: Build, private theme: Theme) {
    const gxs = build.map((p) => p.gx), gys = build.map((p) => p.gy);
    const minX = Math.min(...gxs), maxX = Math.max(...gxs), minY = Math.min(...gys), maxY = Math.max(...gys);
    this.meta = { minX, maxX, minY, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2,
      span: Math.max(maxX - minX, maxY - minY) / 2 + 0.5, wCells: maxX - minX + 1, hCells: maxY - minY + 1 };
    const present = new Set(build.map((p) => p.gx + ',' + p.gy));
    for (const p of build) {
      const g = new Graphics();
      this.drawCube(g, p.gx, p.gy, p.type, present);
      this.root.addChild(g);
      this.cells.push({ gx: p.gx, gy: p.gy, type: p.type, g, springX: makeSpring(), springY: makeSpring(160, 13) });
    }
  }

  private lightFactor(gx: number, gy: number): number {
    const nx = (gx - this.meta.cx) / this.meta.span, ny = (gy - this.meta.cy) / this.meta.span;
    return Math.max(-1, Math.min(1, -(nx * this.theme.light.x + ny * this.theme.light.y)));
  }

  /** Draw one cube into its own Graphics at local origin; transforms position it each frame. */
  private drawCube(g: Graphics, gx: number, gy: number, type: string, present: Set<string>): void {
    const ramp = this.theme.ramp(type);
    const lf = this.lightFactor(gx, gy);
    const has = (x: number, y: number) => present.has(x + ',' + y);
    g.clear();
    if (this.theme.cube === 'diorama') {
      const top = lighten(ramp.base, 0.16 + 0.16 * Math.max(0, lf));
      const bot = darken(ramp.mid, 0.10);
      g.rect(0, 0, CELL, CELL).fill({ color: top });           // base fill (top tone)
      g.rect(0, CELL * 0.5, CELL, CELL * 0.5).fill({ color: bot, alpha: 0.85 }); // lower-half darken (gradient feel)
      // rim light on free top/left edges
      if (!has(gx, gy - 1)) g.rect(0, 0, CELL, 2).fill({ color: 0xfff4e0, alpha: 0.5 });
      if (!has(gx - 1, gy)) g.rect(0, 0, 2, CELL).fill({ color: 0xfff4e0, alpha: 0.5 });
      // soft contact shadow on free bottom/right edges
      if (!has(gx, gy + 1)) g.rect(0, CELL - 2, CELL, 2).fill({ color: 0x000000, alpha: 0.28 });
      if (!has(gx + 1, gy)) g.rect(CELL - 2, 0, 2, CELL).fill({ color: 0x000000, alpha: 0.28 });
    } else { // flat scaffolding theme
      g.rect(0, 0, CELL, CELL).fill({ color: ramp.base });
      g.rect(0, 0, CELL, CELL * 0.16).fill({ color: 0xffffff, alpha: 0.12 });
      const o = 2;
      if (!has(gx, gy - 1)) g.rect(0, 0, CELL, o).fill({ color: 0x05060a });
      if (!has(gx, gy + 1)) g.rect(0, CELL - o, CELL, o).fill({ color: 0x05060a });
      if (!has(gx - 1, gy)) g.rect(0, 0, o, CELL).fill({ color: 0x05060a });
      if (!has(gx + 1, gy)) g.rect(CELL - o, 0, o, CELL).fill({ color: 0x05060a });
    }
    drawGlyph(g, type, CELL / 2, CELL / 2, CELL, this.theme.ramp(type).shadow, 0.9);
  }

  /** hit reaction: kick springs + set squash. */
  react(power: number): void {
    this.squash = Math.min(1, this.squash + 0.5 + power * 0.04);
    for (const c of this.cells) { impulse(c.springX, (Math.random() - 0.5) * 4); impulse(c.springY, -2 - power * 0.1); }
  }

  /** Set flash: tint the root for N frames at the given color. */
  flash(frames: number, color: number): void {
    this.flashFrames = frames;
    this.root.tint = color;
  }

  /** Causal flare: briefly brighten the actor when it fires a move. */
  flare(durationFrames: number): void {
    this.flareFrames = durationFrames;
  }

  /** per-frame: advance springs + breathing + squash, lay out cells (spacing-based, crisp). */
  update(dt: number): void {
    this.t += dt;
    this.squash *= Math.pow(0.0006, dt);
    const sq = 1 - this.squash * 0.18, st = 1 + this.squash * 0.14;
    const breath = 1 + 0.03 * Math.sin(this.t * 2.6);
    const feet = this.meta.maxY;
    for (const c of this.cells) {
      stepSpring(c.springX, dt); stepSpring(c.springY, dt);
      const x = (c.gx * CELL * sq) + c.springX.x;
      const y = -((feet - c.gy) * CELL) * st * breath + c.springY.x;
      c.g.position.set(Math.round(x), Math.round(y));
    }
    // Apply facing — creatures face each other via x-scale flip
    this.root.scale.x = Math.abs(this.root.scale.x) * this.facing;

    // flash decay
    if (this.flashFrames > 0) {
      this.flashFrames--;
      if (this.flashFrames <= 0) this.root.tint = 0xffffff;
    }

    // flare: brighten root tint while active (overrides flash only when flash is done)
    if (this.flareFrames > 0) {
      this.flareFrames--;
      // brighten by blending toward white; use alpha-channel trick via tint
      const brightness = 0xfff4aa; // warm pre-attack glow
      if (this.flashFrames <= 0) this.root.tint = brightness;
      if (this.flareFrames <= 0 && this.flashFrames <= 0) this.root.tint = 0xffffff;
    }
  }
}
