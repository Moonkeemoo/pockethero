# PocketHero — Onboarding & Campaign-Progression Flow (v1)

*Date: 2026-06-06. Status: actionable design for implementation. Author: design+research pass.*

This doc turns the **already-built** lobby↔builder↔campaign loop into a *polished, juicy, market-grade* onboarding and progression-feel experience. It is grounded in (a) our locked design — `docs/2026-06-05-pockethero-player-experience.md`, the 19-title study in `docs/research/2026-06-05-competitors-and-references.md`, the lobby+campaign spec in `docs/superpowers/specs/2026-06-05-lobby-campaign-design.md` — and (b) the **real numbers in code**:

- `src/game/campaign.ts`: every level = **20 stages**; `stageTier` → elites at stage index **5, 10, 14**, **boss at index 19** (the 20th); wavy `genEnemy` difficulty (`ramp 0.4 + stage*0.72`, sine wave, `levelMul = 1 + (level-1)*0.6`, tier mult `minor 1.0 / elite 1.35 / boss 1.6`); `stageReward` tier mult `minor 1× / elite 2× / boss 4×`, and a **guaranteed onboarding-cube schedule on L1 stages 0–9** (`force, vital, plate, force, swift, focus, vital, force, plate, ember`).
- `src/game/meta.ts`: `CHEST_COST=50`, `ESSENCE_PER_FIGHT=5`, `XP_PER_STAGE=20`, `XP_WIN_BONUS=30`, `XP_LOSS=10`, `xpToNext(level)=50+level*25`; **starter hero = `core` + one `force`** (2 cubes); 16-cube starter inventory; per-level loot 1–2 cubes; `RewardEvent` union already supports `essence|xp|levelUp|loot|coins|cube|info`.
- `src/render/lobby-view.ts`: HUD (Level+XP bar, Coins `⬡`, "Рівень X · Етап Y/Z"), hero pedestal, **В БІЙ / Білдер / Скриня** buttons, a **reward toast** (`TOAST_DUR=3.2s`) that already aggregates `rewardEvents`.
- `src/render/gauntlet-fight.ts` (active campaign path = the `*2` functions): `startCard2` (VS card, `CARD_DUR2`) → `startFight2` → `startResult2` → `drawResultBanner2` (inter-stage "Етап пройдено!" flash **vs** full K.O. banner with "← Лоббі"); `drawStageProgressBar2` (Capybara-Go node row — circles for minor, diamonds for elite, 💀 diamond for boss, ✓ on cleared, pulsing ring on current); `handleStageEnd` banks reward per win and advances `state.campaign.stage`.
- `app/main.ts`: lobby is home; battle `onExit(result)` → save → `showLobby(result.rewards)`.

**The director's ask** is *"super-polishing the campaign-passing process."* So the spine of this doc is **D (win-presentation choreography)** and **C (loss flow)** — the dopamine of clearing stages — wrapped in **A (onboarding)**, **B (unlock ladder)**, **E (pacing/what's-next)**, and **F (a bite-sized backlog)**.

---

## Guiding principles (from the market study, distilled)

