# PocketHero — Player Experience & Progression Arc (v0.1)

*Date: 2026-06-05. Status: draft for director review. Every number below is a **proposal-default** (🎚️) — react and retune freely. Each major choice cites the reference it is drawn from in `docs/research/2026-06-05-competitors-and-references.md`.*

This document answers: **how a player starts, how they progress, what unlocks and in what order, and the retention/economy cadence** — grounded in the 19-title competitor study and in the *real* content that already exists in `src/data/` (22 cubes, 6 adjacency synergies, 4 shape recipes, 8 moves).

---

## TL;DR — The Player Journey in 10 Lines

1. **Start (0:00):** you place ONE pixel — the **Ядро/Core** — name it, and you are immediately thrown into your first auto-fight. No menus. *(My Brute instant first fight.)*
2. **First win (0:40):** you watch your blob win, earn XP, and hit Level 2 → **+1 pixel** to place wherever you like. *(Vampire-Survivors "reward every ~23s".)*
3. **The aha (2:00):** at ~Level 4 you place a 3rd **Сила/Force** in a row — a **blue connector line** lights up and the **«Шип» (Spike)** recipe unlocks your first *technique* (sword). You did that. *(Backpack Battles blue-line; HoloCure collab-weapon reveal.)*
4. **Core loop (per session):** watch fight → earn XP + Shards → spend the level on a pixel → re-fight a tougher ladder rung. The **3 idle clocks** tick: combat juice (seconds), offline cap (hours), ladder season (weeks).
5. **Hours 1–3:** you grow from a 1-pixel dot to a ~15-pixel creature, unlock 2–3 recipes, and the ladder reveals **PvE arenas**.
6. **Hour 3 (~Level 15):** **async PvP** + your **`pockethero.gg/fight/<heroId>` challenge link** unlock — the virality moment. *(My Brute pupil link.)*
7. **Hours 3–10:** rare/epic cubes, magic axis (Mana + Ember/Frost), more recipes, MMR climb; you start theorycrafting a *named build*. *(NGU gradual reveal.)*
8. **Hour 10–50:** legendary cubes (Аркана), all 8 moves reachable, seasons, and the **Prestige** decision — evolve your hero into a new pixel-form and keep its biography. *(Soda Dungeon prestige horizon; Spore named saveable builds.)*
9. **Endgame:** climb ladder seasons, chase the recipe-discovery long tail, build a sharable signature hero, recruit challengers. Meta-gold (**Essence**) always increments so **no run is ever zero**. *(Vampire Survivors meta-gold.)*
10. **Monetisation:** cosmetic-only, one-time, **never pay-to-win** — no purchasable cubes, recipes, slots, or stats. *(The Bazaar cautionary tale; Backpack Battles / Super Auto Pets fair-pricing moat.)*

---

## A. First Session / Onboarding (first 5 minutes)

**Design principle:** zero menus before the first fight. My Brute's entire growth engine rested on "create in 30 seconds, watch it fight, go tell friends." PocketHero copies that floor exactly, then layers the build-craft on *after* the first dopamine hit, not before.

