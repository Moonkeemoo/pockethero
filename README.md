# PocketHero

Web idle pixel-creature autobattler. Production rebuild (Slice 1 = engine + data).

- `npm install`
- `npm test` — engine unit tests (determinism + sim-purity included)
- `npm run sim` — headless fight, prints the combat log
- `npm run dev` — empty Pixi shell (Slice 2 adds the renderer)

`poc/` holds the validated vanilla-canvas prototypes (reference spec).
Design: `docs/2026-06-05-pockethero-production-foundation.md`.
