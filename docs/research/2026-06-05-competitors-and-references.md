# PocketHero: Competitor & Reference Research Report

**Date:** 2026-06-05  
**Prepared for:** PocketHero — web-based idle auto-battler (PixiJS, 2.5D billboard pixel-art)

---

## TL;DR — Five Bullets

1. **My Brute's referral loop is the template for async-PvP virality**: pupil links embedded in forum signatures drove 1.7 M daily visits by mid-2009 and 70 M brutes created — and the game required zero player skill to be "good at." The same frictionless invite-to-watch loop is PocketHero's strongest organic growth lever.
2. **Backpack Battles proves grid-adjacency synergies are a proven commercial hit** (640 K units in first month), but the mechanic needs a strong visual "blue line" feedback system and ongoing content cadence — it loses players fast once they've seen all the builds.
3. **The Bazaar's ghost-PvP structure (build a board → fight recorded snapshots of real opponents) is the closest working model for PocketHero's async PvP**, but The Bazaar's aggressive monetization nearly killed it; fair pricing is a moat.
4. **Vampire Survivors shows that upgrade-every-23-seconds cadence + permanent meta-progression gold = players never feel a run is wasted** — this is the idle/roguelite bridge PocketHero needs inside its PvE loop.
5. **Spore's Creature Creator hit 1 million uploads in one week because sharing was automatic and sharing was the game** — PocketHero's pixel-grid hero must be screenshot-shareable, copy-pasteable, and optionally embeddable as a "fight my hero" challenge link from day one.

---

## Bucket 1 — Build-a-Fighter + Async Spectator PvP

### My Brute / LaBrute (Motion Twin, 2009)
**One-line hook:** The original "create a character in 30 seconds, watch it fight automatically, go tell your friends" browser game — the direct ancestor of PocketHero's PvP loop.

**Why it matters:** My Brute is PocketHero's design DNA. Everything that made it viral — zero-skill-floor creation, randomised stat surprise, daily fight limits as FOMO engine, and a referral system wired directly into progression — maps almost 1:1 to what PocketHero should build.

**Core loop:** Character creation → 3–5 daily arena fights (fully automatic, player watches) → level up gaining a random stat, weapon, or pet → recruit pupils (real people) via a personal URL → earn XP per pupil recruited. The pupil/master system meant that every player was also a walking acquisition funnel: pasting your brute link into forum signatures, MSN status lines, and early social media was *how you levelled faster*.

