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

// ---------------------------------------------------------------------------
// Content bounding box per frame (opaque-pixel extent). Used to anchor every
// frame by its FEET (content bottom) + horizontal content centre, so the sprite
// sits on the ground and an idle's breathing doesn't make it drift/jitter.
// ---------------------------------------------------------------------------
interface BBox { cx: number; bottom: number; top: number; w: number; h: number }
const bboxCache = new Map<string, BBox>();
let measureCanvas: HTMLCanvasElement | null = null;
function bbox(src: string, im: HTMLImageElement): BBox {
  const hit = bboxCache.get(src);
  if (hit) return hit;
  const w = im.naturalWidth, h = im.naturalHeight;
  let box: BBox = { cx: w / 2, bottom: h, top: 0, w, h };
  try {
    if (!measureCanvas) measureCanvas = document.createElement('canvas');
    measureCanvas.width = w; measureCanvas.height = h;
    const g = measureCanvas.getContext('2d', { willReadFrequently: true })!;
    g.clearRect(0, 0, w, h); g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, w, h).data;
    let minX = w, maxX = -1, minY = h, maxY = -1;
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        if ((d[(row + x) * 4 + 3] ?? 0) > 24) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
      }
    }
    if (maxX >= 0) box = { cx: (minX + maxX + 1) / 2, bottom: maxY + 1, top: minY, w, h };
  } catch { /* tainted/headless — keep frame-centre fallback */ }
  bboxCache.set(src, box);
  return box;
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

  private srcFor(): { src: string | undefined; im: HTMLImageElement | false | undefined } {
    const a = this.def.anims[this.cur];
    const src = a?.frames[this.frame];
    return { src, im: img(src) };
  }

  /**
   * Draw the current frame so its FEET (content bottom) sit at (x, baseY) and
   * its content centre aligns to x. `scale` multiplies the frame's natural px.
   * `face<0` mirrors X. Returns false if the frame isn't decoded yet.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    x: number, baseY: number, scale: number,
    face: 1 | -1, sqX = 1, sqY = 1, flash = 0,
  ): boolean {
    const { src, im } = this.srcFor();
    if (!ready(im) || !src) return false;
    const bb = bbox(src, im);
    const dw = im.naturalWidth * scale * sqX, dh = im.naturalHeight * scale * sqY;
    // anchor content-centre-x → x, content-bottom → baseY
    const dx = x - bb.cx * scale * sqX;
    const dy = baseY - bb.bottom * scale * sqY;
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

  /** Screen Y of the content top (head) when drawn at (baseY, scale) — for HUD placement above the head. */
  headTopY(baseY: number, scale: number, sqY = 1): number {
    const { src, im } = this.srcFor();
    if (!ready(im) || !src) return baseY - 240 * scale * sqY;
    const bb = bbox(src, im);
    return baseY - (bb.bottom - bb.top) * scale * sqY;
  }
}
