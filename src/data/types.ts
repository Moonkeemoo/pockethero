export type Category = 'body' | 'attack' | 'defense' | 'agility' | 'magic' | 'special';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface Cube {
  id: string;          // e.g. 'red', 'arcana', 'core'
  name: string;        // UA display name
  cat: Category;
  rarity: Rarity;
  cost: number;        // budget cost (◆)
  glyph: string;       // glyph key for the legibility layer
  eff: string;         // UA one-line effect description
  col: string;         // base swatch colour
  tint: string;        // glyph tint
}

export interface Move {
  id: string;
  name: string;        // UA
  weight: number;      // pick weight
  school: string;      // schools.ts key
  power?: number;
  reach?: number;
  status?: string;     // status id this move can apply
}

export interface SynergyDef { key: string; name: string; }
export interface ShapeDef   { key: string; name: string; }
