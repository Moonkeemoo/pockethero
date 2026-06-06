# PocketHero — Core-Loop Rework: Roguelite Auto-Battler with Between-Stage Shop

*Date: 2026-06-06. Status: APPROVED design (director "Ок"). Supersedes the persistent-build campaign loop for the in-run experience.*

Director pivot: replace the lobby→builder→fight persistent-build loop with a **single battle screen** that interleaves auto-battle and a between-stage **cube shop**. The hero grows from **1 base cube to "muscles"** across a level; losing restarts the level. Reference: Backpack Battles / TFT shop phase + AFK Arena soft-wall accumulation.

---

## A. The screen (one canvas, vertical composition)

```
FIGHT PHASE (stage running)        SHOP PHASE (stage won)
┌───────────────────────┐          ┌───────────────────────┐
│   BATTLE VIZ          │   slide   │  (battle slid up/away) │
│   spirit vs enemy,    │   ──▲──   │                        │
│   full juice          │           │                        │
├───────────────────────┤          ├───────────────────────┤
│   MY GRID (cubes)     │          │   MY GRID (cubes)       │  ← interactive in shop
├───────────────────────┤          ├───────────────────────┤
│   (shop hidden)       │          │ SHOP: [cube][cube][cube]│
│                       │          │  3 random, ⬡ price each │
│                       │          │       [ В БІЙ → ]       │
└───────────────────────┘          └───────────────────────┘
```

- **Battle viz** — top region; the existing campaign battle sim (`gauntlet-fight`) rendered into a sub-rect. Read-only watching.
- **My grid** — middle region; always visible. Shows the hero's cube composition. Read-only during fight; **interactive (place bought cubes) during shop**.
- **Shop** — bottom region; only in shop phase. 3 random cube offers with ⬡ prices + a "В БІЙ →" button.

**Phase flow:** `fight` → (win) battle slides up, shop slides in → `shop` (buy + place) → "В БІЙ" → `fight` (next stage) → …

## B. The loop & rules

1. **Level start** → hero = **1 base cube** (core only). Stage 1 fought with just that (trivial by design). No pre-stage-1 shop.
2. Stage win → battle slides up, **3 random priced cubes** appear. Buy what coins allow, place on the grid (adjacency forms synergies/shapes that buff the spirit). "В БІЙ" → next stage.
3. Repeat across **20 stages** (elites at 5/10/14, boss at 20 — kept; wavy `genEnemy` balance kept).
4. **Boss (stage 20) cleared** → Level complete ceremony → **next Level on the same screen**, build resets to 1 cube. Coins + account persist.
5. **Loss on any stage** → roguelite: restart this Level from **stage 1 with 1 cube**. Coins kept.

**Confirmed rules:**
- **D1 — Coins are a permanent wallet.** Never burned on loss; only the build resets. Persist across stages/levels. (AFK-Arena accumulation: the wall yields as you bank coins.)
- **D2 — Cube price by rarity**, scaling slightly with stage. No reroll.
- **D3 — Account meta:** stage wins grant account XP → account level → a small **permanent stat bonus** to the spirit (+`ACCOUNT_HP_PER_LEVEL` max HP per account level). This is what "carries forever".
- **D4 — No budget / no ring-locks.** The only constraint is coins. Place a bought cube on any empty cell orthogonally adjacent to the body; the grid auto-sizes.
- **D5 — Grid is read-only during the fight**, interactive only in the shop phase.

## C. Data model (`SaveState`, SAVE_VERSION → 5; old saves reset)

```ts
interface SaveState {
  coins: number;                 // D1 persistent wallet
  accountLevel: number;          // D3 meta progression (was `level`)
  accountXp: number;             // D3 meta XP (was `xp`)
  run: {
    level: number;               // campaign chapter (1+)
    stage: number;               // 0-based stage within the level
    build: Build;                // current hero; resets to [{gx:0,gy:0,type:'core'}]
  };
  seenTypes?: string[];          // kept for «Новий тип» callout
  lossStreak?: number;           // kept; counts losses of the current level (stuck hint)
  lossStage?: { level: number; stage: number };
}
```

