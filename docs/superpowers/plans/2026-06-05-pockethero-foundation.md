# PocketHero Foundation (Slice 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the production toolchain and the complete deterministic combat engine + data layer, proven by green tests and a headless fight — no visuals.

**Architecture:** Pure `sim/` (no Pixi/DOM) advancing on a fixed 60 Hz timestep, driven by a single seeded RNG, emitting typed events onto a synchronous bus that consumers (a combat-log printer now, a PixiJS renderer later) read. Content (cubes/moves/traits) is typed data ported verbatim from the validated POCs.

**Tech Stack:** Vite · TypeScript (strict) · PixiJS v8 (installed, unused this slice) · Vitest · ESM · Node ≥20.

**Reference source of truth:** `poc/builder.html` (data + derive + 38 self-tests) and `poc/gauntlet.html` (combat resolution + UA log). Exact line ranges are cited per task. Port behaviour faithfully; the ported self-tests and the golden-master log are the parity contract.

---

## File Structure

```
package.json · tsconfig.json · vite.config.ts · vitest.config.ts · README.md
src/
  data/
    types.ts        # Category, Rarity, Cube, SynergyDef, ShapeDef, Move, StatusDef
    schools.ts      # damage schools
    cubes.ts        # ~22 cube registry  (port poc/builder.html:166-262)
    moves.ts        # move registry       (port poc/builder.html:264-313)
    traits.ts       # SYNERGY_DEFS + SHAPE_DEFS (port poc/builder.html:315-451)
  derive/
    types.ts        # PlacedCube, Build, Stats, Trait
    detectors.ts    # detectSynergies/detectShapes/detectTraits (port :336-473)
    deriveStats.ts  # (port :231-262 STAT + :475-557)
    deriveMoveset.ts# (port :558-571)
  builds/
    presets.ts      # HERO/BRUTE/MAGE/TITAN builds + B() helper (port :573-633)
  sim/
    rng.ts          # Mulberry32 -> Rng (port :146-164)
    events.ts       # EventBus + CombatEvent union
    types.ts        # Fighter, FightState
    status.ts       # Burn/Slow/Shock runtime (port poc/gauntlet.html statuses)
    fighter.ts      # makeFighter(build, opts)
    combat.ts       # createFight / stepFight / runToEnd  (port gauntlet sim loop)
    index.ts        # engine public API barrel
  index.ts          # top-level barrel
tools/
  sim-runner.ts     # headless fight -> UA combat log; `npm run sim`
app/
  index.html · main.ts   # empty Pixi canvas shell (proves toolchain; no game)
tests/
  rng.test.ts · events.test.ts · detectors.test.ts · derive.test.ts
  combat.test.ts · determinism.test.ts · purity.test.ts · runner.test.ts
```

---

## Task 0: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `.gitignore`, `app/index.html`, `app/main.ts`, `README.md`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "pockethero",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "sim": "tsx tools/sim-runner.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "pixi.js": "^8.6.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vite": "^6.0.0",
    "vitest": "^2.1.0",
    "tsx": "^4.19.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["src", "tools", "app", "tests"]
}
```

- [ ] **Step 3: Create `vite.config.ts`** (root is `app/`, build to `dist/`)

```ts
import { defineConfig } from 'vite';
export default defineConfig({
  root: 'app',
  build: { outDir: '../dist', emptyOutDir: true },
});
```

- [ ] **Step 4: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
```

- [ ] **Step 5: Create `.gitignore`**

```
node_modules/
dist/
*.log
.DS_Store
# transient headless-render screenshots
_*.png
_*.log
```

- [ ] **Step 6: Create `app/index.html`**

```html
<!doctype html>
<html lang="uk">
<head><meta charset="utf-8"><title>PocketHero</title>
<style>html,body{margin:0;height:100%;background:#070a0f}canvas{display:block}</style>
</head>
<body><script type="module" src="./main.ts"></script></body>
</html>
```

- [ ] **Step 7: Create `app/main.ts`** (empty Pixi shell — proves the toolchain only)

```ts
import { Application } from 'pixi.js';

const app = new Application();
await app.init({ background: '#070a0f', resizeTo: window, antialias: true });
document.body.appendChild(app.canvas);
// Slice 2 mounts the 2.5D billboard renderer here. No game rendering yet.
console.log('PocketHero shell ready — engine lives in src/sim, see `npm run sim`.');
```

- [ ] **Step 8: Create `README.md`**

```markdown
# PocketHero

Web idle pixel-creature autobattler. Production rebuild (Slice 1 = engine + data).

- `npm install`
- `npm test` — engine unit tests (determinism + sim-purity included)
- `npm run sim` — headless fight, prints the combat log
- `npm run dev` — empty Pixi shell (Slice 2 adds the renderer)

`poc/` holds the validated vanilla-canvas prototypes (reference spec).
Design: `docs/2026-06-05-pockethero-production-foundation.md`.
```

- [ ] **Step 9: Install and verify the toolchain**

Run: `npm install`
Then: `npm run typecheck`
Expected: install succeeds; `tsc --noEmit` exits 0 (no source files yet → no errors).

- [ ] **Step 10: Commit**

```bash
git add package.json tsconfig.json vite.config.ts vitest.config.ts .gitignore app README.md
git commit -m "chore: production scaffold (Vite+TS+Pixi+Vitest)"
```

---

## Task 1: Seeded RNG (`src/sim/rng.ts`)

