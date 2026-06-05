# PocketHero — Builder → Fight Core Loop — Design Spec

**Date:** 2026-06-05
**Status:** Director-approved ("го роби все до кінця"). Branch `slice-2-renderer`.
**Governing principle (hard-won):** PORT the proven prototypes VERBATIM; do NOT approximate/reimplement. The combat view is already a verbatim TS port of `poc/gauntlet.html` (`src/render/gauntlet-fight.ts`). The builder will be a verbatim TS port of `poc/builder.html`'s builder view.

## Goal
The core PocketHero loop: the player BUILDS a creature from stat-pixels on a grid, then sends it into the gauntlet fight. "You build the hero, then watch it battle."

## Decomposition (3 sub-projects, built in order)

### Sub-project 1 — Rich Builder (verbatim port of builder.html's builder view)
Port `poc/builder.html`'s BUILDER screen to production TS/canvas2D, verbatim:
grid constructor, inventory panel (tabs/rarity/sort/search), budget bar, grid-unlock,
~22 cubes, preset buttons, adjacency synergies (Лезо/Форпост/Розпал/Потік/Підсилення),
shape recipes (Шип/Бастіон/Серце/Рівновага), bond lines, Traits panel, stats panel, LOD,
footer HUD, mouse place/remove input, the 38 self-tests if present.
- New module `src/render/builder-view.ts` exporting `startBuilder(opts: { onFight: (build: Build) => void }): void`. Self-contained (its own inline derive/detector/synergy/shape display logic ported verbatim — lowest drift, matches the gauntlet approach).
- Produces the current `Build` (PlacedCube[]) and hands it to `onFight` via a "У бій!" button.
- OUT of scope: builder.html's OWN combat view (our fight = gauntlet); meta/loot/progression.

### Sub-project 2 — Combat understands rich builds
Make `gauntlet-fight.ts` consume any 22-cube build: replace its reduced PIX/MOVES/deriveStats
with the full production data + derivation (CUBES 22 types, MOVES incl. venom/arc, deriveStats
with synergies/traits, deriveMoveset), and extend the render for the full 22-cube palette +
venom (poison) and arc (arcane) projectiles/impacts/statuses. Keep ALL gauntlet juice intact.
Single source of truth for derivation = `src/derive` + `src/data` (already ported from builder.html).

### Sub-project 3 — The loop (builder ↔ fight)
Thin screen manager in `app/main.ts`: boot → builder; "У бій!" hands the built creature in as the
hero and switches to the gauntlet fight; on KO/return, back to builder. The build flows
builder → fight. (Until SP2 lands, "У бій!" may stub/log.)

## Architecture
- `src/render/builder-view.ts` — builder screen (canvas2D, verbatim port).
- `src/render/gauntlet-fight.ts` — fight screen (exists; SP2 extends it to rich builds + accept an injected hero build).
- `app/main.ts` — screen manager toggling builder ↔ fight, owns the current build.
- Derivation source of truth: `src/derive` + `src/data` (matches builder.html, has the 38-test contract).

## Data flow
builder-view (place/remove cubes) → `Build` → (preview: deriveStats/deriveMoveset/detectors) →
"У бій!" → app screen-manager → gauntlet-fight (hero = built creature) → KO → back to builder.

## Verification (every sub-project)
`npm run build` clean + `npm test` green (Slice-1 + pure-module tests untouched) + real-time
`rt-capture.mjs` comparison against the source prototype (`builder.html` / `gauntlet.html`) — must
match 1:1. Determinism/purity of `src/sim` preserved.

## Out of scope (later slices)
Meta-progression, loot/economy, async PvP, multiple arenas/opponents beyond the gauntlet roster,
mobile-touch builder input polish.
