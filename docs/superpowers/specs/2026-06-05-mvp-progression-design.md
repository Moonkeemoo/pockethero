# PocketHero — MVP Progression ("Earn-and-Persist Loop") — Design Spec

**Date:** 2026-06-05. **Status:** Director-approved ("Роби"). Branch `slice-2-renderer`.
**Scope:** the smallest meaningful progression loop. Grounded in `docs/2026-06-05-pockethero-player-experience.md` (the full arc) and the progression primitives ALREADY ported into `src/render/builder-view.ts` (level / budgetCap / inventory / `levelUp()` / `grantLoot()` / `expandGrid()`).

## Goal
Make the loop feel like progress: **build → fight → earn (XP + Essence) → level up (budget + loot) → persist → build stronger → tougher fight.** Wins AND losses always reward ("no run is zero").

## Architecture (small, focused units)
- **`src/game/meta.ts`** — single source of truth for progression + persistence. Pure logic + a thin storage adapter:
  - State: `interface SaveState { level: number; xp: number; essence: number; inventory: Record<string, number>; heroBuild: Build }`.
  - Ops (pure, unit-tested): `xpToNext(level): number`; `addFightReward(state, result): { state, events }` where `result = { won: boolean; stagesCleared: number }` → adds Essence + XP, applies level-ups (each level raises budget via the builder's per-level rule + grants a small loot batch), returns the mutated state + an `events` list (`{kind:'levelUp',level}|{kind:'essence',n}|{kind:'xp',n}|{kind:'loot',cubes}`) for UI toasts.
  - Persistence: `load(): SaveState` (from `localStorage['pockethero.save']`, or a fresh default = core-only build, level 1, starter inventory), `save(state)`, and an injectable storage shim for tests.
  - `grantLoot`/level rules reuse the SAME constants the builder already uses (extract shared constants if needed) so builder and meta agree.
- **`src/render/builder-view.ts`** — refactor its in-closure `META` to read/write the shared `meta` state (passed in via `startBuilder({ state, onFight, ... })` or imported). The builder mutates `state.inventory`/build/budget as today; on "У бій!" it saves and calls `onFight(state.heroBuild)`. **Remove/hide the free manual "+Рівень" and "Відкрити лут" buttons** — level + loot now come only from fights (keep the code path, just not as free UI buttons). Add a compact **XP bar + level + Essence** readout, and a **reward toast** shown when returning from a fight.
- **`src/render/gauntlet-fight.ts`** — change `onExit` to report the outcome: `onExit(result: { won: boolean; stagesCleared: number })`, fired on the "← Білдер" button (compute `won` = hero is the winner of the last fight; `stagesCleared` = how many gauntlet stages the hero beat this session).
- **`app/main.ts`** — screen-manager owns the `SaveState`: boot → `meta.load()` → `showBuilder(state)`; on `onFight(build)` → `state.heroBuild = build; meta.save(state); showFight(build)`; on `onExit(result)` → `const {state, events} = addFightReward(state, result); meta.save(state); showBuilder(state, events)` (events → reward toast).

## Data flow
boot → load(state) → builder(state) → "У бій!" (save; hero = state.heroBuild) → gauntlet stages (win/lose) → "← Білдер"(result) → addFightReward → save → builder(state, rewardEvents) → repeat. Reload restores everything.

## Reward defaults (🎚️ tunable constants in meta.ts)
`ESSENCE_PER_FIGHT = 5` (always); `XP_PER_STAGE = 20`; `XP_WIN_BONUS = 30`; `XP_LOSS = 10`; `xpToNext(level) = 50 + level*25`; each level-up → builder per-level budget bump + `grantLoot([1,2])`.

## Out of scope (YAGNI — later slices)
Shards/respec, unlock-ladder gating (rarities/magic drip), PvP/challenge-link, prestige, daily/offline grind, currency shop, monetisation, server sync, "what's next" banner, opponent scaling beyond the existing gauntlet stage sequence.

## Testing / verification
- `tests/meta.test.ts` (Vitest, pure): `xpToNext` curve; `addFightReward` win vs loss grants; multi-level-up in one reward; Essence-always; `save`/`load` round-trip through an in-memory storage shim; default fresh state.
- `npm run build` clean; existing 85 tests + new meta tests green; `src/sim` purity/determinism untouched.
- Visual: `rt-capture.mjs` of the loop — build → fight → return shows level-up + essence + reward toast; reload preserves the hero/level/essence.

## Risks
- Builder-view refactor (1605-line verbatim port) must not break the builder — wire the shared state minimally; verify rt-capture vs current builder still matches.
- `localStorage` availability in the dev/headless context — guard with try/catch; tests use the shim.