**Files:**
- Create: `src/sim/rng.ts`, `tests/rng.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/rng.test.ts
import { describe, it, expect } from 'vitest';
import { makeRng } from '../src/sim/rng';

describe('makeRng', () => {
  it('is deterministic for a fixed seed', () => {
    const a = makeRng(1337), b = makeRng(1337);
    const seqA = Array.from({ length: 5 }, () => a.next());
    const seqB = Array.from({ length: 5 }, () => b.next());
    expect(seqA).toEqual(seqB);
    expect(seqA[0]).toBeGreaterThanOrEqual(0);
    expect(seqA[0]).toBeLessThan(1);
  });
  it('different seeds diverge', () => {
    expect(makeRng(1).next()).not.toEqual(makeRng(2).next());
  });
  it('clone resumes the exact stream', () => {
    const r = makeRng(42); r.next(); r.next();
    const c = r.clone();
    expect(c.next()).toEqual(r.next());
  });
  it('pick and range respect bounds', () => {
    const r = makeRng(7);
    expect(['x', 'y']).toContain(r.pick(['x', 'y']));
    const v = r.range(2, 5);
    expect(v).toBeGreaterThanOrEqual(2);
    expect(v).toBeLessThan(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/rng.test.ts`
Expected: FAIL — cannot resolve `../src/sim/rng`.

- [ ] **Step 3: Write the implementation** (Mulberry32 from `poc/builder.html:146-164`)

```ts
// src/sim/rng.ts
export interface Rng {
  /** float in [0,1) */
  next(): number;
  /** int in [lo, hi) */
  range(lo: number, hi: number): number;
  /** uniform element */
  pick<T>(arr: readonly T[]): T;
  /** independent copy resuming the same stream (for snapshots) */
  clone(): Rng;
  /** raw 32-bit state, for serialisation */
  state(): number;
}

export function makeRng(seed: number): Rng {
  let a = seed | 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng: Rng = {
    next,
    range: (lo, hi) => lo + Math.floor(next() * (hi - lo)),
    pick: (arr) => arr[Math.floor(next() * arr.length)]!,
    clone: () => makeRng(a),
    state: () => a,
  };
  return rng;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/rng.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/sim/rng.ts tests/rng.test.ts
git commit -m "feat(sim): seeded Mulberry32 RNG"
```

---

## Task 2: Event bus + event types (`src/sim/events.ts`)

**Files:**
- Create: `src/sim/events.ts`, `tests/events.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/events.test.ts
import { describe, it, expect } from 'vitest';
import { makeBus } from '../src/sim/events';

describe('makeBus', () => {
  it('collects emitted events in order and drains them', () => {
    const bus = makeBus();
    bus.emit({ type: 'move-start', actor: 'hero', move: 'slice', t: 0 });
    bus.emit({ type: 'hit', source: 'hero', target: 'enemy', amount: 6, crit: false, t: 0.1 });
    const drained = bus.drain();
    expect(drained).toHaveLength(2);
    expect(drained[0]!.type).toBe('move-start');
    expect(bus.drain()).toHaveLength(0); // drain empties the buffer
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/events.test.ts`
Expected: FAIL — cannot resolve `events`.

- [ ] **Step 3: Write the implementation**

```ts
// src/sim/events.ts
export type CombatEvent =
  | { type: 'move-start'; actor: string; move: string; t: number }
  | { type: 'hit'; source: string; target: string; amount: number; crit: boolean; school?: string; t: number }
  | { type: 'block'; target: string; t: number }
  | { type: 'dodge'; target: string; t: number }
  | { type: 'status-applied'; target: string; status: string; t: number }
  | { type: 'status-tick'; target: string; status: string; amount: number; t: number }
  | { type: 'heal'; target: string; amount: number; t: number }
  | { type: 'ko'; target: string; t: number };

export interface EventBus {
  emit(e: CombatEvent): void;
  /** returns buffered events and clears the buffer */
  drain(): CombatEvent[];
}

export function makeBus(): EventBus {
  let buf: CombatEvent[] = [];
  return {
    emit: (e) => { buf.push(e); },
    drain: () => { const out = buf; buf = []; return out; },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/events.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sim/events.ts tests/events.test.ts
git commit -m "feat(sim): synchronous typed event bus"
```

---

## Task 3: Content types + schools + cube registry (`src/data/`)

**Files:**
- Create: `src/data/types.ts`, `src/data/schools.ts`, `src/data/cubes.ts`
- Reference: `poc/builder.html:166-262` (CAT, CUBES, PIX, derived) and `:286-313` (STATUS_DEF schools)

- [ ] **Step 1: Write `src/data/types.ts`** (locks the content vocabulary used everywhere)

```ts
// src/data/types.ts
export type Category = 'body' | 'attack' | 'defense' | 'agility' | 'magic' | 'special';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface Cube {
  id: string;          // e.g. 'red', 'arcana', 'core'
  name: string;        // UA display name
  cat: Category;
  rarity: Rarity;
  cost: number;        // budget cost (◆)
  glyph: string;       // glyph key for the legibility layer
  eff: string;         // UA one-line effect description
  col: string;         // base swatch colour
  tint: string;        // glyph tint
}

export interface Move {
  id: string;
  name: string;        // UA
  weight: number;      // pick weight
  school: string;      // schools.ts key
  // resolution hooks (port exact fields from poc MOVES :264-285)
  power?: number;
  reach?: number;
  status?: string;     // status id this move can apply
}

export interface SynergyDef { key: string; name: string; /* + detection params, port :315-335 */ }
export interface ShapeDef   { key: string; name: string; /* + cells/pattern, port :378-452 */ }
```

