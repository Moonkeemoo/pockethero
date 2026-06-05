# PocketHero — Slice 2: 2.5D Billboard Combat Renderer — Design Spec

**Date:** 2026-06-05
**Status:** IMPLEMENTED on branch `slice-2-renderer` (`src/render/`). Engine-driven Route-B billboard
combat renders and runs to K.O. with HP bars, UA log, depth, soft-body jiggle, and event→VFX juice
(flash/shake/hitstop/debris/floating numbers/causal flare). 82 tests green; build clean. Director owns
vision; agent owns dev. Builds on Slice 1 (engine).
**Art route:** **B — HD-2D Diorama — LOCKED** by director (see `docs/2026-06-05-pockethero-art-direction.md` for the full art bible + the answered open questions). The renderer stays **theme-parameterized** (a swappable `Theme` holds palette/outline/lighting/shadow/VFX-ceiling), but **B is the target look** — a clean-flat theme is only a scaffolding step in the walking-skeleton build order, not the destination. Locked specifics: VFX ceiling = **Dead Cells**; palette = **Endesga-32 scale**; lighting = **single neutral-cool point light, upper-left**; cube = **gradient-fill + rim-light** (no hard outline); **no faces/eyes** (identity via silhouette + spring physics + per-type glyphs); arenas **simple-first** (Blender deferred). Visual + cube-quality reference: `poc/art-routes.html` route-B panel, built to the `poc/builder.html` bar.

---

## 1. Goal & DoD

Render the Slice-1 deterministic engine's fights in the browser, in 2.5D billboard pixel-art, driven entirely by the engine's `CombatEvent` stream.

**Done when (`npm run dev`):**
1. Two preset builds render as **billboard pixel-creatures** standing on a **depth arena** and auto-fight to K.O., visibly driven by the engine (no rendering-side game logic).
2. **Depth** reads correctly: floor drop-shadows, depth-scale, knockback travels into Z, Y-sort layering.
3. **Soft-body**: pixels spring/jiggle and squash on hit (procedural, code-driven).
4. **Juice**: screenshake, hitstop, hit-flash, chunky debris — each triggered by the matching `CombatEvent`.
5. **Legibility** preserved from the POC: semantic palette (colour = stat type), per-type glyphs, causal flare when an ability fires; creature **silhouette stays readable** through any VFX (silhouette-first rule).
6. HP bars + a minimal UA combat readout. A **seed/restart** control to replay or run a new fight.
7. Determinism intact: the renderer never calls `Math.random` for sim outcomes; it only *reads* events. Same seed ⇒ same fight (engine guarantee), visuals are presentation-only.

**Out of scope:** the builder UI (Slice 3), meta/loot (Slice 4), PvP (Slice 5), audio. Arenas: one functional arena is enough.

## 2. Architecture

The engine is fixed-step (`DT = 1/60`) and pure. The renderer wraps it:

- **`render/` (new top dir, may import pixi.js)** — all PixiJS. NEVER imported by `sim/` (purity test still guards `sim/`).
- **Fixed-step driver + interpolation (P2):** a Pixi ticker accumulates real frame dt and advances the sim in whole `DT` steps (`stepFight`), keeping a **previous + current** snapshot of render-relevant fighter state so the draw interpolates by the leftover fraction `alpha`. Variable rAF dt never reaches the sim.
- **Event-driven VFX (P3):** after each `stepFight`, drain the bus; a pure **`mapEventToVfx(event)`** turns each `CombatEvent` into VFX intents (flash, shake, hitstop, debris, flare, floating number). The renderer plays them. This mapping is unit-testable without Pixi.
- **Theme (art route):** a `Theme` object holds palette resolver (stat-type → colour ramp), outline mode, lighting params, shadow style, VFX intensity ceiling. Route A/B/C/D are theme presets. Default = a clean flat theme; Route B theme layered next.

### Module layout (additions)
```
src/
  render/
    app.ts            # PixiJS Application bootstrap + main scene wiring
    loop.ts           # fixed-step driver: accumulate dt -> stepFight x N, expose alpha
    scene.ts          # arena + two creatures + camera, Y-sort container
    creature.ts       # billboard pixel-creature: build -> sprite of stat-pixels
    softbody.ts       # per-pixel spring sim (squash/jiggle), pure math + apply
    arena.ts          # depth ground, drop-shadows, parallax bg, vignette
    vfx.ts            # screenshake/hitstop/flash/debris/flare/floating-numbers
    events-to-vfx.ts  # pure mapEventToVfx(CombatEvent) -> VfxIntent[]
    palette.ts        # semantic stat-type -> colour ramp (ported from POC legibility)
    theme.ts          # Theme type + route presets (A clean-flat default, B diorama)
    hud.ts            # HP bars + UA combat readout + seed/restart control
  app/main.ts         # replace shell: mount render/app.ts
tests/
  events-to-vfx.test.ts   # pure mapping
  loop.test.ts            # fixed-step accumulator + alpha math
  softbody.test.ts        # spring converges/stable
  palette.test.ts         # every stat type resolves to a distinct colour
```

### Determinism & purity
- `sim/` unchanged and still Pixi/DOM-free (purity test stays green).
- The render driver uses wall-clock only to decide *how many* fixed steps to run; the sim itself never sees wall-clock. RNG stays seeded inside the engine.
- VFX may use `Math.random` for purely cosmetic scatter (debris angles) — **never** for anything the sim reads. Keep cosmetic randomness isolated in `vfx.ts`.

## 3. Visual rules (non-negotiable, from research)
- **Silhouette-first:** creature reads through peak VFX; telegraphs + damage numbers on the top layer; debris behind the creature.
- **Palette discipline:** semantic hue = stat type; value for shading; saturation for state. Distinct-but-harmonious across the 22 cube types.
- **Depth recipe:** drop-shadow oval + depth-scale (≈0.85→1.0) + Y-sort + knockback into Z.
- **Juice with restraint:** hitstop on hit, harder on crit; screenshake scaled to damage; flash + squash; chunky debris. Diminishing returns — don't stack everything every hit.

## 4. Approach: walking skeleton first
Build the smallest on-screen fight, then layer fidelity:
1. Pixi app + fixed-step loop stepping the engine; draw each fighter as a static block of its stat-pixels with a floor shadow; HP bars; runs to K.O.
2. Depth (scale/Y-sort/knockback) + camera.
3. Soft-body springs (jiggle/squash on hit).
4. Event→VFX juice (flash, shake, hitstop, debris, flare, floating numbers).
5. Legibility (glyphs, semantic palette, causal flare) + Theme B pass + HUD/readout polish.

Each step is browser-verifiable via `npm run dev` + headless-Chrome screenshot.

## 5. Risks
- **Interpolation vs determinism:** keep sim stepping integer `DT`; interpolate only presentation state. Guard with `loop.test.ts`.
- **VFX burying the creature:** enforce the silhouette-first layering + a theme VFX intensity ceiling.
- **Perf:** many pixels × springs × particles — use Pixi v8 `ParticleContainer`/batching; LOD springs if needed.
- **Art route churn:** mitigated by `Theme` parameterization — switching A↔B is config, not a rewrite.