| Time | What the player sees / does | Reference |
|---|---|---|
| **0:00** | Cold open on an empty grid with a single glowing **Ядро/Core** (yellow, `star` glyph) already placed at `[0,0]`. One field: "Name your hero." That's the whole creation step. | My Brute 30-second creation; Spore "name your creation → attachment spikes". |
| **0:15** | "FIGHT" button. Tap it. No loadout, no shop. Your 1-pixel blob walks into a diorama arena (Route-B, locked art) against a scripted **tutorial dummy** (also ~1 pixel). | My Brute instant first fight; Super Auto Pets no-lobby arena. |
| **0:20–0:40** | The fight auto-resolves with full juice — your blob `fist`-punches (the default move, `req: () => true`), screenshake + hit-flash + a flying damage number, soft-body jiggle on each hit. You win. *Watching is the gameplay.* | Vampire-Survivors "no dead seconds"; Dead-Cells juice ceiling (locked art). |
| **0:40** | **First reward.** Victory banner → XP bar fills → **LEVEL 2** → a single pixel-token pops into your hand: "+1 pixel — place it." A palette opens showing only the 3 starter commons: **Тіло/Vital (green)**, **Сила/Force (red)**, **Броня/Plate (steel)**. | Vampire-Survivors reward cadence; NGU "start with ONE thing". |
| **0:50** | You drag the pixel onto any cell **orthogonally adjacent** to the core. The blob visibly grows and re-jiggles. This is the **authorial-responsibility** beat: *you* changed the creature. | Spore constrained authorship; Wobbledogs "feed → change shape". |
| **1:00–2:00** | Fight #2 → win → Level 3 → place again. Fight #3 → Level 4. By now the player has a ~4-pixel creature with a distinct silhouette. | Vampire-Survivors "trickling vertical" power curve. |
| **~2:00 — THE AHA** | When the player places a **3rd Сила/Force in a straight line**, a **blue connector line** snaps across the three reds and a toast fires: **«Шип» (Spike) unlocked → your hero can now swing a *sword*** (`sword` move, `req: force>=3`). The next fight visibly opens with a sword swing instead of a punch. | Backpack Battles blue-line ("discovery happens in the grid, not a recipe book"); HoloCure collab-weapon reveal moment. |
| **~3:00** | Toast: "Your hero has a **page**. Save it. Share it later." (Link not yet active — seeded as a promise.) A "WATCH AGAIN" replay button appears on the last fight. | Leek Wars replay-to-learn; My Brute shareable-snapshot promise. |
| **~4:00** | Soft offline hook surfaces: "Away? Your hero keeps fighting the PvE ladder (cap 🎚️8h)." First *medium-clock* seed planted. | Melvor 8h offline cap; idle 3-clock model. |

**The "aha" is specifically the first recipe.** It must land inside the first 5 minutes and it must be a *real* recipe from `src/data/traits.ts` (Spike), reachable with only the 3 starter commons — so the very first build choice can produce it by accident-but-feels-intentional. That "I made a technique appear" moment is the Backpack-Battles / HoloCure fusion-reveal, and it is the single most important onboarding beat.

**What the player does NOT see in session 1:** rarities, magic, Mana, Catalyst, MMR, currencies beyond XP, the challenge link being live, prestige, traits other than Spike. (See section D.)

---

## B. The Core Loop (per session) — Mapped to the 3 Idle Clocks

```
   ┌──────────────────────────────────────────────────────┐
   │  FIGHT (auto, watch or instant-resolve)              │
   │     → XP + Shards (+ Essence meta-gold, always)      │
   │        → LEVEL UP: +1 pixel token                    │
   │           → PLACE on grid (adjacency = synergy)      │
   │              → stronger / different hero             │
   │                 → next ladder rung / next opponent ──┘
```

The research's **"3 clocks, one always ticking"** model (Eric Guan idle principles + Vampire-Survivors cadence + Melvor milestones + Soda Dungeon prestige) maps to PocketHero as:

| Clock | Window 🎚️ | What ticks in PocketHero | Reference |
|---|---|---|---|
| **Fast** | 0.5–3 s of combat | Pixel/technique activations, debris, hit-flash, damage numbers, ATB-gauge fills, status procs (burn/slow/shock). Something visible *every fight-second*. | Vampire-Survivors "reward every 23s" → tightened to per-second micro-events; Brotato colour-coded procs. |
| **Medium** | 6–8 h offline cap | Offline PvE auto-grind accrues XP + materials to a cap; daily fight allowance (🎚️ soft cap ~10 ranked PvP/day) refreshes; "collect your offline haul" loss-aversion pull. | Melvor 8h cap; My Brute daily fight cap as 24h return hook; idle "loss of opportunity" principle. |
| **Slow** | 7–30 days | Ladder **season** reset with cosmetic rewards; new recipe-discovery long tail; **Prestige** horizon (evolve form). | Soda Dungeon prestige horizon; Almost a Hero weekly seasons; Backpack-Battles content-cadence warning. |

