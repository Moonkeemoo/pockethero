import type { Fighter, StatusInstance } from './types';
import type { EventBus } from './events';

// ---------------------------------------------------------------------------
// Status registry — ported faithfully from poc/gauntlet.html STATUS_DEF
// ---------------------------------------------------------------------------
// burn:  dur=4.2s, tick interval=1.0s, flat dmg=6 per tick
// slow:  dur=5.0s, no tick, atbMul=0.45 (multiplies ATB fill speed)
// shock: dur=3.0s, no tick, dmgTakenMul=1.5 (consumed on next hit; see combat.ts)
// ---------------------------------------------------------------------------

interface StatusDef {
  dur: number;
  tick: number;     // interval between ticks (0 = no tick)
  dmg: number;      // flat damage per tick
  atbMul?: number;  // ATB-speed multiplier (slow)
  dmgTakenMul?: number; // incoming-damage multiplier (shock)
}

export const STATUS_DEF: Record<string, StatusDef> = {
  burn:  { dur: 4.2, tick: 1.0, dmg: 6 },
  slow:  { dur: 5.0, tick: 0,   dmg: 0, atbMul: 0.45 },
  shock: { dur: 3.0, tick: 0,   dmg: 0, dmgTakenMul: 1.5 },
};

// ---------------------------------------------------------------------------
// applyStatus — port of poc applyStatus(tgt, key)
// Add a new StatusInstance or refresh the duration if already present.
// Magnitude stores the canonical POC parameter (dmg for burn; atbMul for slow;
// dmgTakenMul for shock — stored as the raw multiplier value).
// ---------------------------------------------------------------------------
export function applyStatus(
  f: Fighter,
  id: string,
  duration: number,
  magnitude: number,
  bus: EventBus,
  t: number = 0,
): void {
  const def = STATUS_DEF[id];
  // When duration/magnitude are 0 (move-style apply), fall back to canonical STATUS_DEF values
  const resolvedDur = duration > 0 ? duration : (def?.dur ?? 0);
  const resolvedMag = magnitude > 0 ? magnitude : (def?.dmg ?? 0);
  const existing = f.statuses.find((s) => s.id === id);
  if (existing) {
    // POC: refresh duration, keep same instance (existing.dur = def.dur)
    existing.remaining = resolvedDur;
  } else {
    const inst: StatusInstance = { id, remaining: resolvedDur, magnitude: resolvedMag, tickT: def?.tick ?? 0 };
    f.statuses.push(inst);
  }
  bus.emit({ type: 'status-applied', target: f.id, status: id, t });
}

// ---------------------------------------------------------------------------
// tickStatuses — port of the inner status loop in poc simStep(dt)
// Decrements remaining; fires discrete ticks for burn; drops expired statuses.
// ---------------------------------------------------------------------------
export function tickStatuses(f: Fighter, dt: number, bus: EventBus, t: number = 0): void {
  for (let i = f.statuses.length - 1; i >= 0; i--) {
    const s: StatusInstance | undefined = f.statuses[i];
    if (s === undefined) continue;
    const def = STATUS_DEF[s.id];
    if (!def) { f.statuses.splice(i, 1); continue; }

    s.remaining -= dt;

    // Discrete tick (burn): tickT -= dt; when tickT <= 0 deal flat dmg, reset
    if (def.tick > 0) {
      s.tickT -= dt;
      if (s.tickT <= 0 && f.hp > 0) {
        s.tickT += def.tick;        // reset interval (POC: s.tickT += def.tick)
        const dmg = def.dmg;        // flat 6 for burn
        f.hp = Math.max(0, f.hp - dmg);
        bus.emit({ type: 'status-tick', target: f.id, status: s.id, amount: dmg, t });
      }
    }

    // Drop expired status (POC: if(s.dur<=0) splice)
    if (s.remaining <= 0) {
      f.statuses.splice(i, 1);
    }
  }
}

// ---------------------------------------------------------------------------
// applyStatusFromDef — convenience wrapper that applies a status using the
// canonical STATUS_DEF duration/magnitude (i.e. the move-apply path).
// ---------------------------------------------------------------------------
export function applyStatusFromDef(f: Fighter, id: string, bus: EventBus, t: number = 0): void {
  applyStatus(f, id, 0, 0, bus, t);
}

// ---------------------------------------------------------------------------
// speedMult — port of the atbMul product in poc simStep(dt)
// Returns the product of all active slow/shock ATB multipliers (1.0 if none).
// Shock has no atbMul in the POC; only slow does (0.45).
// ---------------------------------------------------------------------------
export function speedMult(f: Fighter): number {
  let mul = 1;
  for (const s of f.statuses) {
    const def = STATUS_DEF[s.id];
    if (def?.atbMul) mul *= def.atbMul;
  }
  return mul;
}
