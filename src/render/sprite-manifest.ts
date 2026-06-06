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
  },
};

export const CRAB_SPRITE: SpriteDef = {
  pivotX: 0.5, pivotY: 0.95,
  anims: {
    idle:   { frames: frames('crab_idle', 5),   fps: 6,  loop: true },
    attack: { frames: frames('crab_attack', 7), fps: 16, loop: false },
  },
};

/** The hero's billboard sprite. */
export function heroSprite(): SpriteDef { return HERO_SPRITE; }

/**
 * Enemy sprite by archetype. Only the beach crab exists so far, so every enemy
 * uses it for now; add archetype/boss sprites here as they're generated.
 */
export function enemySprite(_archetype?: string, _boss?: boolean): SpriteDef {
  return CRAB_SPRITE;
}
