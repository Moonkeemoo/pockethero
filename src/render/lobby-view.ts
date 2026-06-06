/**
 * src/render/lobby-view.ts
 * Minimal entry screen — hero centerpiece + a single «В БІЙ» button + HUD.
 * Canvas2D, DPR-scaled, full-window fixed canvas. No Pixi.
 */

import { CUBES } from '../index';
import type { Build } from '../index';
import type { SaveState, RewardEvent } from '../game/meta';
import { accountXpToNext } from '../game/meta';
import { stageCount, stageTier, stuckHint } from '../game/campaign';

/* ===========================================================================
   PUBLIC ENTRY POINT
   =========================================================================== */
export function startLobby(opts: {
  state: SaveState;
  onBattle: () => void;
  rewardEvents?: RewardEvent[];
  lastOutcome?: 'levelCleared' | 'defeated';
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
   BUTTON RECT  (CSS pixel space) — single centered «В БІЙ»
   =========================================================================== */
interface ButtonRect { x: number; y: number; w: number; h: number; label: string; key: 'battle' }

function getButtonRects(): ButtonRect[] {
  const isPortrait = W < H;
  const unit = Math.min(W, H);
  const bh = Math.max(52, Math.min(68, unit * 0.15));
  const margin = Math.max(10, W * 0.04);
  const bw = isPortrait
    ? Math.min(W - margin * 2, W * 0.88)
    : Math.min(280, W * 0.5);

  const battle: ButtonRect = {
    x: W * 0.5 - bw / 2,
    y: H - margin - bh - 10,
    w: bw, h: bh,
    label: 'В БІЙ',
    key: 'battle',
  };

  return [battle];
}

/* ===========================================================================
   DRAW BUTTONS
   =========================================================================== */
function drawButtons(pulse: number): void {
  const rects = getButtonRects();

  for (const btn of rects) {
    const { x, y, w, h } = btn;

    ctx.save();

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
    ctx.font = `bold ${Math.round(h * 0.4)}px "Segoe UI",system-ui,sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 4;
    ctx.fillText(btn.label, x + w / 2, y + h / 2);
    ctx.shadowBlur = 0;

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

  // --- LEFT: Account level + XP bar ---
  const lvlX = pad;
  const xpCur = state.accountXp;
  const xpMax = accountXpToNext(state.accountLevel);
  const xpFrac = displayXpFrac; // smoothly-animated fill

  ctx.font = 'bold 14px "Segoe UI",system-ui,sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#a8c0e8';
  ctx.fillText(`Рівень ${state.accountLevel}`, lvlX, 10);

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

  // --- RIGHT: Coins (tweened + scale-bump on gain) ---
  const coinBumpScale = 1 + (coinBump > 0 ? 0.22 * (coinBump / 0.22) : 0);
  ctx.save();
  ctx.translate(W - pad, 19);
  ctx.scale(coinBumpScale, coinBumpScale);
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ctx.font = 'bold 15px "Segoe UI",system-ui,sans-serif';
  ctx.fillStyle = '#ffe050';
  ctx.fillText(`⬡ ${Math.round(displayCoins)}`, 0, 0);
  ctx.restore();
  ctx.textBaseline = 'top';

  // --- CENTRE: Рівень X · Етап Y/Z ---
  const runLevel  = state.run.level;
  const runStage  = state.run.stage;
  const stageTotal = stageCount(runLevel);
  const centreLabel = `Рівень ${runLevel} · Етап ${runStage + 1}/${stageTotal}`;
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
  const newTypes: string[] = [];
  const infoTexts: string[] = [];
  for (const ev of opts.rewardEvents) {
    if (ev.kind === 'xp')      totalXP    += ev.n;
    if (ev.kind === 'coins')   totalCoins += ev.n;
    if (ev.kind === 'levelUp') levelUps    = ev.level;
    if (ev.kind === 'cube')    cubes.push(ev.cube);
    if (ev.kind === 'newType') newTypes.push(CUBES[ev.cube]?.name ?? ev.cube);
    if (ev.kind === 'info')    infoTexts.push(ev.text);
  }
  if (totalXP > 0)    parts.push(`+${totalXP} XP`);
  if (totalCoins > 0) parts.push(`+${totalCoins} монет`);
  if (levelUps > 0)   parts.push(`Рівень ${levelUps}!`);
  if (cubes.length > 0) parts.push(`+${cubes.length} кубик${cubes.length > 1 ? 'ів' : ''}`);
  if (newTypes.length > 0) parts.push(`Новий тип: ${newTypes.join(', ')}`);
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
  const padX = 24;
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
   PROGRESSION FEEDBACK — counter tweens · "Далі:" line
   =========================================================================== */
// What was gained on the run that just ended (for tween start)
let gainedCoins = 0, gainedXp = 0, gainedLevelUps = 0;
if (opts.rewardEvents) {
  for (const ev of opts.rewardEvents) {
    if (ev.kind === 'coins') gainedCoins += ev.n;
    else if (ev.kind === 'xp') gainedXp += ev.n;
    else if (ev.kind === 'levelUp') gainedLevelUps++;
  }
}
// Counter-tween state: start below the real value, climb to it (number-goes-up)
let displayCoins = Math.max(0, opts.state.coins - gainedCoins);
let coinBump = 0;
const xpMax0 = accountXpToNext(opts.state.accountLevel);
let displayXpFrac = gainedLevelUps > 0
  ? 0
  : Math.max(0, Math.min(1, (opts.state.accountXp - gainedXp) / xpMax0));

function targetXpFrac(): number { return Math.min(1, opts.state.accountXp / accountXpToNext(opts.state.accountLevel)); }

function stepCounters(dt: number): void {
  const tc = opts.state.coins;
  if (displayCoins < tc - 0.5) {
    displayCoins = Math.min(tc, displayCoins + (tc - displayCoins) * Math.min(1, dt * 5) + dt * 28);
    coinBump = 0.22;
  } else if (displayCoins > tc + 0.5) {
    displayCoins = Math.max(tc, displayCoins - (displayCoins - tc) * Math.min(1, dt * 6) - dt * 30);
  } else {
    displayCoins = tc;
  }
  if (coinBump > 0) coinBump -= dt;
  displayXpFrac += (targetXpFrac() - displayXpFrac) * Math.min(1, dt * 4);
}

// Brand-new-save finger cue: level 1, stage 0, build still just the core
function isFreshSave(): boolean {
  const s = opts.state;
  return s.run.level === 1 && s.run.stage === 0 && s.run.build.length <= 1;
}

// "Далі:" — names the single most relevant next chase
function nextGoalLine(): string {
  const s = opts.state;
  const lvl = s.run.level, stg = s.run.stage, total = stageCount(lvl);
  if (opts.lastOutcome === 'defeated') {
    // After repeated losses on the same level, upgrade to a concrete tip.
    if ((s.lossStreak ?? 0) >= 3) {
      return `Підказка: ${stuckHint(lvl, stg)}`;
    }
    const tier = stageTier(lvl, stg);
    const tn = tier === 'boss' ? ' (Бос)' : tier === 'elite' ? ' (Еліт)' : '';
    return `Далі: підсиль героя — застряг на Етапі ${stg + 1}${tn}`;
  }
  const tier = stageTier(lvl, stg);
  if (tier === 'boss')  return `Далі: Етап ${stg + 1} — Бос 💀`;
  if (tier === 'elite') return `Далі: Етап ${stg + 1} — Еліт`;
  return `Далі: Етап ${stg + 1}/${total}`;
}

function drawNextGoal(): void {
  const txt = nextGoalLine();
  const stuck = opts.lastOutcome === 'defeated';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.font = 'bold 12px "Segoe UI",system-ui,sans-serif';
  ctx.fillStyle = stuck ? '#ffb070' : '#86d0b0';
  ctx.fillText(txt, W * 0.5, 34);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

// Button decorations drawn ON TOP: brand-new-save finger cue on «В БІЙ»
function drawButtonFx(): void {
  if (isFreshSave()) {
    const rects = getButtonRects();
    const bb = rects.find(r => r.key === 'battle');
    if (bb) {
      const bob = Math.sin(t * 4) * 6;
      ctx.font = '30px system-ui';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('👆', bb.x + bb.w / 2, bb.y + bb.h + 26 + bob);
    }
  }
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
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
  stepCounters(dt);

  const ground  = heroGroundY();
  const cx      = W * 0.5;
  const hScale  = heroDisplayScale(opts.state.run.build);
  const pulse   = 0.5 + 0.5 * Math.sin(t * 2.6);  // 0..1 for button glow

  // --- Draw ---
  drawBackground();
  drawPedestal();
  drawHeroShadow(cx, ground, hScale);
  drawCreatureIdle(opts.state.run.build, cx, ground, hScale, t);
  drawHUD();
  drawNextGoal();
  drawButtons(pulse);
  drawButtonFx();
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
      if (btn.key === 'battle') opts.onBattle();
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