- [ ] **Step 2: Write the failing test for cubes**

```ts
// tests/derive.test.ts  (start the file; more added in later tasks)
import { describe, it, expect } from 'vitest';
import { CUBES, CUBE_IDS } from '../src/data/cubes';

describe('cube registry', () => {
  it('has the full roster with valid fields', () => {
    expect(CUBE_IDS.length).toBeGreaterThanOrEqual(20); // ~22 in the POC
    for (const id of CUBE_IDS) {
      const c = CUBES[id]!;
      expect(c.id).toBe(id);
      expect(c.cost).toBeGreaterThanOrEqual(0);
      expect(['body','attack','defense','agility','magic','special']).toContain(c.cat);
      expect(['common','rare','epic','legendary']).toContain(c.rarity);
      expect(c.name.length).toBeGreaterThan(0);
    }
  });
  it('includes the special core cube', () => {
    expect(CUBES['core']).toBeDefined();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/derive.test.ts`
Expected: FAIL — cannot resolve `cubes`.

- [ ] **Step 4: Write `src/data/schools.ts`** (port the school list referenced by STATUS_DEF / MOVES; keep ids stable)

```ts
// src/data/schools.ts
// Damage/effect schools used by moves and statuses. Port the set used in
// poc/builder.html MOVES (:264-285) and STATUS_DEF (:286-313).
export const SCHOOLS = ['phys', 'fire', 'frost', 'shock', 'arcane'] as const;
export type School = (typeof SCHOOLS)[number];
```

- [ ] **Step 5: Write `src/data/cubes.ts`** — port the registry verbatim

Open `poc/builder.html:166-262`. Port `CUBES` (and the fields `PIX` adds) into the `Cube` shape above. Include `core`. Example of the target shape (fill ALL ~22 from the POC — do not invent values):

```ts
// src/data/cubes.ts
import type { Cube } from './types';

export const CUBES: Record<string, Cube> = {
  core:  { id: 'core',  name: 'Ядро',     cat: 'body',   rarity: 'common', cost: 0, glyph: 'core',  eff: 'основа героя', col: '#d9c46a', tint: '#fff3c0' },
  red:   { id: 'red',   name: 'Лють',     cat: 'attack', rarity: 'common', cost: 3, glyph: 'blade', eff: '+атака зі зниженням HP', col: '#E0483F', tint: '#ffd0cc' },
  // ... port every remaining cube from poc/builder.html:177-216 (names/cat/rarity/cost/glyph/eff/col/tint)
};

export const CUBE_IDS = Object.keys(CUBES);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/derive.test.ts`
Expected: PASS (cube registry block).

- [ ] **Step 7: Commit**

```bash
git add src/data/types.ts src/data/schools.ts src/data/cubes.ts tests/derive.test.ts
git commit -m "feat(data): content types, schools, cube registry (ported)"
```

---

## Task 4: Moves + traits registries (`src/data/moves.ts`, `src/data/traits.ts`)

**Files:**
- Create: `src/data/moves.ts`, `src/data/traits.ts`
- Reference: `poc/builder.html:264-285` (MOVES), `:315-335` (SYNERGY_DEFS), `:378-452` (SHAPE_DEFS)

- [ ] **Step 1: Write the failing test** (append to `tests/derive.test.ts`)

```ts
import { MOVES, MOVE_IDS } from '../src/data/moves';
import { SYNERGY_DEFS, SHAPE_DEFS } from '../src/data/traits';

describe('moves & traits registries', () => {
  it('moves have a school and positive weight', () => {
    expect(MOVE_IDS.length).toBeGreaterThan(0);
    for (const id of MOVE_IDS) {
      const m = MOVES[id]!;
      expect(m.weight).toBeGreaterThan(0);
      expect(m.school.length).toBeGreaterThan(0);
    }
  });
  it('trait defs have unique keys', () => {
    const keys = [...SYNERGY_DEFS, ...SHAPE_DEFS].map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.length).toBeGreaterThanOrEqual(8); // 5 synergies + 4 shapes in POC
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/derive.test.ts`
Expected: FAIL — cannot resolve `moves`/`traits`.

- [ ] **Step 3: Write `src/data/moves.ts`** — port `MOVES` from `poc/builder.html:264-285`

```ts
// src/data/moves.ts
import type { Move } from './types';
// Port each entry from poc/builder.html MOVES (:264-285): id, UA name, weight,
// school, and resolution fields (power/reach/status). Keep ids stable.
export const MOVES: Record<string, Move> = {
  // slice: { id: 'slice', name: 'Розсічення', weight: 3, school: 'phys', power: 6 },
  // ... port all moves
};
export const MOVE_IDS = Object.keys(MOVES);
```

- [ ] **Step 4: Write `src/data/traits.ts`** — port `SYNERGY_DEFS` + `SHAPE_DEFS`

```ts
// src/data/traits.ts
import type { SynergyDef, ShapeDef } from './types';
// Port poc/builder.html:315-335 (SYNERGY_DEFS: Лезо/Форпост/Розпал/Потік/Підсилення)
// and :378-452 (SHAPE_DEFS: Шип/Бастіон/Серце/Рівновага). Preserve key + name +
// every detection parameter the detectors read.
export const SYNERGY_DEFS: SynergyDef[] = [
  // { key: 'edge', name: 'Лезо', /* params */ },
];
export const SHAPE_DEFS: ShapeDef[] = [
  // { key: 'spike', name: 'Шип', /* cells/pattern */ },
];
```

