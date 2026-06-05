# PocketHero — Art Direction (LOCKED) — feeds Slice 2

**Date:** 2026-06-05
**Status:** LOCKED by director. Closes the art-research question opened before Slice 2.
**Inputs:** `docs/research/2026-06-05-art-direction-styles.md` (4 routes) + the live comparator
`poc/art-routes.html` (same creature in A/B/C/D, viewed on LAN).
**Consumed by:** `docs/2026-06-05-pockethero-slice2-renderer.md` (the renderer implements this).

---

## 1. The decision

| Question | Locked answer | Notes |
|---|---|---|
| **Art route** | **B — HD-2D Diorama** | Warm premium diorama; best showcases the spring-physics (live shadows + volumetric cubes). |
| **VFX / juice ceiling** | **Dead Cells** | Dense but silhouette-safe: white/semantic flash, hitstop, screenshake, chunky debris, additive ability-flares. Not Vampire-Survivors maximalism, not Celeste restraint. |
| **Arenas** | **Start simple → grow** | Hand-made gradient/geometry diorama with one point light + shadows + parallax now. Blender-rendered diorama arenas deferred until the feel is locked. |
| **Faces / eyes** | **No faces** | Director's call — pure "pixel construct" identity. Charm comes from **silhouette + spring physics + per-type glyphs**, not an eye. (Deliberately overrides the research "every creature has a face" non-negotiable.) |
| **Palette** | **Endesga-32 scale** | ~32 colours: 8 semantic stat-hues × ~3 values, + neutrals. Hue = stat type, value = shading, saturation = state. |
| **Lighting** | **Single neutral-cool point light, upper-left** | Neutral (not warm-amber) so it doesn't muddy cool stat hues (blue armor / frost). Warmth lives in the *arena* light pool, not on creature sprites. |

## 2. What "Route B" means concretely (the cube is the unit)

The stat-pixel ("cube") rendering itself is the route — not just background/lighting. Route B cube:

- **Vertical gradient fill** per cube: lighter top → darker bottom (volume), tuned by the point-light factor of that cube's grid position. Slight desaturation vs the raw semantic hue (it's a *lit* object, not a flat icon).
- **Rim light** on silhouette-boundary top/left edges (light-facing); **soft contact shadow** on free bottom/right edges. No hard black outline (that's Route A).
- **Per-type glyph** in the cube's dark `tint`, centred (legibility layer; LOD-drops to a dot when the cell is tiny).
- **Drop shadow** ellipse on the floor per creature; **depth-scale** ≈0.85→1.0 by Z.

**Quality bar = `poc/builder.html`.** Reuse its proven technique (see [[prototype-quality-bar-builder]]):
DPR-scaled **crisp square cells**, top-bevel highlight + per-type glyph, **squash via cell-spacing**
(`sq=1-squash*0.18`, `st=1+squash*0.14`) and per-row sway + `behaviorMod` per-type micro-motion —
**never fractionally scale a bitmap/container** (that produced the "stretched/blurry" reject).
The visual target for B is the route-B panel of `poc/art-routes.html`.

## 3. Identity without faces

Since there is no eye/face, creature identity must be carried by:
1. **Silhouette** — readable shape at combat distance; the build's outline is the character.
2. **Spring physics** — the soft-body jiggle/squash is the *primary* charm delivery (Wobbledogs principle); heavier cube types wobble slower, lighter ones faster.
3. **Per-type glyphs + semantic colour** — the cube symbols + hue say what the creature *is/does*.
4. **Causal flare** — a cube flares when its ability fires, drawing the eye to cause→effect.

## 4. Non-negotiable visual rules (adapted for this project)

1. **Silhouette-first, always** — creature reads through peak VFX. VFX below the creature layer; only telegraphs + damage numbers above. (Soulstone-Survivors anti-pattern.)
2. **Semantic colour is sacred** — red=attack, blue=armor, green=hp, etc., never decoration. Arena + UI use a *separate* palette so stat hues pop as figure-against-ground.
3. **Physics carries charm** — spring jiggle is the main animation system; rendering amplifies it.
4. **Drop shadow grounds every creature** — soft floor ellipse; depth-scale by Z; Y-sort.
5. **Palette discipline across all content** — only approved Endesga-32-scale colours; no one-offs.
6. **VFX layer order** (bottom→top): arena bg · arena floor · drop shadows · creature cubes · causal flares · particle debris · screen FX (shake/flash) · damage numbers / telegraphs.
7. **Dead-Cells ceiling, with diminishing returns** — don't stack every effect on every hit; harder hits get more (hitstop on crit, shake scaled to damage).
8. **Test at combat scale** — validate with 6+ creatures on screen (the comparator's "6 істот" mode), not just one.

*(Dropped from the research list: "every creature has a face" — superseded by §1 No-faces.)*

## 5. Arena (simple-first)

One functional diorama arena for Slice 2:
- Vertical gradient sky→floor (cool, low-saturation — the quiet zone).
- One **warm point-light pool** in the arena (warmth here, not on creatures).
- **Floor plane** + drop-shadow receiver; **2-layer parallax** (far bg / near floor decor).
- Optional subtle vignette. No Blender pipeline yet.

Deferred: Blender-rendered normal-mapped diorama arenas; depth-of-field on far parallax; multiple
arena skins. Revisit once renderer feel is locked.

## 6. Hand-off to Slice 2

The renderer spec's `Theme` object encodes this as the **Route-B preset** (palette resolver →
Endesga-32 ramps, lighting = neutral-cool point light, cube = gradient+rim, shadow = soft,
VFX ceiling = Dead Cells, faces = off). A clean-flat theme (Route A) remains only as a *scaffolding
step* in the walking-skeleton build order — **B is the locked target look**, not A.
See `docs/2026-06-05-pockethero-slice2-renderer.md`.
