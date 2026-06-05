// src/render/draw-hud.ts
// HUD drawn on the canvas: two HP bars (green→red at low) + short combat log.
// A DOM restart button overlays the canvas top-left.

const BAR_W = 220;
const BAR_H = 14;
const LOG_MAX = 8;

export interface HudState {
  names: [string, string];
  hp: [number, number];
  maxHP: [number, number];
  lines: string[];
  restartBtn: HTMLButtonElement | null;
}

export function makeHudState(names: [string, string], onRestart: () => void): HudState {
  const btn = document.createElement('button');
  btn.textContent = '↻ restart';
  btn.style.cssText = [
    'position:fixed', 'top:12px', 'left:12px', 'z-index:10',
    'font:700 14px system-ui', 'color:#9fc0ff', 'background:transparent',
    'border:1px solid rgba(159,192,255,0.3)', 'border-radius:6px',
    'padding:6px 10px', 'cursor:pointer',
  ].join(';');
  btn.addEventListener('click', onRestart);
  document.body.appendChild(btn);
  return { names, hp: [1, 1], maxHP: [1, 1], lines: [], restartBtn: btn };
}

export function pushLog(state: HudState, line: string): void {
  state.lines.push(line);
  if (state.lines.length > LOG_MAX) state.lines.shift();
}

export function setHP(state: HudState, i: 0 | 1, hp: number, maxHP: number): void {
  state.hp[i] = hp;
  state.maxHP[i] = maxHP;
}

/** Draw HUD onto canvas. Call after all scene drawing, before requestAnimationFrame yields. */
export function drawHud(ctx: CanvasRenderingContext2D, state: HudState, W: number, H: number): void {
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  for (let i = 0; i < 2; i++) {
    const x = i === 0 ? 24 : (W - BAR_W - 24);
    const y = 40;
    // Name label
    ctx.font = '700 13px system-ui';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(state.names[i] ?? '', x, y - 4);

    // Bar background
    ctx.fillStyle = '#1a1d26';
    _roundRect(ctx, x, y, BAR_W, BAR_H, 4);
    ctx.fill();

    // Bar fill
    const f = Math.max(0, Math.min(1, state.maxHP[i]! > 0 ? state.hp[i]! / state.maxHP[i]! : 0));
    ctx.fillStyle = f > 0.3 ? '#46d68c' : '#e0483f';
    if (f > 0) { _roundRect(ctx, x, y, BAR_W * f, BAR_H, 4); ctx.fill(); }
  }

  // Combat log — bottom-left
  if (state.lines.length > 0) {
    ctx.font = '13px system-ui';
    ctx.fillStyle = '#cfd6e6';
    const lineH = 17;
    const startY = H - 12 - (state.lines.length - 1) * lineH;
    for (let i = 0; i < state.lines.length; i++) {
      ctx.globalAlpha = 0.55 + 0.45 * (i / Math.max(1, state.lines.length - 1));
      ctx.fillText(state.lines[i] ?? '', 24, startY + i * lineH);
    }
    ctx.globalAlpha = 1;
  }
}

function _roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
