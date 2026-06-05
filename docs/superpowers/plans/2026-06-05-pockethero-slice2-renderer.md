# PocketHero Slice 2 — 2.5D Billboard Combat Renderer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the Slice-1 deterministic engine's fights in the browser as 2.5D billboard pixel-art, driven entirely by the engine's `CombatEvent` stream, in the locked HD-2D Diorama (Route B) look.

**Architecture:** A new `src/render/` tree (the only code allowed to import `pixi.js`) wraps the pure engine. A fixed-step driver advances `stepFight` in whole `DT` steps and interpolates presentation state by the leftover `alpha`; a pure `mapEventToVfx` turns drained `CombatEvent`s into VFX intents the renderer plays. Art is a swappable `Theme` (Route B preset = target look). `src/sim/` stays Pixi/DOM-free (purity test still guards it).

**Tech Stack:** TypeScript (strict, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`), PixiJS v8.6, Vite (root `app/`), Vitest. Logic modules are unit-tested; visual assembly is verified by `npm run build` (tsc+vite) plus a headless-Chrome screenshot.

**Reads before starting:**
- `docs/2026-06-05-pockethero-slice2-renderer.md` — the design spec this plan implements.
- `docs/2026-06-05-pockethero-art-direction.md` — LOCKED art bible (Route B, Dead-Cells VFX ceiling, Endesga-32 palette, neutral-cool point light, **no faces**, simple-first arenas).
- `poc/art-routes.html` (route-B panel) and `poc/builder.html` (`drawCreaturePixels`, `drawGlyph`, `behaviorMod`) — the **visual + cube-quality reference** to port from. Match it; do not invent a new look.
- Engine public API in `src/index.ts` / `src/sim/`.

**Conventions:**
- Branch: `slice-2-renderer` (already checked out). Commit after every task. Push periodically.
- Type-only imports MUST use `import type { … }` (verbatimModuleSyntax).
- Array/record indexing returns `T | undefined` (noUncheckedIndexedAccess) — guard or `!` with justification.
- `src/render/**` may import pixi.js and use `document`/`window`. NEVER import render code from `src/sim`, `src/derive`, or `src/data`.
- Run the full suite with `npm test`; typecheck+bundle with `npm run build`.

---

## Engine API quick-reference (from Slice 1 — do not re-implement)

```ts
import {
  createFight, stepFight, runToEnd, DT,        // sim driver; DT = 1/60
  makeRng, makeBus,                            // makeRng(seed:number):Rng; makeBus():EventBus
  deriveStats, deriveMoveset,                  // build -> Stats / string[]
  PRESETS,                                     // Record<string,{name:string;build:Build}>
  CUBES,                                        // Record<string, Cube> (cube.col, cube.tint, cube.glyph, cube.cat)
} from '../index';
import type { FightState, Fighter, CombatEvent, EventBus, Build } from '../index';

// FighterSpec = { id:string; name:string; side:-1|1; build:Build }
// const s = createFight(specA, specB);  // FightState { fighters:[Fighter,Fighter], t, phase:'fight'|'done', winner }
// stepFight(s, rng, bus);               // advances exactly one DT; emits CombatEvents onto bus
// bus.drain(): CombatEvent[]            // buffered events since last drain

// Fighter: { id, name, side:-1|1, stats:Stats, moveset:string[], hp:number, atb:number, alive:boolean, ... }
// Stats:  { maxHP, armor, atk, speed, ... }
// CombatEvent union:
//  | { type:'move-start'; actor; move; t }
//  | { type:'hit'; source; target; amount; crit; school?; t }
//  | { type:'block'; target; t } | { type:'dodge'; target; t }
//  | { type:'status-applied'; target; status; t } | { type:'status-tick'; target; status; amount; t }
//  | { type:'heal'; target; amount; t } | { type:'ko'; target; t }
```

`createFight` ids: use `'p1'` / `'p2'`. The 1v1 engine guarantees exactly two fighters; the only target of a fighter is the other one.

---

## File structure (created by this plan)

```
src/render/
  types.ts          # shared render types: VfxIntent, RenderFighter snapshot, Theme
  palette.ts        # stat-type -> colour ramp (base/shadow/mid/highlight), pure
  theme.ts          # Theme presets: routeB (target) + flat (scaffolding)
  events-to-vfx.ts  # pure mapEventToVfx(CombatEvent) -> VfxIntent[]
  softbody.ts       # pure per-pixel spring (step + impulse), no Pixi
  loop.ts           # pure fixed-step accumulator: advance(acc, realDt) -> {acc, steps, alpha}
  glyph.ts          # drawGlyph(g, key, cx, cy, size, colorNum, alpha) on a Pixi Graphics (ported)
  creature.ts       # Build -> creature Container of stat-pixel cubes (Route B), exposes per-pixel springs
  arena.ts          # diorama bg + floor + parallax + per-creature drop shadow
  vfx.ts            # plays VfxIntents: screenshake, hitstop, flash, debris, flare, floating numbers
  hud.ts            # HP bars + UA combat readout + seed/restart control
  scene.ts          # assembles arena + 2 creatures + camera + Y-sort; owns the fixed-step driver
  app.ts            # PixiJS Application bootstrap + mounts scene
tests/
  palette.test.ts
  events-to-vfx.test.ts
  softbody.test.ts
  loop.test.ts
app/main.ts         # MODIFIED: replace shell with `import { startApp } from '../src/render/app'`
```

Pure/testable modules (Tasks 1–5) land first; Pixi assembly (Tasks 6–13) builds the walking skeleton then layers fidelity; Task 14 finalises.

---

## Task 1: Palette — semantic stat-type → colour ramp (pure)

**Files:**
- Create: `src/render/palette.ts`
- Test: `tests/palette.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/palette.test.ts
import { describe, it, expect } from 'vitest';
import { rampFor, PALETTE } from '../src/render/palette';
import { CUBE_IDS } from '../src/index';

describe('palette', () => {
  it('resolves every cube type to a 4-stop ramp of distinct ints', () => {
    for (const id of CUBE_IDS) {
      const r = rampFor(id);
      expect(typeof r.base).toBe('number');
      expect(new Set([r.shadow, r.mid, r.base, r.highlight]).size).toBe(4);
      // value ordering: shadow darkest, highlight brightest (sum of channels)
      const lum = (n: number) => (n >> 16 & 255) + (n >> 8 & 255) + (n & 255);
      expect(lum(r.shadow)).toBeLessThan(lum(r.base));
      expect(lum(r.highlight)).toBeGreaterThan(lum(r.base));
    }
  });

  it('gives distinct base hues to the 6 categories (no two category exemplars equal)', () => {
    const exemplars = ['force', 'plate', 'vital', 'swift', 'ember', 'core'].map((t) => PALETTE.base(t));
    expect(new Set(exemplars).size).toBe(6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/palette.test.ts`
Expected: FAIL — `rampFor`/`PALETTE` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/render/palette.ts
// Semantic colour: hue = stat type (from CUBES), value = shading ramp.
// Endesga-32-scale discipline: base hue + 3 derived values. Pure number maths.
import { CUBES } from '../index';

export interface Ramp { shadow: number; mid: number; base: number; highlight: number }

const hexToNum = (hex: string): number => parseInt(hex.slice(1), 16);
const mix = (a: number, b: number, t: number): number => {
  const ar = a >> 16 & 255, ag = a >> 8 & 255, ab = a & 255;
  const br = b >> 16 & 255, bg = b >> 8 & 255, bb = b & 255;
  const r = Math.round(ar + (br - ar) * t), g = Math.round(ag + (bg - ag) * t), bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
};
export const lighten = (n: number, t: number): number => mix(n, 0xffffff, t);
export const darken = (n: number, t: number): number => mix(n, 0x000000, t);

export function rampFor(type: string): Ramp {
  const cube = CUBES[type];
  const base = hexToNum(cube ? cube.col : '#888888');
  return { shadow: darken(base, 0.34), mid: darken(base, 0.14), base, highlight: lighten(base, 0.30) };
}

export const PALETTE = {
  base: (type: string): number => rampFor(type).base,
  tint: (type: string): number => hexToNum(CUBES[type]?.tint ?? '#101010'), // dark glyph colour
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/palette.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/render/palette.ts tests/palette.test.ts
git commit -m "feat(render): semantic stat-type colour ramp (palette)"
```

---

## Task 2: Render types + Theme presets

**Files:**
- Create: `src/render/types.ts`, `src/render/theme.ts`

- [ ] **Step 1: Write `src/render/types.ts`** (shared types; no test — consumed by later tested modules)

```ts
// src/render/types.ts
import type { Ramp } from './palette';

/** A presentation-only fighter snapshot the renderer interpolates between sim steps. */
export interface RenderFighter {
  id: string;
  hp: number;
  maxHP: number;
  alive: boolean;
  atb: number;
}

/** VFX intents produced from CombatEvents; the renderer plays them. */
export type VfxIntent =
  | { kind: 'flash'; target: string; color: number; frames: number }
  | { kind: 'shake'; amp: number; ms: number }
  | { kind: 'hitstop'; frames: number }
  | { kind: 'debris'; target: string; count: number; color: number }
  | { kind: 'flare'; actor: string; move: string }
  | { kind: 'floating'; target: string; text: string; color: number; crit: boolean }
  | { kind: 'heal'; target: string; amount: number }
  | { kind: 'ping'; target: string; label: 'block' | 'dodge' }
  | { kind: 'ko'; target: string };

export interface Theme {
  id: string;
  /** cube render mode */
  cube: 'flat' | 'diorama';
  /** silhouette outline */
  outline: 'hardBlack' | 'rim' | 'none';
  /** point-light direction (normalised-ish), neutral-cool tint applied in creature.ts */
  light: { x: number; y: number };
  /** VFX intensity ceiling */
  vfxCeiling: 'celeste' | 'deadcells' | 'vsurvivors';
  shadowAlpha: number;
  /** background draw key handled in arena.ts */
  arena: 'diorama' | 'flat';
  faces: boolean;
  ramp: (type: string) => Ramp;
}
```

- [ ] **Step 2: Write `src/render/theme.ts`**

```ts
// src/render/theme.ts
import type { Theme } from './types';
import { rampFor } from './palette';

/** LOCKED target look (docs/2026-06-05-pockethero-art-direction.md). */
export const routeB: Theme = {
  id: 'B', cube: 'diorama', outline: 'rim', light: { x: -0.55, y: -0.75 },
  vfxCeiling: 'deadcells', shadowAlpha: 0.45, arena: 'diorama', faces: false, ramp: rampFor,
};

/** Clean-flat scaffolding theme — used only while building the walking skeleton. */
export const flat: Theme = {
  id: 'A', cube: 'flat', outline: 'hardBlack', light: { x: -0.55, y: -0.75 },
  vfxCeiling: 'deadcells', shadowAlpha: 0.4, arena: 'flat', faces: false, ramp: rampFor,
};

export const THEMES: Record<string, Theme> = { A: flat, B: routeB };
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no errors).

