// src/render/draw-glyph.ts
// Canvas2D glyph drawer — ported verbatim from poc/art-routes.html drawGlyph().
// Accepts ctx explicitly (no global). Constants match the prototype exactly.

const GLYPH_MIN_CELL = 10;
const GLYPH_SIZE_FRAC = 0.62;

export function drawGlyph(
  ctx: CanvasRenderingContext2D,
  key: string,
  x: number,
  y: number,
  s: number,
  col: string,
  alpha: number,
): void {
  if (s < GLYPH_MIN_CELL) {
    ctx.globalAlpha = alpha * 0.9;
    ctx.fillStyle = col;
    const r = Math.max(1, s * 0.16);
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
    return;
  }
  const g = s * GLYPH_SIZE_FRAC * 0.5;
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = col; ctx.fillStyle = col;
  ctx.lineWidth = Math.max(1, s * 0.10);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  switch (key) {
    case 'heart':
      ctx.beginPath();
      ctx.moveTo(0, g * 0.85);
      ctx.bezierCurveTo(g * 1.2, g * 0.05, g * 0.55, -g * 0.95, 0, -g * 0.15);
      ctx.bezierCurveTo(-g * 0.55, -g * 0.95, -g * 1.2, g * 0.05, 0, g * 0.85);
      ctx.fill();
      break;
    case 'pulse':
      ctx.beginPath();
      ctx.moveTo(-g, 0); ctx.lineTo(-g * 0.4, 0); ctx.lineTo(-g * 0.15, -g * 0.7);
      ctx.lineTo(g * 0.1, g * 0.7); ctx.lineTo(g * 0.4, 0); ctx.lineTo(g, 0);
      ctx.stroke();
      break;
    case 'fang':
      ctx.beginPath();
      ctx.moveTo(-g * 0.5, -g * 0.6); ctx.lineTo(-g * 0.5, g * 0.2); ctx.lineTo(-g * 0.2, -g * 0.2);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(g * 0.5, -g * 0.6); ctx.lineTo(g * 0.5, g * 0.2); ctx.lineTo(g * 0.2, -g * 0.2);
      ctx.closePath(); ctx.fill();
      break;
    case 'blade':
      ctx.beginPath(); ctx.moveTo(0, -g); ctx.lineTo(0, g * 0.55); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-g * 0.55, g * 0.18); ctx.lineTo(g * 0.55, g * 0.18); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -g); ctx.lineTo(-g * 0.22, -g * 0.55); ctx.lineTo(g * 0.22, -g * 0.55);
      ctx.closePath(); ctx.fill();
      break;
    case 'arrowdn':
      ctx.beginPath(); ctx.moveTo(0, -g); ctx.lineTo(0, g * 0.5); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, g); ctx.lineTo(-g * 0.45, g * 0.35); ctx.lineTo(g * 0.45, g * 0.35);
      ctx.closePath(); ctx.fill();
      break;
    case 'rage': {
      ctx.beginPath();
      for (let k = 0; k < 10; k++) {
        const r = k % 2 ? g * 0.4 : g;
        const a = -Math.PI / 2 + k * Math.PI / 5;
        const X = Math.cos(a) * r, Y = Math.sin(a) * r;
        if (k === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
      }
      ctx.closePath(); ctx.fill();
      break;
    }
    case 'shield':
      ctx.beginPath();
      ctx.moveTo(0, -g); ctx.lineTo(g * 0.8, -g * 0.6); ctx.lineTo(g * 0.8, g * 0.25);
      ctx.quadraticCurveTo(g * 0.8, g * 0.9, 0, g);
      ctx.quadraticCurveTo(-g * 0.8, g * 0.9, -g * 0.8, g * 0.25);
      ctx.lineTo(-g * 0.8, -g * 0.6); ctx.closePath(); ctx.fill();
      break;
    case 'brace':
      ctx.beginPath(); ctx.arc(0, 0, g * 0.85, Math.PI * 0.8, Math.PI * 2.2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-g * 0.3, 0); ctx.lineTo(g * 0.3, 0); ctx.stroke();
      break;
    case 'thorns':
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * g, Math.sin(a) * g); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * g, Math.sin(a) * g);
        ctx.lineTo(Math.cos(a + 0.3) * g * 0.6, Math.sin(a + 0.3) * g * 0.6);
        ctx.stroke();
      }
      break;
    case 'rune': {
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = -Math.PI / 2 + k * Math.PI / 3;
        const X = Math.cos(a) * g, Y = Math.sin(a) * g;
        if (k === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
      }
      ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, g * 0.25, 0, 7); ctx.fill();
      break;
    }
    case 'chevron':
      ctx.beginPath();
      ctx.moveTo(-g * 0.7, -g * 0.7); ctx.lineTo(g * 0.05, 0); ctx.lineTo(-g * 0.7, g * 0.7);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-g * 0.05, -g * 0.7); ctx.lineTo(g * 0.7, 0); ctx.lineTo(-g * 0.05, g * 0.7);
      ctx.stroke();
      break;
    case 'dblchev':
      ctx.beginPath();
      ctx.moveTo(-g * 0.8, -g * 0.7); ctx.lineTo(-g * 0.1, 0); ctx.lineTo(-g * 0.8, g * 0.7);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -g * 0.7); ctx.lineTo(g * 0.7, 0); ctx.lineTo(0, g * 0.7);
      ctx.stroke();
      break;
    case 'wisp':
      ctx.beginPath(); ctx.arc(0, 0, g * 0.7, 0.4, Math.PI * 1.7); ctx.stroke();
      ctx.beginPath(); ctx.arc(g * 0.2, g * 0.1, g * 0.3, Math.PI, Math.PI * 2.6); ctx.stroke();
      break;
    case 'diamond':
      ctx.beginPath();
      ctx.moveTo(0, -g); ctx.lineTo(g * 0.78, 0); ctx.lineTo(0, g); ctx.lineTo(-g * 0.78, 0);
      ctx.closePath(); ctx.fill();
      break;
    case 'flame':
      ctx.beginPath();
      ctx.moveTo(0, g);
      ctx.bezierCurveTo(g * 0.95, g * 0.4, g * 0.5, -g * 0.4, 0, -g);
      ctx.bezierCurveTo(-g * 0.3, -g * 0.3, -g * 0.85, g * 0.2, 0, g);
      ctx.fill();
      break;
    case 'snow':
      for (let k = 0; k < 6; k++) {
        const a = k * Math.PI / 3;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * g, Math.sin(a) * g); ctx.stroke();
        const bx = Math.cos(a) * g * 0.6, by = Math.sin(a) * g * 0.6;
        const pa = a + Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(bx - Math.cos(pa) * g * 0.22, by - Math.sin(pa) * g * 0.22);
        ctx.lineTo(bx + Math.cos(pa) * g * 0.22, by + Math.sin(pa) * g * 0.22);
        ctx.stroke();
      }
      break;
    case 'bolt':
      ctx.beginPath();
      ctx.moveTo(g * 0.3, -g); ctx.lineTo(-g * 0.35, g * 0.1); ctx.lineTo(g * 0.1, g * 0.1);
      ctx.lineTo(-g * 0.3, g); ctx.lineTo(g * 0.4, -g * 0.15); ctx.lineTo(-g * 0.05, -g * 0.15);
      ctx.closePath(); ctx.fill();
      break;
    case 'vial':
      ctx.beginPath();
      ctx.moveTo(-g * 0.25, -g); ctx.lineTo(-g * 0.25, -g * 0.2);
      ctx.lineTo(-g * 0.6, g * 0.7);
      ctx.quadraticCurveTo(-g * 0.6, g, 0, g);
      ctx.quadraticCurveTo(g * 0.6, g, g * 0.6, g * 0.7);
      ctx.lineTo(g * 0.25, -g * 0.2); ctx.lineTo(g * 0.25, -g);
      ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-g * 0.45, g * 0.2); ctx.lineTo(g * 0.45, g * 0.2); ctx.stroke();
      break;
    case 'sigil': {
      ctx.beginPath();
      for (let k = 0; k < 3; k++) {
        const a = -Math.PI / 2 + k * 2 * Math.PI / 3;
        if (k === 0) ctx.moveTo(Math.cos(a) * g, Math.sin(a) * g);
        else ctx.lineTo(Math.cos(a) * g, Math.sin(a) * g);
      }
      ctx.closePath(); ctx.stroke();
      ctx.beginPath();
      for (let k = 0; k < 3; k++) {
        const a = Math.PI / 2 + k * 2 * Math.PI / 3;
        if (k === 0) ctx.moveTo(Math.cos(a) * g, Math.sin(a) * g);
        else ctx.lineTo(Math.cos(a) * g, Math.sin(a) * g);
      }
      ctx.closePath(); ctx.stroke();
      break;
    }
    case 'droplet':
      ctx.beginPath();
      ctx.moveTo(0, -g);
      ctx.bezierCurveTo(g * 0.75, g * 0.05, g * 0.55, g, 0, g);
      ctx.bezierCurveTo(-g * 0.55, g, -g * 0.75, g * 0.05, 0, -g);
      ctx.fill();
      break;
    case 'ring':
      ctx.beginPath(); ctx.arc(0, 0, g * 0.8, 0, 7); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-g * 0.45, 0); ctx.lineTo(g * 0.45, 0);
      ctx.moveTo(0, -g * 0.45); ctx.lineTo(0, g * 0.45);
      ctx.stroke();
      break;
    default: {
      ctx.beginPath();
      for (let k = 0; k < 10; k++) {
        const r = k % 2 ? g * 0.45 : g;
        const a = -Math.PI / 2 + k * Math.PI / 5;
        const X = Math.cos(a) * r, Y = Math.sin(a) * r;
        if (k === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
      }
      ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}
