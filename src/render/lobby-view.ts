/**
 * src/render/lobby-view.ts
 * Habby-style Lobby screen — hero centerpiece + В БІЙ / Білдер / Скриня buttons + HUD.
 * Canvas2D, DPR-scaled, full-window fixed canvas. No Pixi.
 */

import { CUBES } from '../index';
import type { Build } from '../index';
import type { SaveState, RewardEvent } from '../game/meta';
import { xpToNext, CHEST_COST } from '../game/meta';
import { stageCount } from '../game/campaign';

/* ===========================================================================
   PUBLIC ENTRY POINT
   =========================================================================== */
export function startLobby(opts: {
  state: SaveState;
  onBattle: () => void;
  onBuilder: () => void;
  onChest: () => void;
  rewardEvents?: RewardEvent[];
}): () => void {

/* ===========================================================================
   DPR + CANVAS SETUP
   =========================================================================== */
const cv = document.createElement('canvas');
cv.style.cssText = 'display:block;position:fixed;inset:0;z-index:5;width:100%;height:100%;image-rendering:pixelated;';
document.body.style.cssText = 'margin:0;height:100%;background:#070a0f;overflow:hidden;font-family:"Segoe UI",system-ui,sans-serif;color:#cfd6e0';
document.body.appendChild(cv);

const ctx = cv.getContext('2d')!;
let W = 0, H = 0;
let DPR = window.devicePixelRatio || 1;

function resize(): void {
  DPR = window.devicePixelRatio || 1;
  W = window.innerWidth;
  H = window.innerHeight;
  cv.width  = Math.round(W * DPR);
  cv.height = Math.round(H * DPR);
  cv.style.width  = W + 'px';
  cv.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resize);
resize();

/* ===========================================================================
   TIME
   =========================================================================== */
let t = 0;
let raf = 0;
let lastNow = performance.now();

/* ===========================================================================
   COLORS / PALETTE  (match gauntlet's dark diorama)
   =========================================================================== */
function colorOfType(type: string): string { return CUBES[type]?.col ?? '#888'; }

/* ===========================================================================
   CREATURE DRAW — flat cubes with top highlight, matching gauntlet look
   =========================================================================== */
const PX = 13;

interface BuildPixel { gx: number; gy: number; type: string }

function drawCreatureIdle(
  build: Build,
  cx: number,   // CSS pixel centre X
  baseY: number, // CSS pixel ground Y
  scale: number,
  breathAnim: number, // time in seconds
): void {
  const s = scale;
  const breath = 1 + 0.025 * Math.sin(breathAnim * 2.2);
  const sway   = 0.6 * Math.sin(breathAnim * 1.1);   // gentle horizontal sway

  const pixels: BuildPixel[] = build as BuildPixel[];

  for (const p of pixels) {
    const x = cx + sway + p.gx * PX * s;
    const y = baseY - 3.2 * PX * s + p.gy * PX * breath * s;
    const w = PX * s + 0.6;

    ctx.fillStyle = colorOfType(p.type);
    ctx.fillRect(x - w / 2, y - w / 2, w, w);
    // top highlight
    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    ctx.fillRect(x - w / 2, y - w / 2, w, Math.max(1, w * 0.22));
  }
}

/* ===========================================================================
   ARENA / BACKGROUND  (simplified drawArena from gauntlet)
   =========================================================================== */
function drawBackground(): void {
  // Base vertical gradient
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0,   '#121824');
  g.addColorStop(0.5, '#0e1420');
  g.addColorStop(1,   '#080b11');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Soft warm light pool on floor
  const ground = heroGroundY();
  const lg = ctx.createRadialGradient(W * 0.5, ground, 10, W * 0.5, ground, W * 0.62);
  lg.addColorStop(0, 'rgba(70,100,155,0.22)');
  lg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = lg;
  ctx.fillRect(0, 0, W, H);

  // Vignette (dark corners)
  const vg = ctx.createRadialGradient(W * 0.5, H * 0.5, H * 0.28, W * 0.5, H * 0.5, H * 0.82);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  // Floor line
  ctx.strokeStyle = 'rgba(120,150,190,0.09)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, ground); ctx.lineTo(W, ground); ctx.stroke();

  // Perspective floor lines
  for (let i = 1; i < 7; i++) {
    const u = i / 7, fy = ground + (H - ground) * u * u;
    ctx.strokeStyle = `rgba(70,100,150,${0.18 * (1 - u)})`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, fy); ctx.lineTo(W, fy); ctx.stroke();
  }
}