**Two loop modes, one sim** (already an engine invariant — deterministic, headless-capable): the player can **watch** the fight (juice, the "wow") *or* **instant-resolve** it (idle convenience). Same seeded simulation, different front-end. *(GDD §4.1; lets the game be "played in the background" — pillar 6.)*

**The meta-gold rule (non-negotiable):** every fight, win *or* loss, increments **Essence** (the cross-run meta currency). This is the Vampire-Survivors "no run is zero" lesson — a lost PvP match still funds permanent progress, so laddering never feels punishing.

---

## C. Progression Arc (hours 1 → 10 → 50) — The Unlock Ladder

**Pacing philosophy (NGU Idle):** the game "starts with ONE thing and adds another after hours of play; never frontloads complexity." Recipes, magic, rarities, and PvP **drip in over the first week**, not the first hour. Below, every cube/recipe/move name is **real content from `src/data/`**.

### Unlock-Ladder Table

| Milestone (Level / ~Time 🎚️) | What opens | Real content referenced | Why here (reference) |
|---|---|---|---|
| **L1 / 0:00** | Core placed, name hero, first fight, `fist` move | `core`; move `fist` (`req: always`) | My Brute instant creation→fight. |
| **L2 / 0:40** | +1 pixel/level begins; starter commons palette | `vital`, `force`, `plate` | Vampire-Survivors first reward fast. |
| **L4 / ~2:00** | **First recipe** = «Шип»/Spike → `sword` | shape `spike`; move `sword` (`req: force≥3`) | Backpack Battles blue-line aha. |
| **L5–6 / ~3:00** | Agility commons + first defensive recipe | `swift`; move `bow` (`req: swift≥2`); shape `bastion` (2×2 `plate`) | Idle Champions adjacency legibility; SAP composability. |
| **L7 / ~4:00** | Adjacency synergies become visible (blue-line tutorial proper): «Лезо», «Форпост», «Потік» | synergies `blade` (force↔force), `outpost` (plate↔vital), `flow` (swift↔swift) | Backpack-Battles connector lines as the teacher. |
| **L8 / ~5h play** | **Magic axis unlocks** (the first *big* new system) | `mana`, `ember`, `frost`; moves `fire`/`frost` (`req: element≥1 & mana≥1`); synergy `kindle` (ember↔mana) | NGU drip-gate of a second system layer hours in. |
| **L10 / ~2h** | **Rare cubes** appear in level-up palette | `regen`, `pierce`, `block`, `thorns`, `haste`, `catalyst`, `spark`, `poison` | Backpack-Battles "item variety = retention". |
| **L10 / ~2h** | Recipes «Серце»/Heart, «Рівновага»/Balance; synergies `amplify`, `venomweave` | shapes `heart` (5 vital cross), `balance` (mirror symmetry); move `spark`, `venom` | Spore symmetry-as-virtue (Balance rewards mirroring). |
| **L15 / ~3h — VIRALITY GATE** | **Async PvP + ranked ladder + live challenge URL** | snapshot upload; MMR/Elo; `pockethero.gg/fight/<heroId>` | My Brute pupil link; The Bazaar ghost-PvP; Spore auto-share. |
| **L15+ / ~3h** | **PvE arenas** themed by difficulty band (cosmetic diorama skins) | Route-B arenas (locked art) | Melvor named milestones; "always know what you're working toward". |
| **L20 / ~6h** | **Epic cubes** | `lifesteal`, `berserk`, `ward`, `evasion` | Sustained discovery cadence. |
| **L25 / ~10h** | Daily/weekly **challenge objectives** + leaderboard bands | daily fight allowance; season board | Almost a Hero weekly seasons; My Brute daily cap. |
| **L30 / ~15h** | **Legendary cubes** (capstone identity) | `arcane` (Аркана); move `arc` (`req: arcane≥1 & mana≥1`) | NGU late-game depth; capstone "wow" spell. |
| **L40 / ~30h** | **Prestige unlocked** (the slow-clock reset choice) | hero evolves to a new pixel-form; keeps name + biography | Soda Dungeon "relics carry over" vs NGU rebirth — director chooses (Q5). |
| **L50+ / ~50h+** | Endgame: season ranking, recipe long-tail mastery, signature-hero gallery, recruit challengers | full 22-cube / 6-synergy / 4-shape / 8-move space | My Brute build-theorycraft community; Leek Wars 10-year retention. |

