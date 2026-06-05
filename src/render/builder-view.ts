/**
 * builder-view.ts — verbatim TS port of poc/builder.html builder mode.
 * Exports startBuilder({ state, onFight, rewardEvents }) which mounts a full-screen Canvas2D builder.
 * All derive logic delegated to src/derive (no detection re-implemented here).
 */

import { deriveStats, deriveMoveset, CUBES } from '../index';
import type { Build, PlacedCube, Trait, Stats } from '../index';
import type { SaveState, RewardEvent } from '../game/meta';
import { xpToNext, grantLootInto } from '../game/meta';
import { detectTraits } from '../derive/detectors';
import { SYNERGY_DEFS } from '../data/traits';
import { MOVES, MOVE_IDS } from '../data/moves';

// ---------------------------------------------------------------------------
// 0. TUNABLE CONSTANTS (verbatim from poc lines 80-141)
// ---------------------------------------------------------------------------
const PX            = 13;
const GLYPH_MIN_CELL = 9.0;
const GLYPH_SIZE_FRAC = 0.62;
const BEHAV_AMP      = 1.0;
const INSPECT_DIM    = 0.22;

const GRID_MAX         = 15;
const GRID_START_RING  = 2;
const BUILD_CELL       = 28;
const BOND_GLOW        = 1.0;
const BOND_WIDTH       = 3.0;
const SHAPE_PULSE      = 1.0;
const SHAPE_FLASH_DUR  = 1.6;
const LOD_BOND_MINCELL = 14;

const BUDGET_BASE       = 10;
const BUDGET_PER_LEVEL  = 4;
const RING_UNLOCK_EVERY = 2;
const LOOT_BATCH: [number, number]  = [3, 5];
const LOOT_LEVEL_BATCH: [number, number] = [4, 7];
const SEED_BASE         = 1337;

const RARITY_WEIGHT: Record<string, number> = { common: 60, rare: 26, epic: 11, legendary: 3 };
const RARITY_COL: Record<string, string>    = { common: '#9fb0c8', rare: '#5aa0ff', epic: '#c77dff', legendary: '#ffce4a' };
const RARITY_UA: Record<string, string>     = { common: 'звичайний', rare: 'рідкісний', epic: 'епічний', legendary: 'легендарний' };
const RARITY_ORDER: Record<string, number>  = { common: 0, rare: 1, epic: 2, legendary: 3 };

const RIGHT_PANEL_W = 360;
// Portrait breakpoint: if W < this we reflow to bottom-strip layout
const PORTRAIT_BREAKPOINT = 760;

// ---------------------------------------------------------------------------
// 1. CATEGORY META (verbatim from poc lines 166-174)
// ---------------------------------------------------------------------------
const CAT: Record<string, { key: string; ua: string; col: string }> = {
  body:    { key: 'body',    ua: 'Тіло',       col: '#2FB873' },
  attack:  { key: 'attack',  ua: 'Атака',      col: '#E0483F' },
  defense: { key: 'defense', ua: 'Захист',      col: '#7C8AA0' },
  agility: { key: 'agility', ua: 'Спритність',  col: '#F0C020' },
  magic:   { key: 'magic',   ua: 'Магія',       col: '#D14FA6' },
  special: { key: 'special', ua: 'Особливі',    col: '#F2C84B' },
};
const CAT_ORDER = ['body', 'attack', 'defense', 'agility', 'magic', 'special'];

const TYPE_ORDER = [
  'core',
  'vital', 'regen', 'lifesteal',
  'force', 'focus', 'pierce', 'berserk',
  'plate', 'block', 'thorns', 'ward',
  'swift', 'haste', 'evasion',
  'mana', 'catalyst', 'ember', 'frost', 'spark', 'poison', 'arcane',
];
const PLACEABLE = TYPE_ORDER.filter(k => k !== 'core');

// ---------------------------------------------------------------------------
// 2. SEEDED RNG (Mulberry32, verbatim from poc lines 146-157)
// ---------------------------------------------------------------------------
function mulberry32(a: number): () => number {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function lootRng(n: number): () => number {
  return mulberry32(SEED_BASE * 7 + n * 2654435761);
}

// ---------------------------------------------------------------------------
// 3. COLOR helpers (verbatim from poc)
// ---------------------------------------------------------------------------
const _lc: Record<string, string> = {};
function lighten(hex: string, a: number): string {
  if (a <= 0) return hex;
  const key = hex + '|' + a.toFixed(2);
  if (_lc[key]) return _lc[key]!;
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.round(r + (255 - r) * a);
  g = Math.round(g + (255 - g) * a);
  b = Math.round(b + (255 - b) * a);
  const out = '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  _lc[key] = out;
  return out;
}
function colorOfType(type: string): string {
  return CUBES[type]?.col ?? '#888';
}

// ---------------------------------------------------------------------------
// 4. TRAIT colors + icons (verbatim from poc lines 746-751, 647-745)
// ---------------------------------------------------------------------------
const TRAIT_COL: Record<string, string> = {
  blade: '#E0483F', outpost: '#7C8AA0', kindle: '#F07A1E', flow: '#F0C020',
  amplify: '#D14FA6', venomweave: '#7bd64a', spike: '#ff8d6b', bastion: '#7CE0A0',
  heart: '#5BE08A', heart5: '#5BE08A', balance: '#EAEFF5', rage: '#ff8060', rune: '#9fb6f0',
};
function traitColor(key: string): string { return TRAIT_COL[key] ?? '#cfe0ff'; }

function drawTraitIcon(ctx: CanvasRenderingContext2D, key: string, x: number, y: number, s: number, col: string): void {
  const g = s * 0.40;
  ctx.save(); ctx.translate(x, y);
  ctx.strokeStyle = col; ctx.fillStyle = col;
  ctx.lineWidth = Math.max(1.4, s * 0.10); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  switch (key) {
    case 'blade': {
      ctx.beginPath(); ctx.moveTo(-g, -g); ctx.lineTo(g, g); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(g, -g); ctx.lineTo(-g, g); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, g * 0.22, 0, 7); ctx.fill();
      break;
    }
    case 'outpost': {
      ctx.beginPath();
      ctx.moveTo(-g * 0.7, -g * 0.3); ctx.lineTo(-g * 0.7, g); ctx.lineTo(g * 0.7, g);
      ctx.lineTo(g * 0.7, -g * 0.3); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-g * 0.7, -g * 0.3); ctx.lineTo(-g * 0.7, -g * 0.7); ctx.lineTo(-g * 0.25, -g * 0.7);
      ctx.lineTo(-g * 0.25, -g * 0.45); ctx.lineTo(g * 0.25, -g * 0.45); ctx.lineTo(g * 0.25, -g * 0.7);
      ctx.lineTo(g * 0.7, -g * 0.7); ctx.lineTo(g * 0.7, -g * 0.3); ctx.stroke();
      break;
    }
    case 'kindle': {
      ctx.beginPath();
      ctx.moveTo(0, g); ctx.bezierCurveTo(g * 0.95, g * 0.3, g * 0.4, -g * 0.5, 0, -g);
      ctx.bezierCurveTo(-g * 0.3, -g * 0.2, -g * 0.85, g * 0.2, 0, g); ctx.fill();
      break;
    }
    case 'flow': {
      ctx.beginPath(); ctx.moveTo(-g * 0.7, -g * 0.6); ctx.lineTo(g * 0.0, 0); ctx.lineTo(-g * 0.7, g * 0.6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -g * 0.6); ctx.lineTo(g * 0.7, 0); ctx.lineTo(0, g * 0.6); ctx.stroke();
      break;
    }
    case 'amplify': {
      ctx.beginPath(); ctx.arc(0, 0, g * 0.7, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-g * 0.4, 0); ctx.lineTo(g * 0.4, 0);
      ctx.moveTo(0, -g * 0.4); ctx.lineTo(0, g * 0.4); ctx.stroke();
      break;
    }
    case 'venomweave': {
      ctx.beginPath(); ctx.moveTo(0, -g);
      ctx.bezierCurveTo(g * 0.75, g * 0.05, g * 0.55, g, 0, g);
      ctx.bezierCurveTo(-g * 0.55, g, -g * 0.75, g * 0.05, 0, -g); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-g * 0.4, 0); ctx.lineTo(g * 0.4, g * 0.3);
      ctx.moveTo(g * 0.4, 0); ctx.lineTo(-g * 0.4, g * 0.3); ctx.stroke();
      break;
    }
    case 'spike': {
      ctx.beginPath(); ctx.moveTo(-g, 0); ctx.lineTo(g * 0.5, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(g, 0); ctx.lineTo(g * 0.3, -g * 0.5); ctx.lineTo(g * 0.3, g * 0.5);
      ctx.closePath(); ctx.fill();
      break;
    }
    case 'bastion': {
      ctx.beginPath();
      ctx.moveTo(0, -g); ctx.lineTo(g * 0.8, -g * 0.55); ctx.lineTo(g * 0.8, g * 0.2);
      ctx.quadraticCurveTo(g * 0.8, g * 0.9, 0, g);
      ctx.quadraticCurveTo(-g * 0.8, g * 0.9, -g * 0.8, g * 0.2);
      ctx.lineTo(-g * 0.8, -g * 0.55); ctx.closePath(); ctx.fill();
      break;
    }
    case 'shield': {
      ctx.beginPath();
      ctx.moveTo(0, -g); ctx.lineTo(g * 0.8, -g * 0.55); ctx.lineTo(g * 0.8, g * 0.2);
      ctx.quadraticCurveTo(g * 0.8, g * 0.9, 0, g);
      ctx.quadraticCurveTo(-g * 0.8, g * 0.9, -g * 0.8, g * 0.2);
      ctx.lineTo(-g * 0.8, -g * 0.55); ctx.closePath(); ctx.stroke();
      break;
    }
    case 'rage': {
      ctx.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = k * Math.PI / 4; const rv = (k % 2) ? g * 0.45 : g;
        const px2 = Math.cos(a) * rv, py2 = Math.sin(a) * rv;
        if (k === 0) ctx.moveTo(px2, py2); else ctx.lineTo(px2, py2);
      }
      ctx.closePath(); ctx.stroke(); break;
    }
    case 'rune': {
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = -Math.PI / 2 + k * Math.PI / 3;
        const px2 = Math.cos(a) * g, py2 = Math.sin(a) * g;
        if (k === 0) ctx.moveTo(px2, py2); else ctx.lineTo(px2, py2);
      }
      ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, g * 0.22, 0, 7); ctx.fill(); break;
    }
    case 'heart':
    case 'heart5': {
      ctx.beginPath();
      ctx.moveTo(0, g * 0.85);
      ctx.bezierCurveTo(g * 1.15, g * 0.05, g * 0.5, -g * 0.9, 0, -g * 0.1);
      ctx.bezierCurveTo(-g * 0.5, -g * 0.9, -g * 1.15, g * 0.05, 0, g * 0.85);
      ctx.fill();
      break;
    }
    case 'cross': {
      ctx.lineWidth = Math.max(2, s * 0.18);
      ctx.beginPath(); ctx.moveTo(0, -g * 0.8); ctx.lineTo(0, g * 0.8);
      ctx.moveTo(-g * 0.8, 0); ctx.lineTo(g * 0.8, 0); ctx.stroke();
      break;
    }
    case 'balance': {
      ctx.beginPath(); ctx.moveTo(0, -g); ctx.lineTo(0, g * 0.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-g, -g * 0.4); ctx.lineTo(g, -g * 0.4); ctx.stroke();
      ctx.beginPath(); ctx.arc(-g * 0.7, 0, g * 0.32, 0, Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.arc(g * 0.7, 0, g * 0.32, 0, Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-g * 0.4, g * 0.5); ctx.lineTo(g * 0.4, g * 0.5); ctx.stroke();
      break;
    }
    default: {
      ctx.beginPath(); ctx.arc(0, 0, g * 0.6, 0, 7); ctx.stroke();
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// 5. GLYPH DRAWERS (verbatim from poc lines 1098-1235)
// ---------------------------------------------------------------------------
function drawGlyph(ctx: CanvasRenderingContext2D, key: string, x: number, y: number, s: number, col: string, alpha: number): void {
  if (s < GLYPH_MIN_CELL) {
    ctx.globalAlpha = alpha * 0.9;
    ctx.fillStyle = col;
    const r = Math.max(1, s * 0.16);
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    ctx.globalAlpha = 1; return;
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
      ctx.fill(); break;
    case 'pulse':
      ctx.beginPath();
      ctx.moveTo(-g, 0); ctx.lineTo(-g * 0.4, 0); ctx.lineTo(-g * 0.15, -g * 0.7);
      ctx.lineTo(g * 0.1, g * 0.7); ctx.lineTo(g * 0.4, 0); ctx.lineTo(g, 0); ctx.stroke(); break;
    case 'fang':
      ctx.beginPath(); ctx.moveTo(-g * 0.5, -g * 0.6); ctx.lineTo(-g * 0.5, g * 0.2); ctx.lineTo(-g * 0.2, -g * 0.2); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(g * 0.5, -g * 0.6); ctx.lineTo(g * 0.5, g * 0.2); ctx.lineTo(g * 0.2, -g * 0.2); ctx.closePath(); ctx.fill(); break;
    case 'blade':
      ctx.beginPath(); ctx.moveTo(0, -g); ctx.lineTo(0, g * 0.55); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-g * 0.55, g * 0.18); ctx.lineTo(g * 0.55, g * 0.18); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -g); ctx.lineTo(-g * 0.22, -g * 0.55);
      ctx.lineTo(g * 0.22, -g * 0.55); ctx.closePath(); ctx.fill(); break;
    case 'arrowdn':
      ctx.beginPath(); ctx.moveTo(0, -g); ctx.lineTo(0, g * 0.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, g); ctx.lineTo(-g * 0.45, g * 0.35); ctx.lineTo(g * 0.45, g * 0.35); ctx.closePath(); ctx.fill(); break;
    case 'rage':
      ctx.beginPath();
      for (let k = 0; k < 10; k++) {
        const rv = (k % 2) ? g * 0.4 : g; const a = -Math.PI / 2 + k * Math.PI / 5;
        const px2 = Math.cos(a) * rv, py2 = Math.sin(a) * rv;
        if (k === 0) ctx.moveTo(px2, py2); else ctx.lineTo(px2, py2);
      }
      ctx.closePath(); ctx.fill(); break;
    case 'shield':
      ctx.beginPath();
      ctx.moveTo(0, -g); ctx.lineTo(g * 0.8, -g * 0.6); ctx.lineTo(g * 0.8, g * 0.25);
      ctx.quadraticCurveTo(g * 0.8, g * 0.9, 0, g);
      ctx.quadraticCurveTo(-g * 0.8, g * 0.9, -g * 0.8, g * 0.25);
      ctx.lineTo(-g * 0.8, -g * 0.6); ctx.closePath(); ctx.fill(); break;
    case 'brace':
      ctx.beginPath(); ctx.arc(0, 0, g * 0.85, Math.PI * 0.8, Math.PI * 2.2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-g * 0.3, 0); ctx.lineTo(g * 0.3, 0); ctx.stroke(); break;
    case 'thorns':
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * g, Math.sin(a) * g); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * g, Math.sin(a) * g);
        ctx.lineTo(Math.cos(a + 0.3) * g * 0.6, Math.sin(a + 0.3) * g * 0.6); ctx.stroke();
      }
      break;
    case 'rune':
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = -Math.PI / 2 + k * Math.PI / 3;
        const px2 = Math.cos(a) * g, py2 = Math.sin(a) * g;
        if (k === 0) ctx.moveTo(px2, py2); else ctx.lineTo(px2, py2);
      }
      ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, g * 0.25, 0, 7); ctx.fill(); break;
    case 'chevron':
      ctx.beginPath();
      ctx.moveTo(-g * 0.7, -g * 0.7); ctx.lineTo(g * 0.05, 0); ctx.lineTo(-g * 0.7, g * 0.7); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-g * 0.05, -g * 0.7); ctx.lineTo(g * 0.7, 0); ctx.lineTo(-g * 0.05, g * 0.7); ctx.stroke(); break;
    case 'dblchev':
      ctx.beginPath(); ctx.moveTo(-g * 0.8, -g * 0.7); ctx.lineTo(-g * 0.1, 0); ctx.lineTo(-g * 0.8, g * 0.7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(g * 0.0, -g * 0.7); ctx.lineTo(g * 0.7, 0); ctx.lineTo(g * 0.0, g * 0.7); ctx.stroke(); break;
    case 'wisp':
      ctx.beginPath(); ctx.arc(0, 0, g * 0.7, 0.4, Math.PI * 1.7); ctx.stroke();
      ctx.beginPath(); ctx.arc(g * 0.2, g * 0.1, g * 0.3, Math.PI, Math.PI * 2.6); ctx.stroke(); break;
    case 'diamond':
      ctx.beginPath();
      ctx.moveTo(0, -g); ctx.lineTo(g * 0.78, 0); ctx.lineTo(0, g); ctx.lineTo(-g * 0.78, 0);
      ctx.closePath(); ctx.fill(); break;
    case 'flame':
      ctx.beginPath();
      ctx.moveTo(0, g);
      ctx.bezierCurveTo(g * 0.95, g * 0.4, g * 0.5, -g * 0.4, 0, -g);
      ctx.bezierCurveTo(-g * 0.3, -g * 0.3, -g * 0.85, g * 0.2, 0, g);
      ctx.fill(); break;
    case 'snow':
      for (let k = 0; k < 6; k++) {
        const a = k * Math.PI / 3;
        ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * g, Math.sin(a) * g); ctx.stroke();
        const bx = Math.cos(a) * g * 0.6, by = Math.sin(a) * g * 0.6;
        const pa = a + Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(bx - Math.cos(pa) * g * 0.22, by - Math.sin(pa) * g * 0.22);
        ctx.lineTo(bx + Math.cos(pa) * g * 0.22, by + Math.sin(pa) * g * 0.22);
        ctx.stroke();
      } break;
    case 'bolt':
      ctx.beginPath();
      ctx.moveTo(g * 0.3, -g); ctx.lineTo(-g * 0.35, g * 0.1); ctx.lineTo(g * 0.1, g * 0.1);
      ctx.lineTo(-g * 0.3, g); ctx.lineTo(g * 0.4, -g * 0.15); ctx.lineTo(-g * 0.05, -g * 0.15);
      ctx.closePath(); ctx.fill(); break;
    case 'vial':
      ctx.beginPath(); ctx.moveTo(-g * 0.25, -g); ctx.lineTo(-g * 0.25, -g * 0.2);
      ctx.lineTo(-g * 0.6, g * 0.7); ctx.quadraticCurveTo(-g * 0.6, g, 0, g);
      ctx.quadraticCurveTo(g * 0.6, g, g * 0.6, g * 0.7); ctx.lineTo(g * 0.25, -g * 0.2);
      ctx.lineTo(g * 0.25, -g); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-g * 0.45, g * 0.2); ctx.lineTo(g * 0.45, g * 0.2); ctx.stroke(); break;
    case 'sigil':
      ctx.beginPath();
      for (let k = 0; k < 3; k++) {
        const a = -Math.PI / 2 + k * 2 * Math.PI / 3;
        if (k === 0) ctx.moveTo(Math.cos(a) * g, Math.sin(a) * g);
        else ctx.lineTo(Math.cos(a) * g, Math.sin(a) * g);
      } ctx.closePath(); ctx.stroke();
      ctx.beginPath();
      for (let k = 0; k < 3; k++) {
        const a = Math.PI / 2 + k * 2 * Math.PI / 3;
        if (k === 0) ctx.moveTo(Math.cos(a) * g, Math.sin(a) * g);
        else ctx.lineTo(Math.cos(a) * g, Math.sin(a) * g);
      } ctx.closePath(); ctx.stroke(); break;
    case 'droplet':
      ctx.beginPath();
      ctx.moveTo(0, -g);
      ctx.bezierCurveTo(g * 0.75, g * 0.05, g * 0.55, g, 0, g);
      ctx.bezierCurveTo(-g * 0.55, g, -g * 0.75, g * 0.05, 0, -g);
      ctx.fill(); break;
    case 'ring':
      ctx.beginPath(); ctx.arc(0, 0, g * 0.8, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-g * 0.45, 0); ctx.lineTo(g * 0.45, 0);
      ctx.moveTo(0, -g * 0.45); ctx.lineTo(0, g * 0.45); ctx.stroke(); break;
    case 'star':
    default:
      ctx.beginPath();
      for (let k = 0; k < 10; k++) {
        const rv = (k % 2) ? g * 0.45 : g;
        const a = -Math.PI / 2 + k * Math.PI / 5;
        const px2 = Math.cos(a) * rv, py2 = Math.sin(a) * rv;
        if (k === 0) ctx.moveTo(px2, py2); else ctx.lineTo(px2, py2);
      }
      ctx.closePath(); ctx.fill(); break;
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// 6. BEHAVIOR MOD (verbatim from poc lines 1237-1270)
// ---------------------------------------------------------------------------
function behaviorMod(type: string, clock: number, off: number): { bright: number; sx: number; sy: number } {
  const A = BEHAV_AMP;
  let bright = 0, sx = 0, sy = 0;
  switch (type) {
    case 'vital': case 'regen': case 'lifesteal': {
      const b = Math.pow(Math.max(0, Math.sin(clock * 2.2 + off)), 6);
      bright = 0.10 * A * b; sx = sy = 0.06 * A * b; break;
    }
    case 'core':
      bright = (0.10 + 0.08 * Math.sin(clock * 1.6 + off)) * A; break;
    case 'ember':
      bright = (0.12 + 0.18 * Math.abs(Math.sin(clock * 9 + off) * Math.sin(clock * 3.3 + off))) * A; break;
    case 'frost':
      bright = (0.10 + 0.10 * Math.sin(clock * 4 + off)) * A; sx = 0.03 * A * Math.sin(clock * 7 + off); break;
    case 'spark': {
      const c = Math.sin(clock * 5 + off); const flick = (c > 0.82) ? 1 : 0;
      bright = (0.08 + 0.5 * flick * (0.5 + 0.5 * Math.sin(clock * 60))) * A; break;
    }
    case 'mana':
      bright = (0.10 + 0.06 * Math.sin(clock * 1.8 + off)) * A; break;
    case 'catalyst': case 'ward': case 'arcane': {
      const p = 0.5 + 0.5 * Math.sin(clock * 3 + off);
      bright = (0.10 + 0.16 * p) * A; sx = sy = 0.05 * A * p; break;
    }
    case 'plate': case 'block': case 'thorns':
      bright = 0.04 * A * Math.sin(clock * 1.2 + off); break;
    case 'force': case 'pierce': case 'berserk': {
      const gv = Math.sin(clock * 2.4 + off); bright = (gv > 0.9 ? 0.4 : 0) * A; break;
    }
    case 'focus':
      bright = (0.06 + 0.14 * Math.pow(Math.max(0, Math.sin(clock * 6 + off)), 8)) * A; break;
    case 'swift': case 'haste': case 'evasion':
      sx = 0.04 * A * Math.sin(clock * 8 + off); break;
    case 'poison':
      bright = (0.08 + 0.10 * Math.abs(Math.sin(clock * 3.5 + off))) * A; break;
  }
  return { bright, sx, sy };
}