/* ===========================================================================
   PEDESTAL
   =========================================================================== */
function drawPedestal(): void {
  const ground = heroGroundY();
  const cx = W * 0.5;
  const pw = 90, ph = 12;

  // Drop shadow under pedestal
  const sg = ctx.createRadialGradient(cx, ground + 4, 2, cx, ground + 4, pw * 0.9);
  sg.addColorStop(0, 'rgba(0,0,0,0.45)');
  sg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.ellipse(cx, ground + 4, pw * 0.9, 14, 0, 0, Math.PI * 2); ctx.fill();

  // Pedestal face
  ctx.fillStyle = '#1a2236';
  roundRect(ctx, cx - pw / 2, ground - ph, pw, ph, 4);
  ctx.fill();

  // Pedestal top highlight
  ctx.fillStyle = 'rgba(150,180,230,0.18)';
  roundRect(ctx, cx - pw / 2, ground - ph, pw, 3, 2);
  ctx.fill();
}

function heroGroundY(): number { return H * 0.64; }

/* ===========================================================================
   HERO DROP SHADOW
   =========================================================================== */
function drawHeroShadow(cx: number, ground: number, scale: number): void {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(cx, ground + 2, 34 * scale, 9 * scale, 0, 0, Math.PI * 2); ctx.fill();
}

/* ===========================================================================
   HERO SCALE  (bigger the more cubes, also relative to screen size)
   =========================================================================== */
function heroDisplayScale(build: Build): number {
  const n = build.length;
  // 1 cube → 1.6x, grows to ~2.4x at 30 cubes, capped at 2.8x
  const base = Math.min(2.8, 1.6 + Math.sqrt(Math.max(0, n - 1)) * 0.12);
  // On narrow portrait screens scale down so hero fits comfortably
  const narrow = Math.min(W, H);
  const screenFactor = Math.min(1, narrow / 500);
  return base * (0.7 + 0.3 * screenFactor);
}

/* ===========================================================================
   BUTTON RECTS  (CSS pixel space)
   Responsive: in portrait (W < H) the two secondary buttons shrink to fit.
   =========================================================================== */
interface ButtonRect { x: number; y: number; w: number; h: number; label: string; key: 'battle'|'builder'|'chest' }

function getButtonRects(): ButtonRect[] {
  const isPortrait = W < H;
  // Scale button heights relative to screen so they're tappable on small phones
  const unit = Math.min(W, H);
  const bh = Math.max(48, Math.min(62, unit * 0.14));
  const sbh = Math.max(44, Math.min(52, unit * 0.12));
  const margin = Math.max(10, W * 0.04);
  const bottomY = H - margin - sbh;

  // In portrait, shrink secondary buttons to half-width minus margin
  const sbw = isPortrait
    ? Math.min(160, (W - margin * 3) / 2)
    : Math.min(160, W * 0.28);
  const bw = isPortrait
    ? Math.min(W - margin * 2, W * 0.88)
    : Math.min(240, W * 0.46);

  const battle: ButtonRect = {
    x: W * 0.5 - bw / 2,
    y: bottomY - bh - 16,
    w: bw, h: bh,
    label: 'В БІЙ',
    key: 'battle',
  };

  const builder: ButtonRect = {
    x: margin,
    y: bottomY,
    w: sbw, h: sbh,
    label: 'Білдер',
    key: 'builder',
  };

  const chest: ButtonRect = {
    x: W - margin - sbw,
    y: bottomY,
    w: sbw, h: sbh,
    label: `Скриня (${CHEST_COST}⬡)`,
    key: 'chest',
  };

  return [battle, builder, chest];
}

