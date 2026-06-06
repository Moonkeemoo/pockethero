/**
 * src/render/sprite.ts — per-frame sprite animator for the billboard.
 *
 * A character animation is just an ordered list of frame image URLs (PixelLab
 * exports one PNG per frame). The animator advances frames on a clock and draws
 * the current frame so its normalised pivot lands at a screen point, flipped by
 * facing, with the engine's squash + a hit-flash. No engine/sim coupling.
 */

export interface AnimDef {
  frames: string[];   // ordered frame image URLs
  fps: number;
  loop?: boolean;     // default true
}

export interface SpriteDef {
  pivotX: number;     // 0..1 within the frame (0.5 = horizontal centre)
  pivotY: number;     // 0..1 (1 = bottom of the frame)
  anims: Record<string, AnimDef>;
}

// ---------------------------------------------------------------------------
// Image cache (one <img> per url; false once it has permanently failed)
// ---------------------------------------------------------------------------
const cache = new Map<string, HTMLImageElement | false>();
function img(src: string | undefined): HTMLImageElement | false | undefined {
  if (!src) return undefined;
  const hit = cache.get(src);
  if (hit !== undefined) return hit;
  if (typeof Image === 'undefined') { cache.set(src, false); return false; }
  const im = new Image();
  im.onerror = () => cache.set(src, false);
  im.src = src;
  cache.set(src, im);
  return im;
}
function ready(i: HTMLImageElement | false | undefined): i is HTMLImageElement {
  return !!i && i.complete && i.naturalWidth > 0;
}

export class SpriteAnimator {
  private cur = 'idle';
  private frame = 0;
  private clock = 0;
  private oneShot = false;
  private returnTo = 'idle';

  constructor(private def: SpriteDef) {
    // warm the cache
    for (const a of Object.values(def.anims)) for (const s of a.frames) img(s);
  }

  play(name: string, oneShot = false, returnTo = 'idle'): void {
    if (!this.def.anims[name]) return;
    if (this.cur === name && !oneShot) return;
    this.cur = name; this.frame = 0; this.clock = 0;
    this.oneShot = oneShot; this.returnTo = returnTo;
  }

  step(dt: number): void {
    const a = this.def.anims[this.cur]; if (!a || a.frames.length <= 1) return;
    this.clock += dt;
    const dur = 1 / Math.max(1, a.fps);
    while (this.clock >= dur) {
      this.clock -= dur; this.frame++;
      if (this.frame >= a.frames.length) {
        if (a.loop ?? true) this.frame = 0;
        else { this.frame = a.frames.length - 1; if (this.oneShot) { this.oneShot = false; this.play(this.returnTo); } }
      }
    }
  }

  /** True once at least the first idle frame is decoded (sprite is showable). */
  loaded(): boolean {
    const first = this.def.anims['idle']?.frames[0] ?? this.def.anims[this.cur]?.frames[0];
    return ready(img(first));
  }

  /**
   * Draw the current frame at (x, baseY) with its pivot, scaled by `scale`
   * (multiplier on the frame's natural pixel size). `face<0` mirrors X.
   * Returns false if the frame isn't decoded yet (caller may fall back).
   */
  draw(
    ctx: CanvasRenderingContext2D,
    x: number, baseY: number, scale: number,
    face: 1 | -1, sqX = 1, sqY = 1, flash = 0,
  ): boolean {
    const a = this.def.anims[this.cur];
    const im = img(a?.frames[this.frame]);
    if (!ready(im)) return false;
    const nw = im.naturalWidth, nh = im.naturalHeight;
    const dw = nw * scale * sqX, dh = nh * scale * sqY;
    const dx = x - dw * this.def.pivotX, dy = baseY - dh * this.def.pivotY;
    ctx.save();
    if (face < 0) { ctx.translate(x, 0); ctx.scale(-1, 1); ctx.translate(-x, 0); }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(im, dx, dy, dw, dh);
    if (flash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, flash) * 0.6;
      ctx.drawImage(im, dx, dy, dw, dh);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    return true;
  }
}
