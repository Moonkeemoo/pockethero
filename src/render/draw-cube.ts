// src/render/draw-cube.ts
// Route-B cube drawing — verbatim port of poc/art-routes.html drawCube(R==='B', ...).
// Uses hex-string colour helpers (same as the prototype) — NOT palette.ts numerics.
import { CUBES } from '../index';
import { drawGlyph } from './draw-glyph';

// ---- Hex-string colour helpers (verbatim from poc/art-routes.html) ----
const _lc: Record<string, string> = {};
export function lightenHex(hex: string, a: number): string {
  if (a <= 0) return hex;
  const k = hex + 'L' + a.toFixed(2);
  if (_lc[k]) return _lc[k]!;
  let n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.round(r + (255 - r) * a);
  g = Math.round(g + (255 - g) * a);
  b = Math.round(b + (255 - b) * a);
  return (_lc[k] = '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1));
}
export function darkenHex(hex: string, a: number): string {
  if (a <= 0) return hex;
  const k = hex + 'D' + a.toFixed(2);
  if (_lc[k]) return _lc[k]!;
  let n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.round(r * (1 - a));
  g = Math.round(g * (1 - a));
  b = Math.round(b * (1 - a));
  return (_lc[k] = '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1));
}
export function desatHex(hex: string, t: number): string {
  let n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const l = 0.3 * r + 0.59 * g + 0.11 * b;
  r = r + (l - r) * t; g = g + (l - g) * t; b = b + (l - b) * t;
  return '#' + ((1 << 24) | (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)).toString(16).slice(1);
}

export interface Neighbours { U: boolean; D: boolean; L: boolean; R: boolean }

/**
 * Draw one cube at (x,y) with width w, route-B style.
 * fl = flash/flare intensity [0..1], lightF = light factor [-1..1].
 * showGlyph controls whether to draw the glyph (always true in combat view).
 */
export function drawCubeB(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number,
  type: string,
  fl: number,
  neigh: Neighbours,
  lightF: number,
  showGlyph = true,
): void {
  const cube = CUBES[type];
  const base = cube?.col ?? '#888888';
  const tint = cube?.tint ?? '#101010';
  const glyph = cube?.glyph ?? 'star';

  const rx = Math.round(x - w / 2), ry = Math.round(y - w / 2), rw = Math.round(w);

  // Route-B gradient (verbatim from prototype lines 210–213)
  const top = lightenHex(base, 0.16 + 0.16 * Math.max(0, lightF) + (fl > 0.1 ? fl * 0.6 : 0));
  const bot = darkenHex(desatHex(base, 0.10), 0.18 - 0.10 * Math.max(0, lightF));
  const grd = ctx.createLinearGradient(rx, ry, rx, ry + rw);
  grd.addColorStop(0, top);
  grd.addColorStop(1, bot);
  ctx.fillStyle = grd;
  ctx.fillRect(rx, ry, rw, rw);

  // Rim light on free top/left edges (verbatim prototype lines 215–218)
  ctx.fillStyle = 'rgba(255,250,240,0.5)';
  if (!neigh.U) ctx.fillRect(rx, ry, rw, Math.max(1, rw * 0.12));
  if (!neigh.L) ctx.fillRect(rx, ry, Math.max(1, rw * 0.12), rw);

  // Soft contact shadow on free bottom/right edges (verbatim prototype lines 219–221)
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  if (!neigh.D) ctx.fillRect(rx, ry + rw - Math.max(1, rw * 0.12), rw, Math.max(1, rw * 0.12));
  if (!neigh.R) ctx.fillRect(rx + rw - Math.max(1, rw * 0.12), ry, Math.max(1, rw * 0.12), rw);

  // Glyph in dark tint (verbatim prototype line 222)
  if (showGlyph) drawGlyph(ctx, glyph, x, y, rw, fl > 0.25 ? '#fff' : tint, 0.85);
}
