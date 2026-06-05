// src/render/types.ts
import type { Ramp } from './palette';

/** A presentation-only fighter snapshot the renderer interpolates between sim steps. */
export interface RenderFighter {
  id: string;
  hp: number;
  maxHP: number;
  alive: boolean;
  atb: number;
}

/** VFX intents produced from CombatEvents; the renderer plays them. */
export type VfxIntent =
  | { kind: 'flash'; target: string; color: number; frames: number }
  | { kind: 'shake'; amp: number; ms: number }
  | { kind: 'hitstop'; frames: number }
  | { kind: 'debris'; target: string; count: number; color: number }
  | { kind: 'floating'; target: string; text: string; color: number; crit: boolean }
  | { kind: 'heal'; target: string; amount: number }
  | { kind: 'ping'; target: string; label: 'block' | 'dodge' }
  | { kind: 'ko'; target: string };

export interface Theme {
  id: string;
  /** cube render mode */
  cube: 'flat' | 'diorama';
  /** silhouette outline */
  outline: 'hardBlack' | 'rim' | 'none';
  /** point-light direction (normalised-ish), neutral-cool tint applied in creature.ts */
  light: { x: number; y: number };
  /** VFX intensity ceiling */
  vfxCeiling: 'celeste' | 'deadcells' | 'vsurvivors';
  shadowAlpha: number;
  /** background draw key handled in arena.ts */
  arena: 'diorama' | 'flat';
  faces: boolean;
  ramp: (type: string) => Ramp;
}
