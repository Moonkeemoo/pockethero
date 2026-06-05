# PocketHero — Production Foundation (Slice 1) — Design Spec

**Date:** 2026-06-05
**Status:** Approved (director sign-off). Owner: Claude (all dev/technical decisions). Director: vision only.
**Supersedes nothing** — this is the first production spec. The vanilla-canvas POCs in `poc/` are the validated reference; this slice begins the clean ("на чистову") rebuild.

---

## 1. Context

Four POCs validated the pillars: combat feel, 2.5D billboard visual, pixel legibility, and builder depth (`poc/combat-prototype.html`, `gauntlet.html`, `pixel-legibility.html`, `builder.html`). The director has approved moving from throwaway POCs to a production codebase on the locked stack (PixiJS).

The full game is too large for one spec. It is decomposed into slices:

1. **Foundation** ← *this spec* — toolchain + deterministic combat engine + data, proven by tests.
2. **2.5D billboard combat renderer** (PixiJS) — consumes the engine's event stream.
3. **Builder** — grid, inventory, budget, synergies/shapes, LOD.
4. **Meta / progression** — loot, levels, grid-unlock, persistence.
5. **Async PvP** (model B, pure-auto) — snapshot + deterministic resolution + backend.

Each slice ships independently. This slice produces **no visuals**; its output is green tests and a deterministic headless fight.

## 2. Goal & Definition of Done

A production-grade project shell plus the **complete deterministic combat engine and data layer**, with the rendering boundary established but unused.

**Done when:**

1. `npm test` is green: the POC's 38 self-tests are ported as Vitest unit tests, **plus** a determinism test (same seed ⇒ byte-identical event log) and a sim-purity test (the `sim/` graph imports nothing from `pixi.js` or the DOM).
2. `npm run sim` runs a full fight between two preset builds to K.O. and prints a readable Ukrainian combat log, driven entirely by the production engine (parity with `poc/gauntlet.html` behaviour).
3. `npm run build` and `npm run dev` succeed against an empty app shell (Pixi installed, canvas mounts, no game rendering yet) — proving Slice 2 can start with zero toolchain friction.

## 3. Stack (decided)

| Concern | Choice | Why |
|---|---|---|
| Language | TypeScript, `strict` | The data-driven cube/move/trait registries and the deterministic sim benefit most from types; discriminated unions model moves/statuses/events safely. |
| Bundler / dev server | Vite | Standard for PixiJS, fast HMR, sets up Slice 2. |
| Renderer (dep only this slice) | PixiJS v8 | Locked visual stack. Installed now, untouched until Slice 2. |
| Tests | Vitest | Vite-native, fast, TS-first. |
| Modules | ESM | — |
| Node | LTS (≥20) | — |

## 4. Architecture principles

**P1 — Determinism is a hard contract.** Every random draw goes through a single seeded RNG instance (Mulberry32, ported from the POC). No `Math.random`, no `Date.now`, no wall-clock in `sim/`. This is what later enables PvP replay from a snapshot. A unit test asserts identical output for a fixed seed.

**P2 — Fixed logical timestep.** The sim advances in fixed steps (default **60 Hz**, `DT = 1/60`) decoupled from any render loop. The headless runner steps the sim in a plain loop; the future renderer will interpolate between sim states. Variable `requestAnimationFrame` dt never reaches the sim. (The POC mixed render dt into the sim — we fix that here.)

**P3 — Sim emits, renderer consumes.** The sim pushes typed events onto an event bus (`hit`, `crit`, `block`, `dodge`, `status-applied`, `status-tick`, `move-start`, `ko`, …). The sim never references the screen. The renderer (Slice 2) and the combat-log printer (this slice) are just two consumers of the same stream. This decoupling is the core reuse boundary.

**P4 — Data-driven content.** Cubes, moves, traits (synergies + shapes), and schools are typed **data**, not code. Balance is tunable in one place; the builder (Slice 3) and `deriveStats` both read the same registries.

**P5 — `sim/` purity.** The `sim/` directory imports only from `sim/`, `data/`, and `derive/` — never `pixi.js`, never DOM. Enforced by test (static import scan). This keeps the engine unit-testable and reusable server-side for PvP validation.

## 5. Module structure