> Note: when porting, extend the `SynergyDef`/`ShapeDef` interfaces in `data/types.ts` with the exact parameter fields the POC detectors use, so the detector port (Task 5) compiles against real types — not `any`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/derive.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/data/moves.ts src/data/traits.ts src/data/types.ts tests/derive.test.ts
git commit -m "feat(data): move + trait (synergy/shape) registries (ported)"
```

---

## Task 5: Detectors (`src/derive/detectors.ts`) — port the POC self-tests

**Files:**
- Create: `src/derive/types.ts`, `src/derive/detectors.ts`, `tests/detectors.test.ts`
- Reference: detectors `poc/builder.html:336-473`; **self-tests `poc/builder.html:2957-3037`** (the 38 PASS suite)

- [ ] **Step 1: Write `src/derive/types.ts`**

```ts
// src/derive/types.ts
export interface PlacedCube { gx: number; gy: number; type: string } // type = Cube id; 'core' special
export type Build = PlacedCube[];
export interface Trait { key: string; name: string }                  // detected synergy/shape
```

- [ ] **Step 2: Write the failing tests** — port the detector assertions from the POC self-test block

Open `poc/builder.html:2957-3037`. Each `test(...)`/assertion there that exercises `detectSynergies`, `detectShapes`, or `detectTraits` becomes one Vitest `it(...)`. Port them verbatim (same builds, same expected trait keys). Seed example (replace with the real cases):

```ts
// tests/detectors.test.ts
import { describe, it, expect } from 'vitest';
import { detectSynergies, detectShapes, detectTraits } from '../src/derive/detectors';
import type { Build } from '../src/derive/types';

const core: Build = [{ gx: 0, gy: 0, type: 'core' }];