- [ ] **Step 4: Commit**

```bash
git add src/render/types.ts src/render/theme.ts
git commit -m "feat(render): render types (VfxIntent, RenderFighter) + Theme presets (B target, flat scaffold)"
```

---

## Task 3: Event → VFX mapping (pure, the juice contract)

**Files:**
- Create: `src/render/events-to-vfx.ts`
- Test: `tests/events-to-vfx.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/events-to-vfx.test.ts
import { describe, it, expect } from 'vitest';
import { mapEventToVfx } from '../src/render/events-to-vfx';
import { routeB } from '../src/render/theme';
import type { CombatEvent } from '../src/index';

const intents = (e: CombatEvent) => mapEventToVfx(e, routeB);

describe('mapEventToVfx', () => {
  it('a normal hit -> flash + shake + hitstop + debris + floating number', () => {
    const out = intents({ type: 'hit', source: 'p1', target: 'p2', amount: 12, crit: false, t: 1 });
    const kinds = out.map((i) => i.kind).sort();
    expect(kinds).toEqual(['debris', 'flash', 'floating', 'hitstop', 'shake'].sort());
    const fl = out.find((i) => i.kind === 'floating');
    expect(fl && fl.kind === 'floating' && fl.text).toBe('12');
  });

  it('a crit hits harder: more shake amp + more hitstop frames than a normal hit', () => {
    const normal = intents({ type: 'hit', source: 'p1', target: 'p2', amount: 10, crit: false, t: 1 });
    const crit = intents({ type: 'hit', source: 'p1', target: 'p2', amount: 10, crit: true, t: 1 });
    const amp = (xs: ReturnType<typeof intents>) => (xs.find((i) => i.kind === 'shake') as { amp: number }).amp;
    const stop = (xs: ReturnType<typeof intents>) => (xs.find((i) => i.kind === 'hitstop') as { frames: number }).frames;
    expect(amp(crit)).toBeGreaterThan(amp(normal));
    expect(stop(crit)).toBeGreaterThan(stop(normal));
  });

  it('block/dodge -> a single ping; ko -> ko; move-start -> flare; heal -> heal', () => {
    expect(intents({ type: 'block', target: 'p2', t: 1 })).toEqual([{ kind: 'ping', target: 'p2', label: 'block' }]);
    expect(intents({ type: 'dodge', target: 'p2', t: 1 })).toEqual([{ kind: 'ping', target: 'p2', label: 'dodge' }]);
    expect(intents({ type: 'ko', target: 'p2', t: 1 })).toEqual([{ kind: 'ko', target: 'p2' }]);
    expect(intents({ type: 'move-start', actor: 'p1', move: 'fireball', t: 1 })).toEqual([{ kind: 'flare', actor: 'p1', move: 'fireball' }]);
    const heal = intents({ type: 'heal', target: 'p1', amount: 5, t: 1 });
    expect(heal).toEqual([{ kind: 'heal', target: 'p1', amount: 5 }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/events-to-vfx.test.ts`