/* ===========================================================================
   DRAW BUTTONS
   =========================================================================== */
function drawButtons(pulse: number): void {
  const rects = getButtonRects();

  for (const btn of rects) {
    const isBattle = btn.key === 'battle';
    const { x, y, w, h } = btn;

    ctx.save();

    if (isBattle) {
      // Subtle outer glow pulse
      ctx.globalAlpha = 0.25 + 0.15 * pulse;
      const glow = ctx.createRadialGradient(x + w / 2, y + h / 2, h * 0.3, x + w / 2, y + h / 2, w * 0.8);
      glow.addColorStop(0, '#ffb020');
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      roundRect(ctx, x - 20, y - 14, w + 40, h + 28, 16);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Glossy gradient fill
      const bg = ctx.createLinearGradient(x, y, x, y + h);
      bg.addColorStop(0,   '#e8931a');
      bg.addColorStop(0.45,'#c97010');
      bg.addColorStop(0.5, '#b86208');
      bg.addColorStop(1,   '#7a3d02');
      ctx.fillStyle = bg;
      roundRect(ctx, x, y, w, h, 10);
      ctx.fill();

      // Top glass sheen
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      roundRect(ctx, x + 2, y + 2, w - 4, h * 0.42, 8);
      ctx.fill();

      // Border
      ctx.strokeStyle = '#ffcd60';
      ctx.lineWidth = 1.5;
      roundRect(ctx, x, y, w, h, 10);
      ctx.stroke();

      // Label
      ctx.fillStyle = '#fff8e0';
      ctx.font = `bold ${Math.round(h * 0.44)}px "Segoe UI",system-ui,sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Shadow text
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 4;
      ctx.fillText(btn.label, x + w / 2, y + h / 2);
      ctx.shadowBlur = 0;

    } else {
      // Secondary button
      const bg2 = ctx.createLinearGradient(x, y, x, y + h);
      if (btn.key === 'builder') {
        bg2.addColorStop(0, '#2a4470');
        bg2.addColorStop(1, '#1a2a4a');
      } else {
        bg2.addColorStop(0, '#3a2868');
        bg2.addColorStop(1, '#221640');
      }
      ctx.fillStyle = bg2;
      roundRect(ctx, x, y, w, h, 8);
      ctx.fill();

      // Top glass sheen
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      roundRect(ctx, x + 2, y + 2, w - 4, h * 0.38, 6);
      ctx.fill();

      ctx.strokeStyle = btn.key === 'builder' ? '#4a70c0' : '#7060b8';
      ctx.lineWidth = 1.2;
      roundRect(ctx, x, y, w, h, 8);
      ctx.stroke();

      ctx.fillStyle = '#c8d8f0';
      ctx.font = `bold ${Math.round(h * 0.38)}px "Segoe UI",system-ui,sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(btn.label, x + w / 2, y + h / 2);
    }

    ctx.restore();
  }
}

/* ===========================================================================
   TOP HUD
   =========================================================================== */
