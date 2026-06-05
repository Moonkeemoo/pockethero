# PocketHero — agent guide

Web idle pixel-creature **auto-battler** ("My Brute on max"). The hero is a creature the
**player builds from coloured stat-pixels on a grid** (start 1 pixel; +1 per level).
PvE = active battler; PvP = async spectator vs a snapshot of another hero. Visual is
**2.5D billboard pixel-art** with procedural soft-body jiggle + code juice. Director sets
vision; the agent owns all development/technical decisions.

## Where things are
- `src/` — production engine (TypeScript, strict). Built in slices.
- `poc/` — **reference spec**: validated vanilla-canvas prototypes (`builder.html` is the
  source of truth for data + derive + 38 self-tests; `gauntlet.html` for combat resolution).
  Do not ship from these; port from them.
- `docs/` — `*-design.md` (GDD + slice specs), `superpowers/plans/` (impl plans),
  `research/` (competitor + art-direction studies).
- `app/` — empty Pixi shell (Slice 2 mounts the renderer here).

## Commands
- `npm test` — full suite (Vitest). Includes determinism + sim-purity guards.
- `npm run sim` — headless fight → UA combat log (`npm run sim -- hero mage 42`).
- `npm run build` — `tsc --noEmit && vite build` (app shell → `dist/`).
- `npm run dev` — Vite dev server.

## Architecture (hold these invariants)
- **Layering, downward-only:** `data/` (content registries) ← `derive/` (deriveStats /
  deriveMoveset / detectors) ← `sim/` (engine). `data/` imports nothing above it.
- **`sim/` is pure** — no `pixi.js`, no DOM. Enforced by `tests/purity.test.ts`. This keeps
  the engine unit-testable and reusable server-side for PvP validation.
- **Determinism (P1):** all randomness flows through one seeded `Rng` (`makeRng`); no
  `Math.random`/`Date.now`/wall-clock in `sim/`. All fight state lives in serializable
  `FightState`/`Fighter`/`StatusInstance` (no hidden module state). Guarded by
  `tests/determinism.test.ts` (same seed ⇒ identical event log).
- **Fixed timestep (P2):** sim steps at `DT = 1/60`, decoupled from render. The renderer
  will interpolate between steps.
- **Event-driven (P3):** `sim` emits typed `CombatEvent`s onto a bus; consumers (the log
  printer now, the renderer later) read the stream, never internal state.
- **Data-driven (P4):** cubes/moves/traits are typed data; balance is tuned in `data/` +
  the `STAT`/`TRAIT_K` constants in `deriveStats.ts`, not in code branches.

## Public API
Import from `src/index.ts` (engine barrel): `createFight`, `stepFight`, `runToEnd`, `DT`,
`makeRng`, `makeBus`, `deriveStats`, `deriveMoveset`, `PRESETS`, `CUBES`, and the types.

## Slice roadmap
1. **Foundation** — DONE (engine + data + tests; 69 tests green).
2. **2.5D billboard combat renderer** (PixiJS) — next; subscribes to the `CombatEvent` stream.
3. Builder UI · 4. Meta/progression · 5. Async PvP (model B, pure-auto).

## Known deferred gaps
- `arc` move (arcane school) applies no status; the POC's `arcane` `dmgTakenMul 1.25` was not
  ported. Harmless — no preset build uses the `arcane` cube. Port when arcane content lands.

## Working notes
- TDD: write the failing test, port/implement, keep the suite green. Frequent commits + push.
- When porting from `poc/`, match behaviour exactly; the ported self-tests are the contract.