Expected: FAIL — `mapEventToVfx` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
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
        { kind: 'hitstop', frames: Math.round((e.crit ? 8 : 4 + 4 * heavy) * ceil) },
        { kind: 'debris', target: e.target, count: Math.round((6 + 8 * heavy) * ceil), color: 0xffffff },
        { kind: 'floating', target: e.target, text: String(e.amount), color: e.crit ? 0xffd84a : 0xffffff, crit: e.crit },
      ];
    }
    case 'block':  return [{ kind: 'ping', target: e.target, label: 'block' }];
    case 'dodge':  return [{ kind: 'ping', target: e.target, label: 'dodge' }];
    case 'heal':   return [{ kind: 'heal', target: e.target, amount: e.amount }];
    case 'move-start': return [{ kind: 'flare', actor: e.actor, move: e.move }];
    case 'ko':     return [{ kind: 'ko', target: e.target }];
    case 'status-applied':
    case 'status-tick':
      return []; // status auras handled by creature state, not transient VFX (v1)
    default: return [];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/events-to-vfx.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/render/events-to-vfx.ts tests/events-to-vfx.test.ts
git commit -m "feat(render): pure mapEventToVfx (Dead-Cells-ceiling juice contract)"
```

---

## Task 4: Soft-body spring (pure per-pixel jiggle math)

**Files:**
- Create: `src/render/softbody.ts`
- Test: `tests/softbody.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/softbody.test.ts
import { describe, it, expect } from 'vitest';
import { makeSpring, stepSpring, impulse } from '../src/render/softbody';

