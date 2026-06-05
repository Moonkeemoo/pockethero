// src/render/theme.ts
import type { Theme } from './types';
import { rampFor } from './palette';

/** LOCKED target look (docs/2026-06-05-pockethero-art-direction.md). */
export const routeB: Theme = {
  id: 'B', cube: 'diorama', outline: 'rim', light: { x: -0.55, y: -0.75 },
  vfxCeiling: 'deadcells', shadowAlpha: 0.45, arena: 'diorama', faces: false, ramp: rampFor,
};

/** Clean-flat scaffolding theme — used only while building the walking skeleton. */
export const flat: Theme = {
  id: 'A', cube: 'flat', outline: 'hardBlack', light: { x: -0.55, y: -0.75 },
  vfxCeiling: 'deadcells', shadowAlpha: 0.4, arena: 'flat', faces: false, ramp: rampFor,
};

export const THEMES: Record<string, Theme> = { A: flat, B: routeB };
