import type { Build, Trait } from './types';
import { SYNERGY_DEFS, SHAPE_DEFS } from '../data/traits';

/**
 * Detect adjacency synergies in a build.
 * Ported from poc/builder.html lines 336-365.
 * Iterates right- and down-neighbours only (each pair counted once).
 */
export function detectSynergies(build: Build): Trait[] {
  // Build cell → index map (same key format as POC: "gx,gy")
  const byCell = new Map<string, number>();
  build.forEach((p, i) => byCell.set(p.gx + ',' + p.gy, i));

  // Accumulator per synergy def
  const acc: Record<string, { pairs: number; bonds: [number, number][]; idx: Set<number> }> = {};
  for (const d of SYNERGY_DEFS) {
    acc[d.key] = { pairs: 0, bonds: [], idx: new Set() };
  }

  for (let i = 0; i < build.length; i++) {
    const p = build[i]!;
    // Only check right and down neighbours — avoids double-counting
    const neigh: [number, number][] = [[p.gx + 1, p.gy], [p.gx, p.gy + 1]];
    for (const [nx, ny] of neigh) {
      const j = byCell.get(nx + ',' + ny);
      if (j === undefined) continue;
      const q = build[j]!;
      for (const d of SYNERGY_DEFS) {
        if (d.match(p.type, q.type)) {
          const a = acc[d.key]!;
          a.pairs++;
          a.bonds.push([i, j]);
          a.idx.add(i);
          a.idx.add(j);
        }
      }
    }
  }

  const traits: Trait[] = [];
  for (const d of SYNERGY_DEFS) {
    const a = acc[d.key]!;
    if (a.pairs > 0) {
      traits.push({
        key: d.key,
        name: d.name,
        icon: d.icon,
        kind: 'adjacency',
        magnitude: a.pairs,
        pixelIndices: [...a.idx],
        bonds: a.bonds,
        effect: d.effect,
      });
    }
  }
  return traits;
}

/**
 * Detect shape patterns in a build.
 * Ported from poc/builder.html lines 453-466.
 */
export function detectShapes(build: Build): Trait[] {
  // Build cell → index map
  const byCell = new Map<string, number>();
  build.forEach((p, i) => byCell.set(p.gx + ',' + p.gy, i));

  const traits: Trait[] = [];
  for (const d of SHAPE_DEFS) {
    const r = d.detect(build, byCell);
    if (r.count > 0) {
      const idx = new Set<number>();
      for (const s of r.sets) for (const i of s) idx.add(i);
      traits.push({
        key: d.key,
        name: d.name,
        icon: d.icon,
        kind: 'shape',
        magnitude: r.count,
        pixelIndices: [...idx],
        sets: r.sets,
        effect: d.effect,
      });
    }
  }
  return traits;
}

/**
 * Detect all traits (synergies then shapes).
 * Ported from poc/builder.html lines 468-470.
 */
export function detectTraits(build: Build): Trait[] {
  return detectSynergies(build).concat(detectShapes(build));
}
