// src/render/behavior.ts
// Per-type per-cube behaviour modifier (brightness pulse + micro-position offset).
// Ported verbatim from poc/builder.html behaviorMod(). Pure function, no side effects.

export interface BehaviorMod { bright: number; sx: number; sy: number }

const A = 1.0; // BEHAV_AMP

export function behaviorMod(type: string, clock: number, off: number): BehaviorMod {
  let bright = 0, sx = 0, sy = 0;
  switch (type) {
    case 'vital': case 'regen': case 'lifesteal': {
      const b = Math.pow(Math.max(0, Math.sin(clock * 2.2 + off)), 6);
      bright = 0.10 * A * b; sx = sy = 0.06 * A * b;
      break;
    }
    case 'core':
      bright = (0.10 + 0.08 * Math.sin(clock * 1.6 + off)) * A;
      break;
    case 'ember':
      bright = (0.12 + 0.18 * Math.abs(Math.sin(clock * 9 + off) * Math.sin(clock * 3.3 + off))) * A;
      break;
    case 'frost':
      bright = (0.10 + 0.10 * Math.sin(clock * 4 + off)) * A;
      sx = 0.03 * A * Math.sin(clock * 7 + off);
      break;
    case 'spark': {
      const c = Math.sin(clock * 5 + off);
      const flick = c > 0.82 ? 1 : 0;
      bright = (0.08 + 0.5 * flick * (0.5 + 0.5 * Math.sin(clock * 60))) * A;
      break;
    }
    case 'mana':
      bright = (0.10 + 0.06 * Math.sin(clock * 1.8 + off)) * A;
      break;
    case 'catalyst': case 'ward': case 'arcane': {
      const p = 0.5 + 0.5 * Math.sin(clock * 3 + off);
      bright = (0.10 + 0.16 * p) * A; sx = sy = 0.05 * A * p;
      break;
    }
    case 'plate': case 'block': case 'thorns':
      bright = 0.04 * A * Math.sin(clock * 1.2 + off);
      break;
    case 'force': case 'pierce': case 'berserk': {
      const g = Math.sin(clock * 2.4 + off);
      bright = (g > 0.9 ? 0.4 : 0) * A;
      break;
    }
    case 'focus':
      bright = (0.06 + 0.14 * Math.pow(Math.max(0, Math.sin(clock * 6 + off)), 8)) * A;
      break;
    case 'swift': case 'haste': case 'evasion':
      sx = 0.04 * A * Math.sin(clock * 8 + off);
      break;
    case 'poison':
      bright = (0.08 + 0.10 * Math.abs(Math.sin(clock * 3.5 + off))) * A;
      break;
  }
  return { bright, sx, sy };
}