function drawHUD(): void {
  const { state } = opts;
  const pad = 16;
  const stripH = 52;

  // HUD background strip
  const hg = ctx.createLinearGradient(0, 0, 0, stripH);
  hg.addColorStop(0, 'rgba(10,14,22,0.88)');
  hg.addColorStop(1, 'rgba(10,14,22,0)');
  ctx.fillStyle = hg;
  ctx.fillRect(0, 0, W, stripH + 8);

  // --- LEFT: Level + XP bar ---
  const lvlX = pad;
  const xpCur = state.xp;
  const xpMax = xpToNext(state.level);
  const xpFrac = Math.min(1, xpCur / xpMax);

  ctx.font = 'bold 14px "Segoe UI",system-ui,sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#a8c0e8';
  ctx.fillText(`Рівень ${state.level}`, lvlX, 10);

  // XP bar background
  const barW = 100, barH = 7;
  const barY = 28;
  ctx.fillStyle = 'rgba(30,40,60,0.9)';
  roundRect(ctx, lvlX, barY, barW, barH, 3);
  ctx.fill();

  // XP bar fill
  const xpGrad = ctx.createLinearGradient(lvlX, barY, lvlX + barW, barY);
  xpGrad.addColorStop(0, '#4090ff');
  xpGrad.addColorStop(1, '#80c0ff');
  ctx.fillStyle = xpGrad;
  roundRect(ctx, lvlX, barY, barW * xpFrac, barH, 3);
  ctx.fill();

  ctx.font = '10px "Segoe UI",system-ui,sans-serif';
  ctx.fillStyle = '#7090b0';
  ctx.fillText(`${xpCur} / ${xpMax}`, lvlX, barY + barH + 3);

  // --- RIGHT: Coins ---
  ctx.textAlign = 'right';
  ctx.font = 'bold 15px "Segoe UI",system-ui,sans-serif';
  ctx.fillStyle = '#ffe050';
  const coinLabel = `⬡ ${state.coins}`;
  ctx.fillText(coinLabel, W - pad, 12);

  // --- CENTRE: Рівень X · Етап Y/Z ---
  const campLevel  = state.campaign.level;
  const campStage  = state.campaign.stage;
  const stageTotal = stageCount(campLevel);
  const centreLabel = `Рівень ${campLevel} · Етап ${campStage + 1}/${stageTotal}`;
  ctx.textAlign = 'center';
  ctx.font = 'bold 13px "Segoe UI",system-ui,sans-serif';
  ctx.fillStyle = '#a0b8d8';
  ctx.fillText(centreLabel, W * 0.5, 14);
}

/* ===========================================================================
   REWARD TOAST
   =========================================================================== */
let toastAlpha = 0;
let toastTimer = 0;
const TOAST_DUR = 3.2;
const TOAST_FADE = 0.5;
let toastText = '';

if (opts.rewardEvents && opts.rewardEvents.length > 0) {
  const parts: string[] = [];
  let totalXP = 0, totalCoins = 0, levelUps = 0;
  const cubes: string[] = [];
  const infoTexts: string[] = [];
  for (const ev of opts.rewardEvents) {
    if (ev.kind === 'xp')      totalXP    += ev.n;
    if (ev.kind === 'coins')   totalCoins += ev.n;
    if (ev.kind === 'levelUp') levelUps    = ev.level;
    if (ev.kind === 'cube')    cubes.push(ev.cube);
    if (ev.kind === 'loot')    cubes.push(...ev.cubes);
    if (ev.kind === 'info')    infoTexts.push(ev.text);
  }
  if (totalXP > 0)    parts.push(`+${totalXP} XP`);
  if (totalCoins > 0) parts.push(`+${totalCoins} монет`);
  if (levelUps > 0)   parts.push(`Рівень ${levelUps}!`);
  if (cubes.length > 0) parts.push(`+${cubes.length} кубик${cubes.length > 1 ? 'ів' : ''}`);
  for (const info of infoTexts) parts.push(info);
  if (parts.length > 0) {
    toastText  = parts.join(' · ');
    toastTimer = TOAST_DUR;
    toastAlpha = 1;
  }
}

function drawToast(): void {
  if (toastTimer <= 0) return;

  const fade = toastTimer < TOAST_FADE ? toastTimer / TOAST_FADE : 1;
  ctx.globalAlpha = fade * 0.95;

  ctx.font = 'bold 16px "Segoe UI",system-ui,sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const tw = ctx.measureText(toastText).width;
  const padX = 24, padY = 12;
  const toastW = tw + padX * 2;
  const toastH = 44;
  const toastX = W / 2 - toastW / 2;
  const toastY = H * 0.16;

  ctx.fillStyle = 'rgba(10,18,32,0.88)';
  roundRect(ctx, toastX, toastY, toastW, toastH, 10);
  ctx.fill();

  ctx.strokeStyle = '#ffe060';
  ctx.lineWidth = 1.5;
  roundRect(ctx, toastX, toastY, toastW, toastH, 10);
  ctx.stroke();

  ctx.fillStyle = '#ffe070';
  ctx.fillText(toastText, W / 2, toastY + toastH / 2);

  ctx.globalAlpha = 1;
}

