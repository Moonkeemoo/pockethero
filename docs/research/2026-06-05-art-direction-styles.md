# PocketHero — Art Direction Research & Style Routes
**Date:** 2026-06-05  
**Author:** Art-Direction Research Agent  
**Status:** Pre-production reference — director to select a route

---

## TL;DR (5 bullets)

- **Player-made pixel blobs become characters through three levers: strong silhouette, a consistent eye/face anchor, and physics personality** — all achievable procedurally within the sprite-spring system.
- **2.5D billboard depth is well-proven**: HD-2D (Octopath), Don't Starve, and Paper Mario all demonstrate that flat sprites feel grounded in depth through drop shadows, depth-scaling, point lighting, and parallax — no voxels or sprite-stacking required.
- **Semantic colour and aesthetic beauty are NOT in conflict** — DawnBringer, Endesga-32, and the IBM Colorblind-Safe palette prove you can ship a constrained, harmonious, legible palette where colour carries functional meaning AND the game looks gorgeous.
- **The gold standard for juice-without-losing-readability is Dead Cells**: normal-mapped sprites lit from a single point, white-flash hit confirmation, hitstop, chunky particles, and screenshake — all layered so the *silhouette is always readable*. Soulstone Survivors is the anti-pattern (it added a VFX opacity slider because effects buried the creatures).
- **Four distinct art-direction routes are proposed below**: (A) Clean Semantic Flat, (B) HD-2D Diorama, (C) Neon-Glow Synthwave, (D) Crunchy CRT Ugly-Cute. Each stays inside all locked constraints.

---

## Locked Constraints Recap (do not propose outside these)

| Constraint | Detail |
|---|---|
| 2.5D billboard | Flat sprites with depth position, shadow, depth-scaling. NO sprite-stacking, NO true 3D. |
| Per-pixel spring jiggle | Soft-body: squash/stretch on hit, wobble. |
| Juice via code | Screenshake, hitstop, debris, flashes — all authored in code, not hand-animated. |
| Player-made creatures | Creatures = grids of coloured stat-pixels. No hand-drawn creature art. |
| Web stack | PixiJS (WebGL 2D). Filters, GlowFilter, normal-mapped sprites, ParticleContainer. |
| Semantic palette | Colour = stat type (red=attack, blue=armor, green=hp, etc.). Per-type glyphs. |
| Legibility first | A pixel must read as what it does. Colourblind-safe. |

---

## Part 1 — Making Emergent Pixel Blobs Look Good (Not Like Noise)

### The Core Problem

A player arranging 10 coloured pixels at random will produce an asymmetric, artefact-shaped blob. The game must make that blob feel like *a creature* — with personality, silhouette, and charm — without any hand-authored creature art.

### How Great Games Solve It

**Spore's Creature Creator** is the canonical reference for emergent modular creature appeal. The insight: procedural animation does more for charm than visual design. When 228 modular parts animate according to their configuration (legs walk, arms swing), even bizarre asymmetric shapes read as alive ([Bournemouth MSc thesis on procedural creatures](https://nccastaff.bournemouth.ac.uk/jmacey/MastersProject/MSc22/01/ProceduralCreatureGenerationandAnimationforGames.pdf)). The **PocketHero parallel**: spring jiggle does the same work — the soft-body wobble is what makes a static pixel-grid feel like a living creature.