**Removed:** persistent `heroBuild`, `inventory`, `essence`, `campaign{}`, `onboarded` (builder coach retired with the builder).

**Meta functions (`meta.ts`):**
- `defaultState()` → coins 0, accountLevel 1, accountXp 0, run {level 1, stage 0, build:[core]}.
- `accountXpToNext(level) = 50 + level*25`.
- `resetRunBuild(state)` → run.stage 0, run.build = [core] (used on level start + loss).
- `winStage(state, reward, rng?)` → coins += reward.coins; accountXp += reward.xp (+ account level-ups via the existing loop, granting only the HP bonus — no loot); run.stage++. Returns RewardEvent[].
- `completeLevel(state)` → run.level++, resetRunBuild.
- `loseRun(state)` → update lossStreak/lossStage, resetRunBuild.
- `buyCube(state, price)` → if coins>=price { coins-=price; return true } else false. (Placement on the grid is the screen's job, mutating run.build.)
- `accountStatBonus(state)` → `{ maxHpAdd: ACCOUNT_HP_PER_LEVEL * (accountLevel-1) }` applied to the hero fighter.
- Keep `noteSeen`, `weightedCubePick`, `grantLootInto` (loot still used for shop rolls / starter? — shop uses its own roll).

**Campaign functions (`campaign.ts`):**
- Keep `stageCount`, `stageTier`, `genEnemy`, `stuckHint`. 
- Replace `stageReward` cube-grant with **coins+xp only**: `stageReward(level,stage) → { xp, coins }` (drop the guaranteed `cube`).
- New `rollShop(level, stage) → string[3]` — 3 weighted-random placeable cube types (deterministic per level,stage via mulberry32; reuse rarity weights).
- New `cubePrice(type, stage) → number` — base by rarity {common 3, rare 6, epic 10, legendary 16} × (1 + stage*0.08), rounded. (Tunable.)

## D. Architecture / screens

- **Lobby** — stays as entry/home; "В БІЙ" launches the run screen; HUD shows coins + account level. Drop the persistent-hero pedestal reflection of a saved build (or show the current run.build). «Білдер» / «Скриня» buttons removed (no builder; shop replaces chest economy). Keep it minimal: hero centerpiece + «В БІЙ».
- **Builder screen** — REMOVED (`builder-view.ts` retired). Grid placement logic (adjacency/connectivity, cube drawing, derive synergies) is reused in the shop phase — a simplified placement (no inventory tabs, no budget, no rings).
- **New `src/render/battle-run.ts`** — the orchestrator screen: hosts the battle sim in a top sub-rect, the grid in the middle, the shop at the bottom; manages fight↔shop phases, slide transitions, reset rules, boss/loss. Reuses `gauntlet-fight`'s sim+juice (rendered into a region) and `src/derive` for synergies.
- **`app/main.ts`** — lobby → battle-run → (back to lobby between sessions). Remove builder route.
- Kept untouched: `src/sim` purity/determinism; `src/derive`; the 20-stage/tier/wavy structure.

## E. Task breakdown (execution)

1. **Data layer (subagent):** reshape `SaveState` + meta functions (§C), update `campaign.ts` (`stageReward` coins-only, `rollShop`, `cubePrice`), bump SAVE_VERSION to 5, update `tests/meta.test.ts` + `tests/campaign.test.ts` to the new shapes. Keep `src/sim`/`derive` untouched.
2. **Battle-run screen (author):** new `battle-run.ts` — layout regions + battle-in-subrect + grid + shop + phase machine + transitions, against the §C API. CDP-verified.
3. **Wire + cleanup (author):** `main.ts` lobby→run, retire `builder-view.ts`, trim lobby buttons. Full build + tests green.

*Tunable numbers (🎚️): cube prices, ACCOUNT_HP_PER_LEVEL, coin rewards. Balanced later via play + `tools/balance.ts`.*
