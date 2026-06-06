/**
 * src/render/sprite-manifest.ts — declares the PixelLab sprite sets the
 * billboard uses. Frame PNGs live in app/public/sprites/ → served at /sprites/.
 * Drop new frames in that folder and add a SpriteDef here to wire them in.
 */
import type { SpriteDef } from './sprite';

const frames = (prefix: string, n: number): string[] =>
  Array.from({ length: n }, (_, i) => `/sprites/${prefix}_${i}.png`);

export const HERO_SPRITE: SpriteDef = {
  pivotX: 0.5, pivotY: 0.95,
  anims: {
    idle:   { frames: frames('hero_idle', 5),   fps: 6,  loop: true },
    attack: { frames: frames('hero_attack', 7), fps: 16, loop: false },
    walk:   { frames: frames('hero_walk', 7),   fps: 10, loop: true },
  },
};

export const CRAB_SPRITE: SpriteDef = {
  pivotX: 0.5, pivotY: 0.95,
  anims: {
    idle:   { frames: frames('crab_idle', 5),   fps: 6,  loop: true },
    attack: { frames: frames('crab_attack', 7), fps: 16, loop: false },
  },
};

export const SAILOR_SPRITE: SpriteDef = {
  pivotX: 0.5, pivotY: 0.95,
  anims: {
    idle:   { frames: frames('sailor_idle', 5),   fps: 6,  loop: true },
    attack: { frames: frames('sailor_attack', 7), fps: 16, loop: false },
  },
};

export const BOSS_CAPTAIN_SPRITE: SpriteDef = {
  pivotX: 0.5, pivotY: 0.95,
  anims: {
    idle:   { frames: frames('boss_idle', 5),   fps: 6,  loop: true },
    attack: { frames: frames('boss_attack', 7), fps: 16, loop: false },
  },
};

/** The hero's billboard sprite. */
export function heroSprite(): SpriteDef { return HERO_SPRITE; }

/**
 * Enemy sprite by archetype + boss flag (beach roster).
 * Roster so far: drowned sailor (melee/mage), beach crab (ranged/tank),
 * drowned captain (boss). Extend as more art lands.
 */
export function enemySprite(archetype?: string, boss?: boolean): SpriteDef {
  if (boss) return BOSS_CAPTAIN_SPRITE;
  switch (archetype) {
    case 'melee':
    case 'mage':  return SAILOR_SPRITE;
    case 'ranged':
    case 'tank':
    default:      return CRAB_SPRITE;
  }
}
