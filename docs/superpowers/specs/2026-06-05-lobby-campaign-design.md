# PocketHero — Habby Lobby + Mini-Campaign — Design Spec

**Date:** 2026-06-05. **Status:** Director-approved ("Роби і не перепитуй до фіналу"). Branch `slice-2-renderer`.
**Supersedes** `2026-06-05-mvp-progression-design.md` (its `meta.ts` earn-and-persist core is REUSED and extended here).
**Reference:** `docs/2026-06-05-pockethero-player-experience.md`. Format target: Habby mobile games (Archer.io, Capybara Go) — lobby with hero centerpiece + a stage-based campaign.

## Goal
A Habby-style loop: **Lobby** (hero stands center, reflects the build; big "В БІЙ" + "Білдер" + "Скриня") → tap "В БІЙ" → **Campaign battle** through a level's stages (minor → elite → BOSS) → kills grant XP + Coins → lose returns to Lobby WITH earnings → upgrade in Builder → return to continue. Two test levels (5 and 10 stages).

## Decisions (director)
- **Two currencies:** **XP** → hero **levels** (existing `meta.levelUp` → +pixel budget in builder); **Coins** → **chest** for cubes. Both granted on every kill ("no run is zero").
- **Procedural enemies:** generated per (level, stage, tier), deterministic by seed so retries are fair.
- **New cubes:** guaranteed from key stage-clears (onboarding) + a **chest gacha** bought with Coins.

## Screens (3, on one persisted SaveState)
1. **Lobby** (`src/render/lobby-view.ts`, NEW) — Habby menu: the hero (current `heroBuild`) rendered idle in the centre via the combat creature renderer (reflects the build); a big **«В БІЙ»** button (→ campaign battle at the current checkpoint stage), a **«Білдер»** button (→ builder), a **«Скриня»** button (→ open chest with Coins); HUD strip: **Level + XP bar**, **Coins**, and **«Рівень X · Етап Y/Z»** progress. Reward toast on return from a battle.
2. **Builder** (`src/render/builder-view.ts`, EXISTS) — upgrade the hero; budget from level; a "← Лоббі" back action (rename its current onFight/back semantics: the builder's exit returns to the LOBBY, not directly to a fight).
3. **Campaign battle** (refactor `src/render/gauntlet-fight.ts`) — auto-fights the current level's stages from the checkpoint forward; reuses ALL combat juice (springs/camera/projectiles/etc.). Replaces the gauntlet's own 4-boss ROSTER loop.

## Data model
- Extend `SaveState` (in `meta.ts`): add `coins: number` and `campaign: { level: number; stage: number }` where `level` is 1-based current level and `stage` is the 0-based checkpoint = next stage to clear in that level. (Level cleared when `stage` reaches `stageCount(level)` → `level++`, `stage = 0`.)
- **`src/game/campaign.ts`** (NEW, pure, tested):
  - `stageCount(level): number` → `level === 1 ? 5 : 10` (levels beyond 2 reuse 10 for now).
  - `stageTier(level, stage): 'minor'|'elite'|'boss'` → last stage = `boss`; elites at fixed indices (L1: stage 2; L2: stages 3 & 6); else `minor`.
  - `genEnemy(level, stage, tier): { name, build: Build, scale: number, boss: boolean }` — deterministic (seed from level*100+stage). Pick an archetype (melee/ranged/mage/tank) by `(level+stage)%4`; grow a Build to a target pixel count `≈ 6 + level*4 + stage*1.5`, multiplied by tier (`minor 1.0`, `elite 1.4`, `boss 1.8`); boss sets `scale ≈ 1.6` + `boss: true`. Use production CUBES types only; keep builds valid (core at [0,0], connected).
  - Rewards: `stageReward(level, stage, tier): { xp: number; coins: number; cube?: string }` — base XP/Coins scaled by tier (`minor 1×, elite 2×, boss 4×`) and by level; `cube` = a guaranteed onboarding cube on specific early stages (e.g., L1 s0→`force`, s1→`plate`, s2(elite)→`swift`, s3→`focus`, s4(boss)→`ember`).
  - Chest: `CHEST_COST = 50` (Coins); `openChest(rng): string[]` → 1–3 cubes weighted by CUBES `rarity` (common>rare>epic>legendary). `meta.openChest(state)` spends Coins + grants into inventory if affordable.
- **`meta.ts` additions:** `coins` in state + default 0; `addKillReward(state, {xp, coins, cube})` (grants + level-ups like `addFightReward`); `openChest(state, rng)`; keep `addFightReward` or replace its use with per-kill rewards driven by the campaign. `defaultState` adds `coins:0, campaign:{level:1, stage:0}`.

## Battle flow (campaign-driven `gauntlet-fight.ts`)
`startCampaignBattle({ state, onExit })`:
- Reads `state.campaign` → plays the current level's stages from `state.campaign.stage` forward. For each stage: build hero (from `state.heroBuild`) vs `genEnemy(level, stage, tier)`; show a brief stage banner (reuse the VS-card or a lighter "Етап Y/Z — <tier>"); run the fight (existing sim + juice).
  - **Hero wins the stage** → grant `stageReward` to `state` (XP/Coins/cube via `meta.addKillReward`), advance `state.campaign.stage`. If that was the last stage (boss) → **level cleared**: `state.campaign.level++`, `state.campaign.stage = 0`; exit to lobby with a "level complete" result. Else auto-continue to the next stage (brief transition).
  - **Hero loses** → exit to lobby immediately; earnings already banked per prior wins; `state.campaign.stage` stays at the failed stage (checkpoint).
- `onExit(result)` where `result = { outcome: 'levelCleared'|'defeated'; stagesWon: number; rewards: RewardEvent[] }`. The screen-manager saves state and returns to the lobby showing the rewards.

## app/main.ts (screen manager)
Owns the `SaveState` (`meta.load()`), routes: **Lobby** is the home. Lobby buttons → `showBuilder()` / `showBattle()` / `openChestFlow()`. Builder back → `showLobby()`. Battle `onExit` → save + `showLobby(rewardEvents)`. Each screen returns an idempotent `stop()` disposer (pattern already established). Persist on every state change.

## Reuse / refactor map
- Combat juice renderer (gauntlet): reused for battle stages AND the lobby idle hero (extract a `drawHeroIdle(ctx, build, x, y, scale)` if convenient, or reuse the creature drawing).
- `meta.ts`: extended (Coins, campaign, chest, kill rewards) — keep the 36 existing tests green; add tests for new logic.
- `builder-view.ts`: minimal change — its exit returns to lobby (the manager decides); keep the build editing intact.
- `gauntlet-fight.ts`: replace ROSTER/STAGE_ORDER sequencer with campaign stages + per-stage reward callback + win/lose→exit; keep the sim + all juice.

## Out of scope (YAGNI)
PvP, prestige, daily/offline, Shards/respec, monetisation, named-hero pages, more than 2 levels, mobile-touch polish, hero naming. Camera/juice unchanged.

## Build order & verification (autonomous, no check-ins until final)
1. `campaign.ts` + `meta.ts` extension + tests (pure) → `npm test` green.
2. `lobby-view.ts` → rt-capture the lobby (hero centre + buttons + HUD).
3. `gauntlet-fight.ts` campaign refactor → rt-capture a battle (stages play, juice intact, rewards).
4. `app/main.ts` wiring → CDP-drive the full loop (lobby → В БІЙ → battle → back → builder → back).
Each sub-project: `npm run build` clean + `npm test` green + visual verify before moving on. `src/sim` purity/determinism untouched. localStorage guarded.