### Grid-size growth
Grid is **uncapped but pixel-count-gated by level** (you get exactly +1 placeable pixel/level, GDD §3). So "grid size" = your level. 🎚️ Suggested silhouette beats: ~4 px (L4, first technique), ~15 px (L15, PvP-ready, comparable to the `hero`/`mage` presets in `src/builds/presets.ts`), ~30 px (L30, comparable to `brute`), ~70 px (L50+, comparable to `titan`). The four existing presets are literal **progression mileposts** the player's own hero passes through.

### Recipe-discovery as the content engine
The 4 shapes + 6 synergies + 8 moves are the launch discovery space. Per the Mechabellum/Backpack-Battles warning ("you can't keep adding pieces; the game gets stale once builds are seen"), PocketHero's edge is **combinatorial**, not additive: the value is in *fitting multiple recipes into one finite body* (e.g. squeezing Spike + Bastion + Kindle into a 15-pixel hero where Core stays buried = a Backpack-Battles-grade packing puzzle). **Open question Q1** is how big this space must be at launch.

---

## D. Feature Gating & Sequencing (the Backpack-Battles legibility principle)

> *"Discovery happens in the grid, not in a recipe book."* The blue-line system worked because Backpack Battles **revealed one relationship at a time**. PocketHero hides everything that isn't load-bearing for the *current* decision.

**Hidden in session 1 (revealed later):**
- **Rarities** — the palette shows only commons until L10. Player never sees an "epic" they can't get. *(Avoids choice paralysis; NGU gradual reveal.)*
- **Magic / Mana / Catalyst / elements** — entirely absent until L8. Magic is the *second* system, introduced as an event, not a launch dump. *(NGU "add another after hours".)*
- **Currencies** — only XP is visible early. **Shards** (respec) surface at first respec prompt (~L6); **Essence** (meta-gold) surfaces when PvP unlocks (~L15). *(Don't show a wallet the player can't fill.)*
- **MMR / ladder / PvP** — hidden until L15. Showing rank to a 4-pixel blob would feel like a loss; showing it to a 15-pixel authored hero feels like graduation. *(Mechabellum opponent-visibility only matters once builds exist.)*
- **Prestige** — invisible until ~L35, then shown as a *horizon* (Soda Dungeon: "always show what the next reset unlocks") well before it's actionable at L40.
- **Adjacency math / exact stat tooltips** — early game teaches via **colour + line + glow** (red pixel → red particle; partial recipe glows at 60–80% complete). Numeric tooltips are an opt-in "advanced" toggle. *(Brotato "colour is the tooltip"; art-direction §4 "semantic colour is sacred".)*

**Revealed deliberately (the drip schedule):** see the unlock ladder. The rule: **one new system per session-arc**, each announced with its own toast + first-use highlight, never two at once.

**Anti-overwhelm guard:** at any level the player's *immediate* choice is always just "which one pixel do I place, and where." Depth is emergent from that single repeated decision (Super Auto Pets "easy to learn, infinite to master" via composable trigger/effect/target — here: cube-type × position × adjacency).

---

## E. PvP / Virality Layer (the My-Brute acquisition engine)

**Core mechanism — the challenge URL.** Every meaningful build change uploads a **snapshot** (build + stats + cosmetic) to the server (GDD §8). That snapshot has a permanent public page:

```
pockethero.gg/fight/<heroId>
```

Opening it loads the hero's **silhouette + name + biography (W/L, notable kills, first technique)** and a single **"FIGHT THIS HERO"** button. Zero friction to challenge — the My-Brute pupil link reborn for 2026. *(Research north-star #2; Spore auto-share; My Brute 1.7M daily visits via forum-signature links.)*

**When it unlocks:** L15 (~3h), gated behind having an *authored, PvP-ready* hero (~15 px). Before that the link is teased but inert (onboarding minute ~3) so the promise is planted early and paid off at graduation.

