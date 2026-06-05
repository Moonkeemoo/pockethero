// src/render/arena.ts
import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { Theme } from './types';
import { mix } from './palette';

/** One diorama arena: cool gradient sky->floor, warm light pool, floor plane,
 *  2-layer parallax, and a soft drop-shadow per creature. Simple-first (no Blender). */
export class Arena {
  readonly root = new Container();
  private bg = new Graphics();
  private warmPool: Sprite | null = null;
  private shadows: Sprite[] = [];
  private shadowTex: Texture;

  constructor(private theme: Theme) {
    this.shadowTex = Arena.makeShadowTexture();
    this.root.addChild(this.bg);
    if (this.theme.arena === 'diorama') {
      this.warmPool = new Sprite(Arena.makeWarmPoolTexture());
      this.warmPool.anchor.set(0.5);
      this.warmPool.alpha = 0.55;
      this.root.addChild(this.warmPool);
    }
  }

  resize(w: number, h: number): void {
    const g = this.bg; g.clear();
    if (this.theme.arena === 'diorama') {
      for (let y = 0; y < h; y += 2) {
        const tcol = mix(0x2c2336, 0x0e0f14, y / h); g.rect(0, y, w, 2).fill({ color: tcol });
      }
      g.rect(0, h * 0.66, w, h * 0.34).fill({ color: 0x141810, alpha: 0.5 }); // floor plane
      // position the soft warm pool sprite (replaces the hard ellipse)
      if (this.warmPool) {
        this.warmPool.position.set(w * 0.5, h * 0.42);
        this.warmPool.width = w * 0.80;
        this.warmPool.height = h * 0.55;
      }
    } else {
      g.rect(0, 0, w, h).fill({ color: 0x14161c });
      g.rect(0, h * 0.62, w, h * 0.38).fill({ color: 0x1b1f28 });
    }
  }

  /** ensure N shadow sprites exist; returns the sprite for index i to position under a creature. */
  shadowFor(i: number): Sprite {
    while (this.shadows.length <= i) {
      const s = new Sprite(this.shadowTex); s.anchor.set(0.5); s.tint = 0x000000; s.alpha = this.theme.shadowAlpha;
      this.shadows.push(s); this.root.addChild(s);
    }
    // noUncheckedIndexedAccess guard — length was just ensured above
    return this.shadows[i]!;
  }

  private static makeShadowTexture(): Texture {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d')!; const grd = x.createRadialGradient(32, 32, 2, 32, 32, 32);
    grd.addColorStop(0, 'rgba(0,0,0,1)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = grd; x.fillRect(0, 0, 64, 64);
    return Texture.from(c);
  }

  /** Soft warm radial-gradient light pool: rgba(255,200,130,a) → transparent. */
  private static makeWarmPoolTexture(): Texture {
    const SIZE = 256;
    const c = document.createElement('canvas'); c.width = SIZE; c.height = SIZE;
    const ctx = c.getContext('2d')!;
    const cx = SIZE / 2, cy = SIZE / 2;
    const grd = ctx.createRadialGradient(cx, cy * 0.85, 0, cx, cy, SIZE / 2);
    grd.addColorStop(0,   'rgba(255,200,130,0.55)');
    grd.addColorStop(0.45,'rgba(255,185,110,0.22)');
    grd.addColorStop(0.75,'rgba(255,170,90,0.07)');
    grd.addColorStop(1,   'rgba(255,160,80,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, SIZE, SIZE);
    return Texture.from(c);
  }
}
