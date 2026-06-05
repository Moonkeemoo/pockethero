// src/render/arena.ts
import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { Theme } from './types';

/** One diorama arena: cool gradient sky->floor, warm light pool, floor plane,
 *  2-layer parallax, and a soft drop-shadow per creature. Simple-first (no Blender). */
export class Arena {
  readonly root = new Container();
  private bg = new Graphics();
  private shadows: Sprite[] = [];
  private shadowTex: Texture;

  constructor(private theme: Theme) {
    this.shadowTex = Arena.makeShadowTexture();
    this.root.addChild(this.bg);
  }

  resize(w: number, h: number): void {
    const g = this.bg; g.clear();
    if (this.theme.arena === 'diorama') {
      for (let y = 0; y < h; y += 2) {
        const tcol = mix(0x2c2336, 0x0e0f14, y / h); g.rect(0, y, w, 2).fill({ color: tcol });
      }
      g.ellipse(w * 0.5, h * 0.34, w * 0.45, h * 0.30).fill({ color: 0xffc882, alpha: 0.10 }); // warm pool
      g.rect(0, h * 0.66, w, h * 0.34).fill({ color: 0x141810, alpha: 0.5 });                  // floor plane
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
}

function mix(a: number, b: number, t: number): number {
  const ar = a >> 16 & 255, ag = a >> 8 & 255, ab = a & 255;
  const br = b >> 16 & 255, bg = b >> 8 & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}
