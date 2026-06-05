// src/render/softbody.ts
// One scalar spring per animated pixel offset. Critically-under-damped so hits
// overshoot then settle (the "jiggle"). Pure; the renderer applies x as an offset.
export interface Spring { x: number; v: number; k: number; damp: number }

export function makeSpring(k = 180, damp = 12): Spring {
  return { x: 0, v: 0, k, damp };
}

/** Semi-implicit Euler toward rest (target 0). dt in seconds. */
export function stepSpring(s: Spring, dt: number): void {
  const a = -s.k * s.x - s.damp * s.v;
  s.v += a * dt;
  s.x += s.v * dt;
  if (Math.abs(s.x) < 1e-4 && Math.abs(s.v) < 1e-3) { s.x = 0; s.v = 0; } // snap to rest
}

/** Kick the spring (e.g. on hit). */
export function impulse(s: Spring, j: number): void { s.v += j; }