**Retention & Virality mechanics:**
- Daily fight cap creates a guaranteed 24-hour return cycle.
- Pupil XP means the game is literally more fun if you recruit: social pressure is baked into the number that matters most (your level).
- Character generation was random on creation — you didn't know if you'd get a bear or a nun's habit as a weapon until level-up surprise. That unpredictability was shareable ("look what my brute just got!").
- Peak: **1.7 million daily visits**, **70 million brutes created** by mid-2009, within months of March 2009 launch. ([Wikipedia](https://en.wikipedia.org/wiki/My_Brute), [Grokipedia](https://grokipedia.com/page/my_brute))

**Monetization:** Free to play; the original had minimal explicit monetization (Flash era ad-revenue model). Decline was partly because there was no robust IAP layer and no content updates to sustain the playerbase. ([Brutoria Blog](https://brutoria.com/post-elbruto-en))

**STEAL:**
- Embed the "fight my hero" URL/link as the game's primary social unit. Every hero should have a shareable challenge link.
- Daily fight cap (even a soft one) as a return-tomorrow habit hook.
- Randomised per-level surprises (which pixel slot unlocks a technique the player didn't expect) as a gossip-generating delight.

**AVOID:**
- Stagnation: My Brute had almost no content updates after launch, and interest collapsed within 18 months. PocketHero must have a visible content roadmap.
- Flash-era single-platform lock-in. PocketHero's PixiJS web stack already avoids this.
- Pupil XP without a cap: high-level players who mass-recruited through spam had unfair progression — an exploit that damaged competitive balance and trust.

---

### Brutoria / Community Revivals (2020s)
**One-line hook:** Modernised My Brute clones confirm the formula still works, but none has cracked long-term retention beyond nostalgia.

A 2020 community revival of My Brute at [mybrute.eternaltwin.org](https://mybrute.eternaltwin.org/) maintains active play; Brutoria adds mythological themes. Brutes.io took the name and made it an Agar.io-style real-time brawler — a *different* game. The revivals confirm: the async spectator format has genuine longshoreman appeal, but without consistent new build options (skills, weapons, synergy depth) they plateau at niche audiences.

**STEAL:** The revival community's willingness to build wikis, run tournaments, and share builds shows the format creates invested players. PocketHero should design for the wiki-writing, build-theorycrafting audience from day one.

---

### Leek Wars (2013–present)
**One-line hook:** "Write the AI that fights your leek" — a programming-literacy framing of the same async-fight loop, with a 90,000-player community a decade on. ([leekwars.com](https://leekwars.com/))

**Why it matters:** Proof that the async-autobattler format has *hardcore retention* when the build-layer has genuine depth. Leek Wars players don't watch fights; they debug scripts. The analogy to PocketHero: pixel placement *is* the programming. Placement decisions must feel as meaningful as writing an algorithm.

**Core loop:** Train leek stats → write/improve AI script in LeekScript → submit to daily tournaments → refine based on fight logs.

**STEAL:** Fight replay logs with annotated events so players can *learn* from losses. Leek Wars players watch replays obsessively to understand *why* they lost. This is also a virality vector: "watch my hero demolish yours" is compelling only if the fight is readable.

**AVOID:** Leek Wars' steep programming barrier limits its TAM. PocketHero replaces code with visual grid-placement — the right abstraction for a mass audience.

---

### Gladihoppers (Dreamon Studios, 2018–present)
**One-line hook:** 2D physics gladiator brawler that blends pixel sprites with low-poly environments; cross-platform real-time 1v1.

**Why it matters:** Less directly relevant — it's real-time, not async — but its **2D sprite + 3D arena hybrid** visual is a reference point for the 2.5D depth PocketHero wants. 90+ equippable items shows that even simple gladiator combat gains stickiness from loadout building. ([Gladihoppers](https://www.playgladihoppers.com/))

**STEAL:** The sprite-in-3D-space visual language. Players accept billboard characters when the environment and camera work reinforce depth cues.

---

## Bucket 2 — Grid/Parts Builder Autobattlers (Closest Mechanic)

### Backpack Battles (PlayWithFurcifer, EA June 2024)
**One-line hook:** Tetris-meets-RPG — pack items in a grid, every adjacency creates synergies, watch the resulting build auto-fight. The closest existing game to PocketHero's pixel-grid build mechanic.

**Why it matters:** This is the proof-of-concept for PocketHero's core idea. 640,000 units in the first month (500,000 in two weeks), peak 36,000 concurrent Steam players, 90%+ positive reviews. The market *wants* spatial autobattlers. ([Wikipedia](https://en.wikipedia.org/wiki/Backpack_Battles), [GIGAZINE review](https://gigazine.net/gsc_news/en/20240310-backpack-battles/))

**Core loop:** Shop phase (buy items, fit them into backpack grid) → fight phase (watch auto-battle) → repeat, adapting to what the shop offers. No two builds with the same items fight identically because *placement matters*.

**Synergy communication — the "blue line" system:** When an item can combine with another adjacent item, a visible **blue connector line** appears between them. Orange lines appear on opponents' items showing what *they* are about to combine. This is the design's single most important onboarding tool: players learn adjacency synergies by following the lines, not by reading tooltips. ([The Gamer beginner tips](https://www.thegamer.com/backpack-battles-beginner-tips-tricks/))

**Item evolution:** Two compatible adjacent items combine into a new, stronger item — e.g., Hero Sword + two Whetstones → Hero Longsword. This morphing reward is enormously satisfying. ([Backpack Battles Wiki](https://backpackbattles.wiki.gg/))

**Monetization:** Premium PC title ($9.99 on Steam EA). No aggressive IAP.

**IGN gave it 6/10** specifically for lack of item variety in EA. The core criticism that emerged across reviews: *too few builds*, the experience becomes repetitive once you've explored each class. Day-7 drop-off is real. ([Metacritic](https://www.metacritic.com/game/backpack-battles/))

**STEAL:**
- **Blue/orange connector line feedback.** PocketHero's pixels should visually indicate active adjacency synergies and "this pattern is almost complete" hints — the moment of recognition is the dopamine hit.
- **Item evolution via adjacency:** pixels that merge into a new pixel-type when a recipe completes. The recipe discovery *is* the content.
- Shop-draft as build-expression layer: players respond to what's available, not a predetermined plan. This creates variance and replayability.

**AVOID:**
- Content treadmill dependency: the game gets stale when players have exhausted build space. PocketHero's pixel-recipe space should be combinatorially large enough to sustain months of discovery, not dozens of fixed interactions.
- Limited run variety: IGN's criticism was that doing multiple runs didn't feel fresh. Procedural recipe generation or daily-modifier seeded runs could address this.

---

### Super Auto Pets (Team Wood Games, 2021)
**One-line hook:** "Easy to learn, infinite to master" — the free-to-play autobattler that out-designed Teamfight Tactics and Battlegrounds by respecting player time and removing mechanical skill from the equation.

**Why it matters:** The most legible autobattler ever designed. SAP proves that **composable triggers + effects + targets** creates emergent depth without complex per-unit exceptions. ([Medium / CodeX analysis](https://medium.com/codex/why-super-auto-pets-is-so-good-and-what-is-still-to-come-5c02854c675b))

**Core loop:** 5-pet lineup → buy/merge/reposition in shop phase → watch fully automated fights → 10 wins or bust.

**Ghost PvP:** Players fight recorded snapshots of real opponents — the core async mechanism. No scheduling, no waiting. The "arena mode" removes timers entirely. This is precisely PocketHero's target PvP model.

**Design genius (from mechanical analysis, [a327ex.com](https://a327ex.com/posts/super_auto_pets_mechanics)):** Every unit has triggers (on sell, on buy, on hurt, on level up), effects (buff/summon/deal damage), and targets (self/friend/enemy/adjacent). The entire game is variations on that 3-axis matrix. New pets feel fresh because they use *new combinations of existing dimensions*, not new dimensions. This "composability" principle is transferable directly to PocketHero's pixel mechanics.

**Monetization:** Completely free base game; expansions add pets for a one-time fee, no gameplay advantage over base game buyers in standard matchmaking. This built enormous goodwill and a 35,000+ Discord. ([CBR analysis](https://www.cbr.com/super-auto-pets-autobattler-tft-hearthstone-battlegrounds/))

**STEAL:**
- Composable mechanic grammar (trigger/effect/target) as design framework for PocketHero's pixel powers.
- Free base tier with paid expansion content that doesn't break competitive fairness.
- Timeless arena mode — no lobby wait, fight when ready.

**AVOID:**
- SAP's depth is front-loaded: the author of the mechanics deep-dive noted "diminishing returns to mechanical insights" after 100 hours. PocketHero needs a second layer of depth (shape recipes, long-term hero identity) that SAP lacks.

---

### The Bazaar (Temporal / Reynad, Beta 2024, Steam August 2025)
**One-line hook:** Slay the Spire × Backpack Battles × async ghost PvP — the most direct design sibling PocketHero has in 2025/26.

**Why it matters:** The Bazaar is the clearest existing blueprint for PocketHero's full loop: build a board of spatial items, discover synergies over 12+ rounds, fight ghost-snapshots of real players' builds. It's PocketHero without the creature-attachment and pixel-art layer.

**Core loop:** Select hero → adventure through ~6 "days" per round (4 random events with 3 choices each, 1 PvE fight, 1 async PvP fight) → build board of up to 10 items with Tetris-grid placement → aim for 10 PvP wins before running out of health (prestige). Fight recorded snapshots of real opponents' setups. ([NoisyPixel preview](https://noisypixel.net/the-bazaar-beta-preview-monetization-issues/), [Quarter to Three forum](https://forum.quartertothree.com/t/the-bazaar-deckbuildy-autobattler-with-asynchronous-multiplayer-was-recently-on-fire/162998))

**Async PvP mechanism:** "The game uses a genius system that uses the 'ghosts' of other players as combat encounters when you're ready for a fight, which means that you can go AFK whenever you'd like, and return to your run while still having a PvP experience." You never wait for a live opponent. Every fight is against a real human's build, not an AI approximation.

**Monetization disaster and recovery:** The launch was described as "predatory" — a $10/month Battle Pass layering onto subscription-doubled-XP, with expansion cards locked behind the pass, requiring 1.5 hours/day of grind to complete the free track. PC Gamer called it potentially "strangling itself to death." By mid-2025, Temporal had reworked monetization to be less intrusive, and the game recovered to strong reviews. ([PC Gamer](https://www.pcgamer.com/games/roguelike/the-bazaar-could-be-the-future-of-autobattlers-if-it-stops-strangling-itself-to-death-with-its-own-microtransactions/))

**STEAL:**
- The 6-day round structure (events + PvE + PvP in each "day") creates pacing rhythm without feeling grind-y.
- Ghost-snapshot PvP as the default multiplayer mode — no lobbies, no scheduling, zero friction.
- Item cooldown variance (short-burst vs. slow-charge items) creates build archetypes organically.

**AVOID:**
- Never gate competitive content behind a paid pass. PocketHero should treat pixel recipes and synergies as discoverable, not purchasable.
- Complexity overload: 10 simultaneous items with different cooldown rhythms can be cognitively overwhelming. PocketHero's pixel grid has a natural complexity cap per level.

---

### Mechabellum (Game River / Dreamhaven, Early Access 2022, full 2024)
**One-line hook:** 1v1 tactical autobattler where you deploy giant mechs, watch them fight, then upgrade and reposition between rounds — "the real pleasure of strategy isn't execution, it's interaction."

**Why it matters:** Mechabellum solved the "deathball" problem (all units clumping) through positional tech systems and proved that **contextual synergies** (every decision is reactive to what *your specific opponent* is doing right now) create far deeper engagement than static build-optimisation. 84% positive reviews across 9,500+ Steam reviews. ([PC Gamer](https://www.pcgamer.com/games/strategy/mechabellum-is-a-conversation-you-should-be-having/))

**The unsolved problem (for PocketHero to note):** Mechabellum's designer Bearlike acknowledged that "you can't keep adding new pieces to your chessboard" — content sustainability is an existential challenge for unit-based autobattlers. PocketHero's pixel recipe space sidesteps this: you're not adding new unit types, you're expanding a combinatorial grammar. ([grokludo analysis](https://grokludo.com/mechabellum-evolved-autobattlers-but-one-problem-remains-unsolved-wen-you-ge-grokludo-14/))

**STEAL:**
- Opponent-reactive decision-making: players should be able to see their opponent's hero (in PvP) before finalising their build, creating a metagame of counters.
- Between-round upgrade passes give players agency even after the build is set — PocketHero could offer a "mid-season" pixel respec system.

**AVOID:**
- Pure live 1v1: scheduling friction kills casual retention. Async ghost fights are better for PocketHero's audience.

---

### Idle Champions of the Forgotten Realms (Codename Entertainment, 2017)
**One-line hook:** Grid-formation idle game where champion *position* relative to each other determines buff ranges — a working example of spatial synergy inside an idle game.

**Why it matters:** Idle Champions explicitly uses a 5x3 grid where adjacency, column depth, and "within 2 slots" ranges define champion effectiveness. This is the closest idle analogue to PocketHero's pixel adjacency system. ([Formation strategy wiki](https://idlechampions.fandom.com/wiki/Formation_strategy))

**STEAL:** Visible range indicators on each "piece" so players immediately understand *why* a formation works. PocketHero's pixel adjacency highlights should function identically.

**AVOID:** Idle Champions' monetisation (time-limited chest events, FOMO-driven chests) is criticised as predatory. The game's formation depth is buried under IAP friction.

---

## Bucket 3 — Idle / Incremental Progression Loops

### Vampire Survivors (Poncle, EA Dec 2021 / Full 2022)
**One-line hook:** Autoshooter roguelite with an upgrade every 23 seconds, casino-calibrated loot chests, and permanent meta-progression gold — the idle/action hybrid that redefined the entire genre.

**Why it matters:** Vampire Survivors is not technically an idle game, but its *feel* is: the player's only active input is movement; the system auto-fights. This makes it the best playable reference for PocketHero's PvE feel. $2.99 → 50,000+ concurrent players within a month; sold millions. ([Vampire Survivors on Steam](https://store.steampowered.com/app/1794680/Vampire_Survivors/))

**Core loop + cadence analysis:** The game gives players *something good every 23 seconds* — XP drops, level-up choices, chest pops. This is dramatically faster than competitors. The power curve is a "trickling vertical" rather than step-changes: you never feel stalled. Between-run gold feeds permanent stat upgrades (up to 2.5× damage, 2× health) so no run is wasted. ([Substack analysis](https://jboger.substack.com/p/the-secret-sauce-of-vampire-survivors))

**Casino mechanics (deliberately deployed):** Designer Luca Galante (formerly a casino developer) hardcoded the first 6 chests with generous loot (pattern: 1-1-3-1-5 items), setting a high expectation that later chests never fully meet. This creates a slot-machine dopamine loop that drives "one more run." ([natrowley.com](https://www.natrowley.com/the-addictive-nature-of-vampire-survivors/))

**Monetization:** $2.99–$4.99 one-time; multiple paid DLC packs at fair prices. No subscription, no battle pass, no competitive advantage from spending. Won enormous community loyalty.

**STEAL:**
- Reward cadence of ~20–30 seconds between meaningful decisions or visible rewards. PocketHero's combat should offer constant micro-feedback (pixel activations, technique procs, debris).
- Permanent meta-gold layer: PocketHero should have a cross-run currency that *always* increments, making even a losing PvP run feel productive.
- "No run is zero" philosophy: first-run achievements, discovery unlocks for seeing a new technique, and idle offline gains all serve this.

**AVOID:**
- Vampire Survivors' combat is pure chaos — no tactical build expression beyond pre-run loadout. PocketHero's grid build must feel more *authored* and *mine* than VS's random weapon offers.

---

### Melvor Idle (Brendan Malcolm / Jagex, 2021)
**One-line hook:** OSRS skill system automated — every RuneScape grind loop turned idle, with meaningful milestones every few minutes.

**Why it matters:** The gold standard for idle session design. "Designed as OSRS, but the game plays itself." Skill progression gives players constant measurable targets (level 60 Smithing → level 61 → craftable new item), each milestone meaningful and short enough to hit in a single session. ([Apptrove analysis](https://apptrove.com/how-to-make-an-idle-game/))

**Retention mechanics:** One-time paid expansions (no subscription) perform better in long-term retention than free-with-IAP competitors. Melvor's expansions are widely cited as fair pricing done right.

**STEAL:**
- Named skill milestones visible on the UI at all times — players always know *what they're working toward this session*.
- Offline gains capped at ~8 hours, creating daily optimal return cycles without punishing casual players who miss a day.

**AVOID:**
- Melvor's combat is extremely thin (stat check vs. enemies). PocketHero's combat needs to be something players *want* to watch, not just let run.

---

### Soda Dungeon (Afro-Ninja Productions, 2015)
**One-line hook:** Send parties of hired adventurers deeper into a dungeon while you upgrade your tavern — the template for "watch your team fight while you manage the meta."

**Why it matters:** Soda Dungeon's prestige/relic system is elegantly paced: hit the wall, reset with permanent relics, go further faster. Players reported sessions of "25–30 minutes of idle dungeon runs without staring at the screen," which is precisely PocketHero's target engagement window. ([Medium analysis](https://medium.com/@zachstechturf/soda-dungeon-the-definition-of-addicting-f9c0da8dd68d))

**STEAL:**
- Visible prestige horizon: always show players *what they'll unlock at the next reset* so the reset decision feels like strategy, not loss.
- Tavern meta-layer: a persistent base/headquarters that persists through prestige, creating long-term attachment to something *beyond* the character.

**AVOID:**
- Soda Dungeon's party combat is totally unreadable — numbers fly and dungeons blur. PocketHero's juice layer is what differentiates it.

---

### Almost a Hero (BeeSquare, 2016)
**One-line hook:** Idle RPG with intentionally bad hero archetypes (cowards, buffoons) whose synergies you discover and exploit — a game that *respects player intelligence*.

**Why it matters:** Almost a Hero is "logic-based and game design-focused so good and bad design can't be hidden." Its feedback loops (gold → heroes → abilities → gold multipliers) are textbook tight. The ring/rune/trinket combination system for heroes parallels PocketHero's pixel-recipe depth. ([Game Design Thinking analysis](https://gamedesignthinking.com/almost-a-hero-crating-experiences-using-feedback-loops-pt-1/))

**Core systems insight:** Six system functions — stocks, sources, sinks, connections, traders, converters — govern every resource. In idle game design, calculating inflow vs. outflow prevents both inflation (content too easy) and deflation (wall-hitting frustration). PocketHero's idle resource model should be run through this framework.

**STEAL:**
- Layered weekly Seasons with tough challenges give long-time players fresh goals without requiring new core mechanics.
- Shorter but constant sessions rather than extended play demands — design the "10-minute check-in" loop explicitly.

---

### NGU Idle (4G, 2018 browser → Steam)
**One-line hook:** "Your number goes up" — an incremental game that starts simple and accumulates 5+ parallel automation systems, all running simultaneously.

**Why it matters:** NGU is the ceiling of idle complexity — five overlapping automation trees, scientific-notation numbers, rebirth modifiers — and it has maintained a cult player base for years. It demonstrates that idle players are "strategic in slow motion" and will engage with extremely complex systems *if the complexity unfolds gradually*. ([NGU Idle Guide](https://sayolove.github.io/ngu-guide/en/mechanics/ngu/))

**STEAL:** The gradual reveal of new system layers (the game starts with ONE thing, adds another after hours of play, never frontloads complexity) is how PocketHero should gate its deeper pixel mechanics — recipes, adjacency, shape unlocks should drip in over the first week of play, not the first hour.

**AVOID:** NGU's visual presentation is aggressively anti-juicy — intentionally ugly ASCII-aesthetic. PocketHero's visual identity is its competitive advantage; never sacrifice juice for "ironic ugliness."

---

### Idle Game Design Principles (synthesised from multiple sources)
The evidence-based model for idle session design:

| Reengagement Cycle | Typical Wait Time | Mechanism |
|---|---|---|
| Active session | 0–30 min | Combat rewards, level-ups |
| Short idle | 2–4 hours | Offline resource cap triggers |
| Daily | 8–24 hours | Daily fight cap / login reward |
| Weekly | 7 days | Season/event reset |
| Prestige | Weeks–months | Hero prestige, shape library |

Idle titles with well-paced loops achieve Day-7 retention of 10–15% vs. the 8% mobile benchmark. Idle RPG sessions were up 35% in Q1 2024. ([Gamigion analysis](https://www.gamigion.com/idle/), [Apptrove](https://apptrove.com/how-to-make-an-idle-game/))

**Key offline cap principle:** Offline income must stop after a set duration to create "loss of opportunity" urgency for returning. The optimal cap for PocketHero is probably 6–8 hours — long enough for working players to benefit, short enough to pull back daily. ([ericguan.substack.com](https://ericguan.substack.com/p/idle-game-design-principles))

---

## Bucket 4 — Creature-from-Parts / Emergent-Body Games

### Spore Creature Creator (Maxis / EA, 2008)
**One-line hook:** Build a creature from modular body parts; the internet went so wild it hit 1 million uploads in one week and 100 million creations total — the defining proof that creature-creation is a contagious activity.

**Why it matters:** Spore's numbers are the benchmark for what player-created character content *can* become. 250,000 creatures on day 1, 1 million by the end of week 1 (Will Wright had hoped for 100K by September), 100 million total uploaded to Sporepedia. Automated upload-to-community was *the* viral mechanism: creation automatically shared. ([EA press release](https://www.ea.com/news/100-million-creatures-take-over-spore-universe), [Wikipedia](https://en.wikipedia.org/wiki/Spore_Creature_Creator))

**Emotional attachment mechanisms:**
- Forced reflective symmetry prevented "imbalanced" creatures — constraints made creatures look *intentional* and viable, deepening owner pride. ([Interaction Culture analysis](https://interactioncultureclass.wordpress.com/2009/12/06/developing-a-critique-of-the-creature-creator-in-spore/))
- Test Drive feature let players control their creature and trigger emotional animations (happiness, fear, anger) before committing — the creature's *personality* emerged from interaction.
- Community Sporepedia meant your creation existed in a universe with other players'. The creature felt like "mine" *in a shared world*.

**STEAL:**
- Automatic community sharing: every hero snapshot should be publicly accessible by URL, browsable in a community gallery.
- Constraints that produce viable-looking output: PocketHero's grid constraints (symmetry optional but rewarded? min pixel count per region?) should prevent "broken" heroes that look like accidents.
- Named, saveable hero variants: players should be able to name builds ("Crimson Golem v2") and share them, creating a vocabulary around their creations.

**AVOID:**
- Spore's creature stage disconnected from the galaxy stage — the creatures players lovingly designed became irrelevant to later game phases. PocketHero's pixels must remain visually and mechanically *central* forever.
- Over-constraining creation: Spore required symmetry; the community found creative workarounds. PocketHero should have asymmetric options (at the cost of no adjacency bonus from axis-crossing, perhaps) to let advanced players express more.

---

### Wobbledogs (Tom Astle / Raw Fury, 2021)
**One-line hook:** Physics-simulated dogs that mutate by what you feed them — feed them french fries and they grow thin and leggy; feed them pancakes and they go flat and wide.

**Why it matters:** Wobbledogs is PocketHero's soul-reference, not its mechanic-reference. The game demonstrates that **procedural physics creates unavoidable emotional attachment** — players can't help caring about a creature that moves uniquely and unpredictably. The "it tried its best" effect: dogs get stuck, wobble, fail adorably. This is what PocketHero's soft-body jiggle should evoke. ([Wobbledogs Steam](https://store.steampowered.com/app/1424330/Wobbledogs/), [Game Developer deep dive](https://www.gamedeveloper.com/design/behind-the-ai-and-physics-of-i-wobbledogs-i-procedurally-goofy-wobbledogs))

**Technical design insight from developer Tom Astle:**
- Physics bodies were "a nightmare" — Astle had no prior physics experience and had to rearchitect repeatedly.
- *The most important lesson:* "The most complex and innovative system in the world is useless if the player can't easily and intuitively understand what it's doing." AI was simplified from memory-based to "distraction-based" (reacts to immediate stimuli) specifically because complex hidden AI looked *random* to players.
- Death was designed *into* the emotional loop — memorial systems and generational play made loss meaningful rather than just punishing.

**Diet-driven mutation as PocketHero analogy:** The mechanic "feed → change shape" is literally what PocketHero does (place pixel → change creature shape). The emotional result (player feels authorial responsibility for how the creature turned out) is the target.

**STEAL:**
- Soft-body jiggle response on hit — even a minimal physics wobble on damage makes the creature feel *alive*.
- "Distraction-based" combat AI that reads legibly: pixels/techniques should have clear activation cues so players understand *why* the fight went how it did.
- Memorial / history layer: show the hero's win/loss history, notable fights, and how the build evolved — generational attachment.

**AVOID:**
- Don't make creatures too *fragile*-looking: Wobbledogs' "helpless" charm works because it's a *pet sim*. PocketHero's hero should feel like a champion, not a victim. Wobble should read as power, not frailty.

---

### Creatures Series (Cyberlife / Creature Labs, 1996–2004)
**One-line hook:** Artificial life simulation with evolving genetic code — players raised Norns, bred them, and watched unique personality traits emerge from simulated biology.

**Why it matters:** Creatures pioneered *emergent personality from systems*, not authored behaviour. Players attached fiercely to Norns that were "difficult" or "weird" because their quirks felt genuinely theirs. The design lesson: **unpredictability within a comprehensible system creates attachment**. PocketHero's randomised stat-pixel distributions at level-up serve this function.

**STEAL:** The joy of "my hero does a weird thing that other heroes don't" — design the combo space so some pixel arrangements produce unexpected interactions that feel like easter eggs.

---

### Lovers in a Dangerous Spacetime (Asteroid Base, 2015)
**Why it matters (briefly):** The "Jelly Roll" spaceship with a squishy protective layer, cooperative station-management, and rescuing cute creatures demonstrates that soft/squishy visual vocabulary in action games reads as *charming* rather than weak when enemies are clearly defeated by it. PocketHero can lean into the softness of its body physics as a *feature of its identity*, not a compromise of combat authority. ([Gamecritics review](https://gamecritics.com/daniel-weissenberger/lovers-in-a-dangerous-spacetime-review/))

---

## Bucket 5 — Juice & 2.5D Pixel Visual References

### Vampire Survivors (juice reference)
*See also Bucket 3.* Key juice mechanics:
- **Gem vacuum / magnet item:** thousands of XP gems streak toward the player simultaneously — a deliberately engineered dopamine burst. The "screen-clear collect" is the game's most shared moment.
- **Chest pop as slot machine:** deliberate hardcoded loot table creates inflated expectations → sustained hope. The *animation* (chest rattles, springs open, items burst out) is as important as the contents.
- **No dead seconds:** something visual happens every 2–3 seconds — an enemy dies, a level-up occurs, a debris particle falls. Players are *never* waiting.

**STEAL for PocketHero:** Combat must have constant micro-events. Even during long fights, pixel activations, technique particles, and debris should maintain visual rhythm.

---

### Brotato (Blobfish, EA 2022 / Full 2023)
**One-line hook:** 5-minute roguelite waves with up to 6 simultaneous weapons and deep item synergies — sells depth through short sessions.

**Why it matters:** Brotato's smaller arena creates *mandatory engagement* — you can't run in circles like in Vampire Survivors, so every weapon placement and stat choice is tested immediately. Sold 1 million copies in EA. ([Brotato review](https://bullethaven.com/review/brotato))

**Juice specifics:** Weapons activate visually with distinct colour-coded projectiles; stat tooltips show exact values. Build legibility is *extremely* high — every item is readable at a glance because of consistent icon + stat number presentation.

**STEAL:**
- Colour-coded damage types (melee red, ranged blue, explosive orange) that match PocketHero's pixel colour language. If red pixels = attack, attacks should emit *red* particles.
- Short run length (5–10 min) enabling rapid iteration feedback for players learning the build space.

---

### HoloCure (Kay Yu, free 2022)
**One-line hook:** Free Vampire Survivors fangame with Hololive VTuber characters — 50,000+ downloads on day 1, proves that the bullet-heaven feel is independent of AAA polish.

**Why it matters:** HoloCure demonstrates that **character identity + weapon collab evolutions** dramatically extend the build variety of the VS formula. Each character has unique exclusive weapons; some weapons combine into "collaboration" powers when paired. This is PocketHero's technique-recipe system in existing form. ([BulletHaven review](https://bullethaven.com/review/holocure-save-the-fans))

**STEAL:** The "collab weapon" (two base weapons merging into a super-weapon) is emotionally equivalent to PocketHero's shape-recipe unlock. The reveal moment — when two mediocre base items fuse into something game-changing — is one of the most discussed moments in community spaces.

---

### Soulstone Survivors (Room-C Games, EA 2022 / Full 2024–25)
**One-line hook:** Vampire Survivors-like with deeper build complexity and stylised 3D visuals — but ran into the "particle overload" readability problem.

**Why it matters:** Soulstone Survivors is a cautionary tale about juice going too far. By late game, the screen fills with so many particle effects that enemies become invisible, and the developers had to add a VFX opacity slider in settings. ([Rogueliker review](https://rogueliker.com/soulstone-survivors-review/), [Steam community thread](https://steamcommunity.com/app/2066020/discussions/0/3490880386666412232/))

**STEAL:** Visual hierarchy discipline from its *early game* — "enemy designs are easy to distinguish" when effect density is low. Clear silhouettes before effects land is the visual grammar PocketHero should maintain.

**AVOID:** Effect density that obscures the creature. PocketHero's hero *is* the art; it must remain readable through combat. Scale and layer effects with intentional z-depth: debris behind hero, hero always front-most, particles brief and directional.

---

### Nubby's Number Factory (MogDogBlog, 2025)
**One-line hook:** Plinko-style roguelike with a bizarre lo-fi art style — 30K+ copies, went viral for its *personality*.

**Why it matters:** Nubby is the best recent example of **intentional aesthetic coherence winning over raw polish**. Pre-rendered 3D in Blender → dithered to pixel art in Aseprite. The developer explicitly pursued "it's so bad it's good" and hit a nerve with an audience exhausted by over-polished games. ([GameMaker dev blog](https://gamemaker.io/en/blog/following-the-fun-nubbys-number-factory), [Wikipedia](https://en.wikipedia.org/wiki/Nubby's_Number_Factory))

**Technical approach mirrored in PocketHero's stack:** Pre-render creature frames in a 3D pipeline → import as billboard sprites → PixiJS renders them with palette-swap shaders. Nubby proves the pipeline is emotionally *valid* at commercial scale.

**STEAL:**
- Lean into the "pre-rendered 3D sprite" aesthetic deliberately, not apologetically. It reads as "retro-premium" when committed to.
- Personality-first art: the weirdness of a player's creature (lopsided, unexpected colour combos, chaotic shape) should be celebrated, not smoothed away.

---

### 2.5D Billboard Technical Reference
From the Moon Reader breakdown ([Jettelly](https://jettelly.com/blog/breaking-down-moon-reader-s-2-5d-pixel-art-style)) and general 80.lv research ([80.lv](https://80.lv/articles/mixing-2d-billboards-and-3d-environments-in-a-game)):

**Core technique stack relevant to PocketHero (PixiJS):**
1. **Billboard sprites:** Flat quad in pseudo-3D space, always facing camera. PixiJS renders flat 2D by default; the "3D" is achieved via parallax layers, shadow casting on a ground plane, and Z-sorted sprites.
2. **Depth via shadow + ground contact:** A blob shadow that scales/offsets with vertical position gives immediate depth cue.
3. **Soft-body jiggle:** Not true physics at render — achieved via vertex shader distortion or spring-lerp bone offsets on the hero's silhouette. Wobbledogs' approach (full physics sim) is overkill for PocketHero; a simplified "jiggle bone" per major pixel cluster is sufficient.
4. **Procedural character gen via LUT palettes:** Grayscale base creature texture + per-body-region colour lookup table = thousands of visual variations from minimal art assets. Papers, Please used this; Moon Reader uses this; PocketHero should use this as its primary art pipeline.
5. **Hit flash + chromatic aberration:** On damage, briefly invert or wash-white the hit target, add 1–2 frame aberration offset. Cost: trivial. Impact: enormous.
6. **Debris sprites:** Pre-authored "pixel chunk" sprites ejected with velocity on hit. The creature itself should not deform (preserve readability), but *fragments* can fly.

---

## Design North-Star: Five Evidence-Backed Lessons for PocketHero

### 1. Build Legibility Is the Game's First Teacher
*(Sources: Backpack Battles blue-line system, Super Auto Pets trigger/effect/target grammar, Brotato colour-coded damage)*

Players learn grid-adjacency synergies only if the game visibly shows *which pixels are connected* and *what pattern they're almost completing*. The "blue line" between compatible Backpack Battles items is the single most important UX lesson: discovery happens *in the grid*, not in a recipe book. PocketHero should:
- Highlight adjacency relationships on hover/select.
- Glow a "partial recipe" when 60–80% of a shape pattern is placed.
- Show visual activation arcs when techniques fire in combat.
- Use colour consistency: red pixels → red damage particles; blue pixels → blue shield arcs. The colour *is* the tooltip.

### 2. Async Spectator PvP Virality Is Built into the Invite Mechanism
*(Sources: My Brute 70M brutes / 1.7M daily visits, The Bazaar ghost PvP, Super Auto Pets arena mode, Spore 100M uploads)*

Every great async-PvP game treats the *shareable snapshot* as its primary social unit. My Brute's forum-signature pupil link drove millions of users. Spore's automatic Sporepedia upload made the game a content platform. PocketHero must:
- Generate a permanent URL per hero-snapshot: `pockethero.com/fight/[heroID]`
- That URL loads the hero's appearance, stats, and a "fight this hero" button — zero friction to challenge.
- Award challenge-receivers a bonus (XP, a special pixel?) for having been challenged, motivating them to share too.
- The daily fight cap creates the return habit; the challenge link creates acquisition.

### 3. Idle Cadence: 3 Clocks, One Always Ticking
*(Sources: Eric Guan idle principles, Vampire Survivors cadence analysis, Melvor Idle milestones, Soda Dungeon prestige)*

Successful idle games run **3 simultaneous reward clocks**:
- **Fast clock (20–60 sec):** Combat micro-events, pixel activations, debris, XP ticks.
- **Medium clock (4–8 hours):** Offline resource cap, daily fight allowance, PvP ranking refresh.
- **Slow clock (days–weeks):** Prestige milestone, new recipe unlock, seasonal ranking reward.

The fast clock provides in-session juice. The medium clock creates the daily check-in habit (loss-aversion: "my offline gains are capped, I should collect"). The slow clock gives direction and identity across weeks.

PocketHero additionally needs a **meta-currency** that always increments (even in loss) so no session feels wasted — this is the single most important lesson from Vampire Survivors.

### 4. Creature Attachment Requires Authorial Responsibility + Surprise
*(Sources: Spore constraints + Test Drive, Wobbledogs diet mutation, My Brute random level-up, Creatures series)*

Players attach to created beings when they feel *responsible* for how the creature turned out AND when the creature surprises them. The formula: **constrained authorship + random emergence = emotional ownership**.
- Constraints that produce viable-looking output (Spore symmetry, PocketHero's grid bounds) prevent accidents and build pride.
- Random per-level pixel-slot distribution (not full random stat allocation) ensures two players at the same level have different heroes.
- The hero's *history* (win streak, notable kills, first technique unlocked) must be visible and shareable — it's the creature's biography.
- Name your hero. The moment a player names their creature, attachment spikes.

### 5. Juice is a Discipline, Not a Volume Knob
*(Sources: Soulstone Survivors overload warning, Vampire Survivors deliberate cadence, Brotato colour hierarchy, 2.5D technical breakdown)*

The seven elements of combat feel — **hitstop, hit flash, knockback, screenshake, particles, sound layering, anticipation** — produce *diminishing returns when overloaded* and *catastrophic readability collapse* when stacked without hierarchy. Soulstone Survivors added a VFX opacity slider *because players needed it*. PocketHero's rule:

1. **Hero always readable** — creature silhouette clear even at peak effect density.
2. **One dominant event per hit** — hitstop + hit flash, OR screenshake + knockback. Not all simultaneously.
3. **Debris behind, hero in front** — Z-order discipline.
4. **Scale effects with power** — a base pixel attack gets a small pop; a technique proc gets the screenshake. Reserve the big effects for big moments.
5. **Sound design carries 40% of feel** — a satisfying thud on hit does more than doubling particle count.

---

## Open Risks / Questions for the Director

1. **Recipe Space Size vs. Discovery Arc:** Backpack Battles lost players once they'd "seen all the builds" in early access. How many distinct shape-recipes does PocketHero need at launch to sustain a month of daily play? Is the recipe space generated procedurally (via pixel grammar rules) or authored one by one? If authored, what is the content cadence beyond launch?

2. **Legibility of Procedural Bodies:** PocketHero's hero is the *player's art*, but unconstrained pixel placement can produce shapes that are visually illegible mid-combat (blob vs. recognisable creature). Does PocketHero use a minimum-viable-silhouette constraint system? Or does the 2.5D billboard pipeline (pre-rendered creature body with pixel overlays) enforce visual coherence automatically?

3. **The Virality Loop Without Flash Embeds:** My Brute's viral mechanism (signature links in forums) relied on an internet culture of forum signatures and early social media. In 2026, the equivalent is Twitter/X shares, Discord embeds, and short-form video. How does PocketHero's shareable hero URL generate *video-watchable* fight replays, not just static screenshots? (The Bazaar's ghost fight replay is the model to study.)

4. **Async PvP Opponent Pool Size:** The Bazaar and Super Auto Pets both work because there are thousands of real opponents to fight as ghosts at any given rank band. PocketHero at launch will have a tiny pool. What is the minimum-viable concurrent player count for async ghost fights to feel *like playing against real people* rather than a small rotation of the same builds? What is the plan if early player count is low (bot builds designed to look hand-crafted)?

5. **Prestige Identity:** Idle games live or die on their prestige design. What does PocketHero's prestige look like — does the hero *die* and you start over? Does it evolve (unlock a new pixel form)? Does the player keep the hero's visual history? The emotional stakes of "reset vs. keep" are enormous. Soda Dungeon's "relics carry over" and NGU's "rebirth modifier" are very different prestige philosophies with different player relationships to their characters.

6. **Monetization Red Line:** The Bazaar nearly died from its battle pass. Backpack Battles thrived on fair one-time pricing. My Brute had no monetization and died from content stagnation. PocketHero needs a sustainable revenue model that does not gate recipes, adjacency bonuses, or pixel slots behind spending. What *is* the fair-monetization design that funds ongoing development? Cosmetic pixel palettes? Name/title cosmetics? A "patron dojo" prestige display?

---

## Quick Comparison Table

| Title | Bucket | Core Hook | Top STEAL for PocketHero |
|---|---|---|---|
| **My Brute** | Async PvP lineage | Referral-link pupil system; zero-skill auto-fight | Forum-embed challenge URL; daily fight cap; random level-up surprise |
| **Leek Wars** | Async PvP lineage | Script your fighter's AI; async tournament | Fight replay logs for post-match analysis |
| **Gladihoppers** | Async PvP lineage | 2D sprite + 3D arena hybrid | Billboard sprite-in-3D-space visual grammar |
| **Backpack Battles** | Grid builder autobattler | Tetris-inventory spatial synergies | Blue-line adjacency feedback; item evolution via adjacency; shop-draft build variance |
| **Super Auto Pets** | Grid builder autobattler | Composable trigger/effect/target; pure async ghost PvP | Ghost-snapshot PvP; free base tier; no-timer arena |
| **The Bazaar** | Grid builder autobattler | Tetris items + ghost PvP + 10-win run structure | Day-structure pacing; item cooldown archetypes; fair post-rework monetization |
| **Mechabellum** | Grid builder autobattler | 1v1 tactical counter-reactive autobattler | Opponent-build visibility before finalising; between-round upgrade passes |
| **Idle Champions** | Grid builder / idle | Formation grid where adjacency = buff range | Visible range indicators; column-depth zone logic |
| **Vampire Survivors** | Idle / juice | Reward every 23 sec; casino chest; permanent meta-gold | ~20-sec reward cadence; meta-gold layer; slot-machine technique procs |
| **Melvor Idle** | Idle progression | OSRS skills automated; fair expansion pricing | Named skill milestones always visible; 8hr offline cap; one-time purchase model |
| **Soda Dungeon** | Idle progression | Auto dungeon runs with prestige relic layer | Prestige horizon always visible; persistent tavern meta-layer |
| **Almost a Hero** | Idle progression | Hero synergies discovered via ring/rune/trinket combos | Stock/source/sink resource balance framework; weekly seasons |
| **NGU Idle** | Idle progression | Deep layered automation; rebirth modifiers | Gradual complexity reveal (drip-gate new mechanics over weeks, not first hour) |
| **Spore** | Creature creator | Body-part modular creation; auto-community upload | Automatic URL sharing; constraints producing viable output; named saveable builds |
| **Wobbledogs** | Creature creator | Physics-simulated dogs; diet-driven body mutation | Soft-body jiggle on hit; legible AI cues; memorial history layer |
| **Creatures** | Creature creator | Emergent personality from simulated biology | "Weird thing my creature does" easter-egg combos as attachment driver |
| **Brotato** | Juice / visual | 6-weapon synergies in 5-min runs; colour-coded damage | Colour = damage type = particle colour; run-length short for fast iteration |
| **HoloCure** | Juice / visual | VS formula + character collab-weapon evolutions | Collab-weapon reveal moment mirrors PocketHero technique-recipe unlock |
| **Soulstone Survivors** | Juice / visual | Deep VS-like with stylised 3D | Cautionary: VFX opacity overload; preserve hero silhouette readability at all times |
| **Nubby's Number Factory** | Juice / visual | Pre-rendered 3D → dithered pixel; lo-fi personality | Pre-render 3D → Aseprite pipeline; personality-first aesthetic coherence |

---

## Sources

- [My Brute — Wikipedia](https://en.wikipedia.org/wiki/My_Brute)
- [My Brute — Grokipedia](https://grokipedia.com/page/my_brute)
- [What happened to My Brute? — Brutoria Blog](https://brutoria.com/post-elbruto-en)
- [MyBrute Eternal Twin Revival](https://mybrute.eternaltwin.org/)
- [Leek Wars](https://leekwars.com/)
- [Leek Wars — GameDev.net](https://gamedev.net/forums/topic/714140-leek-programming-game-leek-wars/)
- [Gladihoppers](https://www.playgladihoppers.com/)
- [Backpack Battles — Wikipedia](https://en.wikipedia.org/wiki/Backpack_Battles)
- [Backpack Battles — GIGAZINE Review](https://gigazine.net/gsc_news/en/20240310-backpack-battles/)
- [Backpack Battles — Metacritic](https://www.metacritic.com/game/backpack-battles/)
- [Backpack Battles Beginner Tips — The Gamer](https://www.thegamer.com/backpack-battles-beginner-tips-tricks/)
- [Backpack Battles Wiki](https://backpackbattles.wiki.gg/)
- [Super Auto Pets — Wikipedia](https://en.wikipedia.org/wiki/Super_Auto_Pets)
- [Why Super Auto Pets is So Good — Medium / CodeX](https://medium.com/codex/why-super-auto-pets-is-so-good-and-what-is-still-to-come-5c02854c675b)
- [Super Auto Pets vs TFT/Battlegrounds — CBR](https://www.cbr.com/super-auto-pets-autobattler-tft-hearthstone-battlegrounds/)
- [Super Auto Pets Mechanics Deep Dive — a327ex.com](https://a327ex.com/posts/super_auto_pets_mechanics)
- [The Bazaar Review — NoisyPixel](https://noisypixel.net/the-bazaar-beta-preview-monetization-issues/)
- [The Bazaar Monetization — PC Gamer](https://www.pcgamer.com/games/roguelike/the-bazaar-could-be-the-future-of-autobattlers-if-it-stops-strangling-itself-to-death-with-its-own-microtransactions/)
- [The Bazaar 2025 Recovery — PC Gamer](https://www.pcgamer.com/games/card-games/after-its-disastrous-launch-last-year-im-here-to-tell-you-that-2025s-most-promising-auto-battler-finally-lives-up-to-its-potential/)
- [What Is The Bazaar — Mobalytics](https://mobalytics.gg/the-bazaar/guides/what-is-the-bazaar)
- [Mechabellum — PC Gamer "Conversation"](https://www.pcgamer.com/games/strategy/mechabellum-is-a-conversation-you-should-be-having/)
- [Mechabellum — Grokludo Analysis](https://grokludo.com/mechabellum-evolved-autobattlers-but-one-problem-remains-unsolved-wen-you-ge-grokludo-14/)
- [Idle Champions Formation Strategy](https://idlechampions.fandom.com/wiki/Formation_strategy)
- [Vampire Survivors — Wikipedia](https://en.wikipedia.org/wiki/Vampire_Survivors)
- [Vampire Survivors Secret Sauce — Substack](https://jboger.substack.com/p/the-secret-sauce-of-vampire-survivors)
- [Vampire Survivors Addictive Nature — natrowley.com](https://www.natrowley.com/the-addictive-nature-of-vampire-survivors/)
- [Idle Game Design Principles — Eric Guan Substack](https://ericguan.substack.com/p/idle-game-design-principles)
- [Idle Clicker Best Practices — The Mind Studios](https://games.themindstudios.com/post/idle-clicker-game-design-and-monetization/)
- [How to Make an Idle Game — Apptrove](https://apptrove.com/how-to-make-an-idle-game/)
- [Idle Game Design Systems — Missions Zanx](https://missionszanx.com/guides/idle-game-design-systems-mechanics-and-progression)
- [Idle Game Engagement 2025 — Gamigion](https://www.gamigion.com/idle/)
- [Soda Dungeon — Medium Analysis](https://medium.com/@zachstechturf/soda-dungeon-the-definition-of-addicting-f9c0da8dd68d)
- [Almost a Hero Feedback Loops — Game Design Thinking](https://gamedesignthinking.com/almost-a-hero-crating-experiences-using-feedback-loops-pt-1/)
- [NGU Idle Guide](https://sayolove.github.io/ngu-guide/en/mechanics/ngu/)
- [Spore Creature Creator — Wikipedia](https://en.wikipedia.org/wiki/Spore_Creature_Creator)
- [100 Million Spore Creations — EA](https://www.ea.com/news/100-million-creatures-take-over-spore-universe)
- [Spore Creature Creator Critique — Interaction Culture](https://interactioncultureclass.wordpress.com/2009/12/06/developing-a-critique-of-the-creature-creator-in-spore/)
- [Wobbledogs — Steam](https://store.steampowered.com/app/1424330/Wobbledogs/)
- [Wobbledogs AI & Physics — Game Developer](https://www.gamedeveloper.com/design/behind-the-ai-and-physics-of-i-wobbledogs-i-procedurally-goofy-wobbledogs)
- [Brotato Review — BulletHaven](https://bullethaven.com/review/brotato)
- [HoloCure Review — BulletHaven](https://bullethaven.com/review/holocure-save-the-fans)
- [Soulstone Survivors Review — Rogueliker](https://rogueliker.com/soulstone-survivors-review/)
- [Soulstone Survivors VFX Thread — Steam](https://steamcommunity.com/app/2066020/discussions/0/3490880386666412232/)
- [Nubby's Number Factory Dev Blog — GameMaker](https://gamemaker.io/en/blog/following-the-fun-nubbys-number-factory)
- [Nubby's Number Factory — Wikipedia](https://en.wikipedia.org/wiki/Nubby's_Number_Factory)
- [Moon Reader 2.5D Breakdown — Jettelly](https://jettelly.com/blog/breaking-down-moon-reader-s-2-5d-pixel-art-style)
- [Mixing 2D Billboards and 3D — 80.lv](https://80.lv/articles/mixing-2d-billboards-and-3d-environments-in-a-game)
- [Super Game Feel Effects — KaiClavier / itch.io](https://kaiclavier.itch.io/super-game-feel-effects)
- [The Juice Factor — Hackread](https://hackread.com/the-juice-factor-designing-game-feel/)
- [4 Great PvP Examples in Casual Games — GameRefinery](https://www.gamerefinery.com/4-great-examples-pvp-modes-casual-games/)
- [Best Asynchronous Multiplayer Games — Game Rant](https://gamerant.com/best-asynchronous-multiplayer-games/)