**Ghost-PvP framing (The Bazaar / Super Auto Pets, model B pure-auto — LOCKED).** You never wait for a live opponent. Matchmaking pulls a **snapshot ghost** at your MMR band, runs the **deterministic seeded sim** server-side (anti-cheat re-sim, GDD §8), and you **watch the replay** or instant-resolve. *(The Bazaar "go AFK, return to a real human's build"; SAP no-timer arena.)*

**Virality reinforcers (drawn from the research):**
- **Challenge-receiver bonus** — when someone fights *your* hero via your link, *you* get a small Essence/XP trickle (capped, to avoid My-Brute's pupil-spam exploit). Sharing is literally how you progress faster — the social pressure is baked into the number that matters. *(My Brute pupil-XP, with the "AVOID: no cap" fix.)*
- **Watchable replays, not just screenshots** — the deterministic engine means any fight is a re-playable, embeddable clip (the 2026 equivalent of forum signatures = Discord/X embeds + short-form video). *(Research open-question #3; Leek Wars replay obsession.)*
- **Hero biography page** — W/L history, notable fights, build evolution timeline. The creature's *story* is the share-bait. *(Wobbledogs memorial layer; My Brute "look what my brute just got".)*
- **Public hero gallery** — browsable, copy-pasteable, "remix this build" — the Spore Sporepedia for pixel heroes.

**Pure-auto for v1 (LOCKED, GDD §4.4 model B):** no scripting, no live input in PvP. The build *is* the skill expression, exactly like My Brute's zero-skill-floor — the build-craft carries the depth, not reflexes.

**Opponent-pool risk (research Q4):** at launch the ghost pool is tiny. Mitigation: seed the pool with **hand-crafted bot builds that look player-made** (named, plausible silhouettes, varied recipes), retired as real population grows. Director sign-off needed (see open questions).

---

## F. Economy & Retention (Vampire-Survivors meta-gold, NON-pay-to-win)

**Currencies (🎚️, from GDD §7, all earnable, none purchasable-for-power):**

| Currency | Earned from | Spent on | Clock | Reference |
|---|---|---|---|---|
| **XP** | every fight | levels → +1 pixel | fast/medium | the main axis (GDD §7). |
| **Shards** | fights, daily objectives | **respec** (move/swap pixels) | medium | encourages experimentation → "easy to learn" (GDD §3). |
| **Essence** (meta-gold) | **every fight, win or loss** + offline cap + challenge-receiver bonus | permanent meta perks (small, non-PvP-warping — e.g. offline-cap +1h, extra daily fight, faster recipe-glow hints, cosmetic unlocks) | slow | **Vampire-Survivors "no run is zero"** — the single most important retention lesson in the research. |

**Why Essence can't be pay-to-win:** its sinks are *convenience and cosmetic*, never stat power. You cannot buy a cube, a recipe, a pixel slot, or a stat. *(The Bazaar near-death by paid-pass; Backpack-Battles / SAP fair-pricing moat; research north-star "avoid pay-to-win".)*

**Daily / return hooks (the medium clock):**
- **Offline auto-grind** with a 🎚️6–8h cap → loss-aversion pull to collect. *(Melvor 8h cap.)*
- **Daily ranked fight allowance** (soft cap ~10 🎚️) → guaranteed 24h return cycle. *(My Brute daily fight cap = its return engine.)*
- **Daily objectives** ("win with a magic build", "unlock a new recipe") → directed short-session goals. *(Melvor named milestones always on UI.)*
- **Always-visible "what's next"** banner: next pixel, next recipe within reach, next rarity tier, season time-left. *(Melvor "always know what you're working toward this session".)*

**"No run is zero" stack (Vampire-Survivors philosophy):** first-time-recipe discovery awards, first-kill-by-technique callouts, offline gains, and Essence-on-loss together guarantee every session — even a losing PvP streak — produces *visible* permanent progress.

**Prestige & the slow clock (research Q5 — director call):** at L40 the player may **Prestige**: the hero evolves into a **new pixel-form** (a fresh silhouette template), resets levels for faster re-climb, and **keeps its name + biography + cosmetic palette** (Soda-Dungeon relics-carry-over flavour, NOT a hard death). The horizon is shown from ~L35 so the reset reads as *strategy and aspiration*, not loss. *(Soda Dungeon visible prestige horizon; Spore named-saveable identity persistence.)*

---

## G. Monetisation Stance (principled, short)

**Red line (LOCKED by research):** *no pay-to-win.* Spending never grants a cube, recipe, adjacency bonus, pixel slot, stat, MMR, or fight outcome. The Bazaar's paid battle-pass nearly "strangled itself to death"; Backpack Battles ($9.99 one-time) and Super Auto Pets (free base + fair expansions) thrived; My Brute *died from no revenue + content stagnation*. The lesson is a narrow lane: **fund ongoing content without touching competitive fairness.**

**Proposed model (🎚️):**
- **Cosmetic pixel palettes** — alternative Endesga-32-scale colour ramps for your cubes (the locked palette stays semantic; cosmetics shift *value/finish*, never hue-meaning). *(Art-direction §1 palette discipline; SAP "no gameplay advantage".)*
- **Hero name/title cosmetics & "patron dojo"** — a prestige display for your hero gallery page. *(Research monetisation-question suggestion.)*
- **One-time content packs** — new *authored* recipe/cube *sets* sold as expansions that remain matchmaking-fair (everyone faces the same content; owning a pack adds build options, not raw power) — Super Auto Pets' model, the highest-goodwill precedent in the study.
- **Never:** subscription, XP-doubler, gacha pixels, energy-to-fight paywall.

**Content roadmap is itself a retention feature** — My Brute collapsed within 18 months for lack of updates; a *visible* recipe/cube cadence is the antidote (research "AVOID: stagnation").

---

## H. Open Questions for the Director

1. **Recipe-space size at launch (research Q1).** 4 shapes + 6 synergies + 8 moves is the current real content. Backpack Battles lost players once builds were "all seen." **How many distinct recipes must ship to sustain a month of daily play — and is the space authored or procedurally generated from pixel-grammar rules?** This sets whether the discovery arc lasts weeks or days.

2. **PvP unlock gate: L15 vs earlier?** I propose L15 (~3h, ~15-pixel authored hero) so PvP reads as graduation. But the My-Brute virality engine is the #1 growth lever — **do we risk a thinner-but-earlier challenge-link (e.g. L8) to get sharing into more players' hands sooner**, accepting less-authored heroes in the early ghost pool?

3. **Cold-start ghost pool (research Q4).** Async PvP needs thousands of ghosts to feel human. **Do we ship hand-crafted "looks-player-made" bot builds to seed low-population bands, and what's the trigger to retire them?** Without a plan, early PvP feels like fighting the same 5 builds.

4. **Prestige philosophy (research Q5).** I propose "evolve to a new form, keep the biography" (Soda-Dungeon flavour, not death). **Does the hero ever truly *die* (My-Brute permanence) or always evolve (NGU rebirth)?** The emotional stakes of reset-vs-keep are huge and define long-term attachment.

5. **Daily fight cap — hard or soft?** My Brute's *hard* cap was its return engine but also its frustration ceiling. **Soft cap (diminishing rewards past ~10/day) or hard lock?** Affects whether the game respects or punishes the engaged player.

6. **Meta-gold sinks — where exactly is the convenience/power line?** Essence-on-loss is locked as the "no run is zero" mechanism, but **which perks are "fair convenience" (offline-cap, hint-glow, extra daily) vs over the line (anything that touches a fight outcome)?** One ambiguous sink (e.g. "respec discount in-season") could erode the no-pay-to-win promise.

---

*Sources: all reference names above are from `docs/research/2026-06-05-competitors-and-references.md`. All cube/synergy/shape/move IDs are real content in `src/data/{cubes,traits,moves}.ts`; preset silhouettes from `src/builds/presets.ts`. Visual beats respect the LOCKED art direction (`docs/2026-06-05-pockethero-art-direction.md`): Route-B billboard, semantic colour, Dead-Cells juice ceiling. Async ghost-PvP is model B pure-auto per GDD §4.4.*
