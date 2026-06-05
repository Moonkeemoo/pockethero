// src/render/palette.ts
// Semantic colour: hue = stat type (from CUBES), value = shading ramp.
// Endesga-32-scale discipline: base hue + 3 derived values. Pure number maths.
import { CUBES } from '../index';

export interface Ramp { shadow: number; mid: number; base: number; highlight: number }

const hexToNum = (hex: string): number => parseInt(hex.slice(1), 16);
const mix = (a: number, b: number, t: number): number => {
  const ar = a >> 16 & 255, ag = a >> 8 & 255, ab = a & 255;
  const br = b >> 16 & 255, bg = b >> 8 & 255, bb = b & 255;
  const r = Math.round(ar + (br - ar) * t), g = Math.round(ag + (bg - ag) * t), bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
};
export const lighten = (n: number, t: number): number => mix(n, 0xffffff, t);
export const darken = (n: number, t: number): number => mix(n, 0x000000, t);

export function rampFor(type: string): Ramp {
  const cube = CUBES[type];
  const base = hexToNum(cube ? cube.col : '#888888');
  return { shadow: darken(base, 0.34), mid: darken(base, 0.14), base, highlight: lighten(base, 0.30) };
}

export const PALETTE = {
  base: (type: string): number => rampFor(type).base,
  tint: (type: string): number => hexToNum(CUBES[type]?.tint ?? '#101010'), // dark glyph colour
};
