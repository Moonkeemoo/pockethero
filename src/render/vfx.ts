// src/render/vfx.ts
// Plays VfxIntents: screenshake, hitstop, flash, debris, floating numbers, pings, heals.
// Cosmetic Math.random is ISOLATED here — it never reaches the sim (determinism intact).
import { Container, Graphics, Text } from 'pixi.js';
import type { VfxIntent } from './types';

interface DebrisParticle { g: Graphics; vx: number; vy: number; life: number; fade: number }
interface FloatLabel { t: Text; life: number; vy: number }

/** Owns transient particles + screen-level shake/hitstop state. */
export class Vfx {
  readonly layer = new Container();       // debris + floating numbers, above creatures
  shake = 0;                              // current shake amplitude (px), decays each frame
  hitstop = 0;                            // seconds of frozen sim remaining
  private parts: DebrisParticle[] = [];
  private floats: FloatLabel[] = [];

  /** Play one intent.
   *  @param at      resolves a fighter id to current screen position
   *  @param onFlash (id, color, frames) — calls creature.flash
   */
  play(
    i: VfxIntent,
    at: (id: string) => { x: number; y: number },
    onFlash: (id: string, color: number, frames: number) => void,
  ): void {
    switch (i.kind) {
      case 'shake':
        this.shake = Math.max(this.shake, i.amp);
        break;
      case 'hitstop':
        this.hitstop = Math.max(this.hitstop, i.frames / 60);
        break;
      case 'flash':
        onFlash(i.target, i.color, i.frames);
        break;
      case 'debris': {
        const p = at(i.target);
        for (let k = 0; k < i.count; k++) this.spawnDebris(p.x, p.y, i.color);
        break;
      }
      case 'floating': {
        const p = at(i.target);
        this.spawnFloat(p.x, p.y, i.text, i.color, i.crit);
        break;
      }
      case 'heal': {
        const p = at(i.target);
        this.spawnFloat(p.x, p.y, '+' + String(i.amount), 0x46d68c, false);
        break;
      }
      case 'ping': {
        const p = at(i.target);
        this.spawnFloat(p.x, p.y, i.label === 'block' ? 'BLOCK' : 'DODGE', 0x9fc0ff, false);
        break;
      }
      case 'ko':
        // KO just lets HP drain to zero; no extra particle (scene can pushLog)
        break;
    }
  }

  private spawnDebris(x: number, y: number, color: number): void {
    const g = new Graphics();
    const s = 3 + Math.random() * 3;
    g.rect(-s / 2, -s / 2, s, s).fill({ color });
    g.position.set(x, y);
    this.layer.addChild(g);
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.8;
    const sp = 3 + Math.random() * 4;
    this.parts.push({ g, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, fade: 1.6 });
  }

  private spawnFloat(x: number, y: number, text: string, color: number, crit: boolean): void {
    const t = new Text({
      text,
      style: { fontFamily: 'system-ui', fontSize: crit ? 22 : 16, fontWeight: '700', fill: color },
    });
    t.anchor.set(0.5);
    t.position.set(x, y);
    this.layer.addChild(t);
    this.floats.push({ t, life: 1, vy: -1.4 });
  }

  /** Destroy all transient particles and floating labels; reset shake/hitstop. */
  clear(): void {
    for (const p of this.parts) p.g.destroy();
    this.parts = [];
    for (const f of this.floats) f.t.destroy();
    this.floats = [];
  }

  /** Advance all particles; returns shake offset to apply to the world container. */
  update(dt: number): { x: number; y: number } {
    this.shake *= Math.pow(0.0001, dt);

    for (let k = this.parts.length - 1; k >= 0; k--) {
      const p = this.parts[k]!;
      p.life -= dt * p.fade;
      if (p.life <= 0) { p.g.destroy(); this.parts.splice(k, 1); continue; }
      p.vy += 26 * dt;
      p.g.x += p.vx * dt * 60;
      p.g.y += p.vy * dt * 60;
      p.g.alpha = Math.min(1, p.life * 1.3);
    }

    for (let k = this.floats.length - 1; k >= 0; k--) {
      const f = this.floats[k]!;
      f.life -= dt * 1.1;
      if (f.life <= 0) { f.t.destroy(); this.floats.splice(k, 1); continue; }
      f.t.y += f.vy * dt * 60;
      f.t.alpha = Math.min(1, f.life * 1.5);
    }

    const amp = this.shake > 0.1 ? this.shake : 0;
    return {
      x: (Math.random() - 0.5) * amp,
      y: (Math.random() - 0.5) * amp,
    };
  }
}