1. **First win fast, zero menus.** My Brute: "create in 30s, watch it fight." We already cold-open near this — protect it.
2. **Acknowledge every action *at once*.** Mobile-reward best practice ([GameGrin](https://www.gamegrin.com/articles/how-mobile-games-learned-to-reward-almost-everything/)): "you do something simple, the game acknowledges it *at once*, your brain encourages you to continue." Our per-stage win must pop immediately, every time.
3. **Numbered progress beats vague progress.** Naavik's Survivor.io teardown found Archero's *numbered* dungeon ("Stage 23/50") read as clearer achievement than Survivor.io's time-survived score ([Naavik](https://naavik.co/deep-dives/survivorio-archeros-footsteps/)). Our **"Етап Y/20" + node bar** is the Archero model — lean into it hard.
4. **Boss every few stages = a *soft* wall that pushes upgrade, not quit.** AFK Arena spikes difficulty at bosses every 5 levels; **no energy lock**, unlimited retries, so the wall reads as "skill/convenience," not punishment ([alexandremacmillan](https://alexandremacmillan.com/2019/06/13/idle-mechanics-and-monetizing-progession-in-afk-arena/)). Our elites at 5/10/14 + boss at 20 are exactly this rhythm — and we have **no energy gate** and a **checkpoint** that keeps your progress. Frame the loss as "almost — one upgrade away."
5. **Drip the systems; preview the locks.** Capybara Go/Habby + NGU: show on the main screen *at which level things unlock* ([Naavik](https://naavik.co/deep-dives/survivorio-archeros-footsteps/)), reveal one mechanic per arc. Never show a wallet/feature the player can't yet use, but *do* tease the next one.
6. **No run is zero.** Vampire Survivors meta-gold; we already grant Essence + bank per-win earnings on loss. The loss screen must *show* the haul.

---

## A. First-Session Onboarding — beat-by-beat (~first 5 minutes)

**Goal:** first watched win inside ~30–40s, first build decision by ~1:00, first "I made a technique/cube happen" delight by ~2:00, and the player understands the lobby↔builder↔battle triangle by ~4:00 — without a single modal wall of text.

Our real starter (`core`+`force`, 2 cubes) **reliably wins** the trivial early stages by design (`genEnemy` `ramp` starts at ~0.4 pixels at stage 0), and L1 stages 0–9 each **guarantee a cube**. That is the onboarding engine; the beats below choreograph it.

| Time | What the player sees / does | What's taught | What's hidden | Market ref |
|---|---|---|---|---|
| **0:00** | **Cold-open on the Lobby.** Hero (`core`+`force`, 2 glowing cubes) idles on the pedestal, breathing. HUD shows Рівень 1, an empty XP bar, ⬡ 0. The big amber **В БІЙ** button pulses; a one-time **hand/finger cue** points at it. No name prompt blocking, no modal. | "This is my creature. The glowing button is go." | Coins meaning, chest, builder depth, tiers, future systems. | My Brute 30s-to-fight; Habby lobby-with-hero centerpiece. |
| **0:06** | Tap **В БІЙ** → `startCard2` shows the **VS card** (`CARD_DUR2`, *shortened to ~1.2s for stage 1 only*): "Рівень 1 · Етап 1/20 · МІНОР", your blob vs a tiny 1-cube "Мінор-Боєць". | "I'm entering a numbered campaign; my foe is small." | Elite/boss tiers (their nodes on the bar are dim/locked-looking). | Archero numbered-dungeon clarity (Naavik). |
| **0:08–0:25** | **Auto-fight with full juice** — `fist` punch, hit-flash, screenshake, flying damage floater, soft-body jiggle, debris. Hero wins. *Watching is the gameplay.* | "I don't control it; I watch it win. It feels good." | — | VS "no dead seconds"; Wobbledogs jiggle. |
| **0:25** | **STAGE-WIN POP** (see §D.1): brief "**Етап пройдено!**" flash + a **coin spray** and a **+cube fly-out** (stage 0 guarantees `force`). The bar's node #1 flips to ✓. ~0.9s, then auto-advance to stage 2. | "Clearing a stage *pays*. The node filled in." | — | GameGrin "acknowledge at once"; VS gem-vacuum. |
| **0:25–1:00** | Stages 2–4 auto-chain (each ~10–18s fight + ~0.9s pop). Cubes `vital`, `plate`, `force` rain in. XP bar visibly climbs; around here the player hits **LEVEL 2** → **§D.3 level-up pop**: bar flash, "РІВЕНЬ 2 ↑", "+1 кубик у білдер". | "Levels give me build budget. Cubes are piling up." | xpToNext curve, Essence wallet. | VS reward cadence; NGU "start with ONE thing." |
| **~1:00 — FIRST WALL (gentle)** | The wavy curve + a sine bump makes a stage near **3–5** the first one the hero *might* lose, OR the player chooses to stop and build. Either way → return to **Lobby** with a **return-toast** summarizing the haul. A **NEW glow + "1" badge** now sits on the **Білдер** button. | "I have stuff to spend. The builder wants me." | — | AFK Arena soft wall; Capybara "unlock mechanics early." |
| **~1:10 — THE AHA (builder)** | Tap **Білдер**. First entry runs a **3-step inline coach** (no modal wall): (1) finger drags one earned cube onto a cell adjacent to core → hero re-jiggles; (2) "place 2 more"; (3) when a **3rd `force` lands in a straight line**, the **«Шип»/Spike** recipe fires — connector glow + toast "**Техніку відкрито: Шип (меч)**". | "*I* changed the creature, and I made a sword appear." | All other recipes/synergies, rarities, magic. | Backpack Battles blue-line; HoloCure collab-reveal; Spore authorship. |
| **~2:00** | Tap **У бій / ← Лоббі → В БІЙ** to retry from the **checkpoint stage** (not stage 1 — progress kept). The next fight visibly **opens with a sword swing** instead of a punch. Player clears the wall. | "Building made me stronger. The checkpoint kept my place." | — | AFK Arena retry-after-upgrade; our checkpoint model. |
| **~2:30** | Player pushes to **stage 5 = first ELITE** (gold diamond node, 1.35× enemy, 2× reward). A heavier VS card + a "**ЕЛІТ**" stinger. Win → bigger coin spray (§D.1 scales by tier). | "Elites are tougher *and* pay more. The gold nodes are milestones." | Boss tier still dim on the bar. | AFK Arena boss-spike rhythm. |
| **~3:00** | Around L3–4, **Coins crest 50** → the **Скриня** button lights with a **"можна відкрити" glow**. First chest open = §D.5 chest choreography (rattle → burst → 1 cube fly to inventory). | "Coins buy cubes from the chest. A second source of growth." | Chest odds/rarity table. | VS chest-as-slot-machine; Habby reward loops. |
| **~4:00** | Player now fluently rides the triangle: **В БІЙ → win stages → return → Білдер/Скриня → В БІЙ**. An always-on **"Далі:" (what's-next) line** on the lobby names the immediate chase (e.g. "Далі: Етап 5 — Еліт" or "Далі: Рівень 4 → +1 кубик"). | The whole loop + the next goal. | Everything past the current arc. | Melvor always-visible milestone; §E. |

**Onboarding rules:**
- **No blocking modals.** All teaching is **diegetic** — finger cues, button badges, one-line toasts, the node bar. (Wobbledogs lesson: a system the player can't *see working* feels random.)
- **First VS card is shortened**, subsequent cards normal — don't make the player wait through ceremony before they've earned investment.
- **Name-your-hero is deferred** to first builder exit or first chest (optional, non-blocking) — attachment spike (Spore) without gating the first fight.
- **The starter must keep winning the first ~3 stages** (already true in `genEnemy`); never let stage 1 be losable, or the cold-open promise breaks.

---

## B. Unlock / Feature-Gating Ladder

Principle (Capybara Go / NGU / Habby): **drip one system per arc, preview the next, never dump.** Every lock is shown with its unlock condition ("Рівень X" / "Етап Y") so the player always has a named target ([Naavik](https://naavik.co/deep-dives/survivorio-archeros-footsteps/)).

| Unlock | Gate (real) | How it's **teased** (locked-with-preview) | How it's **revealed** | Market ref |
|---|---|---|---|---|
| **First fight (`fist`)** | L1, stage 0 | В БІЙ pulses on cold-open | Auto on tap | My Brute |
| **Stage-win reward + cube fly-in** | every stage clear | — (immediate) | §D.1 pop | GameGrin |
| **Builder editing (place earned cubes)** | after 1st return with ≥1 cube | **NEW "1" badge** on Білдер button | 3-step inline coach (§A) | Backpack Battles |
| **«Шип»/Spike technique** | 3 `force` in a line (reachable in session 1 via L1 cube schedule) | partial-recipe **glow at ~70%** in builder (B.B. blue-line) | connector flash + toast | HoloCure collab-reveal |
| **Level 2 → +1 budget** | xp ≥ `xpToNext(1)`=75 | XP bar always visible, fills toward it | §D.3 level-up pop | VS cadence |
| **Elite stages** | stage 5 (then 10, 14) | **gold diamond node** visible-but-ahead on the bar | "ЕЛІТ" VS stinger | AFK Arena |
| **Chest (Скриня)** | Coins ≥ `CHEST_COST`=50 | button shows `Скриня (50⬡)`; **glows when affordable** | §D.5 chest open | VS chest |
| **Boss stage** | stage 20 (index 19) | **💀 diamond node** at the end of the bar (always visible as the run's destination) | full "БОС" VS card + intro | AFK Arena boss-spike |
| **Level 2 of campaign** | clear boss of L1 | "Рівень 2" preview text on level-complete banner | §D.2 level-complete + next-level intro | Archero chapter chain |
| **Rarer cubes in loot** | emergent via `weightedCubePick` (rare 26%, epic 11%, legend 3%) | rarity **colour/glint** when a non-common drops | rarity stinger on the cube fly-in (§D.4) | Backpack variety |
| *(future, not in MVP — show as horizon only)* **Magic axis, synergies panel, PvP/challenge-link, prestige** | per `player-experience.md` ladder | a single **"Скоро" (coming-soon) ghost slot** on the lobby, no numbers | later slices | NGU drip; §E horizon |

**Gating rules:**
- **Never show a wallet you can't fill.** Essence has no early sink → keep it *out* of the HUD until its sink ships (currently it only accrues; do not surface a counter that does nothing — see F-12).
- **Every locked thing carries its unlock label.** Dim node = "Етап 5"; ghost button = "Рівень X". A lock without a number is just a tease that frustrates.
- **One badge at a time.** Only the *single most relevant* next action wears the NEW/glow badge (builder when you have cubes, chest when you can afford it) — avoid a christmas-tree HUD.

---

## C. Loss Flow — "almost, not over"

Our model already does the hard part right: **earnings are banked per-win during the run**, the **checkpoint stage stays** (`state.campaign.stage` is unchanged on loss in `handleStageEnd`), there is **no energy gate**, and retries are **deterministic-but-fair** (same seed per attempt). The job here is purely *framing* so the wall reads as motivating, not punishing (AFK Arena's whole anti-frustration thesis).

**The loss sequence (on `winner2 !== hero2`):**

1. **In-battle (~1.0s):** `drawResultBanner2` shows the K.O. banner — but **reframe the copy**. Instead of only "`<enemy>` переміг!", show:
   - Line 1: **"Поразка на Етапі N"** (neutral, factual — numbered, Archero clarity).
   - Line 2 (the reframe): **"Майже! Ти зібрав:"** + an inline mini-tally of *this run's* haul (XP, ⬡ coins, N cubes — from the banked `rewards` array).
   - Button: keep **"← Лоббі"** but relabel to **"Покращити героя →"** (point the player at the fix, not the exit). A secondary small **"Ще раз"** lets a stubborn player re-attempt the same stage immediately.
2. **Return to Lobby:** `showLobby(result.rewards)` already fires the **return-toast**. Keep it, and add a **one-line nudge** under it: **"Стало важче — поклади кубик і спробуй знову"** (only shown after a *loss*, not after a level-clear). The **Білдер** button gets the **NEW glow** if the player gained cubes this run (they always do — every stage win granted one early, and Essence/coins always accrue).
3. **The push:** the lobby's **"Далі:" line** flips to the actionable fix: **"Далі: підсиль героя — застряг на Етапі N (Еліт)"**. Tier-aware: if the wall was an elite/boss, name it so the player understands *why* it spiked.
4. **The retry:** В БІЙ resumes from the **checkpoint** (kept stage). Because `genEnemy` is deterministic per (level,stage), a player who added even 1–2 cubes will feel the difference immediately — the AFK Arena "accumulate a little power → the wall yields" loop, compressed.

**Anti-frustration guarantees (all already supported by our economy — just surface them):**
- **No run is zero:** loss still banked every cleared stage's reward + `ESSENCE_PER_FIGHT` + `XP_LOSS=10`. The loss screen *shows* this tally so the player sees progress, not a goose-egg (VS philosophy).
- **Checkpoint, never restart:** the loss screen explicitly says "checkpoint збережено · Етап N" so the player knows they won't redo 1–19.
- **Unlimited retries, no energy:** never add an attempt cost on losses; the wall is power, not tickets (AFK Arena).
- **Soft auto-suggest (optional, F-11):** if the player loses the *same* stage ≥3× in a row, the return nudge upgrades to a concrete tip ("Спробуй більше Сили (червоні) — ворог броньований" derived from the enemy archetype), echoing Leek Wars' learn-from-the-replay loop without exposing raw numbers.

---

## D. Reward & Win-Presentation Choreography (the polish core)

Design rule (study north-star #5 — "juice is a discipline"): **one dominant event per beat**, hero always readable, debris behind / hero in front, big effects reserved for big moments, **sound carries ~40% of feel**. Every popup is **canvas-drawn** (no DOM) so it composites with the existing VFX layer in `gauntlet-fight.ts`. All timings are *defaults (🎚️)*.

### D.1 — Stage win (mid-run, brief — fires every ~10–20s, the heartbeat)

This is **the** beat to over-polish, because it repeats 19× per level. Keep it **short, punchy, non-blocking** (auto-advances). Extend `drawResultBanner2`'s inter-stage branch:

- **t=0** (kill confirmed): **hitstop ~80ms** + a short **win chime** (rising 2-note). The defeated enemy bursts to debris (already happens).
- **t=0.05s:** **"Етап пройдено!"** text scales-in (pop from 0.6→1.0 with slight overshoot, ~180ms) — *not* a full-screen dim; use the existing light band so the fight stays visible.
- **t=0.10s:** **coin spray** — N gold ⬡ particles arc from the dead enemy toward the **HUD coin counter**, which **bumps-scale (1.0→1.2→1.0)** as they land (VS gem-vacuum, scaled down). N scales with tier (minor ~6, elite ~12, boss ~20).
- **t=0.15s (if cube granted):** a **cube token** (the real cube colour) **flies from enemy to the Білдер button**, which pulses. On L1 stages 0–9 this is guaranteed (the onboarding schedule).
- **t=0.20s:** the **node bar** node flips minor→✓ with a small green tick-pop; the track fill animates forward.
- **t≈0.9s:** auto-advance to next stage's VS card. **Total ≤ 1.0s** — never let the heartbeat drag.
- **Tier flavour:** elite win adds a **gold flash** + heavier chime; the spray is denser. (Boss = §D.2.)

### D.2 — Level complete (boss cleared — the big fanfare, ~once per level)

This is the **payoff ceremony**; it *should* take a beat (~2.5–3.0s) before exit. Replace the current 1.6s silent auto-exit:

- **t=0:** boss death = **max juice already in code** (screenshake, big burst). Add a **deep boom + triumphant sting**.
- **t=0.2s:** screen dims (existing full banner), **"РІВЕНЬ N ПРОЙДЕНО"** in big gold type with a **shimmer sweep**; the hero does a victory jiggle on the pedestal-style center.
- **t=0.6s:** a **reward roll-up** lists the boss reward (4× tier) as **counting-up numbers** (XP, ⬡, cube) — the slot-machine count-up that mobile reward UIs use (Game UI Database "Rewards & Experience").
- **t=1.2s:** **"Далі: Рівень N+1"** preview slides in with the *new* level's first node bar peeking (Archero chapter-chain anticipation).
- **t=2.6s:** "**Продовжити →**" button (or auto-exit). On exit, lobby return-toast says "Рівень N пройдено!" (already supported via the `levelUp`/rewards aggregation).

### D.3 — Hero level-up (+pixel budget — can fire mid-run or on return)

Currently surfaced only as a lobby toast string. Add an **in-the-moment pop** wherever it occurs (battle or lobby):

- A **bright bar-fill-to-full → flash → reset** on the XP bar, with a **"РІВЕНЬ ↑ N"** badge that pops above it.
- A **"+1 кубик у білдер"** sub-line (the level grants 1–2 loot cubes + budget).
- Sound: ascending **level-up jingle** (distinct from stage-win chime so the player learns the two).
- If multiple level-ups in one reward (possible from a long run), **stack them with a quick 0.25s stagger** ("РІВЕНЬ 3 ↑", "РІВЕНЬ 4 ↑") rather than collapsing to one — each level is a dopamine unit.

### D.4 — New cube earned (the collectible delight)

Every cube is a small Spore/Backpack "I got a part" moment. Differentiate by **rarity** (real `RARITY_WEIGHT`):

- **Common:** the standard fly-to-builder token (§D.1).
- **Rare/Epic/Legendary:** add a **rarity glint** (white sweep), a **brighter particle burst** in the rarity colour, and a **distinct "rare get" chime**. A small **"Рідкісний кубик!"/"Епічний!"** label flashes. (Backpack "item variety = retention"; the rarer the louder.)
- **First-ever of a type:** a one-time **"Новий тип: <ім'я>"** banner (discovery callout — VS "no run is zero" first-time awards). Track a `seenTypes` set in `SaveState`.

### D.5 — Chest open (the deliberate slot-machine)

The chest is the one place to lean into **anticipation → reveal** (VS hardcoded-generous-early chests; the *animation* matters as much as the loot):

- **Tap Скриня (50⬡):** coins counter **deducts with a down-tick**; a **chest sprite** slides to center.
- **Rattle (~0.5s):** chest shakes with increasing intensity + rising "charging" sound — build suspense.
- **Burst (~0.2s):** lid pops, **light beam**, the cube(s) **erupt** (we grant 1 per chest), then **arc to the inventory/builder**.
- **Reveal card:** the cube's name + rarity flashes (reuse §D.4 rarity flavour). Then return to lobby idle.
- **Empty-wallet guard:** already handled (`info: 'Недостатньо монет'`) — make the chest button **visibly dim/locked** below 50⬡ so the player doesn't tap into a dead-end (preview the gate).

### D.6 — Coins & XP micro-gains (the constant drip)

- **Coins:** the HUD ⬡ counter should **tween up** (not snap) and **scale-bump** on each gain — the "number goes up" satisfaction (NGU). 
- **XP:** the bar **animates fill** smoothly toward `xpToNext`; when it crosses a level, hand off to §D.3.
- These are the *fast clock* — they must produce a visible micro-event on **every** stage clear so there are "no dead seconds" between the bigger beats (VS).

### D.7 — Sound map (cheap, high-impact — ~40% of feel)

| Event | Cue |
|---|---|
| Stage win | rising 2-note chime |
| Coin land | light "ting" per coin (capped/round-robin to avoid spam) |
| Cube fly-in | soft "pock" |
| Level-up | ascending jingle |
| Rare+ cube | sparkle "shing" |
| Boss intro | low boom |
| Level complete | triumphant sting |
| Chest rattle→open | charging hum → wooden "ka-thunk" + sparkle |
| Loss | soft descending "aw" (gentle, never harsh — anti-frustration) |

---

## E. Progression Pacing & "What's Next"

**Difficulty/reward curve (from real `campaign.ts`):** within a level, `ramp + sine wave` makes difficulty **undulate** (a tough stage, then a breather) rather than a flat ramp — this is good *feel* (VS "trickling vertical"), and the **elites at 5/10/14 + boss at 20** are the visible milestone spikes. Reward scales with tier (2×/4×) so the spikes *pay*. Keep this; just make the spikes **legible on the node bar** (they already are: gold diamonds, 💀).

**Always-on "what's next" (the single most important retention UI — Melvor):** add a persistent **"Далі:" line** on the lobby (just under the HUD) that names the *immediate* chase, priority-ordered:
1. If a loss just happened → **"підсиль героя — застряг на Етапі N"** (§C).
2. Else if next stage is an elite/boss → **"Етап M — Еліт/Бос"**.
3. Else if within ~30 XP of a level → **"Рівень N+1 → +1 кубик"** (almost-there nudge).
4. Else if coins ≥ 50 → **"Відкрий скриню"**.
5. Else → **"Етап M/20"**.

**Session shape:** a session = a handful of В БІЙ pushes (each ~1–4 min of watched stages) interleaved with builder/chest spends. The **checkpoint** means sessions resume instantly; the **node bar** gives a within-session "I got to stage 12" achievement (Archero clarity). 

**Return hooks (medium clock — seed now, even pre-offline-system):**
- The **boss node** at the end of the current level is an always-visible "destination" (Soda Dungeon visible-horizon).
- The **"Далі:" line** survives reload (it's derived from `SaveState`), so a returning player instantly re-reads their goal.
- *(Future, per `player-experience.md`)* offline auto-grind cap, daily fight allowance, season — tease as a single **"Скоро"** ghost slot now; ship later.

---

## F. Implementation Backlog (prioritized, bite-sized, against real modules)

Ordered by **impact-on-the-passing-feel ÷ effort**. Each is small and local to an existing module. Nothing here touches `src/sim` (purity/determinism preserved).

1. **Polish the stage-win pop (§D.1)** — in `gauntlet-fight.ts` `drawResultBanner2` (inter-stage branch) + `handleStageEnd`: add scale-in "Етап пройдено!", **coin spray → HUD counter bump**, **cube fly-to-Білдer token**, node ✓ tick-pop. Reuse existing `particles2`/`burst2`/`spark22`. **This is the heartbeat — do it first.**
2. **Animate the HUD counters (§D.6)** — in `lobby-view.ts` `drawHUD` (and the battle HUD): tween Coins up + scale-bump on gain; smooth XP-bar fill. Hold a small `displayCoins/displayXp` lerp state.
3. **Reframe the loss banner (§C.1)** — `drawResultBanner2` defeat branch: "Поразка на Етапі N" + "Майже! Ти зібрав:" run-tally (from the `rewards` array) + relabel button to "Покращити героя →" + add a small "Ще раз" retry-this-stage button.
4. **Add the lobby "Далі:" line (§E)** — `lobby-view.ts` `drawHUD`: one derived line under the HUD, priority-ordered from `SaveState` + last `result.outcome`. Pass `lastOutcome` through `app/main.ts` `showLobby`.
5. **Level-complete ceremony (§D.2)** — `gauntlet-fight.ts` boss branch in `handleStageEnd`/`drawResultBanner2`: replace the silent 1.6s exit with the ~2.6s gold "РІВЕНЬ N ПРОЙДЕНО" + count-up roll + "Далі: Рівень N+1" preview + "Продовжити →".
6. **Level-up pop (§D.3)** — wherever a `levelUp` `RewardEvent` lands (battle reward + lobby toast): XP-bar flash + "РІВЕНЬ ↑ N" badge + "+1 кубик" sub-line; stack multi-level-ups with a stagger.
7. **Button states / badges (§B, §A)** — `lobby-view.ts` `drawButtons`: NEW "1" badge on **Білдер** when cubes were gained this run; **glow** on **Скриня** when `coins ≥ CHEST_COST`, **dim/locked** when below; one-time **finger cue on В БІЙ** for a brand-new save (level 1, stage 0, default build).
8. **Chest-open choreography (§D.5)** — currently instant in `app/main.ts` `onChest`. Route through a short canvas sequence (rattle→burst→reveal) before `showLobby(events)`; reuse §D.4 rarity flavour. Keep the `Недостатньо монет` guard but also dim the button.
9. **Rarity flavour on cube get (§D.4)** — shared helper used by stage-win, chest, and loot: glint + colour burst + label keyed off `CUBES[type].rarity`. Add `seenTypes:string[]` to `SaveState` (+ save-version bump) for the one-time "Новий тип" callout.
10. **Builder onboarding coach + recipe-glow (§A aha)** — `builder-view.ts`: a 3-step first-entry finger coach (place adjacent → place 2 more → land the Spike line) gated on a `SaveState` flag; partial-recipe **~70% glow** for «Шип» and the connector flash on completion (Backpack blue-line). *(Largest item — schedule after the cheap juice wins 1–7.)*
11. **Stuck-stage auto-tip (§C optional)** — track consecutive same-stage losses in `SaveState`; at ≥3, upgrade the "Далі:" nudge to an archetype-derived hint from `genEnemy`'s archetype (e.g. armored → "більше Сили").
12. **Sound layer (§D.7)** — add a tiny canvas-side SFX map (WebAudio) keyed to the existing `CombatEvent`/`RewardEvent` streams. Cheapest big feel-multiplier; do once the visual beats land. **Keep Essence out of the HUD until it has a sink** (don't surface a dead counter).

**Top 8 (the order to ship):** 1 (stage-win pop) → 3 (loss reframe) → 2 (counter tweens) → 4 ("Далі:" line) → 7 (button badges/cue) → 5 (level-complete ceremony) → 6 (level-up pop) → 8 (chest choreography). Items 9–12 are the polish tail.

---

*All numbers are tunable (🎚️). Sources cited inline; full competitor analysis in `docs/research/2026-06-05-competitors-and-references.md`. This design is implementable entirely on the existing Canvas2D screens (`lobby-view.ts`, `gauntlet-fight.ts`, `builder-view.ts`, `app/main.ts`) and the pure `meta.ts`/`campaign.ts` reward data — no engine/sim changes.*

Sources: [Capybara Go beginner guide (BlueStacks)](https://www.bluestacks.com/blog/game-guides/capybara-go/cbg-beginners-guide-en.html), [Survivor.io vs Archero teardown (Naavik)](https://naavik.co/deep-dives/survivorio-archeros-footsteps/), [AFK Arena idle/progression (Macmillan)](https://alexandremacmillan.com/2019/06/13/idle-mechanics-and-monetizing-progession-in-afk-arena/), [AFK Arena flexible-time session design (Game Developer)](https://www.gamedeveloper.com/design/flexible-time-session-design-in-afk-arena), [How mobile games reward everything (GameGrin)](https://www.gamegrin.com/articles/how-mobile-games-learned-to-reward-almost-everything/), [Game UI Database — Rewards & Experience](https://www.gameuidatabase.com/index.php?scrn=54).
</content>
</invoke>