describe('detectors (ported from poc self-tests)', () => {
  it('bare core has no synergies/shapes', () => {
    expect(detectSynergies(core)).toEqual([]);
    expect(detectShapes(core)).toEqual([]);
  });
  // PORT each detector-related case from poc/builder.html:2957-3037 here,
  // one it() per assertion, preserving the build + expected keys exactly.
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/detectors.test.ts`
Expected: FAIL — cannot resolve `detectors`.

- [ ] **Step 4: Port `src/derive/detectors.ts`** from `poc/builder.html:336-473`

Port `detectSynergies` (:336-377), `detectShapes` (:453-467), and `detectTraits` (:468-473) to TypeScript against `Build`/`Trait`/`SYNERGY_DEFS`/`SHAPE_DEFS`. Keep algorithm and return shape identical (arrays of `{ key, name }`). Import the defs from `../data/traits`.

```ts
// src/derive/detectors.ts
import type { Build, Trait } from './types';
import { SYNERGY_DEFS, SHAPE_DEFS } from '../data/traits';

export function detectSynergies(build: Build): Trait[] { /* port :336-377 */ }
export function detectShapes(build: Build): Trait[] { /* port :453-467 */ }
export function detectTraits(build: Build): Trait[] { /* port :468-473 (synergies + shapes) */ }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/detectors.test.ts`
Expected: PASS (all ported detector cases).

- [ ] **Step 6: Commit**

```bash
git add src/derive/types.ts src/derive/detectors.ts tests/detectors.test.ts
git commit -m "feat(derive): adjacency + shape detectors (ported, self-tests green)"
```

---

## Task 6: deriveStats + deriveMoveset (`src/derive/`)

**Files:**
- Create: `src/derive/deriveStats.ts`, `src/derive/deriveMoveset.ts`
- Modify: `tests/derive.test.ts`
- Reference: `poc/builder.html:231-262` (STAT base table), `:475-557` (deriveStats), `:558-571` (deriveMoveset); anchors from the POC self-tests `:2999` (TITAN_BUILD stats)

- [ ] **Step 1: Write the failing test** (append to `tests/derive.test.ts`)

```ts
import { deriveStats } from '../src/derive/deriveStats';
import { deriveMoveset } from '../src/derive/deriveMoveset';
import type { Build } from '../src/derive/types';

describe('deriveStats / deriveMoveset', () => {
  const core: Build = [{ gx: 0, gy: 0, type: 'core' }];
  it('bare core yields the base stat block', () => {
    const s = deriveStats(core);
    expect(s.maxHP).toBeGreaterThan(0);
    expect(s.atk).toBeGreaterThanOrEqual(0);
    expect(s.speed).toBeGreaterThan(0);
    // traitDelta/cubeDelta present for the «Детально» breakdown
    expect(s.traitDelta).toBeDefined();
    expect(s.cubeDelta).toBeDefined();
  });
  it('moveset always contains the basic move', () => {
    expect(deriveMoveset(core).length).toBeGreaterThan(0);
  });
  // PORT the TITAN_BUILD stat assertions from poc/builder.html:2999 here
  // (exact expected maxHP/atk/etc.) as the golden anchor.
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/derive.test.ts`
Expected: FAIL — cannot resolve `deriveStats`.

- [ ] **Step 3: Write `src/derive/deriveStats.ts`** (port STAT table :231-262 + deriveStats :475-557)

```ts
// src/derive/deriveStats.ts
import type { Build } from './types';
import { CUBES } from '../data/cubes';
import { detectTraits } from './detectors';

export interface Stats {
  maxHP: number; atk: number; armor: number; speed: number; crit: number; magic: number;
  dodge: number; acc: number; blockChance: number; regenPerSec: number; lifesteal: number;
  pierce: number; magResist: number; haste: number; thorns: number; berserk: number;
  traitDelta: Record<string, string>; // per-trait contribution (for the breakdown UI)
  cubeDelta: Record<string, string>;  // per-cube contribution
}

// Port the base table (poc :231-262) and the folding logic (poc :475-557):
// start from base, add each cube's stat contribution, then apply detected traits.
export function deriveStats(build: Build): Stats { /* port :475-557 */ }
```

- [ ] **Step 4: Write `src/derive/deriveMoveset.ts`** (port :558-571)

```ts
// src/derive/deriveMoveset.ts
import type { Build } from './types';
import { MOVES } from '../data/moves';
// Port poc/builder.html:558-571: derive the list of move ids a build can use,
// bound to its cube types (attack types -> moves).
export function deriveMoveset(build: Build): string[] { /* port :558-571 */ }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/derive.test.ts`
Expected: PASS (including the ported TITAN anchor).

- [ ] **Step 6: Commit**

```bash
git add src/derive/deriveStats.ts src/derive/deriveMoveset.ts tests/derive.test.ts
git commit -m "feat(derive): deriveStats + deriveMoveset (ported, TITAN anchor green)"
```

---

## Task 7: Preset builds (`src/builds/presets.ts`)

**Files:**
- Create: `src/builds/presets.ts`, append to `tests/derive.test.ts`
- Reference: `poc/builder.html:573-633` (B() helper, HERO/BRUTE/MAGE/TITAN builds, PRESETS)

- [ ] **Step 1: Write the failing test**

```ts
import { PRESETS, PRESET_IDS } from '../src/builds/presets';
import { deriveStats } from '../src/derive/deriveStats';

describe('presets', () => {
  it('exposes the four playable builds, each a valid build with a core', () => {
    expect(PRESET_IDS).toEqual(expect.arrayContaining(['hero', 'brute', 'mage', 'titan']));
    for (const id of PRESET_IDS) {
      const b = PRESETS[id]!.build;
      expect(b.some((p) => p.type === 'core')).toBe(true);
      expect(deriveStats(b).maxHP).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/derive.test.ts`
Expected: FAIL — cannot resolve `presets`.

- [ ] **Step 3: Write `src/builds/presets.ts`** (port the `B()` helper and the four builds from `poc/builder.html:573-633`)

```ts
// src/builds/presets.ts
import type { Build } from '../derive/types';

/** B(): build-from-rows helper, ported from poc/builder.html:~570. */
function B(/* same signature as POC */): Build { /* port */ }

export const HERO_BUILD: Build  = B(/* port :573-582 */);
export const BRUTE_BUILD: Build = B(/* port :583-594 */);
export const MAGE_BUILD: Build  = B(/* port :595-604 */);
export const TITAN_BUILD: Build = B(/* port :605-629 */);

export const PRESETS: Record<string, { name: string; build: Build }> = {
  hero:  { name: '«Піксель» (Герой)', build: HERO_BUILD },
  mage:  { name: '«Чаклун» (Маг)',    build: MAGE_BUILD },
  brute: { name: '«Громило»',         build: BRUTE_BUILD },
  titan: { name: '«Титан» (великий)', build: TITAN_BUILD },
};
export const PRESET_IDS = Object.keys(PRESETS);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/derive.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/builds/presets.ts tests/derive.test.ts
git commit -m "feat(builds): preset builds Hero/Brute/Mage/Titan (ported)"
```

---

## Task 8: Statuses + Fighter (`src/sim/status.ts`, `src/sim/fighter.ts`, `src/sim/types.ts`)

**Files:**
- Create: `src/sim/types.ts`, `src/sim/status.ts`, `src/sim/fighter.ts`, `tests/combat.test.ts` (start)
- Reference: statuses + fighter construction in `poc/gauntlet.html` (Burn/Slow/Shock; `makeFighter`), cross-checked with `poc/builder.html:286-313` STATUS_DEF

- [ ] **Step 1: Write `src/sim/types.ts`**

```ts
// src/sim/types.ts
import type { Stats } from '../derive/deriveStats';

export interface StatusInstance { id: string; remaining: number; magnitude: number }

export interface Fighter {
  id: string;
  name: string;
  side: -1 | 1;
  stats: Stats;
  moveset: string[];
  hp: number;
  atb: number;          // 0..1 action gauge
  moveCursor: number;
  statuses: StatusInstance[];
  alive: boolean;
}

export interface FightState {
  fighters: [Fighter, Fighter];
  t: number;            // accumulated sim time (fixed-step)
  phase: 'fight' | 'done';
  winner: string | null;
}
```

- [ ] **Step 2: Write the failing test** (`tests/combat.test.ts`)

```ts
// tests/combat.test.ts
import { describe, it, expect } from 'vitest';
import { makeFighter } from '../src/sim/fighter';
import { applyStatus, tickStatuses } from '../src/sim/status';
import { makeBus } from '../src/sim/events';
import { HERO_BUILD } from '../src/builds/presets';

describe('fighter + status', () => {
  it('builds a fighter from a build', () => {
    const f = makeFighter('hero', 'Герой', -1, HERO_BUILD);
    expect(f.hp).toBe(f.stats.maxHP);
    expect(f.alive).toBe(true);
    expect(f.moveset.length).toBeGreaterThan(0);
  });
  it('burn ticks damage over time and expires', () => {
    const f = makeFighter('hero', 'Герой', -1, HERO_BUILD);
    const bus = makeBus();
    applyStatus(f, 'burn', 2, 3, bus);   // id, duration, magnitude
    const hp0 = f.hp;
    tickStatuses(f, 1, bus);             // 1s
    expect(f.hp).toBeLessThan(hp0);
    expect(bus.drain().some((e) => e.type === 'status-tick')).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/combat.test.ts`
Expected: FAIL — cannot resolve `fighter`/`status`.

- [ ] **Step 4: Write `src/sim/status.ts`** (port Burn/Slow/Shock from `poc/gauntlet.html`)

```ts
// src/sim/status.ts
import type { Fighter } from './types';
import type { EventBus } from './events';

// Status registry: how each status ticks/modifies. Port Burn (DoT), Slow
// (speed multiplier), Shock (from Іскра/Розряд) from poc/gauntlet.html.
export function applyStatus(f: Fighter, id: string, duration: number, magnitude: number, bus: EventBus): void { /* port */ }
export function tickStatuses(f: Fighter, dt: number, bus: EventBus): void { /* port: tick DoT, decrement remaining, drop expired */ }
export function speedMult(f: Fighter): number { /* port: product of Slow etc. */ return 1; }
```

- [ ] **Step 5: Write `src/sim/fighter.ts`**

```ts
// src/sim/fighter.ts
import type { Build } from '../derive/types';
import type { Fighter } from './types';
import { deriveStats } from '../derive/deriveStats';
import { deriveMoveset } from '../derive/deriveMoveset';

export function makeFighter(id: string, name: string, side: -1 | 1, build: Build): Fighter {
  const stats = deriveStats(build);
  return {
    id, name, side, stats,
    moveset: deriveMoveset(build),
    hp: stats.maxHP, atb: side < 0 ? 0.1 : 0, moveCursor: side < 0 ? 0 : 1,
    statuses: [], alive: true,
  };
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/combat.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/sim/types.ts src/sim/status.ts src/sim/fighter.ts tests/combat.test.ts
git commit -m "feat(sim): statuses (Burn/Slow/Shock) + fighter construction"
```

---

## Task 9: Combat loop (`src/sim/combat.ts`, `src/sim/index.ts`)

**Files:**
- Create: `src/sim/combat.ts`, `src/sim/index.ts`, append to `tests/combat.test.ts`
- Reference: ATB loop + move resolution in `poc/gauntlet.html` (pickMove, resolution: crit/block/dodge/pierce/lifesteal/thorns/magResist), and `poc/builder.html:803-814` pickMove

- [ ] **Step 1: Write the failing test** (append to `tests/combat.test.ts`)

```ts
import { createFight, stepFight, runToEnd } from '../src/sim/index';
import { makeBus } from '../src/sim/events';
import { makeRng } from '../src/sim/rng';
import { HERO_BUILD, BRUTE_BUILD } from '../src/builds/presets';

describe('combat loop', () => {
  it('runs a fight to a decisive K.O. within a bounded number of steps', () => {
    const bus = makeBus();
    const rng = makeRng(1337);
    const state = createFight(
      { id: 'a', name: 'Герой', side: -1, build: HERO_BUILD },
      { id: 'b', name: 'Громило', side: 1, build: BRUTE_BUILD },
    );
    const result = runToEnd(state, rng, bus, { maxSteps: 60 * 120 }); // ≤120s @60Hz
    expect(result.phase).toBe('done');
    expect(result.winner).not.toBeNull();
    expect(bus.drain().some((e) => e.type === 'ko')).toBe(true);
  });
  it('a single fixed step advances time by exactly DT', () => {
    const bus = makeBus();
    const rng = makeRng(1);
    const s = createFight(
      { id: 'a', name: 'A', side: -1, build: HERO_BUILD },
      { id: 'b', name: 'B', side: 1, build: HERO_BUILD },
    );
    const t0 = s.t;
    stepFight(s, rng, bus);
    expect(s.t).toBeCloseTo(t0 + 1 / 60, 6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/combat.test.ts`
Expected: FAIL — cannot resolve `../src/sim/index`.

- [ ] **Step 3: Write `src/sim/combat.ts`** (fixed-step ATB; port resolution from gauntlet)

```ts
// src/sim/combat.ts
import type { Fighter, FightState } from './types';
import type { EventBus } from './events';
import type { Rng } from './rng';
import type { Build } from '../derive/types';
import { makeFighter } from './fighter';
import { MOVES } from '../data/moves';
import { tickStatuses, speedMult, applyStatus } from './status';

export const DT = 1 / 60; // fixed logical timestep — see design P2

export interface FighterSpec { id: string; name: string; side: -1 | 1; build: Build }

export function createFight(a: FighterSpec, b: FighterSpec): FightState {
  return {
    fighters: [makeFighter(a.id, a.name, a.side, a.build), makeFighter(b.id, b.name, b.side, b.build)],
    t: 0, phase: 'fight', winner: null,
  };
}

function pickMove(f: Fighter, rng: Rng): string { /* port poc pickMove (weighted, cursor bias) */ }
function resolveMove(src: Fighter, tgt: Fighter, moveId: string, rng: Rng, bus: EventBus, t: number): void {
  /* port gauntlet resolution: dodge -> block -> crit -> pierce/armor -> damage,
     then lifesteal/thorns/magResist + status application; emit events. */
}

/** Advance exactly one fixed step. */
export function stepFight(s: FightState, rng: Rng, bus: EventBus): void {
  if (s.phase === 'done') return;
  s.t += DT;
  for (const f of s.fighters) {
    if (!f.alive) continue;
    tickStatuses(f, DT, bus);
    if (f.hp <= 0) { f.alive = false; bus.emit({ type: 'ko', target: f.id, t: s.t }); }
  }
  for (const f of s.fighters) {
    if (!f.alive || s.phase === 'done') continue;
    f.atb += f.stats.speed * speedMult(f) * DT;
    if (f.atb >= 1) {
      f.atb -= 1;
      const tgt = s.fighters.find((o) => o !== f)!;
      if (tgt.alive) {
        const mv = pickMove(f, rng);
        bus.emit({ type: 'move-start', actor: f.id, move: mv, t: s.t });
        resolveMove(f, tgt, mv, rng, bus, s.t);
        if (tgt.hp <= 0) { tgt.alive = false; bus.emit({ type: 'ko', target: tgt.id, t: s.t }); }
      }
    }
  }
  const dead = s.fighters.find((f) => !f.alive);
  if (dead) { s.phase = 'done'; s.winner = s.fighters.find((f) => f.alive)?.id ?? null; }
}

export function runToEnd(s: FightState, rng: Rng, bus: EventBus, opts: { maxSteps: number }): FightState {
  for (let i = 0; i < opts.maxSteps && s.phase === 'fight'; i++) stepFight(s, rng, bus);
  return s;
}
```

- [ ] **Step 4: Write `src/sim/index.ts`** (engine public API barrel)

```ts
// src/sim/index.ts
export { createFight, stepFight, runToEnd, DT } from './combat';
export type { FighterSpec } from './combat';
export { makeRng } from './rng';
export type { Rng } from './rng';
export { makeBus } from './events';
export type { CombatEvent, EventBus } from './events';
export type { Fighter, FightState, StatusInstance } from './types';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/combat.test.ts`
Expected: PASS. If a preset matchup stalls (known Бастіон risk), the `maxSteps` guard fails the test loudly — fix the resolution port (block cap) rather than raising the bound.

- [ ] **Step 6: Commit**

```bash
git add src/sim/combat.ts src/sim/index.ts tests/combat.test.ts
git commit -m "feat(sim): fixed-step ATB combat loop + resolution (ported)"
```

---

## Task 10: Determinism + sim-purity tests

**Files:**
- Create: `tests/determinism.test.ts`, `tests/purity.test.ts`

- [ ] **Step 1: Write the determinism test**

```ts
// tests/determinism.test.ts
import { describe, it, expect } from 'vitest';
import { createFight, runToEnd, makeRng, makeBus } from '../src/sim/index';
import { HERO_BUILD, BRUTE_BUILD } from '../src/builds/presets';

function logFor(seed: number): string {
  const bus = makeBus();
  const s = createFight(
    { id: 'a', name: 'A', side: -1, build: HERO_BUILD },
    { id: 'b', name: 'B', side: 1, build: BRUTE_BUILD },
  );
  runToEnd(s, makeRng(seed), bus, { maxSteps: 60 * 120 });
  return JSON.stringify(bus.drain());
}

describe('determinism', () => {
  it('same seed ⇒ identical event log', () => {
    expect(logFor(1337)).toBe(logFor(1337));
  });
  it('different seeds ⇒ different log', () => {
    expect(logFor(1)).not.toBe(logFor(2));
  });
});
```

- [ ] **Step 2: Write the sim-purity test** (static import scan — enforces design P5)

```ts
// tests/purity.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
  });
}

describe('sim/ purity (no Pixi / no DOM)', () => {
  it('src/sim imports nothing from pixi.js or the DOM', () => {
    const offenders: string[] = [];
    for (const file of walk('src/sim')) {
      const src = readFileSync(file, 'utf8');
      if (/from\s+['"]pixi\.js['"]/.test(src)) offenders.push(`${file}: imports pixi.js`);
      if (/\b(document|window)\b/.test(src)) offenders.push(`${file}: references DOM global`);
    }
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 3: Run both tests to verify they pass**

Run: `npx vitest run tests/determinism.test.ts tests/purity.test.ts`
Expected: PASS. (If purity fails, move the offending import out of `sim/` into a consumer.)

- [ ] **Step 4: Commit**

```bash
git add tests/determinism.test.ts tests/purity.test.ts
git commit -m "test(sim): determinism + sim-purity guards (design P1/P5)"
```

---

## Task 11: Headless sim runner (`tools/sim-runner.ts`)

**Files:**
- Create: `tools/sim-runner.ts`, `tests/runner.test.ts`
- Reference: UA combat-log formatting in `poc/gauntlet.html` / `poc/combat-prototype.html`

- [ ] **Step 1: Write the failing test**

```ts
// tests/runner.test.ts
import { describe, it, expect } from 'vitest';
import { fightLog } from '../tools/sim-runner';

describe('sim runner', () => {
  it('produces a non-empty UA combat log ending in a K.O. line', () => {
    const lines = fightLog('hero', 'brute', 1337);
    expect(lines.length).toBeGreaterThan(3);
    expect(lines.join('\n')).toMatch(/K\.O\.|Перемога|переміг/i);
  });
  it('is deterministic for a fixed seed', () => {
    expect(fightLog('hero', 'brute', 7)).toEqual(fightLog('hero', 'brute', 7));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/runner.test.ts`
Expected: FAIL — cannot resolve `sim-runner`.

- [ ] **Step 3: Write `tools/sim-runner.ts`**

```ts
// tools/sim-runner.ts
import { createFight, runToEnd, makeRng, makeBus } from '../src/sim/index';
import type { CombatEvent } from '../src/sim/index';
import { PRESETS } from '../src/builds/presets';

function fmt(e: CombatEvent, nameOf: (id: string) => string): string | null {
  switch (e.type) {
    case 'move-start':     return `${nameOf(e.actor)} → ${e.move}`;
    case 'hit':            return `  ${nameOf(e.source)} б'є ${nameOf(e.target)} на ${e.amount}${e.crit ? ' ✦КРИТ' : ''}`;
    case 'block':          return `  ${nameOf(e.target)} блокує`;
    case 'dodge':          return `  ${nameOf(e.target)} ухиляється`;
    case 'status-applied': return `  ${nameOf(e.target)}: ${e.status}`;
    case 'status-tick':    return `  ${nameOf(e.target)} втрачає ${e.amount} (${e.status})`;
    case 'heal':           return `  ${nameOf(e.target)} +${e.amount} HP`;
    case 'ko':             return `K.O. — ${nameOf(e.target)} переможено`;
    default:               return null;
  }
}

export function fightLog(aId: string, bId: string, seed: number): string[] {
  const a = PRESETS[aId]!, b = PRESETS[bId]!;
  const names: Record<string, string> = { a: a.name, b: b.name };
  const nameOf = (id: string) => names[id] ?? id;
  const bus = makeBus();
  const s = createFight(
    { id: 'a', name: a.name, side: -1, build: a.build },
    { id: 'b', name: b.name, side: 1, build: b.build },
  );
  runToEnd(s, makeRng(seed), bus, { maxSteps: 60 * 120 });
  return bus.drain().map((e) => fmt(e, nameOf)).filter((l): l is string => l !== null);
}

// CLI: `npm run sim` (optionally `npm run sim -- hero mage 42`)
const [aId = 'hero', bId = 'brute', seedStr = '1337'] = process.argv.slice(2);
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`PocketHero — ${PRESETS[aId]?.name} vs ${PRESETS[bId]?.name} (seed ${seedStr})\n`);
  console.log(fightLog(aId, bId, Number(seedStr)).join('\n'));
}
```

- [ ] **Step 4: Run test + the CLI to verify**

Run: `npx vitest run tests/runner.test.ts`
Expected: PASS.
Run: `npm run sim`
Expected: prints a readable UA fight log ending in a `K.O.` line. Eyeball it against `poc/gauntlet.html` for parity.

- [ ] **Step 5: Commit**

```bash
git add tools/sim-runner.ts tests/runner.test.ts
git commit -m "feat(tools): headless sim runner -> UA combat log"
```

---

## Task 12: Top-level barrel + full-suite gate + app-shell smoke

**Files:**
- Create: `src/index.ts`
- Verify: whole suite + `npm run build`

- [ ] **Step 1: Write `src/index.ts`** (top-level public API)

```ts
// src/index.ts
export * from './sim/index';
export { PRESETS, PRESET_IDS } from './builds/presets';
export { CUBES, CUBE_IDS } from './data/cubes';
export { deriveStats } from './derive/deriveStats';
export type { Stats } from './derive/deriveStats';
export { deriveMoveset } from './derive/deriveMoveset';
export type { Build, PlacedCube, Trait } from './derive/types';
```

- [ ] **Step 2: Run the FULL test suite**

Run: `npm test`
Expected: PASS — all files: rng, events, derive (cubes/moves/traits/stats/moveset/presets), detectors (≥ the ported POC self-tests), combat, determinism, purity, runner.

- [ ] **Step 3: Typecheck + build the app shell**

Run: `npm run build`
Expected: `tsc --noEmit` clean AND Vite builds `app/` to `dist/` (empty Pixi canvas). This proves Slice 2 starts frictionless.

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: top-level engine barrel; Slice 1 foundation complete"
```

- [ ] **Step 5: Push**

```bash
git push origin main
```

---

## Self-Review (completed by author)

**Spec coverage:**
- §3 Stack → Task 0. §4 P1 determinism → Tasks 1, 10. §4 P2 fixed timestep → Task 9 (DT, step test). §4 P3 events → Tasks 2, 9, 11. §4 P4 data-driven → Tasks 3–4. §4 P5 sim-purity → Task 10.
- §5 modules → every module has a creating task. §6 testing (ported 38 self-tests → Task 5/6; determinism → Task 10; purity → Task 10; balance smoke/stall guard → Task 9) all covered.
- §2 DoD: (1) `npm test` green incl. determinism+purity → Task 12 Step 2 + Task 10; (2) `npm run sim` → Task 11; (3) `npm run dev/build` shell → Task 0 + Task 12 Step 3.

**Placeholder scan:** Content-port steps name an exact POC file + line range and the locking test, with concrete target types/signatures — these are translation tasks against existing, cited code, not open-ended TODOs. All scaffolding/plumbing steps contain complete code.

**Type consistency:** `Build`/`PlacedCube` (derive/types) used identically across detectors, deriveStats, fighter, presets. `Stats` defined in deriveStats, imported by sim/types. `CombatEvent` union defined in events, consumed unchanged in combat + runner. `FighterSpec` defined in combat, used by createFight + tests + runner. `makeFighter(id,name,side,build)` signature matches every call site (fighter test, createFight).

**Note for executor:** Tasks 3–7 port real content; when a `SynergyDef`/`ShapeDef`/`Move` field is needed by a detector or resolver, add it to `data/types.ts` at port time so nothing is typed `any`. The ported POC self-tests (Task 5/6) are the behavioural contract — port until they are green, matching `poc/builder.html:2957-3037`.
