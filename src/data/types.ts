export type Category = 'body' | 'attack' | 'defense' | 'agility' | 'magic' | 'special';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface PlacedCube { gx: number; gy: number; type: string }  // type = Cube id; 'core' is special
export type Build = PlacedCube[];

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
  kind: string;        // original POC `kind` field (same as id)
  icon: string;        // emoji icon
  label: string;       // UA display label
  windUp: number;      // animation wind-up duration (seconds)
  recover: number;     // animation recover duration (seconds)
  power: number;       // base damage power
  school: string;      // damage school ('phys' | 'magic'); renamed from POC `type`
  ranged: boolean;     // whether the move is ranged
  weight: number;      // pick weight for move selection
  // optional fields present on some moves
  double?: boolean;    // fist: attacks twice
  critBonus?: number;  // sword: extra crit chance
  status?: string;     // status effect applied on hit (burn/slow/shock/poison)
  magicSchool?: string;// spell school (fire/frost/spark/poison/arcane); from POC `school` on magic moves
  req?: (build: Build) => boolean;  // unlock predicate; absent = always available
}

/** Adjacency-based synergy between two orthogonally adjacent cube types */
export interface SynergyDef {
  key: string;
  name: string;
  kind: 'adjacency';
  icon: string;
  effect: string;      // UA description of the bonus
  /** Returns true when cube type `a` and cube type `b` form this synergy pair */
  match: (a: string, b: string) => boolean;
}

/** Shape pattern of same-type cubes in a spatial arrangement */
export interface ShapeDef {
  key: string;
  name: string;
  kind: 'shape';
  icon: string;
  effect: string;      // UA description of the bonus
  /** Detect matching shapes in a build; returns count of matches and the pixel index sets */
  detect: (
    build: Build,
    byCell: Map<string, number>
  ) => { count: number; sets: number[][] };
}
