export type { Build, PlacedCube } from '../data/types';

/** A detected trait (synergy or shape) — matches the POC detectSynergies/detectShapes return shape exactly */
export interface Trait {
  key: string;
  name: string;
  icon: string;
  kind: 'adjacency' | 'shape';
  magnitude: number;
  pixelIndices: number[];
  effect: string;
  // adjacency-only fields (present when kind === 'adjacency')
  bonds?: [number, number][];
  // shape-only fields (present when kind === 'shape')
  sets?: number[][];
}