// ---------------------------------------------------------------------------
// 7. CREATURE PREVIEW draw (verbatim from poc drawCreaturePixels, builder-LOD path)
// ---------------------------------------------------------------------------
function drawCreaturePixels(
  ctx: CanvasRenderingContext2D,
  build: Build,
  sx: number,
  baseY: number,
  scaleMul: number,
  t: number,
  breathPhase: number,
): void {
  const scale = scaleMul;
  const cell = PX * scale;
  const detailed = cell >= GLYPH_MIN_CELL;
  const breath = 1 + 0.03 * Math.sin(t * 2.6 + breathPhase);

  for (let i = 0; i < build.length; i++) {
    const p = build[i]!;
    const bm = behaviorMod(p.type, t, i * 1.7);
    const bx = bm.sx * PX, by = bm.sy * PX;
    const x = sx + (p.gx * PX + bx) * scale;
    const y = baseY - (3.2 * PX * scale) + (p.gy * PX * breath + by) * scale;
    const w = (PX * scale + 0.6);
    const base = colorOfType(p.type);
    const col = lighten(base, Math.min(0.6, bm.bright));
    ctx.globalAlpha = 1;
    ctx.fillStyle = col;
    ctx.fillRect(x - w / 2, y - w / 2, w, w);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(x - w / 2, y - w / 2, w, Math.max(1, w * 0.18));
    if (detailed) {
      const cube = CUBES[p.type];
      if (cube) drawGlyph(ctx, cube.glyph, x, y, w, cube.tint, 0.92);
    }
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------------------
// MAIN startBuilder()
// ---------------------------------------------------------------------------
export function startBuilder(opts: { state: SaveState; onFight: (build: Build) => void; rewardEvents?: RewardEvent[] }): () => void {

  // ---- canvas setup (verbatim DPR logic from poc lines 757-769) ----
  const cv = document.createElement('canvas');
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;cursor:crosshair;display:block;background:#070a0f';
  document.body.style.cssText = 'margin:0;height:100%;background:#070a0f;overflow:hidden;font-family:"Segoe UI",system-ui,sans-serif;color:#cfd6e0';
  document.body.appendChild(cv);

  const ctx = cv.getContext('2d')!;
  let W = 0, H = 0, DPR = 1;
  // Declared early — resize() (called during init) calls repositionUiDiv() which
  // reads uiDiv; a later `let` would be in the temporal dead zone (blank screen).
  let uiDiv: HTMLDivElement | null = null;

  function resize(): void {
    DPR = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    W = window.innerWidth; H = window.innerHeight;
    cv.width  = Math.round(W * DPR);
    cv.height = Math.round(H * DPR);
    cv.style.width  = W + 'px';
    cv.style.height = H + 'px';
    repositionUiDiv();
  }
  window.addEventListener('resize', resize); resize();

  // ---- META-STATE — read/write from opts.state (shared SaveState) ----
  // Local ring/grid state derived from level (not stored in SaveState — cosmetic only)
  let ringUnlocked = GRID_START_RING + Math.floor((opts.state.level - 1) / RING_UNLOCK_EVERY);
  {
    const half = GRID_MAX >> 1;
    if (ringUnlocked > half) ringUnlocked = half;
  }
  const discovered: Record<string, boolean> = {};

  function owned(type: string): number { return type === 'core' ? Infinity : (opts.state.inventory[type] ?? 0); }
  function buildCost(arr: Build): number { let s = 0; for (const p of arr) s += (CUBES[p.type]?.cost ?? 0); return s; }
  function budgetUsed(): number { return buildCost(build); }
  function budgetCap(): number { return BUDGET_BASE + (opts.state.level - 1) * BUDGET_PER_LEVEL; }
  function cellUnlocked(gx: number, gy: number): boolean {
    const half = GRID_MAX >> 1;
    if (Math.abs(gx) > half || Math.abs(gy) > half) return false;
    return Math.max(Math.abs(gx), Math.abs(gy)) <= ringUnlocked;
  }

  // Internal loot counter for deterministic loot seeding within this builder session
  let _lootClicks = 0;
  function grantLootToState(batchRange: [number, number]): void {
    _lootClicks++;
    const r = lootRng(_lootClicks);
    const n = batchRange[0] + ((r() * (batchRange[1] - batchRange[0] + 1)) | 0);
    const got: Record<string, number> = {};
    const granted = grantLootInto(opts.state.inventory, n, r);
    for (const k of granted) got[k] = (got[k] ?? 0) + 1;
    const parts = Object.keys(got).map(k => (CUBES[k]?.name ?? k) + '×' + got[k]);
    toast('Лут: ' + parts.join(', '), '#5ec07e');
  }

  function expandGrid(): void {
    const half = GRID_MAX >> 1;
    if (ringUnlocked >= half) { toast('Поле вже максимальне', '#e3b341'); return; }
    ringUnlocked++;
    toast('Поле розширено до ' + (ringUnlocked * 2 + 1) + '×' + (ringUnlocked * 2 + 1), '#7ea0d0');
  }

  // levelUp and grantLoot kept as internal helpers (used by old code paths — no free UI buttons)
  function levelUpInternal(): void {
    opts.state.level++;
    let msg = 'Рівень ' + opts.state.level + ' · бюджет +' + BUDGET_PER_LEVEL;
    if (opts.state.level % RING_UNLOCK_EVERY === 0) {
      const half = GRID_MAX >> 1;
      if (ringUnlocked < half) { ringUnlocked++; msg += ' · поле розширено'; }
    }
    grantLootToState(LOOT_LEVEL_BATCH);
    toast(msg, '#b07ed0');
  }
  void levelUpInternal; // suppress unused-warning (kept for internal use)

  function markDiscovered(traits: Trait[]): void {
    for (const tr of traits) { if (!discovered[tr.key]) discovered[tr.key] = true; }
  }

  // ---- BUILDER STATE — initialize from shared state ----
  let build: Build = opts.state.heroBuild.map(p => ({ ...p }));
  let selectedType = 'vital';
  let showAllBonds = false;
  let builderZoom = 1.0;
  let derived: Stats | null = null;
  let traitsCache: Trait[] = [];
  let hoverCell: { gx: number; gy: number } | null = null;
  let hoverPixIdx = -1;
  const shapeFlash: Record<string, { t: number }> = {};
  let prevShapeKeys = new Set<string>();
  let showCodex = false;
  let detailExpanded = false;

  // inventory UI state
  let invTab = 'all';
  let invRarity = 'all';
  let invSort = 'rarity';
  let invSearch = '';
  let invScroll = 0;
  let invSearchFocus = false;

  // toast state
  const toasts: Array<{ text: string; col: string; t: number; life: number }> = [];
  function toast(text: string, col: string): void {
    toasts.push({ text, col: col || '#dfe8ff', t: 0, life: 2.4 });
    if (toasts.length > 5) toasts.shift();
  }
  function stepToasts(dt: number): void {
    for (let i = toasts.length - 1; i >= 0; i--) {
      toasts[i]!.t += dt;
      if (toasts[i]!.t >= toasts[i]!.life) toasts.splice(i, 1);
    }
  }

  // hit-test regions
  const invHit = {
    tabs: [] as Array<{ k: string; x: number; y: number; w: number; h: number }>,
    rarities: [] as Array<{ k: string; x: number; y: number; w: number; h: number }>,
    sorts: [] as Array<{ k: string; x: number; y: number; w: number; h: number }>,
    entries: [] as Array<{ k: string; x: number; y: number; w: number; h: number; usable: boolean }>,
    search: null as { x: number; y: number; w: number; h: number } | null,
  };
  const statHit = { detail: null as { x: number; y: number; w: number; h: number } | null };

  let mouseX = -1, mouseY = -1;
  let t = 0;

  // ---- GEOMETRY — responsive: portrait uses bottom-strip layout ----
  function isPortrait(): boolean { return W < PORTRAIT_BREAKPOINT; }
  /** Height of the bottom inventory strip in portrait mode */
  function portraitStripH(): number { return Math.round(H * 0.38); }
  /** Portrait: height of the canvas HUD strip at the very top */
  function portraitHudH(): number { return 86; }
  /** Portrait: height of the action-buttons row directly below the HUD */
  function portraitBtnRowH(): number { return 54; }
  /** Portrait: y-start of the grid area (below HUD + button row) */
  function portraitGridTop(): number { return portraitHudH() + portraitBtnRowH(); }

  function builderGeom() {
    const cell = BUILD_CELL * builderZoom;
    if (isPortrait()) {
      // In portrait: grid fills the middle area between button row and inventory strip
      const stripH = portraitStripH();
      const gridTop = portraitGridTop();
      const areaH = H - stripH - gridTop;
      const areaW = W;
      const cx = areaW * 0.5;
      const cy = gridTop + areaH * 0.50;
      return { cell, cx, cy, panelW: 0, areaW, portraitMode: true, stripH, areaH };
    }
    const panelW = Math.min(RIGHT_PANEL_W, W * 0.38);
    const areaW = W - panelW;
    const cx = areaW * 0.5;
    const cy = H * 0.50;
    return { cell, cx, cy, panelW, areaW, portraitMode: false, stripH: 0, areaH: H };
  }
  function gridToScreen(gx: number, gy: number): { x: number; y: number } {
    const { cell, cx, cy } = builderGeom();
    return { x: cx + gx * cell, y: cy + gy * cell };
  }
  function screenToGrid(mx: number, my: number): { gx: number; gy: number } {
    const { cell, cx, cy } = builderGeom();
    return { gx: Math.round((mx - cx) / cell), gy: Math.round((my - cy) / cell) };
  }

  // ---- RECOMPUTE (verbatim from poc lines 1761-1768) ----
  function recompute(): void {
    derived = deriveStats(build);
    traitsCache = derived.traits;
    markDiscovered(traitsCache);
    const shapeKeys = new Set(traitsCache.filter(tr => tr.kind === 'shape').map(tr => tr.key));
    for (const k of shapeKeys) { if (!prevShapeKeys.has(k)) shapeFlash[k] = { t: 0 }; }
    prevShapeKeys = shapeKeys;
  }
  recompute();

  // ---- CONNECTED SET (verbatim from poc lines 1771-1784) ----
  function connectedSet(arr: Build): Set<number> {
    const byCell = new Map<string, number>();
    arr.forEach((p, i) => byCell.set(p.gx + ',' + p.gy, i));
    const coreI = arr.findIndex(p => p.type === 'core');
    if (coreI < 0) return new Set();
    const seen = new Set<number>([coreI]); const stack = [coreI];
    while (stack.length) {
      const i = stack.pop()!; const p = arr[i]!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) {
        const j = byCell.get((p.gx + dx) + ',' + (p.gy + dy));
        if (j !== undefined && !seen.has(j)) { seen.add(j); stack.push(j); }
      }
    }
    return seen;
  }
  function cellOccupied(gx: number, gy: number): boolean { return build.some(p => p.gx === gx && p.gy === gy); }
  function orthAdjToBody(gx: number, gy: number): boolean {
    return build.some(p => (Math.abs(p.gx - gx) + Math.abs(p.gy - gy)) === 1);
  }

  // ---- PLACE/REMOVE (verbatim from poc lines 1790-1832) ----
  function canPlace(gx: number, gy: number, type: string): { ok: boolean; reason: string } {
    if (cellOccupied(gx, gy)) return { ok: false, reason: 'зайнято' };
    if (!cellUnlocked(gx, gy)) return { ok: false, reason: 'клітинка замкнена 🔒' };
    if (!orthAdjToBody(gx, gy)) return { ok: false, reason: 'має торкатись тіла' };
    if (type === 'core') return { ok: false, reason: 'Ядро лише одне' };
    if (owned(type) <= 0) return { ok: false, reason: 'немає в інвентарі' };
    if (budgetUsed() + (CUBES[type]?.cost ?? 0) > budgetCap()) return { ok: false, reason: 'перевищує бюджет' };
    return { ok: true, reason: '' };
  }
  function placePixel(gx: number, gy: number): void {
    const res = canPlace(gx, gy, selectedType);
    if (!res.ok) { toast('Не можна: ' + res.reason, '#e5814b'); return; }
    build.push({ gx, gy, type: selectedType });
    opts.state.inventory[selectedType] = (opts.state.inventory[selectedType] ?? 1) - 1;
    recompute();
  }
  function removePixel(idx: number): void {
    const p = build[idx]!;
    if (p.type === 'core') { toast('Ядро не можна прибрати', '#e3b341'); return; }
    const trial = build.slice(0, idx).concat(build.slice(idx + 1));
    const reach = connectedSet(trial);
    if (reach.size !== trial.length) { toast('Прибирання відʼєднає тіло', '#e5814b'); return; }
    build.splice(idx, 1);
    opts.state.inventory[p.type] = (opts.state.inventory[p.type] ?? 0) + 1;
    recompute();
  }
  // ---- BOND SEGMENTS (verbatim from poc lines 1835-1846) ----
  function bondSegments(): Array<{ i: number; j: number; key: string; name: string; x1: number; y1: number; x2: number; y2: number }> {
    const out = [];
    for (const tr of traitsCache) {
      if (tr.kind !== 'adjacency' || !tr.bonds) continue;
      for (const [i, j] of tr.bonds) {
        const a = build[i]!, b2 = build[j]!;
        const sa = gridToScreen(a.gx, a.gy), sb = gridToScreen(b2.gx, b2.gy);
        out.push({ i, j, key: tr.key, name: tr.name, x1: sa.x, y1: sa.y, x2: sb.x, y2: sb.y });
      }
    }
    return out;
  }

  // ---- PREVIEW AT (verbatim from poc lines 1851-1881) ----
  function previewAt(gx: number, gy: number, type: string) {
    const res = canPlace(gx, gy, type);
    if (!res.ok && res.reason !== 'перевищує бюджет') return null;
    const trial = build.concat([{ gx, gy, type }]);
    const before = detectTraits(build);
    const after = detectTraits(trial);
    const newIdx = trial.length - 1;
    const bondNeighbors: Array<{ j: number; key: string; name: string }> = [];
    const byCell = new Map<string, number>();
    build.forEach((p, i) => byCell.set(p.gx + ',' + p.gy, i));
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) {
      const j = byCell.get((gx + dx) + ',' + (gy + dy));
      if (j === undefined) continue;
      const q = build[j]!;
      for (const d of SYNERGY_DEFS) {
        if (d.match(type, q.type) || d.match(q.type, type)) {
          bondNeighbors.push({ j, key: d.key, name: d.name }); break;
        }
      }
    }
    const gained: Array<{ key: string; name: string; kind: string; delta: number; sets?: number[][]; idxAfter: number[] }> = [];
    const bmap: Record<string, number> = {};
    for (const tr of before) bmap[tr.key] = tr.magnitude;
    for (const tr of after) {
      const wasMag = bmap[tr.key] ?? 0;
      if (tr.magnitude > wasMag && tr.pixelIndices.includes(newIdx)) {
        gained.push({ key: tr.key, name: tr.name, kind: tr.kind, delta: tr.magnitude - wasMag, sets: tr.sets, idxAfter: tr.pixelIndices });
      } else if (!bmap[tr.key] && tr.pixelIndices.includes(newIdx)) {
        gained.push({ key: tr.key, name: tr.name, kind: tr.kind, delta: tr.magnitude, sets: tr.sets, idxAfter: tr.pixelIndices });
      }
    }
    return { gx, gy, type, bondNeighbors, gained, trial, newIdx, budgetBlocked: (res.ok === false) };
  }

  // ---- FILTERED INVENTORY (verbatim from poc lines 2090-2101) ----
  function filteredInventory(): string[] {
    let list = PLACEABLE.slice();
    if (invTab !== 'all') list = list.filter(k => CUBES[k]?.cat === invTab);
    if (invRarity !== 'all') list = list.filter(k => CUBES[k]?.rarity === invRarity);
    if (invSearch.trim()) {
      const q = invSearch.trim().toLowerCase();
      list = list.filter(k => (CUBES[k]?.name.toLowerCase().includes(q)) || (CUBES[k]?.eff.toLowerCase().includes(q)));
    }
    if (invSort === 'rarity') list.sort((a, b) => (RARITY_ORDER[CUBES[b]?.rarity ?? 'common'] ?? 0) - (RARITY_ORDER[CUBES[a]?.rarity ?? 'common'] ?? 0) || (CUBES[a]?.cost ?? 0) - (CUBES[b]?.cost ?? 0));
    else if (invSort === 'cost') list.sort((a, b) => (CUBES[a]?.cost ?? 0) - (CUBES[b]?.cost ?? 0) || a.localeCompare(b));
    else list.sort((a, b) => (CUBES[a]?.name ?? a).localeCompare(CUBES[b]?.name ?? b, 'uk'));
    return list;
  }

  // ---- RIGHT PANEL LAYOUT — responsive ----
  function rightPanelLayout() {
    const GAP = 12;
    if (isPortrait()) {
      // Portrait: panels live inside the bottom strip (H - stripH .. H)
      const stripH = portraitStripH();
      const stripTop = H - stripH;
      const invBoxTop = stripTop + 4;
      const invBoxH = stripH - 4;
      return {
        inv: { boxTop: invBoxTop, boxH: invBoxH },
        stats: { boxTop: stripTop, boxH: 0 },   // hidden in portrait
        traits: { boxTop: stripTop, boxH: 0 },  // hidden in portrait
        portraitMode: true,
        stripTop,
        stripH,
      };
    }
    const invBoxTop = 44;
    const traitsBoxH = 110;
    const traitsBoxTop = H - 146;
    const statsBoxH = detailExpanded ? 300 : 150;
    const statsBoxTop = traitsBoxTop - GAP - statsBoxH;
    const invBoxH = Math.max(120, (statsBoxTop - GAP) - invBoxTop);
    return {
      inv: { boxTop: invBoxTop, boxH: invBoxH },
      stats: { boxTop: statsBoxTop, boxH: statsBoxH },
      traits: { boxTop: traitsBoxTop, boxH: traitsBoxH },
      portraitMode: false,
      stripTop: 0,
      stripH: 0,
    };
  }

  // ---- DRAW HELPERS ----
  function inRect(mx: number, my: number, r: { x: number; y: number; w: number; h: number } | null): boolean {
    return !!r && mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h;
  }

  // ---- DRAW ARENA (verbatim from poc lines 1521-1539) ----
  function drawArena(): void {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#121826'); g.addColorStop(0.55, '#0e141d'); g.addColorStop(1, '#070a10');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // Subtle center glow (build area ambient light)
    const geomA = builderGeom();
    const cxA = geomA.cx, cyA = geomA.cy;
    const hg = ctx.createRadialGradient(cxA, cyA, 10, cxA, cyA, Math.min(W, H) * 0.55);
    hg.addColorStop(0, 'rgba(50,80,140,0.10)'); hg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hg; ctx.fillRect(0, 0, W, H);
    // Edge vignette
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }

  // ---- DRAW BOND (verbatim from poc lines 2031-2046) ----
  function drawBond(sg: { key: string; x1: number; y1: number; x2: number; y2: number }, alphaMul: number): void {
    const col = traitColor(sg.key);
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.35 * BOND_GLOW * alphaMul; ctx.strokeStyle = col; ctx.lineWidth = BOND_WIDTH * builderZoom + 4;
    ctx.beginPath(); ctx.moveTo(sg.x1, sg.y1); ctx.lineTo(sg.x2, sg.y2); ctx.stroke();
    ctx.globalAlpha = 0.95 * alphaMul; ctx.strokeStyle = lighten(col, 0.4); ctx.lineWidth = BOND_WIDTH * builderZoom;
    ctx.beginPath(); ctx.moveTo(sg.x1, sg.y1); ctx.lineTo(sg.x2, sg.y2); ctx.stroke();
    ctx.globalAlpha = 1;
    const mx = (sg.x1 + sg.x2) / 2, my = (sg.y1 + sg.y2) / 2;
    const r = 8 * builderZoom + 3;
    ctx.fillStyle = 'rgba(10,14,22,0.9)';
    ctx.beginPath(); ctx.arc(mx, my, r, 0, 7); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(mx, my, r, 0, 7); ctx.stroke();
    drawTraitIcon(ctx, sg.key, mx, my, r * 1.7, lighten(col, 0.3));
  }

  // ---- DRAW SHAPE HIGHLIGHTS (verbatim from poc lines 2048-2086) ----
  function drawShapeHighlights(): void {
    const { cell } = builderGeom();
    for (const tr of traitsCache) {
      if (tr.kind !== 'shape' || !tr.sets) continue;
      const col = traitColor(tr.icon) || traitColor(tr.key);
      const pulse = 0.4 + 0.3 * Math.sin(t * 4) * SHAPE_PULSE;
      for (const set of tr.sets) {
        ctx.globalAlpha = 0.18 + 0.12 * Math.max(0, Math.sin(t * 3));
        ctx.fillStyle = col;
        for (const idx of set) {
          const p = build[idx]!; const s = gridToScreen(p.gx, p.gy);
          ctx.fillRect(s.x - cell / 2, s.y - cell / 2, cell - 2, cell - 2);
        }
        ctx.globalAlpha = Math.min(0.9, 0.5 + pulse);
        ctx.strokeStyle = lighten(col, 0.3); ctx.lineWidth = 2;
        for (const idx of set) {
          const p = build[idx]!; const s = gridToScreen(p.gx, p.gy);
          ctx.strokeRect(s.x - cell / 2 + 1, s.y - cell / 2 + 1, cell - 4, cell - 4);
        }
        ctx.globalAlpha = 1;
      }
      const fl = shapeFlash[tr.key];
      if (fl) {
        fl.t += 1 / 60;
        const set = tr.sets[0]!;
        let mx2 = 0, my2 = 0;
        for (const idx of set) { const s2 = gridToScreen(build[idx]!.gx, build[idx]!.gy); mx2 += s2.x; my2 += s2.y; }
        mx2 /= set.length; my2 /= set.length;
        const u = fl.t / SHAPE_FLASH_DUR;
        if (u < 1) {
          ctx.globalAlpha = Math.min(1, (1 - u) * 2);
          ctx.font = 'bold 18px system-ui'; ctx.textAlign = 'center';
          ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
          ctx.strokeText(tr.name + '!', mx2, my2 - 30 - u * 24);
          ctx.fillStyle = lighten(col, 0.4); ctx.fillText(tr.name + '!', mx2, my2 - 30 - u * 24);
          ctx.globalAlpha = 1; ctx.textAlign = 'left';
        } else { delete shapeFlash[tr.key]; }
      }
    }
  }

  // ---- DRAW BUILDER GRID (verbatim from poc lines 1883-2028) ----
  function drawBuilderGrid(): void {
    const { cell } = builderGeom();
    const half = GRID_MAX >> 1;

    for (let gy = -half; gy <= half; gy++) {
      for (let gx = -half; gx <= half; gx++) {
        const s = gridToScreen(gx, gy);
        const x = s.x - cell / 2, y = s.y - cell / 2, w = cell - 1, hh = cell - 1;
        if (cellUnlocked(gx, gy)) {
          // Subtle inner glow on unlocked cells — warmer near center
          const dist = Math.max(Math.abs(gx), Math.abs(gy));
          if (dist === 0) {
            ctx.fillStyle = 'rgba(100,130,180,0.06)'; ctx.fillRect(x, y, w, hh);
          }
          ctx.strokeStyle = 'rgba(100,130,180,0.14)'; ctx.lineWidth = 0.8;
          ctx.strokeRect(x + 0.5, y + 0.5, w - 1, hh - 1);
        } else {
          ctx.fillStyle = 'rgba(12,16,24,0.7)'; ctx.fillRect(x, y, w, hh);
          ctx.strokeStyle = 'rgba(45,60,88,0.4)'; ctx.lineWidth = 0.8;
          // diagonal hatch for locked cells
          ctx.beginPath();
          for (let o = -hh; o < w; o += 7) {
            ctx.moveTo(x + Math.max(0, o), y + Math.max(0, -o));
            ctx.lineTo(x + Math.min(w, o + hh), y + Math.min(hh, hh - o));
          }
          ctx.stroke();
        }
      }
    }

    // unlocked-region border — subtle double glow
    {
      const r = ringUnlocked;
      const a = gridToScreen(-r, -r), b2 = gridToScreen(r, r);
      const rw = (2 * r + 1) * cell;
      ctx.strokeStyle = 'rgba(80,120,190,0.15)'; ctx.lineWidth = 4;
      ctx.strokeRect(a.x - cell / 2 - 1, a.y - cell / 2 - 1, rw + 2, rw + 2);
      ctx.strokeStyle = 'rgba(140,180,240,0.45)'; ctx.lineWidth = 1.5;
      ctx.strokeRect(a.x - cell / 2, a.y - cell / 2, rw, rw);
      void b2;
    }

    drawShapeHighlights();

    if (cell >= LOD_BOND_MINCELL) {
      const segs = bondSegments();
      const hoverType2 = hoverPixIdx >= 0 ? build[hoverPixIdx]!.type : null;
      for (const sg of segs) {
        let show = showAllBonds;
        if (!show && hoverPixIdx >= 0) {
          show = (sg.i === hoverPixIdx || sg.j === hoverPixIdx)
            || build[sg.i]!.type === hoverType2 || build[sg.j]!.type === hoverType2;
        }
        if (!show) continue;
        drawBond(sg, 1.0);
      }
    }

    // synergy preview ghost
    let preview: ReturnType<typeof previewAt> = null;
    if (hoverCell && hoverPixIdx < 0) {
      preview = previewAt(hoverCell.gx, hoverCell.gy, selectedType);
    }
    if (preview) {
      const s = gridToScreen(preview.gx, preview.gy);
      const ghostCol = preview.budgetBlocked ? '#e5814b' : colorOfType(selectedType);
      ctx.globalAlpha = 0.35 + 0.12 * Math.sin(t * 6); ctx.fillStyle = ghostCol;
      ctx.fillRect(s.x - cell / 2, s.y - cell / 2, cell - 2, cell - 2);
      ctx.globalAlpha = 0.9; ctx.setLineDash([5, 4]);
      ctx.strokeStyle = ghostCol; ctx.lineWidth = 2;
      ctx.strokeRect(s.x - cell / 2, s.y - cell / 2, cell - 2, cell - 2);
      ctx.setLineDash([]);
      const selCube = CUBES[selectedType];
      if (cell >= GLYPH_MIN_CELL && selCube) drawGlyph(ctx, selCube.glyph, s.x, s.y, cell - 2, '#0a0d12', 0.7);
      ctx.globalAlpha = 1;
      for (const bn of preview.bondNeighbors) {
        const q = build[bn.j]!; const qs = gridToScreen(q.gx, q.gy);
        ctx.setLineDash([4, 3]); ctx.globalAlpha = 0.8;
        ctx.strokeStyle = traitColor(bn.key); ctx.lineWidth = BOND_WIDTH * builderZoom;
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(qs.x, qs.y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = traitColor(bn.key); ctx.lineWidth = 2;
        ctx.strokeRect(qs.x - cell / 2 + 1, qs.y - cell / 2 + 1, cell - 4, cell - 4);
        ctx.globalAlpha = 1;
      }
      if (preview.gained.length || preview.bondNeighbors.length) {
        const labels = preview.gained.length
          ? preview.gained.map(g => g.name + (g.kind === 'adjacency' ? ' +' + g.delta : '!')).join('  ')
          : 'торкання: ' + [...new Set(preview.bondNeighbors.map(b => b.name))].join(' ');
        ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center';
        const ww = ctx.measureText(labels).width + 16;
        ctx.fillStyle = 'rgba(8,12,20,0.92)'; ctx.fillRect(s.x - ww / 2, s.y - cell / 2 - 26, ww, 20);
        ctx.strokeStyle = '#5a7bc0'; ctx.lineWidth = 1; ctx.strokeRect(s.x - ww / 2, s.y - cell / 2 - 26, ww, 20);
        ctx.fillStyle = '#dff0c0'; ctx.fillText(labels, s.x, s.y - cell / 2 - 12);
        ctx.textAlign = 'left';
      }
    } else if (hoverCell && hoverPixIdx < 0) {
      const { gx, gy } = hoverCell;
      if (canPlace(gx, gy, selectedType).ok) {
        const s = gridToScreen(gx, gy);
        ctx.globalAlpha = 0.22 + 0.1 * Math.sin(t * 6); ctx.fillStyle = colorOfType(selectedType);
        ctx.fillRect(s.x - cell / 2, s.y - cell / 2, cell - 2, cell - 2); ctx.globalAlpha = 1;
      }
    }

    // placed pixels
    const hoverType3 = hoverPixIdx >= 0 ? build[hoverPixIdx]!.type : null;
    for (let i = 0; i < build.length; i++) {
      const p = build[i]!;
      const s = gridToScreen(p.gx, p.gy);
      const bm = behaviorMod(p.type, t, i * 1.7);
      const w = cell - 2;
      const base = colorOfType(p.type);
      const dim = (hoverPixIdx >= 0 && hoverType3 && p.type !== hoverType3) ? INSPECT_DIM : 1;
      ctx.globalAlpha = dim;
      ctx.fillStyle = lighten(base, Math.min(0.6, bm.bright));
      // Slightly rounded feel — use inset fill with a subtle inner top-highlight
      ctx.fillRect(s.x - w / 2, s.y - w / 2, w, w);
      ctx.fillStyle = 'rgba(255,255,255,0.13)';
      ctx.fillRect(s.x - w / 2, s.y - w / 2, w, Math.max(1, w * 0.22));
      // Rarity corner pip — bottom-right, slightly larger
      const rc = RARITY_COL[CUBES[p.type]?.rarity ?? 'common']!;
      ctx.fillStyle = rc; ctx.fillRect(s.x + w / 2 - 6, s.y + w / 2 - 6, 5, 5);
      const cube = CUBES[p.type];
      if (cell >= GLYPH_MIN_CELL && cube) {
        drawGlyph(ctx, cube.glyph, s.x, s.y, w, cube.tint, dim * 0.95);
      }
      if (p.type === 'core') {
        ctx.globalAlpha = dim * (0.7 + 0.3 * Math.sin(t * 2.4));
        ctx.strokeStyle = '#fff3c0'; ctx.lineWidth = 2;
        ctx.strokeRect(s.x - w / 2, s.y - w / 2, w, w);
      }
      ctx.globalAlpha = 1;
    }

    if (hoverPixIdx >= 0) {
      const p = build[hoverPixIdx]!; const s = gridToScreen(p.gx, p.gy);
      // Bright highlight ring for hovered/removable pixel
      ctx.strokeStyle = p.type === 'core' ? '#aaa' : '#ff6060';
      ctx.lineWidth = 2.5; ctx.strokeRect(s.x - cell / 2 + 1, s.y - cell / 2 + 1, cell - 4, cell - 4);
      // Outer glow
      ctx.globalAlpha = 0.25; ctx.strokeStyle = p.type === 'core' ? '#fff' : '#ff4040';
      ctx.lineWidth = 5; ctx.strokeRect(s.x - cell / 2, s.y - cell / 2, cell - 2, cell - 2);
      ctx.globalAlpha = 1;
    }

    // footer hint strip
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    // Footer hint — hidden in portrait to save space (the bottom is the inventory strip)
    if (!isPortrait()) {
      const selName = CUBES[selectedType]?.name ?? '—';
      const selCol  = colorOfType(selectedType);
      const status = '✦ ' + selName + '  ·  ' + (build.length - 1) + ' кубів  ·  [ ] масштаб';
      ctx.font = '11px system-ui';
      const sw = ctx.measureText(status).width;
      const bw = sw + 28;
      const bh = 28;
      const bx = 12, by = H - 36;
      ctx.fillStyle = 'rgba(8,12,20,0.78)';
      if ((ctx as CanvasRenderingContext2D & { roundRect?: unknown }).roundRect) {
        ctx.beginPath();
        (ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect(bx, by, bw, bh, 6);
        ctx.fill();
        ctx.strokeStyle = 'rgba(90,120,170,0.22)'; ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        ctx.fillRect(bx, by, bw, bh);
      }
      ctx.fillStyle = selCol; ctx.fillText('✦', bx + 10, by + 18);
      ctx.font = '11px system-ui'; ctx.fillStyle = '#a0b4cc';
      ctx.fillText(selName + '  ·  ' + (build.length - 1) + ' кубів  ·  [ ] масштаб', bx + 22, by + 18);
    } else {
      // Portrait: compact pill above the bottom strip showing selected cube
      const stripTop = H - portraitStripH();
      const selName = CUBES[selectedType]?.name ?? '—';
      const selCol  = colorOfType(selectedType);
      const label = selName + '  ·  ' + (build.length - 1) + ' кубів';
      ctx.font = 'bold 11px system-ui';
      const lw = ctx.measureText(label).width + 26;
      const lx = W / 2 - lw / 2, ly = stripTop - 22;
      ctx.fillStyle = 'rgba(8,12,20,0.84)';
      if ((ctx as CanvasRenderingContext2D & { roundRect?: unknown }).roundRect) {
        ctx.beginPath();
        (ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect(lx, ly, lw, 18, 9);
        ctx.fill();
        ctx.strokeStyle = selCol; ctx.lineWidth = 1; ctx.globalAlpha = 0.45; ctx.stroke();
        ctx.globalAlpha = 1;
      } else {
        ctx.fillRect(lx, ly, lw, 18);
      }
      ctx.fillStyle = selCol; ctx.textAlign = 'center';
      ctx.fillText(label, W / 2, ly + 13);
      ctx.textAlign = 'left';
    }
  }

  // ---- DRAW INVENTORY PANEL (responsive: right-side on landscape, bottom-strip on portrait) ----
  function drawInventoryPanel(): void {
    const geom = builderGeom();
    // In portrait: panel spans full width at the bottom
    const px = geom.portraitMode ? 6 : W - geom.panelW + 10;
    const pw = geom.portraitMode ? W - 12 : geom.panelW - 20;
    const L = rightPanelLayout();
    // Panel box dimensions
    const panelBoxTop = L.inv.boxTop;
    const panelBoxH   = L.inv.boxH;
    invHit.tabs.length = invHit.rarities.length = invHit.sorts.length = invHit.entries.length = 0;
    invHit.search = null;

    // --- Panel background (semi-transparent dark card) ---
    const rounding = 10;
    ctx.fillStyle = geom.portraitMode ? 'rgba(7,10,18,0.92)' : 'rgba(8,12,20,0.72)';
    if ((ctx as CanvasRenderingContext2D & { roundRect?: unknown }).roundRect) {
      ctx.beginPath();
      (ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void })
        .roundRect(px - 6, panelBoxTop, pw + 12, panelBoxH, rounding);
      ctx.fill();
      ctx.strokeStyle = 'rgba(90,120,175,0.28)'; ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      ctx.fillRect(px - 6, panelBoxTop, pw + 12, panelBoxH);
      ctx.strokeStyle = 'rgba(90,120,175,0.28)'; ctx.lineWidth = 1;
      ctx.strokeRect(px - 6, panelBoxTop, pw + 12, panelBoxH);
    }

    // --- Header ---
    const headerH = 28;
    const headerY = panelBoxTop + 4;
    ctx.font = 'bold 11px system-ui'; ctx.fillStyle = '#6a88b8'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('ІНВЕНТАР', px + 2, headerY + headerH / 2);
    ctx.textBaseline = 'alphabetic';

    // --- Category tabs (pill style) ---
    const tabsY = panelBoxTop + headerH + 8;
    const tabH = 22;
    ctx.font = 'bold 10px system-ui'; ctx.textBaseline = 'middle';
    let tx = px, ty = tabsY;
    const tabs: [string, string][] = [['all', 'Всі'], ...CAT_ORDER.map(c => [c, CAT[c]!.ua] as [string, string])];
    for (const [k, lbl] of tabs) {
      const tabW = ctx.measureText(lbl).width + 14;
      const sel = invTab === k;
      const tabCol = k !== 'all' ? (CAT[k]?.col ?? '#7ea0d0') : '#7ea0d0';
      if (tx + tabW > px + pw + 2) { tx = px; ty += tabH + 4; }
      ctx.globalAlpha = sel ? 1 : 0.7;
      ctx.fillStyle = sel ? (k !== 'all' ? tabCol + '33' : 'rgba(50,80,140,0.5)') : 'rgba(18,26,42,0.6)';
      if ((ctx as CanvasRenderingContext2D & { roundRect?: unknown }).roundRect) {
        ctx.beginPath();
        (ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void })
          .roundRect(tx, ty, tabW, tabH, tabH / 2);
        ctx.fill();
        ctx.strokeStyle = sel ? tabCol : 'rgba(60,80,120,0.5)';
        ctx.lineWidth = sel ? 1.5 : 0.8;
        ctx.stroke();
      } else {
        ctx.fillRect(tx, ty, tabW, tabH);
        ctx.strokeStyle = sel ? tabCol : '#324768'; ctx.lineWidth = 1; ctx.strokeRect(tx, ty, tabW, tabH);
      }
      ctx.fillStyle = sel ? '#fff' : '#8fa0b8';
      ctx.fillText(lbl, tx + tabW / 2 - ctx.measureText(lbl).width / 2, ty + tabH / 2 + 1);
      invHit.tabs.push({ k, x: tx, y: ty, w: tabW, h: tabH });
      tx += tabW + 5;
      ctx.globalAlpha = 1;
    }
    let ry = ty + tabH + 8;

    // --- Filter row: rarity + sort (compact, single row) ---
    ctx.font = '9px system-ui'; ctx.textBaseline = 'middle';
    let rx = px;
    // Rarity pills
    for (const [k, lbl] of [['all', 'Всі'], ['common', 'Зв'], ['rare', 'Рід'], ['epic', 'Еп'], ['leg', 'Лег']] as [string, string][]) {
      const rk = k === 'leg' ? 'legendary' : k;
      const rw = ctx.measureText(lbl).width + 10; const sel = invRarity === rk;
      const rcol = rk !== 'all' ? (RARITY_COL[rk] ?? '#7ea0d0') : '#7ea0d0';
      ctx.globalAlpha = sel ? 1 : 0.55;
      ctx.fillStyle = sel ? 'rgba(40,60,110,0.7)' : 'rgba(16,22,38,0.6)';
      if ((ctx as CanvasRenderingContext2D & { roundRect?: unknown }).roundRect) {
        ctx.beginPath();
        (ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void })
          .roundRect(rx, ry, rw, 18, 9);
        ctx.fill();
        ctx.strokeStyle = sel ? rcol : 'rgba(50,70,110,0.5)'; ctx.lineWidth = sel ? 1.5 : 0.8; ctx.stroke();
      } else {
        ctx.fillRect(rx, ry, rw, 18);
        ctx.strokeStyle = sel ? rcol : '#324768'; ctx.lineWidth = 1; ctx.strokeRect(rx, ry, rw, 18);
      }
      ctx.fillStyle = sel ? rcol : '#7a8a9e';
      ctx.fillText(lbl, rx + rw / 2 - ctx.measureText(lbl).width / 2, ry + 9);
      invHit.rarities.push({ k: rk, x: rx, y: ry, w: rw, h: 18 }); rx += rw + 4;
      ctx.globalAlpha = 1;
    }
    // Sort pills — right-aligned
    const sortDefs: [string, string][] = [['rarity', 'Рід'], ['cost', 'Ціна'], ['name', 'A–Z']];
    let srx = px + pw;
    for (let si = sortDefs.length - 1; si >= 0; si--) {
      const [k, lbl] = sortDefs[si]!;
      const sw2 = ctx.measureText(lbl).width + 10; const sel = invSort === k;
      srx -= sw2 + 4;
      ctx.globalAlpha = sel ? 1 : 0.55;
      ctx.fillStyle = sel ? 'rgba(40,60,110,0.7)' : 'rgba(16,22,38,0.6)';
      if ((ctx as CanvasRenderingContext2D & { roundRect?: unknown }).roundRect) {
        ctx.beginPath();
        (ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void })
          .roundRect(srx, ry, sw2, 18, 9);
        ctx.fill();
        ctx.strokeStyle = sel ? '#7ea0d0' : 'rgba(50,70,110,0.5)'; ctx.lineWidth = sel ? 1.5 : 0.8; ctx.stroke();
      } else {
        ctx.fillRect(srx, ry, sw2, 18);
        ctx.strokeStyle = sel ? '#7ea0d0' : '#324768'; ctx.lineWidth = 1; ctx.strokeRect(srx, ry, sw2, 18);
      }
      ctx.fillStyle = sel ? '#cde' : '#7a8a9e';
      ctx.fillText(lbl, srx + sw2 / 2 - ctx.measureText(lbl).width / 2, ry + 9);
      invHit.sorts.push({ k, x: srx, y: ry, w: sw2, h: 18 });
      ctx.globalAlpha = 1;
    }
    ry += 24;

    // --- Search box (rounded pill) ---
    const searchH = 22;
    ctx.fillStyle = invSearchFocus ? 'rgba(20,30,56,0.9)' : 'rgba(12,18,32,0.85)';
    if ((ctx as CanvasRenderingContext2D & { roundRect?: unknown }).roundRect) {
      ctx.beginPath();
      (ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void })
        .roundRect(px, ry, pw, searchH, searchH / 2);
      ctx.fill();
      ctx.strokeStyle = invSearchFocus ? '#5a82d0' : 'rgba(60,80,130,0.5)'; ctx.lineWidth = 1; ctx.stroke();
    } else {
      ctx.fillRect(px, ry, pw, searchH);
      ctx.strokeStyle = invSearchFocus ? '#7ea0d0' : '#324768'; ctx.lineWidth = 1; ctx.strokeRect(px, ry, pw, searchH);
    }
    ctx.font = '10px system-ui'; ctx.textBaseline = 'middle';
    ctx.fillStyle = invSearch ? '#dfe8ff' : '#4a5a70';
    ctx.fillText(invSearch ? invSearch + (invSearchFocus ? '|' : '') : '🔍 пошук…', px + 10, ry + searchH / 2);
    invHit.search = { x: px, y: ry, w: pw, h: searchH };
    ctx.textBaseline = 'alphabetic';
    ry += searchH + 8;

    // --- Inventory card grid ---
    const list = filteredInventory();
    // Card sizing — larger on portrait for touch
    const CARD_GAP = 6;
    const cols = geom.portraitMode ? Math.max(2, Math.floor(pw / 150)) : 2;
    const cardW = (pw - (cols - 1) * CARD_GAP) / cols;
    // Card height: enough for icon + 2 text rows + padding — min 52px (≥44px touch target)
    const cardH = geom.portraitMode ? 56 : 52;
    const listTop = ry;
    const visibleH = (panelBoxTop + panelBoxH) - listTop - 8;
    const rows = Math.ceil(list.length / cols);
    const rowH = cardH + CARD_GAP;
    const maxScroll = Math.max(0, rows * rowH - visibleH);
    invScroll = Math.max(0, Math.min(maxScroll, invScroll));

    ctx.save();
    if ((ctx as CanvasRenderingContext2D & { roundRect?: unknown }).roundRect) {
      ctx.beginPath();
      (ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void })
        .roundRect(px - 4, listTop, pw + 8, visibleH + 4, 4);
      ctx.clip();
    } else {
      ctx.beginPath(); ctx.rect(px - 6, listTop - 2, pw + 12, visibleH + 4); ctx.clip();
    }

    ctx.textBaseline = 'alphabetic';
    const iconSize = geom.portraitMode ? 34 : 30;
    const iconPad = geom.portraitMode ? 9 : 8;

    for (let i = 0; i < list.length; i++) {
      const k = list[i]!;
      const col2 = i % cols;
      const row2 = Math.floor(i / cols);
      const cxx = px + col2 * (cardW + CARD_GAP);
      const cyy = listTop + row2 * rowH - invScroll;
      if (cyy + cardH < listTop - 4 || cyy > listTop + visibleH + 4) continue;
      const c = CUBES[k]!;
      const own = owned(k);
      const affordable = budgetUsed() + c.cost <= budgetCap();
      const usable = own > 0 && affordable;
      const sel = selectedType === k;
      const rarCol = RARITY_COL[c.rarity]!;

      ctx.globalAlpha = usable ? 1 : 0.38;

      // Card background
      ctx.fillStyle = sel
        ? 'rgba(34,52,90,0.97)'
        : 'rgba(14,20,36,0.93)';
      if ((ctx as CanvasRenderingContext2D & { roundRect?: unknown }).roundRect) {
        ctx.beginPath();
        (ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void })
          .roundRect(cxx, cyy, cardW, cardH, 8);
        ctx.fill();
      } else {
        ctx.fillRect(cxx, cyy, cardW, cardH);
      }

      // Selected: bright background glow
      if (sel) {
        ctx.globalAlpha = usable ? 0.18 : 0.07;
        ctx.fillStyle = rarCol;
        if ((ctx as CanvasRenderingContext2D & { roundRect?: unknown }).roundRect) {
          ctx.beginPath();
          (ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void })
            .roundRect(cxx, cyy, cardW, cardH, 8);
          ctx.fill();
        }
        ctx.globalAlpha = usable ? 1 : 0.38;
      }

      // Rarity border
      ctx.strokeStyle = rarCol;
      ctx.lineWidth = sel ? 2.5 : 1.2;
      ctx.globalAlpha = (usable ? 1 : 0.38) * (sel ? 1 : 0.7);
      if ((ctx as CanvasRenderingContext2D & { roundRect?: unknown }).roundRect) {
        ctx.beginPath();
        (ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void })
          .roundRect(cxx + 0.5, cyy + 0.5, cardW - 1, cardH - 1, 8);
        ctx.stroke();
      } else {
        ctx.strokeRect(cxx + 0.5, cyy + 0.5, cardW - 1, cardH - 1);
      }
      ctx.globalAlpha = usable ? 1 : 0.38;

      // Icon background circle
      const iconX = cxx + iconPad + iconSize / 2;
      const iconY = cyy + cardH / 2;
      ctx.fillStyle = c.col + '44';
      ctx.beginPath(); ctx.arc(iconX, iconY, iconSize / 2 + 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = c.col + 'aa';
      ctx.beginPath(); ctx.arc(iconX, iconY, iconSize / 2, 0, Math.PI * 2); ctx.fill();
      drawGlyph(ctx, c.glyph, iconX, iconY, iconSize, c.tint, 1);

      // Text block
      const textX = cxx + iconPad + iconSize + 8;
      const textW = cardW - textX + cxx;
      // Name
      ctx.font = 'bold 11px system-ui'; ctx.fillStyle = '#eaf0fb';
      let nameText = c.name;
      while (nameText.length > 3 && ctx.measureText(nameText).width > textW - 4)
        nameText = nameText.slice(0, -1);
      if (nameText !== c.name) nameText = nameText.slice(0, -1) + '…';
      ctx.fillText(nameText, textX, cyy + cardH / 2 - 4);

      // Count + cost row
      ctx.font = '10px system-ui';
      const ownStr = '×' + (own === Infinity ? '∞' : own);
      ctx.fillStyle = own > 0 ? rarCol : '#5a6a7a';
      ctx.fillText(ownStr, textX, cyy + cardH / 2 + 10);
      ctx.fillStyle = '#7a8fa8';
      ctx.fillText('  ' + c.cost + '◆', textX + ctx.measureText(ownStr).width, cyy + cardH / 2 + 10);

      ctx.globalAlpha = 1;
      invHit.entries.push({ k, x: cxx, y: cyy, w: cardW, h: cardH, usable });
    }
    ctx.restore();

    // Scrollbar
    if (maxScroll > 0) {
      const sbTrackH = visibleH;
      const sbH = Math.max(24, sbTrackH * (visibleH / (rows * rowH)));
      const sbY = listTop + (invScroll / maxScroll) * (sbTrackH - sbH);
      const sbX = px + pw + 2;
      ctx.fillStyle = 'rgba(60,80,130,0.3)'; ctx.fillRect(sbX, listTop, 3, visibleH);
      ctx.fillStyle = 'rgba(140,170,220,0.55)'; ctx.fillRect(sbX, sbY, 3, sbH);
    }

    if (list.length === 0) {
      ctx.fillStyle = '#5a6e86'; ctx.font = '11px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('— нічого за фільтром', px + pw / 2, listTop + 20);
      ctx.textAlign = 'left';
    }
  }

  // ---- DRAW PROGRESS HUD — level / XP / Essence / budget readout ----
  // Helper: draw a rounded progress bar
  function drawBar(
    bx: number, by: number, bw: number, bh: number,
    frac: number, fillCol: string, trackCol: string, label: string, labelCol: string
  ): void {
    const r = bh / 2;
    // Track
    ctx.fillStyle = trackCol;
    if ((ctx as CanvasRenderingContext2D & { roundRect?: unknown }).roundRect) {
      ctx.beginPath();
      (ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void })
        .roundRect(bx, by, bw, bh, r);
      ctx.fill();
    } else { ctx.fillRect(bx, by, bw, bh); }
    // Fill
    if (frac > 0) {
      const fw = Math.max(r * 2, bw * frac);
      ctx.fillStyle = fillCol;
      ctx.save();
      if ((ctx as CanvasRenderingContext2D & { roundRect?: unknown }).roundRect) {
        ctx.beginPath();
        (ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void })
          .roundRect(bx, by, fw, bh, r);
        ctx.clip();
        ctx.fill();
      } else {
        ctx.fillRect(bx, by, fw, bh);
      }
      ctx.restore();
    }
    // Label
    if (label) {
      ctx.font = 'bold 9px system-ui'; ctx.fillStyle = labelCol; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, bx + bw / 2, by + bh / 2);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    }
  }

  function drawProgressHUD(): void {
    const lvl = opts.state.level;
    const xpCur = opts.state.xp;
    const xpMax = xpToNext(lvl);
    const used = budgetUsed(), cap = budgetCap();
    const xpFrac = xpMax > 0 ? Math.min(1, xpCur / xpMax) : 0;
    const budFrac = cap > 0 ? Math.min(1, used / cap) : 0;
    const budFull = used >= cap;
    const budCol = budFull ? '#e5534b' : (budFrac > 0.8 ? '#e3b341' : '#4da8e0');

    if (isPortrait()) {
      // Portrait: full-width clean strip at top
      const hudH = portraitHudH();
      const pad = 10;
      const stripW = W;

      // Frosted background
      ctx.fillStyle = 'rgba(7,10,18,0.93)';
      ctx.fillRect(0, 0, stripW, hudH);
      // Bottom separator
      ctx.strokeStyle = 'rgba(80,110,165,0.3)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, hudH); ctx.lineTo(stripW, hudH); ctx.stroke();

      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';

      // Pill: Level
      const lvlLabel = 'Рів. ' + lvl;
      ctx.font = 'bold 12px system-ui';
      const lvlW = ctx.measureText(lvlLabel).width + 20;
      ctx.fillStyle = 'rgba(40,60,110,0.6)';
      if ((ctx as CanvasRenderingContext2D & { roundRect?: unknown }).roundRect) {
        ctx.beginPath();
        (ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void })
          .roundRect(pad, 6, lvlW, 20, 10);
        ctx.fill();
        ctx.strokeStyle = 'rgba(100,140,220,0.35)'; ctx.lineWidth = 1; ctx.stroke();
      } else { ctx.fillRect(pad, 6, lvlW, 20); }
      ctx.fillStyle = '#c8dcff';
      ctx.fillText(lvlLabel, pad + 10, 21);

      // Pill: Essence
      ctx.font = '11px system-ui';
      const essLabel = '✦ ' + opts.state.essence;
      const essW = ctx.measureText(essLabel).width + 18;
      ctx.fillStyle = 'rgba(40,30,80,0.6)';
      if ((ctx as CanvasRenderingContext2D & { roundRect?: unknown }).roundRect) {
        ctx.beginPath();
        (ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void })
          .roundRect(pad + lvlW + 6, 6, essW, 20, 10);
        ctx.fill();
        ctx.strokeStyle = 'rgba(140,100,200,0.35)'; ctx.lineWidth = 1; ctx.stroke();
      } else { ctx.fillRect(pad + lvlW + 6, 6, essW, 20); }
      ctx.fillStyle = '#c8a8ff';
      ctx.fillText(essLabel, pad + lvlW + 15, 21);

      // Field pill (top-right)
      ctx.font = '10px system-ui';
      const fieldLabel = (ringUnlocked * 2 + 1) + '×' + (ringUnlocked * 2 + 1);
      const fieldW = ctx.measureText(fieldLabel).width + 16;
      ctx.fillStyle = 'rgba(20,36,60,0.6)';
      if ((ctx as CanvasRenderingContext2D & { roundRect?: unknown }).roundRect) {
        ctx.beginPath();
        (ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void })
          .roundRect(W - fieldW - pad, 6, fieldW, 20, 10);
        ctx.fill();
        ctx.strokeStyle = 'rgba(70,100,160,0.3)'; ctx.lineWidth = 1; ctx.stroke();
      } else { ctx.fillRect(W - fieldW - pad, 6, fieldW, 20); }
      ctx.fillStyle = '#7a9abf'; ctx.textAlign = 'center';
      ctx.fillText(fieldLabel, W - fieldW / 2 - pad, 21);
      ctx.textAlign = 'left';

      // XP bar (full width)
      const barW = W - pad * 2;
      drawBar(pad, 30, barW, 12, xpFrac, '#8850d8', 'rgba(0,0,0,0.45)',
        'XP ' + xpCur + '/' + xpMax, '#d0b8ff');

      // Budget bar (full width)
      drawBar(pad, 46, barW, 16, budFrac, budCol, 'rgba(0,0,0,0.45)',
        'Бюджет ' + used + '/' + cap + '◆', budFull ? '#ffddcc' : '#dff0ff');
      return;
    }

    // ---- Desktop HUD: clean card in top-left ----
    const x = 14, y = 12, w = 350, h = 80;
    // Card background
    ctx.fillStyle = 'rgba(7,10,18,0.82)';
    if ((ctx as CanvasRenderingContext2D & { roundRect?: unknown }).roundRect) {
      ctx.beginPath();
      (ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void })
        .roundRect(x, y, w, h, 10);
      ctx.fill();
      ctx.strokeStyle = 'rgba(80,110,175,0.28)'; ctx.lineWidth = 1; ctx.stroke();
    } else {
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(80,110,175,0.28)'; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, h);
    }

    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';

    // Level pill
    const pad = 12;
    const lvlLabel = 'Рів. ' + lvl;
    ctx.font = 'bold 13px system-ui';
    const lvlW2 = ctx.measureText(lvlLabel).width + 20;
    ctx.fillStyle = 'rgba(40,60,120,0.55)';
    if ((ctx as CanvasRenderingContext2D & { roundRect?: unknown }).roundRect) {
      ctx.beginPath();
      (ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void })
        .roundRect(x + pad, y + 8, lvlW2, 22, 11);
      ctx.fill();
      ctx.strokeStyle = 'rgba(100,140,230,0.3)'; ctx.lineWidth = 1; ctx.stroke();
    } else { ctx.fillRect(x + pad, y + 8, lvlW2, 22); }
    ctx.fillStyle = '#c8dcff';
    ctx.fillText(lvlLabel, x + pad + 10, y + 24);

    // Essence pill
    ctx.font = '11px system-ui';
    const essLabel2 = '✦ ' + opts.state.essence;
    const essW2 = ctx.measureText(essLabel2).width + 18;
    ctx.fillStyle = 'rgba(40,30,80,0.55)';
    const essX = x + pad + lvlW2 + 8;
    if ((ctx as CanvasRenderingContext2D & { roundRect?: unknown }).roundRect) {
      ctx.beginPath();
      (ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void })
        .roundRect(essX, y + 8, essW2, 22, 11);
      ctx.fill();
      ctx.strokeStyle = 'rgba(140,100,200,0.3)'; ctx.lineWidth = 1; ctx.stroke();
    } else { ctx.fillRect(essX, y + 8, essW2, 22); }
    ctx.fillStyle = '#c0a0f0';
    ctx.fillText(essLabel2, essX + 9, y + 24);

    // Field pill
    ctx.font = '10px system-ui';
    const fieldLabel2 = (ringUnlocked * 2 + 1) + '×' + (ringUnlocked * 2 + 1);
    const fieldW2 = ctx.measureText(fieldLabel2).width + 16;
    const fieldX = essX + essW2 + 8;
    ctx.fillStyle = 'rgba(20,36,60,0.55)';
    if ((ctx as CanvasRenderingContext2D & { roundRect?: unknown }).roundRect) {
      ctx.beginPath();
      (ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void })
        .roundRect(fieldX, y + 8, fieldW2, 22, 11);
      ctx.fill();
      ctx.strokeStyle = 'rgba(70,100,160,0.3)'; ctx.lineWidth = 1; ctx.stroke();
    } else { ctx.fillRect(fieldX, y + 8, fieldW2, 22); }
    ctx.fillStyle = '#7a9abf'; ctx.textAlign = 'center';
    ctx.fillText(fieldLabel2, fieldX + fieldW2 / 2, y + 24);
    ctx.textAlign = 'left';

    // XP bar
    const barX = x + pad, barW2 = w - pad * 2;
    drawBar(barX, y + 38, barW2, 12, xpFrac, '#8850d8', 'rgba(0,0,0,0.45)',
      'XP ' + xpCur + '/' + xpMax, '#d0b8ff');

    // Budget bar
    drawBar(barX, y + 56, barW2, 14, budFrac, budCol, 'rgba(0,0,0,0.45)',
      'Бюджет ' + used + '/' + cap + '◆', budFull ? '#ffddcc' : '#dff0ff');
  }

  // ---- DRAW STATS PANEL — skipped in portrait mode ----
  function drawStatsPanel(): void {
    const geomS = builderGeom();
    if (geomS.portraitMode) return; // stats panel hidden in portrait — shown in inventory area instead
    const { panelW } = geomS;
    const x = W - panelW + 12, w = panelW - 24;
    const L = rightPanelLayout();
    const y = L.stats.boxTop + 26;
    const s = derived!;
    const panelH = L.stats.boxH;
    ctx.fillStyle = 'rgba(7,10,18,0.78)';
    if ((ctx as CanvasRenderingContext2D & { roundRect?: unknown }).roundRect) {
      ctx.beginPath();
      (ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void })
        .roundRect(x - 8, y - 26, w + 16, panelH, 10);
      ctx.fill();
      ctx.strokeStyle = 'rgba(90,120,170,0.22)'; ctx.lineWidth = 1; ctx.stroke();
    } else {
      ctx.fillRect(x - 8, y - 26, w + 16, panelH);
      ctx.strokeStyle = 'rgba(90,120,170,0.22)'; ctx.lineWidth = 1; ctx.strokeRect(x - 8, y - 26, w + 16, panelH);
    }
    ctx.font = 'bold 11px system-ui'; ctx.fillStyle = '#5a7aaa'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('СТАТИ', x + 2, y - 10);

    const primary: [string, string, string, string][] = [
      ['heart5', 'HP', Math.round(s.maxHP).toString(), '#56d364'],
      ['blade', 'Атака', s.atk.toFixed(0), '#E0483F'],
      ['shield', 'Броня', s.armor.toFixed(1), '#9fb0c8'],
      ['flow', 'Швидк.', s.speed.toFixed(2), '#7fc8ff'],
      ['blade', 'Крит', (s.crit * 100).toFixed(0) + '%', '#EAEFF5'],
      ['amplify', 'Магія', s.magic.toFixed(0), '#D14FA6'],
    ];
    const pcols = 3, pcw = w / pcols;
    for (let i = 0; i < primary.length; i++) {
      const [ic, lbl, val, col] = primary[i]!;
      const cx = x + (i % pcols) * pcw, cyy = y + 4 + ((i / pcols) | 0) * 44;
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(cx, cyy, 26, 26);
      drawTraitIcon(ctx, ic, cx + 13, cyy + 13, 22, col);
      ctx.font = '9px system-ui'; ctx.fillStyle = '#8fa0b8'; ctx.fillText(lbl, cx + 30, cyy + 10);
      ctx.font = 'bold 16px system-ui'; ctx.fillStyle = col; ctx.fillText(val, cx + 30, cyy + 25);
    }
    let dy = y + 4 + Math.ceil(primary.length / pcols) * 44 + 4;

    // detail toggle
    ctx.font = 'bold 11px system-ui'; ctx.fillStyle = '#9fb4d6';
    const dlbl = (detailExpanded ? 'Детально ▴' : 'Детально ▾');
    const dw = ctx.measureText(dlbl).width + 10;
    ctx.fillStyle = 'rgba(22,32,58,0.8)'; ctx.fillRect(x, dy, dw, 18);
    ctx.strokeStyle = '#38507e'; ctx.lineWidth = 1; ctx.strokeRect(x, dy, dw, 18);
    ctx.fillStyle = '#cfe0ff'; ctx.textBaseline = 'middle'; ctx.fillText(dlbl, x + 5, dy + 10); ctx.textBaseline = 'alphabetic';
    statHit.detail = { x, y: dy, w: dw, h: 18 };

    if (detailExpanded) {
      let ly = dy + 26;
      const det: [string, string][] = [
        ['Ухил', (s.dodge * 100).toFixed(0) + '%'],
        ['Точність', (s.acc * 100).toFixed(0) + '%'],
        ['Блок', (s.blockChance * 100).toFixed(0) + '%'],
        ['Регенерація', s.regenPerSec.toFixed(1) + '/с'],
        ['Вампіризм', (s.lifesteal * 100).toFixed(0) + '%'],
        ['Пробій броні', (s.pierce * 100).toFixed(0) + '%'],
        ['Маг. опір', (s.magResist * 100).toFixed(0) + '%'],
        ['ATB/ривок', '+' + (s.haste * 100).toFixed(0) + '%'],
      ];
      ctx.font = '11px system-ui';
      for (let i = 0; i < det.length; i++) {
        const [k, v] = det[i]!; const c = i % 2, rr = (i / 2) | 0;
        const cx = x + c * (w / 2), cyy = ly + rr * 18;
        ctx.fillStyle = '#8fa0b8'; ctx.fillText(k, cx, cyy + 8);
        ctx.fillStyle = '#dfe8ff'; ctx.font = 'bold 11px system-ui'; ctx.fillText(v, cx + 96, cyy + 8); ctx.font = '11px system-ui';
      }
      ly += Math.ceil(det.length / 2) * 18 + 6;
      ctx.font = 'bold 10px system-ui'; ctx.fillStyle = '#7e90ac'; ctx.fillText('ВНЕСКИ (база + трейти/куби):', x, ly + 6); ly += 16;
      ctx.font = '10px system-ui';
      const contrib: [string, string][] = [];
      contrib.push(['база HP', '+60']);
      for (const tk in s.traitDelta) contrib.push([traitKeyName(tk), s.traitDelta[tk]!]);
      for (const ck in s.cubeDelta) contrib.push([CUBES[ck]?.name ?? ck, s.cubeDelta[ck]!]);
      let cn = 0;
      for (const [k, v] of contrib) {
        if (ly > y - 26 + 300 - 8) { ctx.fillStyle = '#7e90ac'; ctx.fillText('+ще ' + (contrib.length - cn), x, ly + 6); break; }
        ctx.fillStyle = '#9aa6b8'; ctx.fillText('• ' + k, x, ly + 6);
        ctx.fillStyle = '#bfe0a0'; ctx.textAlign = 'right'; ctx.fillText(v, x + w, ly + 6); ctx.textAlign = 'left';
        ly += 14; cn++;
      }
    }
  }

  function traitKeyName(key: string): string {
    // synergy / shape names looked up from the imported SYNERGY_DEFS and SHAPE_DEFS
    // re-import shape defs lazily to avoid circular compile issues
    const found = traitsCache.find(t => t.key === key);
    return found ? found.name : key;
  }

  // ---- DRAW TRAITS PANEL — skipped in portrait mode ----
  function drawTraitsPanel(): void {
    const geomT = builderGeom();
    if (geomT.portraitMode) return;
    const { panelW } = geomT;
    const x = W - panelW + 12, w = panelW - 24;
    const y = rightPanelLayout().traits.boxTop + 26;
    const moves = deriveMoveset(build);
    ctx.fillStyle = 'rgba(7,10,18,0.78)';
    if ((ctx as CanvasRenderingContext2D & { roundRect?: unknown }).roundRect) {
      ctx.beginPath();
      (ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void })
        .roundRect(x - 8, y - 26, w + 16, 110, 10);
      ctx.fill();
      ctx.strokeStyle = 'rgba(90,120,170,0.22)'; ctx.lineWidth = 1; ctx.stroke();
    } else {
      ctx.fillRect(x - 8, y - 26, w + 16, 110);
      ctx.strokeStyle = 'rgba(90,120,170,0.22)'; ctx.lineWidth = 1; ctx.strokeRect(x - 8, y - 26, w + 16, 110);
    }
    ctx.font = 'bold 11px system-ui'; ctx.fillStyle = '#5a7aaa'; ctx.textAlign = 'left';
    ctx.fillText('ТРЕЙТИ' + (traitsCache.length > 0 ? ' (' + traitsCache.length + ')' : ''), x + 2, y - 10);
    ctx.textBaseline = 'middle';
    if (traitsCache.length === 0) {
      ctx.font = '11px system-ui'; ctx.fillStyle = '#6f7e94';
      ctx.fillText('— ще немає. Постав суміжні куби (див. Кодекс).', x, y + 6);
    }
    let cx = x, cy = y + 2; const chipH = 20;
    ctx.font = 'bold 10px system-ui';
    for (const tr of traitsCache) {
      const col = traitColor(tr.icon) || traitColor(tr.key);
      const tag = '×' + tr.magnitude;
      const lbl = tr.name + ' ' + tag;
      const cw = ctx.measureText(lbl).width + 26;
      if (cx + cw > x + w) { cx = x; cy += chipH + 4; }
      if (cy > y + 44) break;
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(cx, cy, cw, chipH);
      ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.strokeRect(cx, cy, cw, chipH);
      drawTraitIcon(ctx, tr.icon, cx + 11, cy + chipH / 2, 16, col);
      ctx.fillStyle = '#eaf0fb'; ctx.fillText(lbl, cx + 22, cy + chipH / 2 + 1);
      cx += cw + 5;
    }
    ctx.textBaseline = 'alphabetic';
    ctx.font = 'bold 10px system-ui'; ctx.fillStyle = '#9fb4d6';
    ctx.fillText('РУХИ:', x, y + 72);
    ctx.font = '18px system-ui'; let ix = x + 44;
    for (const k of moves) { const mv = MOVES[k]; if (mv) { ctx.fillText(mv.icon, ix, y + 76); ix += 28; } }
    if (moves.length === 0) { ctx.font = '11px system-ui'; ctx.fillStyle = '#6f7e94'; ctx.fillText('лише кулак', x + 44, y + 74); }
  }

  // ---- DRAW CODEX (verbatim from poc lines 2377-2408) ----
  function drawCodex(): void {
    const cw = Math.min(520, W - 40), x = (W - cw) / 2, ch = Math.min(H - 80, 560), y = (H - ch) / 2;
    ctx.fillStyle = 'rgba(6,10,16,0.96)'; ctx.fillRect(x, y, cw, ch);
    ctx.strokeStyle = '#5a7bc0'; ctx.lineWidth = 2; ctx.strokeRect(x, y, cw, ch);
    ctx.font = 'bold 16px system-ui'; ctx.fillStyle = '#cfe0ff'; ctx.textAlign = 'left';
    ctx.fillText('КОДЕКС КОМБІНАЦІЙ', x + 18, y + 28);
    ctx.font = '11px system-ui'; ctx.fillStyle = '#7e90ac';
    ctx.fillText('відкрито: ' + Object.keys(discovered).length + ' / ' + (SYNERGY_DEFS.length + 4) + '    (клік «Кодекс» щоб закрити)', x + 18, y + 44);

    // We need shape defs count — 4 shapes (spike/bastion/heart/balance). Use imported data.
    const grps: Array<{ hd: string; list: Array<{ key: string; name: string; icon: string; effect: string }> }> = [
      { hd: 'СИНЕРГІЇ СУМІЖНОСТІ', list: SYNERGY_DEFS },
      { hd: 'ФОРМИ', list: traitsCache.filter(t => t.kind === 'shape').length > 0
        ? [
            { key: 'spike',   name: '«Шип»',      icon: 'spike',    effect: '3+ Сила в лінію → +досяжність/атака' },
            { key: 'bastion', name: '«Бастіон»',  icon: 'bastion',  effect: '2×2 блок Броні → шанс блоку' },
            { key: 'heart',   name: '«Серце»',    icon: 'heart5',   effect: '5 Тіло хрестом → +регенерація' },
            { key: 'balance', name: '«Рівновага»',icon: 'balance',  effect: 'дзеркальна симетрія L↔R → +точність' },
          ]
        : [
            { key: 'spike',   name: '«Шип»',      icon: 'spike',    effect: '3+ Сила в лінію → +досяжність/атака' },
            { key: 'bastion', name: '«Бастіон»',  icon: 'bastion',  effect: '2×2 блок Броні → шанс блоку' },
            { key: 'heart',   name: '«Серце»',    icon: 'heart5',   effect: '5 Тіло хрестом → +регенерація' },
            { key: 'balance', name: '«Рівновага»',icon: 'balance',  effect: 'дзеркальна симетрія L↔R → +точність' },
          ]
      },
    ];
    let ry = y + 62;
    for (const grp of grps) {
      ctx.font = 'bold 12px system-ui'; ctx.fillStyle = '#9fb4d6'; ctx.fillText(grp.hd, x + 18, ry + 12); ry += 22;
      for (const d of grp.list) {
        const disc = !!discovered[d.key];
        const col = traitColor(d.icon) || traitColor(d.key);
        ctx.globalAlpha = disc ? 1 : 0.42;
        ctx.fillStyle = 'rgba(16,22,36,0.9)'; ctx.fillRect(x + 18, ry, cw - 36, 36);
        ctx.strokeStyle = disc ? col : '#324768'; ctx.lineWidth = 1.4; ctx.strokeRect(x + 18, ry, cw - 36, 36);
        ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(x + 22, ry + 5, 26, 26);
        if (disc) drawTraitIcon(ctx, d.icon, x + 22 + 13, ry + 5 + 13, 24, col);
        else { ctx.fillStyle = '#5f6f86'; ctx.font = 'bold 16px system-ui'; ctx.textAlign = 'center'; ctx.fillText('🔒', x + 22 + 13, ry + 22); ctx.textAlign = 'left'; }
        ctx.font = 'bold 12px system-ui'; ctx.fillStyle = disc ? '#eaf0fb' : '#7e8a99';
        ctx.fillText(disc ? d.name : '？？？', x + 56, ry + 15);
        ctx.font = '10px system-ui'; ctx.fillStyle = disc ? '#9fb0c8' : '#5f6f86';
        ctx.fillText(disc ? d.effect : 'заблоковано', x + 56, ry + 29);
        ctx.globalAlpha = 1;
        ry += 40;
        if (ry > y + ch - 30) { ctx.fillStyle = '#7e90ac'; ctx.font = '10px system-ui'; ctx.fillText('…', x + 18, ry); break; }
      }
    }
  }

  // ---- DRAW TOOLTIPS (verbatim from poc lines 2410-2452) ----
  function drawBuilderTooltip(): void {
    if (hoverPixIdx < 0) return;
    const p = build[hoverPixIdx]!;
    const c = CUBES[p.type]!;
    const inTraits = traitsCache.filter(tr => tr.pixelIndices.includes(hoverPixIdx));
    const lines = [
      c.name + ' — ' + c.eff,
      (RARITY_UA[c.rarity] ?? c.rarity) + ' · ' + c.cost + '◆ · ' + (CAT[c.cat]?.ua ?? c.cat),
    ];
    for (const tr of inTraits) lines.push('• ' + tr.name + ' (' + (tr.kind === 'adjacency' ? 'синергія' : 'форма') + ')');
    ctx.font = 'bold 13px system-ui';
    let wmax = 0; for (const l of lines) wmax = Math.max(wmax, ctx.measureText(l).width);
    const tw = wmax + 50, th = 20 + lines.length * 18 + 8;
    let bx = mouseX + 16, by = mouseY - th - 10;
    if (bx + tw > W) bx = mouseX - tw - 16; if (by < 4) by = mouseY + 16;
    ctx.fillStyle = 'rgba(10,14,22,0.94)'; ctx.fillRect(bx, by, tw, th);
    ctx.strokeStyle = RARITY_COL[c.rarity]!; ctx.lineWidth = 2; ctx.strokeRect(bx, by, tw, th);
    ctx.fillStyle = colorOfType(p.type); ctx.fillRect(bx + 8, by + 8, 30, 30);
    drawGlyph(ctx, c.glyph, bx + 8 + 15, by + 8 + 15, 30, c.tint, 1);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = 'bold 13px system-ui'; ctx.fillStyle = '#fff';
    ctx.fillText(lines[0]!, bx + 46, by + 22);
    ctx.font = '11px system-ui'; ctx.fillStyle = '#bcd0ee';
    for (let i = 1; i < lines.length; i++) ctx.fillText(lines[i]!, bx + 12, by + 22 + i * 18);
  }

  function drawInvTooltip(): void {
    if (mouseX < 0) return;
    for (const e of invHit.entries) {
      if (mouseX >= e.x && mouseX <= e.x + e.w && mouseY >= e.y && mouseY <= e.y + e.h) {
        const c = CUBES[e.k]!;
        const lines = [
          c.name,
          (RARITY_UA[c.rarity] ?? c.rarity) + ' · ' + (CAT[c.cat]?.ua ?? c.cat) + ' · ' + c.cost + '◆',
          c.eff,
          'у наявності: ' + owned(e.k) + (e.usable ? '' : '  (недоступно)'),
        ];
        ctx.font = 'bold 12px system-ui'; let wmax = 0;
        for (const l of lines) wmax = Math.max(wmax, ctx.measureText(l).width);
        const tw = wmax + 24, th = 14 + lines.length * 16 + 6;
        let bx = mouseX - tw - 12, yy = mouseY + 8;
        if (bx < 4) bx = mouseX + 12; if (yy + th > H) yy = H - th - 4;
        ctx.fillStyle = 'rgba(10,14,22,0.96)'; ctx.fillRect(bx, yy, tw, th);
        ctx.strokeStyle = RARITY_COL[c.rarity]!; ctx.lineWidth = 2; ctx.strokeRect(bx, yy, tw, th);
        ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = 'bold 12px system-ui';
        ctx.fillText(lines[0]!, bx + 10, yy + 18);
        ctx.font = '11px system-ui'; ctx.fillStyle = '#bcd0ee';
        for (let i = 1; i < lines.length; i++) {
          ctx.fillStyle = i === 1 ? (RARITY_COL[c.rarity] ?? '#bcd0ee') : '#bcd0ee';
          ctx.fillText(lines[i]!, bx + 10, yy + 18 + i * 16);
        }
        return;
      }
    }
  }

  // ---- DRAW TOASTS ----
  function drawToasts(): void {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const geomToas = builderGeom();
    const cxPos = geomToas.portraitMode ? W / 2 : (W - geomToas.panelW) / 2;
    for (let i = 0; i < toasts.length; i++) {
      const ts = toasts[i]!; const u = ts.t / ts.life;
      const a = u < 0.1 ? u * 10 : (u > 0.8 ? (1 - u) * 5 : 1);
      const ty2 = H * 0.16 + i * 30;
      ctx.globalAlpha = Math.max(0, Math.min(1, a));
      ctx.font = 'bold 13px system-ui';
      const tw = ctx.measureText(ts.text).width + 28;
      ctx.fillStyle = 'rgba(8,12,20,0.92)';
      if ((ctx as CanvasRenderingContext2D & { roundRect?: unknown }).roundRect) {
        ctx.beginPath();
        (ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect(cxPos - tw / 2, ty2 - 13, tw, 26, 8);
        ctx.fill();
        ctx.strokeStyle = ts.col; ctx.lineWidth = 1.5; ctx.stroke();
      } else {
        ctx.fillRect(cxPos - tw / 2, ty2 - 13, tw, 26);
        ctx.strokeStyle = ts.col; ctx.lineWidth = 1.5; ctx.strokeRect(cxPos - tw / 2, ty2 - 13, tw, 26);
      }
      ctx.fillStyle = ts.col; ctx.fillText(ts.text, cxPos, ty2);
    }
    ctx.globalAlpha = 1; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }

  // ---- CREATURE PREVIEW (right-panel preview box — landscape only) ----
  function drawCreaturePreview(): void {
    const geomCp = builderGeom();
    if (geomCp.portraitMode) return; // no room for preview in portrait
    const px = W - geomCp.panelW + 12;
    const pw = geomCp.panelW - 24;
    const previewX = px + pw / 2;
    const previewY = H * 0.50;
    const scaleMul = 0.5;
    drawCreaturePixels(ctx, build, previewX, previewY, scaleMul, t, 0);
  }

  // ---- "← Лоббі" button — desktop canvas only; portrait handled by HTML uiDiv ----
  let fightBtnRect = { x: 0, y: 0, w: 0, h: 0 };
  function drawFightButton(): void {
    const geomB = builderGeom();
    if (geomB.portraitMode) {
      // In portrait the button lives in uiDiv (HTML row) — zero the hit-rect so canvas tap doesn't fire
      fightBtnRect = { x: 0, y: 0, w: 0, h: 0 };
      return;
    }
    const bw = 130, bh = 36;
    const bx = W - geomB.panelW / 2 - bw / 2;
    const by = H - 52;
    fightBtnRect = { x: bx, y: by, w: bw, h: bh };
    // Glow behind button
    ctx.globalAlpha = 0.12 + 0.06 * Math.sin(t * 2.5);
    ctx.fillStyle = '#ff8040';
    ctx.beginPath(); ctx.ellipse(bx + bw / 2, by + bh / 2, bw * 0.7, bh * 0.9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    // Button bg
    ctx.fillStyle = '#1e1008';
    if ((ctx as CanvasRenderingContext2D & { roundRect?: unknown }).roundRect) {
      ctx.beginPath();
      (ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void })
        .roundRect(bx, by, bw, bh, 10);
      ctx.fill();
      ctx.strokeStyle = '#8a4a22'; ctx.lineWidth = 1.5; ctx.stroke();
    } else {
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = '#8a4a22'; ctx.lineWidth = 1.5; ctx.strokeRect(bx, by, bw, bh);
    }
    ctx.font = 'bold 14px system-ui'; ctx.fillStyle = '#ffaa60'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('← Лоббі', bx + bw / 2, by + bh / 2 + 1);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }

  // ---- ACTION BUTTONS (HTML overlay) ----
  // Note: "+Рівень" and "Відкрити лут" removed — level/loot come only from fights now.
  // uiDiv is declared near the top of startBuilder (before resize) to avoid a TDZ error.

  /** Apply portrait vs desktop CSS to uiDiv based on current W. Called on create and resize. */
  function repositionUiDiv(): void {
    if (!uiDiv) return;
    if (isPortrait()) {
      // Portrait: full-width row directly below HUD strip (y = portraitHudH)
      // Width spans the full viewport; buttons distribute evenly.
      const topPx = portraitHudH();
      const rowH = portraitBtnRowH();
      uiDiv.style.cssText = [
        'position:fixed',
        'left:0',
        'right:0',
        'top:' + topPx + 'px',
        'height:' + rowH + 'px',
        'z-index:6',
        'display:flex',
        'flex-direction:row',
        'gap:4px',
        'padding:5px 8px',
        'box-sizing:border-box',
        'align-items:center',
        'justify-content:space-between',
        'background:rgba(8,12,20,0.82)',
        'border-bottom:1px solid rgba(90,120,170,0.25)',
      ].join(';');
    } else {
      // Desktop: top-right overlay (original positioning)
      uiDiv.style.cssText = [
        'position:fixed',
        'right:14px',
        'top:10px',
        'z-index:6',
        'display:flex',
        'gap:6px',
        'flex-wrap:wrap',
        'max-width:58vw',
        'justify-content:flex-end',
        'align-items:flex-start',
        'background:none',
        'border:none',
        'padding:0',
        'height:auto',
      ].join(';');
    }
  }

  function createActionButtons(): void {
    const ui = document.createElement('div');
    uiDiv = ui;
    repositionUiDiv();

    // min-height 44px for touch targets
    const btnStyleBase = [
      'border-radius:10px',
      'font:bold 12px system-ui',
      'cursor:pointer',
      'letter-spacing:.2px',
      'box-shadow:0 2px 10px #0009',
      'touch-action:manipulation',
      '-webkit-tap-highlight-color:transparent',
      'transition:filter 0.1s,background 0.1s',
    ].join(';');
    // Desktop buttons use fixed padding; portrait buttons flex-grow to fill the row evenly
    const btnStyleDesktop = btnStyleBase + ';color:#c8d8f0;background:#111d38;border:1px solid #2e4878;padding:10px 14px;min-height:44px;';
    const btnStylePortrait = btnStyleBase + ';color:#c8d8f0;background:#111d38;border:1px solid #2e4878;padding:5px 8px;min-height:44px;flex:1 1 0;text-align:center;font-size:11px;';

    function makeBtn(text: string, extraStyle: string, title: string): HTMLButtonElement {
      const btn = document.createElement('button');
      btn.textContent = text; btn.title = title;
      btn.style.cssText = (isPortrait() ? btnStylePortrait : btnStyleDesktop) + ';' + extraStyle;
      btn.addEventListener('pointerenter', () => { btn.style.filter = 'brightness(1.25)'; });
      btn.addEventListener('pointerleave', () => { btn.style.filter = ''; });
      return btn;
    }

    // Portrait gets "← Лоббі" as first button in the row
    const btnLobby  = makeBtn('← Лоббі',         'background:#1e1208;border-color:#7a4020;color:#ffaa70', 'повернутись в лоббі');
    const btnExpand = makeBtn('⊞ Поле',    'background:#0e1a2c;border-color:#3a6090', 'розширити поле');
    const btnAll    = makeBtn('◈ Звʼязки', '', 'показати всі звʼязки');
    const btnCodex  = makeBtn('📖 Кодекс',            '', 'кодекс комбінацій');

    btnLobby.addEventListener('click', () => {
      if (build.length > 1) opts.onFight(build.map(p => ({ ...p })));
      else toast('Спершу побудуй героя (постав куби)', '#e3b341');
    });
    btnExpand.addEventListener('click', () => expandGrid());
    btnAll.addEventListener('click', () => {
      showAllBonds = !showAllBonds;
      btnAll.textContent = showAllBonds ? '◈ Звʼязки ✓' : '◈ Звʼязки';
    });
    btnCodex.addEventListener('click', () => { showCodex = !showCodex; });

    // In portrait mode include the Lobby button; in desktop it's the canvas button
    if (isPortrait()) {
      ui.appendChild(btnLobby);
    }
    ui.appendChild(btnExpand);
    ui.appendChild(btnAll);
    ui.appendChild(btnCodex);
    document.body.appendChild(ui);
  }

  // ---- INPUT ----
  function pixelUnderMouse(mx: number, my: number): number {
    const geomP = builderGeom();
    // Exclude panel area
    if (!geomP.portraitMode && mx > W - geomP.panelW) return -1;
    if (geomP.portraitMode && my > H - geomP.stripH) return -1;
    const { cell } = geomP;
    for (let i = 0; i < build.length; i++) {
      const p = build[i]!; const s = gridToScreen(p.gx, p.gy);
      if (mx >= s.x - cell / 2 && mx <= s.x + cell / 2 && my >= s.y - cell / 2 && my <= s.y + cell / 2) return i;
    }
    return -1;
  }

  function updateBuilderHover(): void {
    hoverPixIdx = -1; hoverCell = null;
    if (mouseX < 0) return;
    const geomH = builderGeom();
    // Don't hover in panel area
    if (!geomH.portraitMode && mouseX > W - geomH.panelW) return;
    if (geomH.portraitMode && mouseY > H - geomH.stripH) return;
    hoverPixIdx = pixelUnderMouse(mouseX, mouseY);
    hoverCell = screenToGrid(mouseX, mouseY);
  }

  function handleInventoryClick(mx: number, my: number): boolean {
    if (inRect(mx, my, invHit.search)) { invSearchFocus = true; return true; }
    else invSearchFocus = false;
    for (const tab of invHit.tabs) { if (inRect(mx, my, tab)) { invTab = tab.k; invScroll = 0; return true; } }
    for (const r of invHit.rarities) { if (inRect(mx, my, r)) { invRarity = r.k; invScroll = 0; return true; } }
    for (const sn of invHit.sorts) { if (inRect(mx, my, sn)) { invSort = sn.k; return true; } }
    for (const en of invHit.entries) { if (inRect(mx, my, en)) { selectedType = en.k; return true; } }
    const geomI = builderGeom();
    // Consume clicks that land in the panel area (but weren't on a specific element)
    if (!geomI.portraitMode && mx > W - geomI.panelW) return true;
    if (geomI.portraitMode && my > H - geomI.stripH) return true;
    return false;
  }

  // ---- POINTER (mouse + touch) input ----
  // Touch drag-to-scroll inventory: track pointer state
  let _bPtrDown = false;
  let _bPtrId = -1;
  let _bPdX = -1, _bPdY = -1;    // pointer-down position
  let _bLastY = -1;               // last Y for drag-scroll velocity
  let _bDragging = false;         // true once drag threshold passed
  const DRAG_THRESHOLD = 8;       // px before we treat as drag

  function isInInventoryArea(mx: number, my: number): boolean {
    const geom = builderGeom();
    if (geom.portraitMode) {
      return my > H - geom.stripH;
    }
    return mx > W - geom.panelW;
  }

  function onPointerMove(e: PointerEvent): void {
    if (e.pointerId !== _bPtrId && _bPtrDown) return; // ignore other touches
    mouseX = e.clientX; mouseY = e.clientY;
    if (_bPtrDown && _bPdX >= 0) {
      const dy = e.clientY - _bPdY;
      const dx = e.clientX - _bPdX;
      if (!_bDragging && (dx * dx + dy * dy) > DRAG_THRESHOLD * DRAG_THRESHOLD) {
        _bDragging = true;
      }
      if (_bDragging && isInInventoryArea(_bPdX, _bPdY)) {
        const delta = _bLastY - e.clientY;
        invScroll += delta;
        _bLastY = e.clientY;
        e.preventDefault();
      }
    }
  }
  function onPointerLeave(): void { mouseX = -1; mouseY = -1; }
  function onPointerDown(e: PointerEvent): void {
    if (_bPtrDown) return; // single-touch only
    _bPtrDown = true;
    _bPtrId = e.pointerId;
    _bPdX = e.clientX; _bPdY = e.clientY;
    _bLastY = e.clientY;
    _bDragging = false;
    e.preventDefault();
  }
  function onPointerUp(e: PointerEvent): void {
    if (e.pointerId !== _bPtrId) return;
    const wasDragging = _bDragging;
    _bPtrDown = false; _bPtrId = -1; _bDragging = false;
    e.preventDefault();
    if (wasDragging) return; // drag-scroll, not a tap
    const mx = e.clientX, my = e.clientY;
    // Verify it was a tap (didn't travel far)
    const dx = mx - _bPdX, dy = my - _bPdY;
    if (dx * dx + dy * dy > 400) return;
    _bPdX = -1; _bPdY = -1;
    // --- same logic as original onCanvasClick ---
    if (showCodex) { showCodex = false; return; }
    if (inRect(mx, my, fightBtnRect)) {
      if (build.length > 1) opts.onFight(build.map(p => ({ ...p })));
      else toast('Спершу побудуй героя (постав куби)', '#e3b341');
      return;
    }
    if (handleInventoryClick(mx, my)) return;
    if (statHit.detail && inRect(mx, my, statHit.detail)) { detailExpanded = !detailExpanded; return; }
    // Grid interactions only outside the inventory area
    if (!isInInventoryArea(mx, my)) {
      const idx = pixelUnderMouse(mx, my);
      if (idx >= 0) { removePixel(idx); return; }
      const { gx, gy } = screenToGrid(mx, my);
      placePixel(gx, gy);
    }
  }
  function onWheel(e: WheelEvent): void {
    if (isInInventoryArea(mouseX, mouseY)) { invScroll += e.deltaY * 0.5; }
  }
  function onKeyDown(e: KeyboardEvent): void {
    if (invSearchFocus) {
      if (e.key === 'Escape') { invSearchFocus = false; }
      else if (e.key === 'Backspace') { invSearch = invSearch.slice(0, -1); e.preventDefault(); }
      else if (e.key === 'Enter') { invSearchFocus = false; }
      else if (e.key.length === 1) { invSearch += e.key; }
      return;
    }
    if (e.key === '[') { builderZoom = Math.max(0.5, builderZoom - 0.1); }
    if (e.key === ']') { builderZoom = Math.min(2.0, builderZoom + 0.1); }
    if (e.key === 'b' || e.key === 'B') { showAllBonds = !showAllBonds; }
    if (e.key === 'c' || e.key === 'C') { showCodex = !showCodex; }
  }
  function setupInput(): void {
    cv.addEventListener('pointermove', onPointerMove, { passive: false });
    cv.addEventListener('pointerleave', onPointerLeave);
    cv.addEventListener('pointerdown', onPointerDown, { passive: false });
    cv.addEventListener('pointerup', onPointerUp, { passive: false });
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('keydown', onKeyDown);
  }

  // ---- DRAW BUILDER (verbatim from poc lines 2504-2516) ----
  function drawBuilder(): void {
    drawArena();
    drawBuilderGrid();
    drawProgressHUD();
    drawFightButton();
    drawInventoryPanel();
    drawStatsPanel();
    drawTraitsPanel();
    drawInvTooltip();
    drawBuilderTooltip();
    if (showCodex) drawCodex();
    drawToasts();
  }

    // ---- MAIN LOOP ----
  let rafId = 0;
  let stopped = false;
  let prevTs = 0;
  function frame(ts: number): void {
    if (stopped) return;
    const rawDt = Math.min(0.05, (prevTs ? ts - prevTs : 16) / 1000);
    prevTs = ts;
    t += rawDt;
    stepToasts(rawDt);

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);

    updateBuilderHover();
    drawBuilder();

    rafId = requestAnimationFrame(frame);
  }

  // ---- BOOT ----
  createActionButtons();
  setupInput();
  recompute();
  // Show reward toast if returning from a fight
  if (opts.rewardEvents && opts.rewardEvents.length > 0) {
    const parts: string[] = [];
    for (const ev of opts.rewardEvents) {
      if (ev.kind === 'levelUp') parts.unshift('Рівень ' + ev.level + '!');
      else if (ev.kind === 'xp') parts.push('+' + ev.n + ' XP');
      else if (ev.kind === 'essence') parts.push('+' + ev.n + ' Essence');
      else if (ev.kind === 'loot') parts.push('Лут: ' + ev.cubes.map(k => CUBES[k]?.name ?? k).join(', '));
    }
    if (parts.length > 0) toast(parts.join(' · '), '#b07ed0');
  }
  rafId = requestAnimationFrame(frame);

  // ---- DISPOSER ----
  return function stop(): void {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(rafId);
    cv.remove();
    if (uiDiv) uiDiv.remove();
    window.removeEventListener('resize', resize);
    cv.removeEventListener('pointermove', onPointerMove);
    cv.removeEventListener('pointerleave', onPointerLeave);
    cv.removeEventListener('pointerdown', onPointerDown);
    cv.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('wheel', onWheel);
    window.removeEventListener('keydown', onKeyDown);
  };
}