describe('softbody spring', () => {
  it('an impulse decays back toward rest within ~1s and stays finite', () => {
    const s = makeSpring();
    impulse(s, 8);
    for (let i = 0; i < 60; i++) stepSpring(s, 1 / 60);
    expect(Number.isFinite(s.x)).toBe(true);
    expect(Math.abs(s.x)).toBeLessThan(0.3);   // converged near rest
    expect(Math.abs(s.v)).toBeLessThan(0.5);
  });

  it('is stable (no explosion) when stepped at rest', () => {
    const s = makeSpring();
    for (let i = 0; i < 600; i++) stepSpring(s, 1 / 60);
    expect(s.x).toBe(0);
    expect(s.v).toBe(0);
  });

  it('overshoots before settling (it is springy, not damped-to-zero instantly)', () => {
    const s = makeSpring();
    impulse(s, 10);
    let crossed = false, prev = 0;
    for (let i = 0; i < 60; i++) { stepSpring(s, 1 / 60); if (prev > 0 && s.x < 0) crossed = true; prev = s.x; }
    expect(crossed).toBe(true); // velocity carried it through rest at least once
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/softbody.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/softbody.test.ts`
Expected: PASS (3 tests). If the "overshoot" test fails, lower `damp` toward 10; if the "stable" test explodes, the spring is fine at 1/60 — do not raise `k` above ~220.

- [ ] **Step 5: Commit**

```bash
git add src/render/softbody.ts tests/softbody.test.ts
git commit -m "feat(render): pure under-damped spring for soft-body jiggle"
```

---

## Task 5: Fixed-step accumulator (pure loop math)

**Files:**
- Create: `src/render/loop.ts`
- Test: `tests/loop.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/loop.test.ts
import { describe, it, expect } from 'vitest';
import { advance, MAX_STEPS } from '../src/render/loop';
import { DT } from '../src/index';

describe('fixed-step accumulator', () => {
  it('accumulates real dt into whole DT steps and reports leftover alpha in [0,1)', () => {
    const r = advance(0, DT * 1.5);
    expect(r.steps).toBe(1);
    expect(r.alpha).toBeGreaterThanOrEqual(0);
    expect(r.alpha).toBeLessThan(1);
    expect(Math.abs(r.alpha - 0.5)).toBeLessThan(1e-6);
  });

  it('runs multiple steps for a big frame and carries the remainder', () => {
    const r = advance(0, DT * 3.25);
    expect(r.steps).toBe(3);
    expect(Math.abs(r.alpha - 0.25)).toBeLessThan(1e-6);
  });

  it('clamps to MAX_STEPS to avoid a spiral of death on a long stall', () => {
    const r = advance(0, DT * 1000);
    expect(r.steps).toBe(MAX_STEPS);
    expect(r.acc).toBeLessThan(DT); // leftover drained, no unbounded backlog
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/loop.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/render/loop.ts
// Pure fixed-step accumulator. The Pixi ticker feeds real frame dt; this decides
// how many whole DT sim steps to run and the leftover interpolation fraction.
// The sim itself never sees wall-clock (determinism, design P2).
import { DT } from '../index';

export const MAX_STEPS = 5; // cap steps per frame (spiral-of-death guard)

export interface Advance { acc: number; steps: number; alpha: number }

export function advance(acc: number, realDt: number): Advance {
  let a = acc + Math.max(0, realDt);
  let steps = 0;
  while (a >= DT && steps < MAX_STEPS) { a -= DT; steps++; }
  if (steps === MAX_STEPS) a = a % DT;        // drop backlog beyond the cap
  return { acc: a, steps, alpha: a / DT };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/loop.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/render/loop.ts tests/loop.test.ts
git commit -m "feat(render): pure fixed-step accumulator with spiral-of-death cap"
```

---

## Task 6: Glyph drawing on Pixi Graphics (ported from builder.html)

**Files:**
- Create: `src/render/glyph.ts`

No unit test (pure-visual path); verified when creatures render in Task 8. This is a faithful port of `poc/builder.html` `drawGlyph` from `ctx` 2D to a Pixi `Graphics`.

- [ ] **Step 1: Write `src/render/glyph.ts`**

```ts
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
  // Pixi v8 Graphics is path-then-fill/stroke. Coordinates are absolute (cx,cy + offsets).
  const P = (x: number, y: number) => ({ x: cx + x, y: cy + y });
  switch (key) {
    case 'heart': {
      const a = P(0, r * 0.85);
      g.moveTo(a.x, a.y)
        .bezierCurveTo(cx + r * 1.2, cy + r * 0.05, cx + r * 0.55, cy - r * 0.95, cx, cy - r * 0.15)
        .bezierCurveTo(cx - r * 0.55, cy - r * 0.95, cx - r * 1.2, cy + r * 0.05, a.x, a.y)
        .fill(fill);
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
      break;
    }
    case 'flame': {
      g.moveTo(cx, cy + r).bezierCurveTo(cx + r * 0.95, cy + r * 0.4, cx + r * 0.5, cy - r * 0.4, cx, cy - r)
        .bezierCurveTo(cx - r * 0.3, cy - r * 0.3, cx - r * 0.85, cy + r * 0.2, cx, cy + r).fill(fill);
      break;
    }
    case 'droplet': {
      g.moveTo(cx, cy - r).bezierCurveTo(cx + r * 0.75, cy + r * 0.05, cx + r * 0.55, cy + r, cx, cy + r)
        .bezierCurveTo(cx - r * 0.55, cy + r, cx - r * 0.75, cy + r * 0.05, cx, cy - r).fill(fill);
      break;
    }
    case 'diamond': {
      g.moveTo(cx, cy - r).lineTo(cx + r * 0.78, cy).lineTo(cx, cy + r).lineTo(cx - r * 0.78, cy).closePath().fill(fill);
      break;
    }
    default: { // 'star' and any unported glyph -> star (still legible)
      g.poly(starPoints(cx, cy, r)).fill(fill);
    }
  }
}

function starPoints(cx: number, cy: number, r: number): number[] {
  const pts: number[] = [];
  for (let k = 0; k < 10; k++) {
    const rad = k % 2 ? r * 0.45 : r;
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    pts.push(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  return pts;
}
```

> Port the remaining glyph cases (`pulse, fang, arrowdn, rage, brace, thorns, rune, chevron, dblchev, wisp, snow, bolt, vial, sigil, ring`) from `poc/builder.html` lines 1113–1232 the same way (Canvas `ctx.bezierCurveTo/lineTo/arc` → Pixi `g.bezierCurveTo/lineTo/arc`, then `.fill()` or `.stroke(stroke)`). Until ported they fall through to the star — acceptable for the first visual pass; complete them in Task 13.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/render/glyph.ts
git commit -m "feat(render): per-type glyph drawing on Pixi Graphics (core set; rest fall back to star)"
```

---

## Task 7: Pixi app bootstrap (replace the shell)

**Files:**
- Create: `src/render/app.ts`
- Modify: `app/main.ts`

- [ ] **Step 1: Write `src/render/app.ts`**

```ts
// src/render/app.ts
import { Application } from 'pixi.js';
import { Scene } from './scene';

export async function startApp(): Promise<void> {
  const app = new Application();
  await app.init({
    background: '#0e0f14', resizeTo: window, antialias: false,
    autoDensity: true, resolution: Math.min(window.devicePixelRatio || 1, 2),
  });
  document.body.appendChild(app.canvas);
  const scene = new Scene(app);
  await scene.start(0xC0FFEE); // initial seed
}
```

- [ ] **Step 2: Replace `app/main.ts`**

```ts
// app/main.ts
import { startApp } from '../src/render/app';
void startApp();
```

- [ ] **Step 3: Add a temporary minimal `Scene` so the app compiles & runs** (it is fleshed out in Task 10; this stub just clears + logs so Tasks 7–9 can build independently)

```ts
// src/render/scene.ts  (TEMPORARY STUB — replaced in Task 10)
import type { Application } from 'pixi.js';

export class Scene {
  constructor(private app: Application) {}
  async start(_seed: number): Promise<void> {
    console.log('Scene stub ready');
  }
}
```

- [ ] **Step 4: Build to verify it compiles and boots**

Run: `npm run build`
Expected: PASS (tsc clean + vite bundle to `dist/`). Then headless-screenshot smoke:
Run (PowerShell): start the dev server `npm run dev` in the background and capture `http://localhost:5173/` with headless Chrome (`--headless=new --virtual-time-budget=5000 --screenshot`). Expected: a blank dark canvas, console "Scene stub ready", no errors.

- [ ] **Step 5: Commit**

```bash
git add src/render/app.ts src/render/scene.ts app/main.ts
git commit -m "feat(render): Pixi v8 app bootstrap replacing the empty shell (scene stub)"
```

---

## Task 8: Creature — Build → Route-B cube container (the quality bar)

**Files:**
- Create: `src/render/creature.ts`

Port `poc/builder.html drawCreaturePixels` + the route-B cube from `poc/art-routes.html` into Pixi. Crisp square cells; per-cube vertical gradient + rim light + glyph; spacing-based squash; per-pixel spring offsets. **No eye/face** (theme.faces = false). One `Creature` owns its build, a `Container`, and a `Spring[]` (one per pixel) for jiggle.

- [ ] **Step 1: Write `src/render/creature.ts`**

```ts
// src/render/creature.ts
import { Container, Graphics } from 'pixi.js';
import type { Build } from '../index';
import type { Theme } from './types';
import { lighten, darken } from './palette';
import { drawGlyph } from './glyph';
import { makeSpring, stepSpring, impulse, type Spring } from './softbody';

const CELL = 14; // base px per stat-pixel (depth-scaled by the scene, never bitmap-stretched)

export class Creature {
  readonly root = new Container();
  private cells: { gx: number; gy: number; type: string; g: Graphics; springX: Spring; springY: Spring }[] = [];
  readonly meta: { minX: number; maxX: number; minY: number; maxY: number; cx: number; cy: number; span: number; wCells: number; hCells: number };
  private t = 0;
  private squash = 0;
  facing: 1 | -1 = 1;

  constructor(private build: Build, private theme: Theme) {
    const gxs = build.map((p) => p.gx), gys = build.map((p) => p.gy);
    const minX = Math.min(...gxs), maxX = Math.max(...gxs), minY = Math.min(...gys), maxY = Math.max(...gys);
    this.meta = { minX, maxX, minY, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2,
      span: Math.max(maxX - minX, maxY - minY) / 2 + 0.5, wCells: maxX - minX + 1, hCells: maxY - minY + 1 };
    const present = new Set(build.map((p) => p.gx + ',' + p.gy));
    for (const p of build) {
      const g = new Graphics();
      this.drawCube(g, p.gx, p.gy, p.type, present);
      this.root.addChild(g);
      this.cells.push({ gx: p.gx, gy: p.gy, type: p.type, g, springX: makeSpring(), springY: makeSpring(160, 13) });
    }
  }

  private lightFactor(gx: number, gy: number): number {
    const nx = (gx - this.meta.cx) / this.meta.span, ny = (gy - this.meta.cy) / this.meta.span;
    return Math.max(-1, Math.min(1, -(nx * this.theme.light.x + ny * this.theme.light.y)));
  }

  /** Draw one cube into its own Graphics at local origin; transforms position it each frame. */
  private drawCube(g: Graphics, gx: number, gy: number, type: string, present: Set<string>): void {
    const ramp = this.theme.ramp(type);
    const lf = this.lightFactor(gx, gy);
    const has = (x: number, y: number) => present.has(x + ',' + y);
    g.clear();
    if (this.theme.cube === 'diorama') {
      const top = lighten(ramp.base, 0.16 + 0.16 * Math.max(0, lf));
      const bot = darken(ramp.mid, 0.10);
      g.rect(0, 0, CELL, CELL).fill({ color: top });           // base fill (top tone)
      g.rect(0, CELL * 0.5, CELL, CELL * 0.5).fill({ color: bot, alpha: 0.85 }); // lower-half darken (gradient feel)
      // rim light on free top/left edges
      if (!has(gx, gy - 1)) g.rect(0, 0, CELL, 2).fill({ color: 0xfff4e0, alpha: 0.5 });
      if (!has(gx - 1, gy)) g.rect(0, 0, 2, CELL).fill({ color: 0xfff4e0, alpha: 0.5 });
      // soft contact shadow on free bottom/right edges
      if (!has(gx, gy + 1)) g.rect(0, CELL - 2, CELL, 2).fill({ color: 0x000000, alpha: 0.28 });
      if (!has(gx + 1, gy)) g.rect(CELL - 2, 0, 2, CELL).fill({ color: 0x000000, alpha: 0.28 });
    } else { // flat scaffolding theme
      g.rect(0, 0, CELL, CELL).fill({ color: ramp.base });
      g.rect(0, 0, CELL, CELL * 0.16).fill({ color: 0xffffff, alpha: 0.12 });
      const o = 2;
      if (!has(gx, gy - 1)) g.rect(0, 0, CELL, o).fill({ color: 0x05060a });
      if (!has(gx, gy + 1)) g.rect(0, CELL - o, CELL, o).fill({ color: 0x05060a });
      if (!has(gx - 1, gy)) g.rect(0, 0, o, CELL).fill({ color: 0x05060a });
      if (!has(gx + 1, gy)) g.rect(CELL - o, 0, o, CELL).fill({ color: 0x05060a });
    }
    drawGlyph(g, type, CELL / 2, CELL / 2, CELL, this.theme.ramp(type).shadow, 0.9);
  }

  /** hit reaction: kick springs + set squash. */
  react(power: number): void {
    this.squash = Math.min(1, this.squash + 0.5 + power * 0.04);
    for (const c of this.cells) { impulse(c.springX, (Math.random() - 0.5) * 4); impulse(c.springY, -2 - power * 0.1); }
  }

  /** per-frame: advance springs + breathing + squash, lay out cells (spacing-based, crisp). */
  update(dt: number): void {
    this.t += dt;
    this.squash *= Math.pow(0.0006, dt);
    const sq = 1 - this.squash * 0.18, st = 1 + this.squash * 0.14;
    const breath = 1 + 0.03 * Math.sin(this.t * 2.6);
    const feet = this.meta.maxY;
    for (const c of this.cells) {
      stepSpring(c.springX, dt); stepSpring(c.springY, dt);
      const x = (c.gx * CELL * sq) + c.springX.x;
      const y = -((feet - c.gy) * CELL) * st * breath + c.springY.x;
      c.g.position.set(Math.round(x), Math.round(y));
    }
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS. (If `noUncheckedIndexedAccess` complains about `Math.min(...gxs)` — it won't, spreads are fine; builds are non-empty by construction.)

- [ ] **Step 3: Commit**

```bash
git add src/render/creature.ts
git commit -m "feat(render): Route-B billboard creature (crisp cubes, gradient+rim+glyph, spring jiggle, no face)"
```

---

## Task 9: Arena — diorama background, floor, parallax, drop shadow

**Files:**
- Create: `src/render/arena.ts`

- [ ] **Step 1: Write `src/render/arena.ts`**

```ts
// src/render/arena.ts
import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { Theme } from './types';

/** One diorama arena: cool gradient sky->floor, warm light pool, floor plane,
 *  2-layer parallax, and a soft drop-shadow per creature. Simple-first (no Blender). */
export class Arena {
  readonly root = new Container();
  private bg = new Graphics();
  private shadows: Sprite[] = [];
  private shadowTex = Arena.makeShadowTexture();

  constructor(private theme: Theme) { this.root.addChild(this.bg); }

  resize(w: number, h: number): void {
    const g = this.bg; g.clear();
    if (this.theme.arena === 'diorama') {
      for (let y = 0; y < h; y += 2) {
        const tcol = mix(0x2c2336, 0x0e0f14, y / h); g.rect(0, y, w, 2).fill({ color: tcol });
      }
      g.ellipse(w * 0.5, h * 0.34, w * 0.45, h * 0.30).fill({ color: 0xffc882, alpha: 0.10 }); // warm pool
      g.rect(0, h * 0.66, w, h * 0.34).fill({ color: 0x141810, alpha: 0.5 });                  // floor plane
    } else {
      g.rect(0, 0, w, h).fill({ color: 0x14161c });
      g.rect(0, h * 0.62, w, h * 0.38).fill({ color: 0x1b1f28 });
    }
  }

  /** ensure N shadow sprites exist; returns the sprite for index i to position under a creature. */
  shadowFor(i: number): Sprite {
    while (this.shadows.length <= i) {
      const s = new Sprite(this.shadowTex); s.anchor.set(0.5); s.tint = 0x000000; s.alpha = this.theme.shadowAlpha;
      this.shadows.push(s); this.root.addChild(s);
    }
    return this.shadows[i]!;
  }

  private static makeShadowTexture(): Texture {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d')!; const grd = x.createRadialGradient(32, 32, 2, 32, 32, 32);
    grd.addColorStop(0, 'rgba(0,0,0,1)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = grd; x.fillRect(0, 0, 64, 64);
    return Texture.from(c);
  }
}

function mix(a: number, b: number, t: number): number {
  const ar = a >> 16 & 255, ag = a >> 8 & 255, ab = a & 255;
  const br = b >> 16 & 255, bg = b >> 8 & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/render/arena.ts
git commit -m "feat(render): simple-first diorama arena + per-creature drop shadow"
```

---

## Task 10: Scene — assemble fight, fixed-step driver, depth, HP-less walking skeleton

**Files:**
- Modify (replace stub): `src/render/scene.ts`

This is the walking-skeleton integration: two preset creatures stand on the arena, depth-scaled and Y-sorted, and the engine drives them to K.O. via the fixed-step loop. Juice/HUD come in later tasks.

- [ ] **Step 1: Replace `src/render/scene.ts`**

```ts
// src/render/scene.ts
import { Container, type Application } from 'pixi.js';
import { createFight, makeRng, makeBus, PRESETS, deriveStats } from '../index';
import type { FightState, EventBus } from '../index';
import type { Rng } from '../index';
import { routeB } from './theme';
import { advance } from './loop';
import { Arena } from './arena';
import { Creature } from './creature';

export class Scene {
  private world = new Container();
  private arena = new Arena(routeB);
  private creatures: Creature[] = [];
  private state!: FightState;
  private rng!: Rng;
  private bus!: EventBus;
  private acc = 0;
  private maxHP: number[] = [];

  constructor(private app: Application) {
    this.app.stage.addChild(this.arena.root);
    this.app.stage.addChild(this.world);
  }

  async start(seed: number): Promise<void> {
    this.rng = makeRng(seed);
    this.bus = makeBus();
    const a = PRESETS['hero']!, b = PRESETS['brute']!;
    this.state = createFight(
      { id: 'p1', name: a.name, side: -1, build: a.build },
      { id: 'p2', name: b.name, side: 1, build: b.build },
    );
    this.maxHP = [deriveStats(a.build).maxHP, deriveStats(b.build).maxHP];
    this.creatures = [new Creature(a.build, routeB), new Creature(b.build, routeB)];
    this.world.removeChildren();
    for (const c of this.creatures) this.world.addChild(c.root);
    this.layout();
    window.addEventListener('resize', () => this.layout());
    this.app.ticker.add((tk) => this.frame(tk.deltaMS / 1000));
  }

  private layout(): void {
    const W = this.app.screen.width, H = this.app.screen.height;
    this.arena.resize(W, H);
    const groundY = H * 0.82;
    this.creatures.forEach((c, i) => {
      const side = i === 0 ? -1 : 1;
      const scale = Math.min(W * 0.30 / (c.meta.wCells * 14), H * 0.45 / (c.meta.hCells * 14));
      c.root.scale.set(scale);
      c.root.position.set(W * 0.5 + side * W * 0.22, groundY);
      c.facing = i === 0 ? 1 : -1;
      const sh = this.arena.shadowFor(i);
      sh.position.set(c.root.x, groundY + 4);
      sh.width = c.meta.wCells * 14 * scale * 1.2; sh.height = 14 * scale * 1.2;
    });
  }

  private frame(realDt: number): void {
    const r = advance(this.acc, realDt); this.acc = r.acc;
    for (let i = 0; i < r.steps; i++) {
      if (this.state.phase === 'fight') { stepOnce(this.state, this.rng, this.bus); }
    }
    this.bus.drain(); // events consumed for real in Task 12; drain to avoid unbounded buffer
    for (const c of this.creatures) c.update(realDt);
    // Y-sort: lower on screen draws in front (here both share groundY; depth comes in Task 13)
  }
}

// local import kept out of the class for clarity
import { stepFight } from '../index';
function stepOnce(s: FightState, rng: Rng, bus: EventBus): void { stepFight(s, rng, bus); }
```

- [ ] **Step 2: Build + visual verify**

Run: `npm run build` → Expected: PASS.
Then `npm run dev` (background) and headless-Chrome screenshot of `http://localhost:5173/`.
Expected: two diorama pixel-creatures (hero vs brute) facing each other on a lit floor with drop shadows; they animate (breathing/jiggle); after a few seconds one stops updating ATB (fight reaches K.O. internally — not yet shown). No console errors. Save the screenshot for the review.

- [ ] **Step 3: Commit**

```bash
git add src/render/scene.ts
git commit -m "feat(render): walking skeleton — engine-driven hero vs brute on diorama arena (fixed-step)"
```

---

## Task 11: HUD — HP bars, UA combat readout, seed/restart

**Files:**
- Create: `src/render/hud.ts`
- Modify: `src/render/scene.ts` (instantiate HUD, feed hp each frame, wire restart)

- [ ] **Step 1: Write `src/render/hud.ts`**

```ts
// src/render/hud.ts
import { Container, Graphics, Text } from 'pixi.js';

export class Hud {
  readonly root = new Container();
  private bars: { bg: Graphics; fill: Graphics; name: Text }[] = [];
  private log = new Text({ text: '', style: { fontFamily: 'system-ui', fontSize: 13, fill: 0xcfd6e6, wordWrap: true, wordWrapWidth: 360 } });
  private lines: string[] = [];

  constructor(names: [string, string], private onRestart: () => void) {
    for (let i = 0; i < 2; i++) {
      const bg = new Graphics(), fill = new Graphics();
      const name = new Text({ text: names[i]!, style: { fontFamily: 'system-ui', fontSize: 13, fontWeight: '700', fill: 0xffffff } });
      this.root.addChild(bg, fill, name); this.bars.push({ bg, fill, name });
    }
    this.root.addChild(this.log);
    const btn = new Text({ text: '↻ restart', style: { fontFamily: 'system-ui', fontSize: 14, fill: 0x9fc0ff } });
    btn.eventMode = 'static'; btn.cursor = 'pointer'; btn.on('pointertap', onRestart);
    btn.position.set(12, 12); this.root.addChild(btn);
  }

  setHP(i: number, hp: number, maxHP: number): void {
    const b = this.bars[i]!; const W = 220, H = 14; const x = i === 0 ? 24 : (this.lastW - W - 24); const y = 40;
    b.name.position.set(x, y - 18);
    b.bg.clear().roundRect(x, y, W, H, 4).fill({ color: 0x1a1d26 });
    const f = Math.max(0, Math.min(1, hp / maxHP));
    b.fill.clear().roundRect(x, y, W * f, H, 4).fill({ color: f > 0.3 ? 0x46d68c : 0xE0483F });
  }

  pushLog(line: string): void { this.lines.push(line); if (this.lines.length > 8) this.lines.shift(); this.log.text = this.lines.join('\n'); }

  layout(w: number, h: number): void { this.lastW = w; this.log.position.set(24, h - 150); }
  private lastW = 800;
}
```

- [ ] **Step 2: Wire into `scene.ts`** — add `private hud = new Hud(['Герой','Громило'], () => this.start(this.nextSeed()))`, `this.app.stage.addChild(this.hud.root)`, call `this.hud.layout(W,H)` in `layout()`, and each frame `this.creatures.forEach((_,i)=>this.hud.setHP(i, this.state.fighters[i]!.hp, this.maxHP[i]!))`. Add `private seed=0; nextSeed(){ this.seed=(this.seed*1664525+1013904223)>>>0; return this.seed; }`.

- [ ] **Step 3: Build + visual verify**

Run: `npm run build` → PASS. Dev + screenshot: two HP bars drain over the fight; a restart control reruns a fresh seed; no errors.

- [ ] **Step 4: Commit**

```bash
git add src/render/hud.ts src/render/scene.ts
git commit -m "feat(render): HUD — HP bars, combat readout, seed/restart"
```

---

## Task 12: VFX — play the intents (flash, shake, hitstop, debris, flare, floating numbers)

**Files:**
- Create: `src/render/vfx.ts`
- Modify: `src/render/scene.ts` (drain → mapEventToVfx → vfx.play; apply shake/hitstop to the loop)

- [ ] **Step 1: Write `src/render/vfx.ts`**

```ts
// src/render/vfx.ts
import { Container, Graphics, Text } from 'pixi.js';
import type { VfxIntent } from './types';

/** Owns transient particles + screen-level shake/hitstop state. Cosmetic Math.random
 *  is isolated here (never reaches the sim). */
export class Vfx {
  readonly layer = new Container();         // debris + floating numbers, above creatures
  shake = 0;                                // current shake amplitude (px), decays
  hitstop = 0;                              // seconds of frozen sim remaining
  private parts: { g: Graphics; vx: number; vy: number; life: number; fade: number }[] = [];
  private floats: { t: Text; life: number; vy: number }[] = [];

  /** play one intent; `at` resolves a target/actor id to a screen position. */
  play(i: VfxIntent, at: (id: string) => { x: number; y: number }, onFlash: (id: string, color: number, frames: number) => void): void {
    switch (i.kind) {
      case 'shake': this.shake = Math.max(this.shake, i.amp); break;
      case 'hitstop': this.hitstop = Math.max(this.hitstop, i.frames / 60); break;
      case 'flash': onFlash(i.target, i.color, i.frames); break;
      case 'debris': { const p = at(i.target); for (let k = 0; k < i.count; k++) this.debris(p.x, p.y, i.color); break; }
      case 'floating': { const p = at(i.target); this.floating(p.x, p.y, i.text, i.color, i.crit); break; }
      case 'flare': /* causal flare handled on the creature in Task 13 */ break;
      case 'heal': { const p = at(i.target); this.floating(p.x, p.y, '+' + i.amount, 0x46d68c, false); break; }
      case 'ping': { const p = at(i.target); this.floating(p.x, p.y, i.label === 'block' ? 'БЛОК' : 'УХИЛ', 0x9fc0ff, false); break; }
      case 'ko': break;
    }
  }

  private debris(x: number, y: number, color: number): void {
    const g = new Graphics(); const s = 3 + Math.random() * 3; g.rect(-s / 2, -s / 2, s, s).fill({ color });
    g.position.set(x, y); this.layer.addChild(g);
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.8, sp = 3 + Math.random() * 4;
    this.parts.push({ g, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, fade: 1.6 });
  }
  private floating(x: number, y: number, text: string, color: number, crit: boolean): void {
    const t = new Text({ text, style: { fontFamily: 'system-ui', fontSize: crit ? 22 : 16, fontWeight: '700', fill: color } });
    t.anchor.set(0.5); t.position.set(x, y); this.layer.addChild(t);
    this.floats.push({ t, life: 1, vy: -1.4 });
  }

  /** advance particles; call every frame with real dt. Returns shake offset for the world. */
  update(dt: number): { x: number; y: number } {
    this.shake *= Math.pow(0.0001, dt);
    for (let k = this.parts.length - 1; k >= 0; k--) { const p = this.parts[k]!; p.life -= dt * p.fade;
      if (p.life <= 0) { p.g.destroy(); this.parts.splice(k, 1); continue; }
      p.vy += 26 * dt; p.g.x += p.vx * dt * 60; p.g.y += p.vy * dt * 60; p.g.alpha = Math.min(1, p.life * 1.3); }
    for (let k = this.floats.length - 1; k >= 0; k--) { const f = this.floats[k]!; f.life -= dt * 1.1;
      if (f.life <= 0) { f.t.destroy(); this.floats.splice(k, 1); continue; }
      f.t.y += f.vy * dt * 60; f.t.alpha = Math.min(1, f.life * 1.5); }
    const amp = this.shake > 0.1 ? this.shake : 0;
    return { x: (Math.random() - 0.5) * amp, y: (Math.random() - 0.5) * amp };
  }
}
```

- [ ] **Step 2: Wire into `scene.ts`** — instantiate `private vfx = new Vfx()`, add `this.world.addChild(this.vfx.layer)`. In `frame`:
  1. compute `advance`; but gate sim stepping on hitstop: `if (this.vfx.hitstop > 0) { this.vfx.hitstop -= realDt; } else { run r.steps }`.
  2. after stepping, `for (const e of this.bus.drain()) for (const intent of mapEventToVfx(e, routeB)) this.vfx.play(intent, id => this.screenPos(id), (id,col,fr)=>this.flash(id,col,fr));` (also `this.hud.pushLog(...)` for hit/ko lines, and call `creature.react(amount)` on `hit`).
  3. `const sh = this.vfx.update(realDt); this.world.position.set(sh.x, sh.y);`
  Add helpers `screenPos(id)` (returns the creature root x,y offset upward by half height) and `flash(id,color,frames)` (tint the creature white for N frames via a counter on the Creature — add a `flash(frames,color)` method to Creature that sets `root.tint` and counts down in `update`).

- [ ] **Step 3: Build + visual verify**

Run: `npm run build` → PASS. Dev + screenshot mid-fight: hits produce white flashes, screenshake, floating damage numbers, debris; crits visibly bigger; the fight still resolves to K.O. No console errors. Determinism unaffected (VFX never touches the sim).

- [ ] **Step 4: Commit**

```bash
git add src/render/vfx.ts src/render/scene.ts src/render/creature.ts
git commit -m "feat(render): event-driven juice — flash, shake, hitstop, debris, floating numbers"
```

---

## Task 13: Depth, causal flare, glyph completion, Theme-B polish

**Files:**
- Modify: `src/render/scene.ts` (depth-scale + Y-sort + knockback into Z), `src/render/creature.ts` (causal flare on `flare` intent + complete glyphs), `src/render/glyph.ts` (port remaining glyphs)

- [ ] **Step 1: Knockback + depth.** In `scene.ts`, give each creature a `z` offset that a `hit` nudges (target pushed back into depth), eased back over time; map `z` to a small `scale` reduction (≈0.85→1.0) and a downward `y` shift, and Y-sort `world.children` by `y` each frame so the front creature overlaps. Add a short lunge on `move-start` for the actor.

- [ ] **Step 2: Causal flare.** Add `Creature.flare(durationFrames)` that briefly brightens the firing cube cluster (lighten its cubes / add an additive glow child) when a `flare` intent arrives for that creature; remove when it decays.

- [ ] **Step 3: Complete glyphs.** Port the remaining `drawGlyph` cases from `poc/builder.html` (lines 1113–1232) into `src/render/glyph.ts` so every cube type shows its real symbol (not the star fallback).

- [ ] **Step 4: Build + visual verify**

Run: `npm run build` → PASS. Dev + screenshot: knockback travels into depth with shadow/scale change; the attacking cube flares on its move; all cube types show correct glyphs; the route-B look matches the `poc/art-routes.html` B panel. No errors.

- [ ] **Step 5: Commit**

```bash
git add src/render/scene.ts src/render/creature.ts src/render/glyph.ts
git commit -m "feat(render): depth knockback + Y-sort, causal flare, complete per-type glyphs"
```

---

## Task 14: Finalise — silhouette-layering check, slice status, full verify

**Files:**
- Modify: `CLAUDE.md` (slice roadmap: mark Slice 2 done), `docs/2026-06-05-pockethero-slice2-renderer.md` (status note)

- [ ] **Step 1: Verify the silhouette-first layer order** — confirm draw order is: arena bg → floor → drop shadows → creatures (Y-sorted) → causal flares → debris/floating numbers (vfx.layer) → screen shake (world transform) → HUD (top). Fix any layer that buries the creature silhouette. Confirm the Dead-Cells ceiling reads (dense but never occludes the creature) by watching a full fight.

- [ ] **Step 2: Full suite + build**

Run: `npm test` → Expected: all Slice-1 tests still green + the 4 new render-logic test files pass; `tests/purity.test.ts` and `tests/determinism.test.ts` still green (render code never imported by `sim/`).
Run: `npm run build` → Expected: PASS.

- [ ] **Step 3: Final visual capture** — `npm run dev`, headless screenshot of a full hero-vs-brute fight to K.O. (route B). Attach for review.

- [ ] **Step 4: Update docs** — in `CLAUDE.md` change the roadmap line to `2. **2.5D billboard combat renderer** — DONE`; add a one-line status to the renderer spec.

- [ ] **Step 5: Commit + push**

```bash
git add CLAUDE.md docs/2026-06-05-pockethero-slice2-renderer.md
git commit -m "docs: Slice 2 renderer complete — engine-driven Route-B billboard combat"
git push
```

---

## Self-review (checked against the spec)

**Spec coverage:**
- DoD-1 two billboard creatures auto-fight driven by engine → Tasks 8/10. DoD-2 depth (shadow/scale/Y-sort/knockback-Z) → Tasks 9/13. DoD-3 soft-body springs/squash → Tasks 4/8/12. DoD-4 juice via matching events → Tasks 3/12. DoD-5 legibility (palette/glyphs/causal flare/silhouette-first) → Tasks 1/6/13/14. DoD-6 HP bars + UA readout + seed/restart → Task 11. DoD-7 determinism intact (sim never sees wall-clock; render reads events only) → Tasks 5/10 + purity/determinism tests in Task 14.
- Architecture: `render/` isolated, fixed-step driver + interpolation, pure `mapEventToVfx`, `Theme` parameterisation → Tasks 2/3/5/10. Art bible specifics (Route B, Dead-Cells ceiling, Endesga-32 ramp, neutral-cool light, no faces, simple arena) → Tasks 1/2/8/9.
- Out-of-scope (builder/meta/PvP/audio) correctly untouched.

**Placeholder scan:** pure modules (Tasks 1,3,4,5) have complete code + tests. Glyph (Task 6) ships the core set with an explicit star fallback and a named follow-up in Task 13 (not a silent TODO). Pixi-integration tasks (7–13) give real v8 code; visual sub-steps are verified by `npm run build` + a headless screenshot rather than unit tests because they are presentation-only — this is the spec's stated verification method, not a placeholder.

**Type consistency:** `Theme` (id/cube/outline/light/vfxCeiling/shadowAlpha/arena/faces/ramp) is defined once in `types.ts` and consumed unchanged in `theme.ts`, `creature.ts`, `arena.ts`. `VfxIntent` kinds produced in `events-to-vfx.ts` exactly match the `switch` arms played in `vfx.ts` (`flash/shake/hitstop/debris/flare/floating/heal/ping/ko`). `advance()`/`MAX_STEPS` (loop), `makeSpring/stepSpring/impulse/Spring` (softbody), `rampFor/lighten/darken/PALETTE` (palette), `drawGlyph` (glyph), `Creature`/`Arena`/`Hud`/`Vfx`/`Scene` classes are referenced with consistent names across tasks. Engine symbols match `src/index.ts` exactly.

**Note for executor:** Tasks 1–5 are pure TDD and can be done/committed in any order. Tasks 6–13 are sequential (each builds on the prior scene). Verify every visual task with `npm run build` first (cheap typecheck gate), then the headless screenshot for the look.
```