```
pockethero/
  poc/                         # untouched — reference spec
  docs/                        # this spec + GDD
  src/
    sim/
      rng.ts                   # Mulberry32, seedable, serialisable state
      events.ts                # EventBus + discriminated CombatEvent union
      status.ts                # Burn / Slow / Shock (+ extensible registry)
      fighter.ts               # Combatant model from a derived build
      combat.ts                # fixed-step ATB loop, move resolution
      index.ts                 # engine public API (createFight, step, runToEnd)
    data/
      schools.ts               # damage schools / status palette
      cubes.ts                 # ~22 cube types: cat, rarity, cost, glyph, effect
      moves.ts                 # move definitions + weights + status hooks
      traits.ts                # synergy defs + shape defs
    derive/
      detectors.ts             # adjacency-synergy + shape detection over a grid
      deriveStats.ts           # folds base + cubes + traits -> Stats
      deriveMoveset.ts         # build -> moveset
    builds/
      presets.ts               # Hero / Brute / Ranger / Mage / Boss (port from POC)
    index.ts                   # top-level public API barrel
  tests/
    *.test.ts                  # ported self-tests + determinism + purity
  tools/
    sim-runner.ts              # headless fight -> Ukrainian combat log
  app/
    main.ts                    # empty Pixi shell (mounts canvas, no game) — for Slice 2
    index.html
  package.json tsconfig.json vite.config.ts vitest.config.ts README.md
```

### Module responsibilities & interfaces (sketch)

- **`rng.ts`** — `makeRng(seed: number): Rng` where `Rng` exposes `next()`, `pick(arr)`, `range(a,b)`, and `state`/`clone()` for snapshotting. Pure.
- **`events.ts`** — `CombatEvent` discriminated union (`type` tag). A tiny synchronous bus: `emit(e)`, `drain(): CombatEvent[]`. No async.
- **`status.ts`** — status definitions (id, on-apply, on-tick, on-expire) as data + a small applier. Burn (DoT), Slow (speed mult), Shock (from Іскра/Розряд).
- **`fighter.ts`** — `makeFighter(build, opts): Fighter`. Holds derived stats, moveset, ATB, hp, statuses, move cursor. Pure data + helpers.
- **`combat.ts`** — `stepFight(state, dt, rng, bus)` advances ATB, picks moves, resolves hits (crit/block/dodge/pierce/lifesteal/thorns/magResist), applies statuses, emits events. `createFight(a, b, seed)` and `runToEnd(state, rng, bus)`.
- **`derive/*`** — pure functions from a placed-cube grid to stats/moveset, folding detector output. Ported faithfully from `poc/builder.html` (`deriveStats`, `deriveMoveset`, detectors) and `poc/gauntlet.html`.
- **`data/*`** — the content registries, ported from the POCs (single source of truth for the ~22 cubes, moves, synergy/shape defs).
- **`tools/sim-runner.ts`** — constructs two presets, runs `runToEnd`, formats the event stream into the UA combat log seen in the POC.

## 6. Testing strategy

- **Port the 38 self-tests** from `poc/builder.html` (detectors, deriveStats, loot/budget/grid invariants) into Vitest. These are the regression floor.
- **Determinism test:** run the same fight twice with the same seed; assert the serialised event logs are identical. Run with two different seeds; assert they differ (sanity).
- **Purity test:** statically scan `src/sim/**` imports; fail if any import resolves to `pixi.js` or a DOM global.
- **Balance smoke:** each preset vs each preset terminates within a sane step bound (no infinite stalls — guards the known "Бастіон block can stall fights" risk).

## 7. Out of scope (later slices)

Rendering of anything, the builder UI, loot/levels/meta, persistence, PvP/backend, audio. The empty `app/` shell mounts a Pixi canvas only to prove the toolchain; it draws no game.

## 8. Risks & mitigations

- **Determinism regressions from float math** — keep all sim math in plain JS numbers, fixed step, single RNG; the determinism test is the guard.
- **Porting drift** — behaviour must match the POC; the ported self-tests + the sim-runner log compared against `poc/gauntlet.html` keep parity.
- **Over-engineering the engine before the renderer exists** — scope is frozen to "run a fight + prove it"; no speculative systems.

## 9. After this slice

Slice 2 (PixiJS billboard renderer) subscribes to the same `CombatEvent` stream and interpolates between fixed sim steps — no engine changes expected.