**Wobbledogs** pushes this further — 3D pets with procedurally mutated bodies that are deliberately strange-looking. The charm comes not from visual beauty but from **physics-driven behavioural personality**: simplified stimulus-response AI (approach food, flee threats) gives the body a mind, and the player anthropomorphises immediately ([GDC / GameDeveloper article on Wobbledogs' AI and physics](https://www.gamedeveloper.com/design/behind-the-ai-and-physics-of-i-wobbledogs-i-procedurally-goofy-wobbledogs)). The developer explicitly chose physics animation over baked frames because "physics gives them more life." **PocketHero takeaway**: the per-pixel spring system is not a technical footnote — it is the primary charm delivery mechanism.

**Fall Guys' bean** demonstrates the power of **shape language**: rounded, chunky, non-threatening. The lead designer described the inspiration as "a chunky little yeti-shaped vinyl toy" — the softness of the silhouette is what makes it instantly lovable ([PlayStation Blog character design feature](https://blog.playstation.com/2020/05/25/creating-the-character-designs-of-fall-guys-out-on-ps4-this-summer/)). For pixel creatures, this maps to: **avoid sharp, spiky outlines on the blob itself**. Even a 3×3 pixel creature should have at least one rounded corner.

**Patapon** proves the extreme case: **pure black silhouette with a single cyclopsian eye** = complete personality ([Rolito interview on Patapon's design](https://www.gamedeveloper.com/game-platforms/q-a-i-patapon-i-s-rolito-talks-art-and-inspiration)). Rolito's rule: "Let strong geometry and colour carry emotional weight." He called the key ingredients "strong geometry and complementary colour palettes" combined with "innocence and poetry." For PocketHero: a simple **eye glyph anchor** on every creature (even 1-pixel creatures display a tiny eye indicator) transforms a coloured square into a face. The eye is the cheapest possible charm upgrade.

**Slime/blob pixel art design** (well-established genre on itch.io and Lospec) shows consistent techniques: make the bottom edge spread wider than the top (the "gravity puddle"), blend the lower pixels to suggest contact with the ground, and place the face feature high on the body mass ([Lospec slime design tutorials](https://lospec.com/pixel-art-tutorials/tags/outlines); [itch.io pixel slime tutorial](https://itch.io/t/2614553/pixel-tutorial-slime-monster-design)).

### Actionable Rules for PocketHero Creatures

1. **Every creature gets an eye anchor** — even 1px creatures display a directional indicator that reads as a face. The eye glyph should be one of the per-type glyphs but with a universal "face" position rule.
2. **Spring jiggle is the primary charm** — the visual design serves the physics. Heavier stat-pixels (e.g., armor blue) should jiggle with lower frequency; lighter types (speed, ranged) with higher frequency.
3. **Silhouette > internal detail** — from combat distance, a creature must read as a recognisable shape. At minimum 4px, the blob should have a discernible widest point and a directional facing.
4. **Palette discipline makes noise legible** — a creature made of 5 different stat-colours is only charming if those 5 colours form a coherent, limited palette subset. This is the core tension to solve.

---

## Part 2 — 2.5D Billboard Pixel Aesthetics Done Well

### How the Best Games Fake Depth

**HD-2D / Octopath Traveler** (Square Enix, UE4) is the definitive modern reference for billboard sprites in depthful space ([Wikipedia: HD-2D](https://en.wikipedia.org/wiki/HD-2D); [analysis: why it changed RPG gaming](https://samppy.com/octopath-travelers-hd-2d/)). The technique stack:
- **Point light in scene** → sprites cast shadows onto environment → the shadow proves they exist in 3D space
- **Tilt-shift + depth of field** → foreground and background elements blur, creating the diorama effect
- **Bloom + volumetric fog** → atmospheric distance cues
- **Parallax scrolling** → background layers scroll at different rates than foreground
- The lead programmer's rule: *"It is essential to make the pixels of a sprite not only look but feel part of a world with volume, fog, rain, and light filtering through the trees."*

**Don't Starve** (Klei, WebGL) uses the oldest and most reliable billboard depth trick: **drop shadow blobs** ([Klei forum on the animation style](https://forums.kleientertainment.com/forums/topic/56775-is-there-a-name-for-the-games-2d-as-3d-animation-style/)). The shadow is a simple oval beneath each sprite; as creatures move "into" depth, the shadow moves farther away and the sprite scales down. This is achievable in pure PixiJS with no 3D engine. Don't Starve also uses **height offsets** — sprites higher on screen are "further away" and rendered behind lower sprites. Combined with a strong **rim-light on characters** against the dark background, the 2.5D read is convincing.

**Paper Mario** (Nintendo, N64+) demonstrated flat characters in 3D worlds are believable when the **design language commits consistently** — every character is paper-flat, every environment uses similar visual vocabulary ([Paper Mario design analysis, Mario Wiki](https://www.mariowiki.com/Paper_Mario_%28series%29); [Unity discussion on the style](https://discussions.unity.com/t/2d-characters-in-a-3d-environment-the-paper-mario-art-style/604429)). The lesson: mixing flat and volumetric in the same tier breaks the illusion. PocketHero should decide: are arenas also flat/stylised, or are they more "real"? If arenas have depth (parallax, normal-mapped tiles), creatures should have slight normal-map shading too.

**xDasher devlog** (indie pixel game) documents the most PixiJS-relevant technique stack for adding depth on a budget ([xDasher devlog: 4 things we did for depth](https://pixel-beef.itch.io/xdasher/devlog/192949/4-things-we-did-to-add-light-and-depth-to-our-pixel-art-game)):
1. 3D point lights above sprites with Standard Sprite Diffuse shader
2. **Rim light shader** — highlights outermost pixels based on received light; creates a glowing edge that "makes the character a believable part of our world"
3. **Hand-painted drop and cast shadows** onto sprites directly — "the most efficient way to light a 2D game"
4. **Normal maps** on environmental objects for polish

**Hyper Light Drifter** uses the simplest approach that still reads as deep: **split-complementary palette per area** (warm character on cool environment or vice versa), large sections of flat colour with tiny detail etchings, and a consistent lighting direction ([HLD art direction analysis blog](http://idrawwearinghats.blogspot.com/2014/04/art-direction-analysis-of-hyper-light.html)). The depth is mainly *implied* by colour temperature: warm objects come forward, cool objects recede.

### What PocketHero Needs Specifically

The arena is a 2.5D space with:
- **Floor plane**: a tiled isometric-perspective or slight overhead-angle surface
- **Depth axis**: creatures move back/forward; depth shown via Y-position, scale, and shadow distance
- **Drop shadow**: every creature has a soft-edge shadow sprite on the floor plane (PixiJS: `Graphics` oval, blurred)
- **Depth scaling**: creatures at back of arena are ~80% size; creatures at front ~100%
- **Arena parallax**: at minimum 2 layers (near arena wall / far background) scrolling at different rates
- **Point light**: one warm point light source (sun-side) per arena to give all sprites a shared lighting direction

---

## Part 3 — Palette & Semantic-Colour Systems

### The Core Tension

PocketHero's semantic palette assigns colour to *function* (stat type). The challenge: 22+ stat types need distinct colours, those colours must form a harmonious palette, the palette must be colourblind-safe, and the result must still look beautiful in motion.

### Reference Palettes

**DawnBringer DB16** (16 colours) ([Lospec: DB16](https://lospec.com/palette-list/dawnbringer-16); [PixelJoint original thread](https://pixeljoint.com/forum/forum_posts.asp?TID=12795)) — the classic small palette. Its key design insight: *"it somewhat forces the artist to colour lights and shadows with warm and cold hues"* — colour temperature contrast does the shading work, reducing the colours needed. Ships as a default Aseprite preset. Too small for 22 stat types, but the temperature-contrast principle is essential.

**DawnBringer DB32** ([Lospec: DB32](https://lospec.com/palette-list/dawnbringer-32)) — the 32-colour expansion. More room for distinct stat hues while keeping the same warm/cool discipline. A reasonable target palette size.

**Endesga-32** ([Lospec: Endesga-32](https://lospec.com/palette-list/endesga-32)) — 195,000+ downloads, included in Aseprite presets. Covers warm earth tones, cool blues/cyans, multiple green ramps, clean neutrals. Designed with organised colour ramps for smooth shading without excessive colours. The most downloaded non-legacy palette on Lospec.

**AAP-64** ([Lospec: AAP-64](https://lospec.com/palette-list/aap-64); [PixelJoint gallery](http://pixeljoint.com/pixelart/119466.htm)) — 64 colours, all hand-selected without computer generation. Natural smooth ramp transitions. Wide enough to cover 22 stat types with room for shading.

**Colourblind-16** ([Lospec: Colorblind-16](https://lospec.com/palette-list/colorblind-16)) — adapted from IBM's colourblind-safe palette for pixel art. Tested with multiple types of colour vision deficiency including monochromacy. All 16 colours maintain unique identifiable shades even under greyscale simulation. This is the foundation for the semantic sub-palette.

### Reconciling Semantic Colour with Aesthetic Harmony

The key insight from palette research: **semantic colour and aesthetic harmony need to work on different registers**:

- **Hue** = stat-type identity (red = attack, blue = armor, etc.) — this is the semantic layer
- **Value/brightness** = depth, shading, sheen — this is the aesthetic layer
- **Saturation** = health/charge state — a weakened pixel desaturates while maintaining hue-identity

This means you need **at least 3 value steps per stat-hue** (dark, mid, highlight) — for 8 core stat types, that's 24 colours minimum. This is why DB32 or Endesga-32 is the right scale.

**Brotato** solves a simpler version of this problem with hard semantic colour rules: enemies are purple, bullets are red, the player is white — never ambiguous, always reads at game speed. The background is dark and desaturated. The lesson: **make the arena/background the visual "quiet zone"** so stat-coloured pixels pop against it.

**PICO-8's 16-colour palette** ([Lospec: PICO-8](https://lospec.com/palette-list/pico-8)) demonstrates that constraints force beauty — with only 16 colours, every pixel choice is deliberate, and the palette's natural harmony emerges. The practical takeaway: if you freeze the creature palette at 16 semantic colours (8 stat types × 2 tints: base + highlight), the aesthetic problem simplifies dramatically.

### Recommended Approach for PocketHero

1. Define **8 primary stat hues** from a colourblind-safe base (IBM palette or Colourblind-16)
2. Give each hue **3 values**: shadow, mid, highlight (= 24 creature colours total)
3. Add **4–6 neutral colours** for creature "body frame" pixels (if a player places filler pixels, they are grey/beige neutrals)
4. Reserve a **separate glyph layer** (drawn as a PIXI Graphics overlay, not as pixels) for per-type glyphs — this means glyphs don't consume palette slots
5. The **arena palette** is separate: muted, lower-saturation, mostly cool tones, so hot stat-colours read as figure against ground

---

## Part 4 — Juicy Pixel Combat & VFX Style

### The Gold Standard: Dead Cells

Dead Cells (Motion Twin) is universally cited as the benchmark for pixel-art combat juice ([GameDeveloper deep dive](https://www.gamedeveloper.com/production/art-design-deep-dive-using-a-3d-pipeline-for-2d-animation-in-i-dead-cells-i-); [80.lv case study](https://80.lv/articles/case-study-dead-cells-character-art-pipeline); [GameAnim analysis](https://www.gameanim.com/2018/01/31/dead-cells-3d-pipeline-2d-animation/)). The technical stack:
- **3D models downsampled to pixel art**, preserving normal maps → each sprite has a corresponding normal map → real-time point lighting on flat sprites (the lighting *moves* as the light moves)
- **Hit flash**: white colour-swap shader activated for 2–3 frames on damage (the "all-pixels-go-white" flash) — reads at game speed even in peripheral vision
- **Hitstop**: freeze animation for 4–8 frames on heavy hits (the freeze *is* the impact)
- **Screenshake**: short-duration (100–200ms), eased, directional — communicates the *direction* of impact
- **Chunky particles**: debris at pixel scale, not sub-pixel; satisfying to watch because they snap to the pixel grid
- **Blend modes for VFX**: additive blend for glow/fire effects (bright without obscuring content)

Dead Cells is also notable for *what it doesn't do*: VFX never occlude the character sprite outline. The silhouette of every creature is always readable through any effect layer.

### The Anti-Pattern: Soulstone Survivors

Soulstone Survivors had to add a **VFX opacity slider** because, at late-game build densities, special effects completely buried enemy attack indicators under the player's own VFX ([Steam community thread: Too much visual effects](https://steamcommunity.com/app/2066020/discussions/3490880386666412232/)). The problem was specifically that enemy attack indicators were underlaid (rendered below player VFX) rather than overlaid. The fix the community wanted was *not a slider* — it was **drawing enemy danger indicators on a top layer with maximum opacity**.

**PocketHero implication**: Assign strict draw-layer priority:
1. **Top**: enemy incoming-attack telegraphs + damage numbers
2. **Mid**: creature sprites + causal flares (pixel ability fires)
3. **Low**: VFX particles, trails, screenshake, debris

### Other Reference Games

**Nuclear Throne** (Vlambeer) — established the vocabulary of "chunky-pixel" bullet feel. The principle: pixels that snap to grid feel *heavier* than smooth sub-pixel particles. The crack of a shotgun shell in Nuclear Throne comes from large, fast, grid-snapping pixel chunks that vanish in 3–4 frames ([Nuclear Throne on Wikipedia](https://en.wikipedia.org/wiki/Nuclear_Throne)).

**Vampire Survivors** — demonstrated that extreme VFX density is possible *if the player character silhouette is always maximally bright and distinct*. The player is a bright white dot in a sea of effects; the contrast makes it work. The options menu offers a "Flashing VFX" toggle for accessibility ([PCGamingWiki: Vampire Survivors options](https://www.pcgamingwiki.com/wiki/Vampire_Survivors)).

**Celeste** — the restrained counterpoint. Screenshake kept to 50–300ms with easing. Madeline's hair state-change (colour signal) is the primary feedback layer. Particle count is minimal; every particle has narrative purpose. The devblog advice: *"screenshake communicates impact and weight without changing gameplay — keep it short and use an easing curve"* ([GameDevAcademy: How To Improve Game Feel](https://gamedevacademy.org/game-feel-tutorial/)). For PocketHero's idle-watch mode (player observing auto-battle), Celeste's restraint is a useful counterweight to Dead Cells' density.

**Brotato** demonstrates semantic VFX: danger = red, always ([Games Asylum review](https://www.gamesasylum.com/2024/02/06/brotato-review/)). The player sprite is white. Every combat signal is expressed in simple, unambiguous colour codes that work without knowing the game. This aligns directly with PocketHero's semantic palette: a hit to an armor pixel could briefly flash a bright blue ring (armor colour) instead of always flashing white — the damage *knows* what it hit.

### VFX Technique Stack for PixiJS

| Effect | PixiJS Implementation | Notes |
|---|---|---|
| Hit flash | Colour matrix filter; swap all RGB to 1,1,1 for 3 frames | Cheapest readable hit confirm |
| Stat-hit flash | Colour tint to stat hue (e.g., blue for armor hit) | Semantic feedback |
| Hitstop | Pause animation ticker for 6–10 frames on heavy hit | Code-side, free |
| Screenshake | Translate stage container ±4px on eased curve, 150ms | One function, reused everywhere |
| Debris particles | ParticleContainer v8: 100k+ particles at 60fps ([PixiJS ParticleContainer v8 blog](https://pixijs.com/blog/particlecontainer-v8)); pixel-grid-snapped chunks | Must snap to pixel grid |
| Glow / causal flare | GlowFilter ([PixiJS GlowFilter docs](https://pixijs.io/filters/docs/GlowFilter.html)); apply only to firing pixel | Expensive if overused; apply per-pixel, remove when idle |
| Drop shadow | Graphics oval, blurred, 40% alpha | One per creature, updated on depth position |
| Normal map lighting | PixiJS natively supports normal-mapped sprites ([SpriteIlluminator docs](https://www.codeandweb.com/spriteilluminator)) | For arena tiles; optional for creatures |

---

## Part 5 — Cheap Authored Art Pipelines (Arenas, UI, VFX)

Since creatures are player-authored (zero art budget), the authored budget concentrates on **arenas, UI elements, and VFX particles**.

### Blender → Pixel Art Pipeline

Blender can render assets directly to pixel art via dithered downsampling, producing highly detailed environments at pixel scale ([Blender pixel art exploration, Blender Studio](https://studio.blender.org/blog/3d-pixel-art-in-blender/); [Patata School: Pixel Art in Blender](https://www.patataschool.com/pixel-art-in-blender/)). Lucas Roedel's Blender addon adds Bayer dithering and multiple light sources to the pixel-art render path. **For arenas**: model the arena in Blender with proper materials and lighting, render at 2×–4× target pixel size with dithering, downscale in Aseprite with palette-snap. This gives you normal-map-accurate shadows and lighting for zero additional painting.

The **Dead Cells pipeline** demonstrated this at production scale: 3D model → custom downsampling tool → pixel sprite sheet + normal map in one pass ([Dead Cells animation pipeline, GameAnim](https://www.gameanim.com/2018/01/31/dead-cells-3d-pipeline-2d-animation/)). The animator reused 3D rig assets across characters, saving hundreds of hours.

### Aseprite Tools

- **Normal Toolkit for Aseprite** by Mooosik ([itch.io: Aseprite Normal Toolkit](https://mooosik.itch.io/normal-toolkit)) — auto-generates normal maps from Aseprite layers
- **Normal Map Preview extension** by Yahallo Games ([itch.io](https://yahallogames.itch.io/normal-map-preview-aseprite-extension)) — preview lighting on sprites in real-time inside Aseprite
- **Normal Shading extension** by Mooosik ([itch.io](https://mooosik.itch.io/shading-extension)) — adds shading preview based on a light direction

### SpriteIlluminator

For painted arena tiles, **SpriteIlluminator** ([codeandweb.com](https://www.codeandweb.com/spriteilluminator)) generates normal maps from existing pixel art sprites. This is the fastest way to add proper 2D lighting to hand-painted tiles without Blender.

### PixiJS Filter Pipeline

PixiJS ships a [community filter library](https://github.com/pixijs/filters) including GlowFilter, BloomFilter, ColorMatrixFilter, DotFilter (CRT scanlines), and CRTFilter. These apply as post-processing passes on any DisplayObject with minimal setup. Performance note: filters on individual sprites are costly; apply to containers or limit filter area with fixed `filterArea` rectangles.

---

## Part 6 — Art Direction Routes

Four distinct routes, all within locked constraints. Each is genuinely different in vibe, palette, outline treatment, and production cost.

---

### Route A: "Clean Semantic Flat" — *Icons in Space*

**Vibe:** Ultra-legible, opinionated, modern flat design. Creatures are bright icon-objects against a quiet muted arena. Every pixel reads its type at a glance. The overall feeling is a tabletop game come to life — clean edges, high contrast, confident colour. Think Brotato meets a well-designed board-game status board.

**Palette:** 8 vivid stat hues (drawn from IBM Colorblind-Safe, tuned for maximum distinction) × 2 tints (mid + highlight) = 16 creature colours. Arena uses a 4–6 colour muted grey/stone sub-palette entirely separate from creature hues. Background is near-black desaturated tone. Total palette: ~22–24 colours.

**Outline treatment:** Hard 1px black outline on every creature (computed in PixiJS as a rendered sprite outline via `OutlineFilter`). Black outline provides maximum silhouette separation from any background. The outline is the frame; the stat colours are the content. No shading — completely flat fill within the outline.

**How creatures get charm:** Eyes are the sole authored element per creature — a small set of hand-drawn eye sprites (normal, sleeping, enraged, dead) positioned at creature's topmost pixel. The spring jiggle and the eyebrow reaction state carry personality. Creatures bounce and wobble through physics; the eye sprite tracks the motion with a slight lag (cheap tweening).

**Arena / VFX:** Arenas are flat-tile top-down/slight-overhead grids with strong geometric patterns — minimalist colour-field backgrounds, hard-edge tile art. VFX is clean and graphic: hit flashes are pure white/stat-colour, particles are solid-colour pixel squares, no soft glow. Screenshake is short and sharp.

**Reference games/images:**
- [Brotato (Steam)](https://store.steampowered.com/app/1550050/Brotato/) — semantic colour rules, clean enemy/player contrast
- [Patapon (PlayStation Blog)](https://blog.playstation.com/archive/2017/08/01/the-complete-story-behind-rhythm-action-classic-patapon-as-told-by-the-games-creators/) — silhouette-first, geometry + colour = character
- [Dome Keeper (Raw Fury/Steam)](https://store.steampowered.com/app/1637320/Dome_Keeper/) — clean flat backgrounds with strong creature silhouettes
- [DB16 palette reference (Lospec)](https://lospec.com/palette-list/dawnbringer-16) — flat colour discipline

**Production cost:** Lowest. Arenas are geometric tile sets (one artist, one week per arena). VFX are code-generated solid-colour shapes. No lighting passes, no normal maps, no glow.

**Main risk:** Creatures may feel clinical rather than alive without shading. The palette harmony of 8 distinct semantic hues on a single creature (a late-game build) could look garish. Mitigation: enforce a cap on simultaneous distinct hues visible (e.g., maximum 4 hue families per creature via UI feedback).

---

### Route B: "HD-2D Diorama" — *Living Miniature*

**Vibe:** Warm, handcrafted, like a lovingly-lit diorama in a glass case. Pixel sprites feel three-dimensional because they're lit by a single warm point light, cast proper drop shadows, and sit in a foggy parallax world. The aesthetic borrows HD-2D's diorama effect but at a smaller resolution and simpler production budget. Feels premium, not retro.

**Palette:** Endesga-32 as base. Warm amber light source tints everything slightly gold on the lit side, cool blue on the shadow side — temperature contrast does the shading work (DB16 principle). Stat hues are slightly desaturated compared to Route A; they're lit objects, not flat icons. Arena uses a separate earth/stone ramp with 2–3 depth colour shifts (foreground lighter, background more muted/cool).

**Outline treatment:** Selective outline — crisp outline on creature/background boundary, no internal outlines. Where a creature's coloured pixel borders the background, a 1px rim-light outline appears (slightly brighter than the pixel colour, matching the light direction). This is the same technique as xDasher's rim-light shader and Dead Cells' lit sprites. The outline is dynamic: it shifts with the point light direction.

**How creatures get charm:** The jiggle physics gains a lighting dimension — pixels on the lit side of the wobbling creature are slightly brighter; shadow-side slightly darker. The creature appears volumetric even though it's a flat grid. Eye glyphs are small but have a tiny `GlowFilter` applied when the creature is active (dim glow off, pulse glow when attacking).

**Arena / VFX:** Arenas built via Blender-render pipeline: 3D arena geometry rendered to pixel art with dithered shadows, then palette-snapped. 3–4 parallax layers (far sky/bg, mid wall/terrain, near floor decor, arena floor plane). Point light in scene casts creature shadows onto floor. VFX uses additive blend glow for ability flares; particles have a slight bloom. Depth of field effect on back parallax layers (PixiJS blur filter).

**Reference games/images:**
- [HD-2D / Octopath Traveler (Wikipedia)](https://en.wikipedia.org/wiki/HD-2D) — the defining reference; tilt-shift, shadows, point light
- [Don't Starve billboard technique (Klei forum)](https://forums.kleientertainment.com/forums/topic/56775-is-there-a-name-for-the-games-2d-as-3d-animation-style/) — drop shadows, depth, billboard creatures
- [Moonlighter pixel art (80.lv)](https://80.lv/articles/moonlighter-building-pixel-art-preparing-for-switch) — warm-lit arena tilesets, creature shading
- [xDasher devlog: 4 depth techniques (itch.io)](https://pixel-beef.itch.io/xdasher/devlog/192949/4-things-we-did-to-add-light-and-depth-to-our-pixel-art-game) — practical PixiJS/Unity depth recipe

**Production cost:** Medium-high for arenas (Blender pipeline investment). Creature rendering is automatic (per-pixel lighting computed from the single point light against stat colours). One Blender template per arena type, then skin variants are cheap.

**Main risk:** The warm lit aesthetic may fight with the cold/cool semantic colours (e.g., blue armor pixels look muddy under amber light). Mitigation: tune point light to white/neutral rather than warm amber; save warmth for arena-only lighting that doesn't light creature sprites.

---

### Route C: "Neon-Glow Synthwave" — *Dark Arena, Electric Creatures*

**Vibe:** Dark arena, electric creatures. The battlefield is near-black with deep cool or purple midtones. Stat pixels glow — they're self-luminous, not illuminated. The creature's attack lights up the arena around it. Screenshake and particle bursts feel like electrical discharge. References: REPLACED (neon pixel with 3D lighting), Hyper Light Drifter's vivid-on-dark palette, PixiJS's GlowFilter capabilities. This is the most "premium-feeling" route for a browser game and the most visually dramatic on stream.

**Palette:** Very restricted base (6–8 colours): near-black for arena ground, 2–3 dark cool midtones for arena surfaces, white/off-white for UI. Stat-type colours are *highly saturated, high-brightness* — they need to glow against the dark. Each stat hue is also its highlight colour; no dark values needed for stat pixels (they're emissive). A GlowFilter on each active pixel provides soft outer glow. Total creature palette: 8–10 stat hues, no shading steps required (glow implies light). Arena palette: 6–8 separate dark tones.

**Outline treatment:** None on creatures. The `GlowFilter` provides the creature boundary — a soft coloured halo around each pixel cluster separates it from the background. This only works reliably on dark backgrounds (which this route mandates). The glow radius should be 2–3px; inner glow strength 0, outer strength 2–3 ([PixiJS GlowFilter docs](https://pixijs.io/filters/docs/GlowFilter.html)).

**How creatures get charm:** Creatures pulse. The spring jiggle translates into a subtle GlowFilter intensity oscillation — pixels "breathe" (glow intensity varies ±20% on a 1.5s sin wave when idle, spikes to full on combat). The eye glyph is a bright point in the glow cloud; it's the hottest-brightness pixel on the creature. Physics wobble is especially visually striking against a dark background because the glowing outline traces the motion trail.

**Arena / VFX:** Arenas are dark: cave, void, circuit-board, deep space, ruin. Parallax layers are silhouette-only at back, with occasional neon accent details. VFX is additive-blend only — everything bright is added to the dark background, never subtracted. Hit particles are electric sparks. The causal flare (ability fire) is a bright burst that momentarily lights the arena around the creature. Screenshake is more intense here (the drama is expected).

**Reference games/images:**
- [Hyper Light Drifter art direction analysis](http://idrawwearinghats.blogspot.com/2014/04/art-direction-analysis-of-hyper-light.html) — vivid on dark, split-complementary per area
- [Neon Synthwave pixel game aesthetics (retrowave.com)](https://retrowave.com/neon-dreams-and-killer-beats-the-ultimate-synthwave-games/) — the genre context
- [PixiJS GlowFilter documentation](https://pixijs.io/filters/docs/GlowFilter.html) — implementation reference
- [Vampire Survivors (Steam)](https://store.steampowered.com/app/1794680/Vampire_Survivors/) — additive blend VFX, player always brightest element

**Production cost:** Medium-low. Arenas are dark silhouette backgrounds (fast to produce, no lighting pipeline). The GlowFilter does the heavy aesthetic lifting in code. Main authored asset is arena mid-ground silhouette art (1–2 layers per arena).

**Main risk:** GlowFilter is expensive at scale — applying per-pixel to a 20-pixel creature at 60fps with many creatures on screen may tank performance. Mitigation: apply GlowFilter to the entire creature sprite (as one container), not per-pixel; only apply to creatures on screen and within camera distance. Also: the dark-arena requirement limits arena variety (no bright outdoor arenas without style breakage).

---

### Route D: "Crunchy CRT Ugly-Cute" — *Vintage Pocket Monster*

**Vibe:** Deliberately low-resolution, deliberately crunchy — like playing on an original Game Boy Color with a slightly damaged screen. The pixel art is imperfect and proud of it. Creatures read as vintage digital pets (Tamagotchi, Game Boy Pokémon, old Digimon) that have gained tactical sentience. The 2.5D depth is achieved through dithering patterns rather than gradients (Bayer dither on shadows, on fog, on everything). There's a CRT scanline overlay from PixiJS's CRTFilter. This is the route that most aggressively leans into the pixel-blob-as-character identity — because in this aesthetic, a pixel blob *is* the aesthetic, not a compromise.

**Palette:** Strictly constrained to 16–20 colours (PICO-8 adjacent, or a custom colourblind-safe 16 derived from the Colorblind-16 base). Stat hues mapped to PICO-8-adjacent hues: limited overlap, maximum distinction. Dithering between palette entries replaces gradients — a pixel in half-light is a checkerboard of lit and shadow colours, not a mid-value colour. This gives the chunky, hand-held-game texture.

**Outline treatment:** Hard 1px dark outline (near-black, not pure black — use the darkest palette colour, one step up from black). Internal major boundaries also outlined (e.g., where attack-red pixel meets armor-blue pixel, a dark 1px separator). This maximises per-pixel readability at tiny sizes. The outline stays constant regardless of lighting — it's baked into the sprite rendering, not a runtime effect.

**How creatures get charm:** The *ugliness is the feature*. A chunky, asymmetric, dithered creature looks like a creature you'd have on a 1999 digital pet device — it carries retro-toy nostalgia. Eye glyphs are pixel-tiny (2×2 maximum), drawn in a simplified style that matches the 16-colour, dithered aesthetic. The spring jiggle is *more exaggerated* in this route (higher spring constant, more bounce) — the chunky aesthetic pairs with bouncy slapstick physics.

**Arena / VFX:** Arenas are tightly-constrained tileset art, PICO-8-style. Floor is a dithered checkerboard in 2 complementary colours. Background is flat bands of palette colours (no gradient). VFX uses chunky pixel chunks (4×4px minimum), no glow, hard colour (no additive blend — keeps the CRT palette intact). CRTFilter applied as screen-level post-process (slight scanlines, subtle barrel distortion, screen curvature). Drop shadow is a dithered oval.

**Reference games/images:**
- [PICO-8 palette reference (Lospec)](https://lospec.com/palette-list/pico-8) — the defining 16-colour constraint
- [Patapon design (GameDeveloper)](https://www.gamedeveloper.com/game-platforms/q-a-i-patapon-i-s-rolito-talks-art-and-inspiration) — minimalism as feature
- [Nuclear Throne (Steam)](https://store.steampowered.com/app/242680/Nuclear_Throne/) — chunky pixel combat particles, crunchy feel
- [Wobbledogs (Steam)](https://store.steampowered.com/app/1424330/Wobbledogs/) — emergent ugly-cute creature charm via physics

**Production cost:** Lowest arena production cost (flat dithered tiles are fast). Highest cognitive constraint — the dither discipline and 16-colour palette require careful management when adding new content.

**Main risk:** The CRT/retro aesthetic is a very crowded market positioning. "Another PICO-8 game" is a risk unless the emergent creature system is the clear differentiator. Also: CRTFilter is a post-process pass on the entire canvas — this is fine at 60fps on modern hardware but degrades on lower-end mobile browsers. The dither aesthetic may make per-pixel stat reading harder because dither patterns add visual noise around creature boundaries.

---

## Route Comparison Table

| Route | Vibe (3 words) | Palette | Outline | Creature Charm | Arena | VFX Style | Production Cost | Main Risk |
|---|---|---|---|---|---|---|---|---|
| **A: Clean Semantic Flat** | Graphic, legible, bold | 16 vivid stat colours + 6 muted arena | Hard 1px black, computed OutlineFilter | Eyes + spring physics | Flat geometric tiles | Solid-colour, sharp, no glow | Low | Garish at high hue count |
| **B: HD-2D Diorama** | Warm, premium, depth | Endesga-32, temp-contrast shading | Selective rim-light (dynamic) | Eyes glow, physics + lighting | Blender-rendered, parallax layers | Additive glow, depth-of-field | Medium-high | Warm light fights cool stat hues |
| **C: Neon-Glow Synthwave** | Electric, dark, dramatic | 6-8 dark arena + 8-10 vivid emissive stat hues | None; GlowFilter provides boundary | Breathing glow pulse, eye hotspot | Dark silhouette, neon accents | Additive-only sparks and bursts | Medium-low | GlowFilter perf at scale; dark arenas only |
| **D: Crunchy CRT Ugly-Cute** | Retro, chunky, slapstick | 16-20 colours (PICO-8 adjacent) | Hard 1px dark, internal boundaries too | Exaggerated bounce, retro nostalgia | Flat dithered tile bands, CRT overlay | Chunky solid-colour debris, no glow | Lowest arenas | Crowded market position; dither adds noise |

---

## Recommendation

**Primary recommendation: Route B (HD-2D Diorama), with Route A as the fast-ship fallback.**

Route B best matches PocketHero's emergent creature system because:
1. **Per-pixel dynamic lighting makes the physics more beautiful** — the wobbling creature casts a moving shadow, and the jiggle causes lit/shadow sides to shift, making the spring simulation *visible* as well as physical.
2. **The diorama premium feel differentiates the game** — the idle autobattler market is dominated by Route D (crunchy retro) and Route C (neon) aesthetics. A warm, handcrafted-diorama pixel look is distinctive.
3. **Semantic colour survives temperature-lit shading** — with a neutral-to-cool point light, the stat hues retain their identity while gaining depth.
4. **The Blender pipeline investment pays compound dividends** — once one arena is templated, skinning variants is cheap; the normal-map pipeline works for UI elements and VFX too.

Route A is recommended as the **development phase default** while Route B pipeline is built — it is the cheapest to implement and directly tests the semantic palette + legibility system without any lighting dependencies. Build Route A first, promote to Route B when the Blender/PixiJS lighting pipeline is validated.

Route C is worth prototyping if the game targets a streaming/spectator audience — it is the most visually spectacular on camera. The glow aesthetic broadcasts well. Consider Route C for the "arena boss" moments even within a Route B game.

Route D should be parked as a potential future skin/alternative mode, not the main identity.

---

## Non-Negotiable Visual Rules

Distilled from all references above:

1. **Silhouette-first, always.** The creature outline is readable at any VFX density. VFX are painted below the creature sprite layer; only telegraphs/damage numbers go above. (Soulstone Survivors anti-pattern.)
2. **Semantic colour is sacred.** Red is attack. Blue is armor. Green is HP. These are never used for decoration. Arena and UI use a completely separate palette. (Brotato's semantic VFX rule.)
3. **Every creature has a face.** A minimum eye indicator anchors the blob as a creature, not a cluster of blocks. Even 1-pixel creatures display a directional face indicator.
4. **Physics carries charm.** The spring jiggle is the primary animation system; visual design amplifies it, not replaces it. (Wobbledogs/Fall Guys principle.)
5. **Drop shadow grounds the creature.** Every billboard sprite casts a soft shadow oval onto the arena floor plane. Without it, creatures float. (HD-2D principle.)
6. **Palette discipline across all content.** New content — arenas, UI, VFX — uses only approved palette colours. No one-off colours. Use the Endesga-32 or custom palette as the global constraint.
7. **VFX layering is non-optional.** Draw layer order: (1) arena background, (2) arena floor, (3) drop shadows, (4) creature sprites, (5) causal flares, (6) particle debris, (7) screen-space effects (screenshake, flash), (8) damage numbers / telegraphs.
8. **Test at combat scale.** All VFX decisions validated with 6+ creatures on screen simultaneously. What looks good at 1 creature may bury the read at 8.

---

## Open Art Questions for the Director

Choices the final look hinges on. These are sharp binary or constrained options:

1. **Outlines: hard 1px / selective rim-light / none (glow only)?**
   - Hard = Route A/D: maximum per-pixel readability, cartoonish, cheap
   - Rim-light = Route B: premium, requires shader, lighting-dependent
   - None / glow = Route C: only works on dark background, expensive at scale

2. **Face / eyes on creatures: universal anchor glyph / player-optional face pixels / none?**
   - Universal anchor = lowest charm floor, most readable (recommended)
   - Player-optional = player can choose face-type pixels (charming but inconsistent)
   - None = purer "pixel build" concept but likely kills creature empathy

3. **Palette size: 16 (PICO-8 scale) / 32 (Endesga scale) / 64 (AAP-64)?**
   - 16 = forces hard semantic choices; very coherent; limits shading
   - 32 = sweet spot for 8 stat types with shading steps (recommended)
   - 64 = most visual richness; hardest to manage discipline

4. **Lighting model: flat (no light) / single point light affecting sprites / emissive glow (no external light)?**
   - Flat = cheapest, fastest, Route A/D
   - Single point light = Route B; requires normal-map sprites for full effect
   - Emissive = Route C; dark background required

5. **VFX intensity ceiling: Celeste (restrained) / Dead Cells (dense but silhouette-safe) / Vampire Survivors (extreme, player = brightest point)?**
   - This is determined partly by arena size and creature count; idle autobattlers benefit from VS-style density at high levels

6. **Arena style: flat-geometric (designed in Aseprite, 1–2 days) / Blender-rendered (1–2 weeks investment, compound return) / tileset-from-palette (procedurally coloured, developer-authored)?**
   - Flat-geometric = fastest ship, Route A/D
   - Blender-rendered = premium, Route B, best long-term economics
   - Procedural tileset = interesting if arena variety is high and art budget is lowest-possible

---

## Reference / Moodboard Link Table

| Game / Resource | What to Steal Visually | Link |
|---|---|---|
| Octopath Traveler (HD-2D) | Tilt-shift diorama depth, point light shadows, fog depth cue | [Wikipedia: HD-2D](https://en.wikipedia.org/wiki/HD-2D) |
| Don't Starve | Drop-shadow billboard grounding, depth-scale with Y-position | [Klei forum discussion](https://forums.kleientertainment.com/forums/topic/56775-is-there-a-name-for-the-games-2d-as-3d-animation-style/) |
| Dead Cells | Normal-mapped lit sprites, white hit flash, hitstop, VFX layer discipline | [GameDeveloper art deep dive](https://www.gamedeveloper.com/production/art-design-deep-dive-using-a-3d-pipeline-for-2d-animation-in-i-dead-cells-i-); [80.lv case study](https://80.lv/articles/case-study-dead-cells-character-art-pipeline) |
| Brotato | Semantic colour rules (enemies purple, danger red), readable flat silhouettes | [Games Asylum review](https://www.gamesasylum.com/2024/02/06/brotato-review/) |
| Vampire Survivors | Player = brightest element, additive VFX never occludes player, accessibility VFX toggle | [PCGamingWiki](https://www.pcgamingwiki.com/wiki/Vampire_Survivors) |
| Celeste | Restrained screenshake (150ms, eased), physics squash/stretch, hair as state signal | [GameDevAcademy game feel](https://gamedevacademy.org/game-feel-tutorial/) |
| Patapon | Silhouette-only character = complete personality; geometry + colour = charm | [Rolito interview, GameDeveloper](https://www.gamedeveloper.com/game-platforms/q-a-i-patapon-i-s-rolito-talks-art-and-inspiration) |
| Fall Guys | Rounded chunky silhouette = non-threatening appeal; soft shapes = charm | [PlayStation Blog character design](https://blog.playstation.com/2020/05/25/creating-the-character-designs-of-fall-guys-out-on-ps4-this-summer/) |
| Wobbledogs | Physics-driven personality > visual beauty; jiggle = life | [GameDeveloper: Wobbledogs AI/physics](https://www.gamedeveloper.com/design/behind-the-ai-and-physics-of-i-wobbledogs-i-procedurally-goofy-wobbledogs) |
| Hyper Light Drifter | Vivid on dark; split-complementary per zone; area palette = emotional tone | [Art direction analysis blog](http://idrawwearinghats.blogspot.com/2014/04/art-direction-analysis-of-hyper-light.html) |
| Soulstone Survivors | The anti-pattern: VFX buried gameplay → opacity slider = design failure | [Steam community thread](https://steamcommunity.com/app/2066020/discussions/3490880386666412232/) |
| Nuclear Throne | Chunky grid-snapped pixels for debris — heavier feeling than sub-pixel | [Wikipedia](https://en.wikipedia.org/wiki/Nuclear_Throne) |
| Dome Keeper | Retro-atmospheric underground arena, sci-fi pixel tiles | [Grokipedia](https://grokipedia.com/page/Dome_Keeper) |
| Paper Mario | Flat characters in 3D world — commit to the style language consistently | [Mario Wiki](https://www.mariowiki.com/Paper_Mario_%28series%29) |
| Endesga-32 palette | 32-colour harmony with warm/cool ramps; Aseprite preset; 195k downloads | [Lospec: Endesga-32](https://lospec.com/palette-list/endesga-32) |
| DawnBringer DB32 | Classic 32-colour constrained palette; warm/cool temperature contrast | [Lospec: DB32](https://lospec.com/palette-list/dawnbringer-32) |
| Colorblind-16 palette | Colourblind-safe pixel art palette, luminance-distinct under all CVD types | [Lospec: Colorblind-16](https://lospec.com/palette-list/colorblind-16) |
| AAP-64 palette | 64 hand-selected colours, smooth ramps, wide stat-hue coverage | [Lospec: AAP-64](https://lospec.com/palette-list/aap-64) |
| xDasher devlog | 4-step depth recipe for pixel game (lights, rim shader, shadows, normal maps) | [xDasher on itch.io](https://pixel-beef.itch.io/xdasher/devlog/192949/4-things-we-did-to-add-light-and-depth-to-our-pixel-art-game) |
| Blender pixel art render (Blender Studio) | 3D-to-pixel pipeline with dithering, normal maps | [Blender Studio blog](https://studio.blender.org/blog/3d-pixel-art-in-blender/) |
| PixiJS GlowFilter | Glow outer/inner, distance/strength params; apply to container | [PixiJS filters docs](https://pixijs.io/filters/docs/GlowFilter.html) |
| PixiJS ParticleContainer v8 | 1M particles at 60fps on M3; dynamic vs static property control | [PixiJS blog: ParticleContainer v8](https://pixijs.com/blog/particlecontainer-v8) |
| SpriteIlluminator | Normal-map editor for pixel art — generates from existing sprites | [codeandweb.com](https://www.codeandweb.com/spriteilluminator) |
| Aseprite Normal Toolkit | Auto-generates normal maps from Aseprite layers | [itch.io by Mooosik](https://mooosik.itch.io/normal-toolkit) |

---

*End of report. Next step: director selects a route (or hybrid), then a palette prototype and one arena + one combat encounter are built to test the complete look.*
