// src/render/events-to-vfx.ts
// Pure mapping CombatEvent -> VfxIntent[]. No Pixi, no randomness (debris angles
// are randomised later inside vfx.ts, never here). Diminishing-returns scaling
// lives here so it is testable; the Dead-Cells ceiling caps the magnitudes.
import type { CombatEvent } from '../index';
import type { Theme, VfxIntent } from './types';

const CEIL = { celeste: 0.5, deadcells: 1, vsurvivors: 1.5 } as const;

export function mapEventToVfx(e: CombatEvent, theme: Theme): VfxIntent[] {
  const ceil = CEIL[theme.vfxCeiling];
  switch (e.type) {
    case 'hit': {
      const heavy = Math.min(1, e.amount / 25);                 // 0..1 by damage
      const critK = e.crit ? 1.6 : 1;
      return [
        { kind: 'flash', target: e.target, color: e.crit ? 0xffffff : 0xfff2cc, frames: e.crit ? 4 : 3 },
        { kind: 'shake', amp: (2 + 5 * heavy) * critK * ceil, ms: 150 },
        { kind: 'hitstop', frames: Math.round((4 + 4 * heavy) * critK * ceil) },
        { kind: 'debris', target: e.target, count: Math.round((6 + 8 * heavy) * ceil), color: 0xffffff },
        { kind: 'floating', target: e.target, text: String(e.amount), color: e.crit ? 0xffd84a : 0xffffff, crit: e.crit },
      ];
    }
    case 'block':  return [{ kind: 'ping', target: e.target, label: 'block' }];
    case 'dodge':  return [{ kind: 'ping', target: e.target, label: 'dodge' }];
    case 'heal':   return [{ kind: 'heal', target: e.target, amount: e.amount }];
    case 'move-start': return [];
    case 'ko':     return [{ kind: 'ko', target: e.target }];
    case 'status-applied':
    case 'status-tick':
      return []; // status auras handled by creature state, not transient VFX (v1)
    default: return [];
  }
}
