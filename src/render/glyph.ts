// src/render/glyph.ts
// Per-type glyph baked onto a Pixi Graphics (one per cube). Ported from
// poc/builder.html drawGlyph; Canvas2D path ops -> Pixi v8 Graphics path ops.
// `size` is the cube cell size in px; glyph is centred on (cx,cy).
import { Graphics } from 'pixi.js';
import { CUBES } from '../index';

const GLYPH_FRAC = 0.62;

export function drawGlyph(g: Graphics, type: string, cx: number, cy: number, size: number, color: number, alpha: number): void {
  const key = CUBES[type]?.glyph ?? 'star';
  const r = size * GLYPH_FRAC * 0.5;
  const stroke = { width: Math.max(1, size * 0.10), color, alpha, cap: 'round' as const, join: 'round' as const };
  const fill = { color, alpha };
  switch (key) {
    case 'heart': {
      g.moveTo(cx, cy + r * 0.85)
        .bezierCurveTo(cx + r * 1.2, cy + r * 0.05, cx + r * 0.55, cy - r * 0.95, cx, cy - r * 0.15)
        .bezierCurveTo(cx - r * 0.55, cy - r * 0.95, cx - r * 1.2, cy + r * 0.05, cx, cy + r * 0.85)
        .fill(fill);
      break;
    }
    case 'pulse': {
      // heartbeat line
      g.moveTo(cx - r, cy).lineTo(cx - r * 0.4, cy).lineTo(cx - r * 0.15, cy - r * 0.7)
        .lineTo(cx + r * 0.1, cy + r * 0.7).lineTo(cx + r * 0.4, cy).lineTo(cx + r, cy).stroke(stroke);
      break;
    }
    case 'fang': {
      // two fangs
      g.moveTo(cx - r * 0.5, cy - r * 0.6).lineTo(cx - r * 0.5, cy + r * 0.2).lineTo(cx - r * 0.2, cy - r * 0.2).closePath().fill(fill);
      g.moveTo(cx + r * 0.5, cy - r * 0.6).lineTo(cx + r * 0.5, cy + r * 0.2).lineTo(cx + r * 0.2, cy - r * 0.2).closePath().fill(fill);
      break;
    }
    case 'shield': {
      g.moveTo(cx, cy - r).lineTo(cx + r * 0.8, cy - r * 0.6).lineTo(cx + r * 0.8, cy + r * 0.25)
        .quadraticCurveTo(cx + r * 0.8, cy + r * 0.9, cx, cy + r)
        .quadraticCurveTo(cx - r * 0.8, cy + r * 0.9, cx - r * 0.8, cy + r * 0.25)
        .lineTo(cx - r * 0.8, cy - r * 0.6).closePath().fill(fill);
      break;
    }
    case 'blade': {
      g.moveTo(cx, cy - r).lineTo(cx, cy + r * 0.55).stroke(stroke);
      g.moveTo(cx - r * 0.55, cy + r * 0.18).lineTo(cx + r * 0.55, cy + r * 0.18).stroke(stroke);
      // blade tip triangle
      g.moveTo(cx, cy - r).lineTo(cx - r * 0.22, cy - r * 0.55).lineTo(cx + r * 0.22, cy - r * 0.55).closePath().fill(fill);
      break;
    }
    case 'arrowdn': {
      // down-arrow piercing
      g.moveTo(cx, cy - r).lineTo(cx, cy + r * 0.5).stroke(stroke);
      g.moveTo(cx, cy + r).lineTo(cx - r * 0.45, cy + r * 0.35).lineTo(cx + r * 0.45, cy + r * 0.35).closePath().fill(fill);
      break;
    }
    case 'rage': {
      // spiky star
      g.poly(starPoints(cx, cy, r, 10, 0.4)).fill(fill);
      break;
    }
    case 'brace': {
      // bracket shield
      g.arc(cx, cy, r * 0.85, Math.PI * 0.8, Math.PI * 2.2).stroke(stroke);
      g.moveTo(cx - r * 0.3, cy).lineTo(cx + r * 0.3, cy).stroke(stroke);
      break;
    }
    case 'thorns': {
      // spikes
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2;
        g.moveTo(cx, cy).lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r).stroke(stroke);
        g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
          .lineTo(cx + Math.cos(a + 0.3) * r * 0.6, cy + Math.sin(a + 0.3) * r * 0.6).stroke(stroke);
      }
      break;
    }
    case 'rune': {
      // hex rune
      g.poly(hexPoints(cx, cy, r)).closePath().stroke(stroke);
      g.circle(cx, cy, r * 0.25).fill(fill);
      break;
    }
    case 'chevron': {
      g.moveTo(cx - r * 0.7, cy - r * 0.7).lineTo(cx + r * 0.05, cy).lineTo(cx - r * 0.7, cy + r * 0.7).stroke(stroke);
      g.moveTo(cx - r * 0.05, cy - r * 0.7).lineTo(cx + r * 0.7, cy).lineTo(cx - r * 0.05, cy + r * 0.7).stroke(stroke);
      break;
    }
    case 'dblchev': {
      // fast double chevron
      g.moveTo(cx - r * 0.8, cy - r * 0.7).lineTo(cx - r * 0.1, cy).lineTo(cx - r * 0.8, cy + r * 0.7).stroke(stroke);
      g.moveTo(cx + r * 0.0, cy - r * 0.7).lineTo(cx + r * 0.7, cy).lineTo(cx + r * 0.0, cy + r * 0.7).stroke(stroke);
      break;
    }
    case 'wisp': {
      // swirl
      g.arc(cx, cy, r * 0.7, 0.4, Math.PI * 1.7).stroke(stroke);
      g.arc(cx + r * 0.2, cy + r * 0.1, r * 0.3, Math.PI, Math.PI * 2.6).stroke(stroke);
      break;
    }
    case 'flame': {
      g.moveTo(cx, cy + r).bezierCurveTo(cx + r * 0.95, cy + r * 0.4, cx + r * 0.5, cy - r * 0.4, cx, cy - r)
        .bezierCurveTo(cx - r * 0.3, cy - r * 0.3, cx - r * 0.85, cy + r * 0.2, cx, cy + r).fill(fill);
      break;
    }
    case 'snow': {
      for (let k = 0; k < 6; k++) {
        const a = k * Math.PI / 3;
        g.moveTo(cx, cy).lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r).stroke(stroke);
        const bx = cx + Math.cos(a) * r * 0.6, by = cy + Math.sin(a) * r * 0.6;
        const pa = a + Math.PI / 2;
        g.moveTo(bx - Math.cos(pa) * r * 0.22, by - Math.sin(pa) * r * 0.22)
          .lineTo(bx + Math.cos(pa) * r * 0.22, by + Math.sin(pa) * r * 0.22).stroke(stroke);
      }
      break;
    }
    case 'bolt': {
      g.moveTo(cx + r * 0.3, cy - r).lineTo(cx - r * 0.35, cy + r * 0.1).lineTo(cx + r * 0.1, cy + r * 0.1)
        .lineTo(cx - r * 0.3, cy + r).lineTo(cx + r * 0.4, cy - r * 0.15).lineTo(cx - r * 0.05, cy - r * 0.15)
        .closePath().fill(fill);
      break;
    }
    case 'vial': {
      // flask
      g.moveTo(cx - r * 0.25, cy - r).lineTo(cx - r * 0.25, cy - r * 0.2)
        .lineTo(cx - r * 0.6, cy + r * 0.7).quadraticCurveTo(cx - r * 0.6, cy + r, cx, cy + r)
        .quadraticCurveTo(cx + r * 0.6, cy + r, cx + r * 0.6, cy + r * 0.7).lineTo(cx + r * 0.25, cy - r * 0.2)
        .lineTo(cx + r * 0.25, cy - r).closePath().stroke(stroke);
      g.moveTo(cx - r * 0.45, cy + r * 0.2).lineTo(cx + r * 0.45, cy + r * 0.2).stroke(stroke);
      break;
    }
    case 'sigil': {
      // star-of-six (two overlapping triangles)
      g.poly(triPoints(cx, cy, r, -Math.PI / 2)).closePath().stroke(stroke);
      g.poly(triPoints(cx, cy, r, Math.PI / 2)).closePath().stroke(stroke);
      break;
    }
    case 'droplet': {
      g.moveTo(cx, cy - r).bezierCurveTo(cx + r * 0.75, cy + r * 0.05, cx + r * 0.55, cy + r, cx, cy + r)
        .bezierCurveTo(cx - r * 0.55, cy + r, cx - r * 0.75, cy + r * 0.05, cx, cy - r).fill(fill);
      break;
    }
    case 'ring': {
      g.arc(cx, cy, r * 0.8, 0, Math.PI * 2).stroke(stroke);
      g.moveTo(cx - r * 0.45, cy).lineTo(cx + r * 0.45, cy).stroke(stroke);
      g.moveTo(cx, cy - r * 0.45).lineTo(cx, cy + r * 0.45).stroke(stroke);
      break;
    }
    case 'diamond': {
      g.moveTo(cx, cy - r).lineTo(cx + r * 0.78, cy).lineTo(cx, cy + r).lineTo(cx - r * 0.78, cy).closePath().fill(fill);
      break;
    }
    default: {
      // 'star' and any unported glyph -> star (still legible)
      g.poly(starPoints(cx, cy, r, 10, 0.45)).fill(fill);
    }
  }
}

function starPoints(cx: number, cy: number, r: number, pts: number, innerFrac: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < pts; k++) {
    const rad = k % 2 ? r * innerFrac : r;
    const a = -Math.PI / 2 + (k * Math.PI) / (pts / 2);
    out.push(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  return out;
}

function hexPoints(cx: number, cy: number, r: number): number[] {
  const pts: number[] = [];
  for (let k = 0; k < 6; k++) {
    const a = -Math.PI / 2 + k * Math.PI / 3;
    pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  return pts;
}

function triPoints(cx: number, cy: number, r: number, startAngle: number): number[] {
  const pts: number[] = [];
  for (let k = 0; k < 3; k++) {
    const a = startAngle + k * 2 * Math.PI / 3;
    pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  return pts;
}