/* ===========================================================================
   MAIN RENDER LOOP
   =========================================================================== */
function frame(now: number): void {
  const dt = Math.min(0.05, (now - lastNow) / 1000);
  lastNow = now;
  t += dt;

  // Update toast timer
  if (toastTimer > 0) toastTimer -= dt;

  const ground  = heroGroundY();
  const cx      = W * 0.5;
  const hScale  = heroDisplayScale(opts.state.heroBuild);
  const pulse   = 0.5 + 0.5 * Math.sin(t * 2.6);  // 0..1 for button glow

  // --- Draw ---
  drawBackground();
  drawPedestal();
  drawHeroShadow(cx, ground, hScale);
  drawCreatureIdle(opts.state.heroBuild, cx, ground, hScale, t);
  drawHUD();
  drawButtons(pulse);
  drawToast();

  raf = requestAnimationFrame(frame);
}

raf = requestAnimationFrame(frame);

/* ===========================================================================
   HIT TESTING — pointer events (mouse + touch + pen unified)
   =========================================================================== */
// Tap detection: track pointerdown position to avoid scroll-drag false taps
let _pdX = -1, _pdY = -1;

function onPointerDown(e: PointerEvent): void {
  e.preventDefault();
  const rect = cv.getBoundingClientRect();
  _pdX = e.clientX - rect.left;
  _pdY = e.clientY - rect.top;
}

function onPointerUp(e: PointerEvent): void {
  e.preventDefault();
  const rect = cv.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  // Only fire if pointer didn't travel far (tap, not drag)
  const dx = mx - _pdX, dy = my - _pdY;
  if (_pdX < 0 || dx * dx + dy * dy > 400) { _pdX = -1; _pdY = -1; return; }
  _pdX = -1; _pdY = -1;

  const btns = getButtonRects();
  for (const btn of btns) {
    if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
      if (btn.key === 'battle')  opts.onBattle();
      if (btn.key === 'builder') opts.onBuilder();
      if (btn.key === 'chest')   opts.onChest();
      return;
    }
  }
}

function onPointerMove(e: PointerEvent): void {
  const rect = cv.getBoundingClientRect();
  const mx   = e.clientX - rect.left;
  const my   = e.clientY - rect.top;
  const btns = getButtonRects();
  const hit  = btns.some(b => mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h);
  cv.style.cursor = hit ? 'pointer' : 'default';
}

function onPointerLeave(): void {
  cv.style.cursor = 'default';
}

cv.addEventListener('pointerdown', onPointerDown);
cv.addEventListener('pointerup', onPointerUp);
cv.addEventListener('pointermove', onPointerMove);
cv.addEventListener('pointerleave', onPointerLeave);

/* ===========================================================================
   DISPOSER
   =========================================================================== */
let stopped = false;
function stop(): void {
  if (stopped) return;
  stopped = true;
  cancelAnimationFrame(raf);
  cv.removeEventListener('pointerdown', onPointerDown);
  cv.removeEventListener('pointerup', onPointerUp);
  cv.removeEventListener('pointermove', onPointerMove);
  cv.removeEventListener('pointerleave', onPointerLeave);
  window.removeEventListener('resize', resize);
  cv.remove();
}

return stop;

} // end startLobby

/* ===========================================================================
   HELPERS
   =========================================================================== */

/**
 * Draw a rounded rectangle path on ctx.
 * No ctx.roundRect polyfill needed — manual arc approach for compat.
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  r: number,
): void {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
}
