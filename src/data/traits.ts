import type { SynergyDef, ShapeDef, Build, PlacedCube } from './types';

/** Element cube types used in the amplify synergy check */
const ELEMENTS = ['ember', 'frost', 'spark', 'poison', 'arcane'] as const;

/**
 * Adjacency-synergy definitions ported verbatim from poc/builder.html SYNERGY_DEFS.
 * `match(a, b)` is called with cube type strings from orthogonally adjacent pixels.
 */
export const SYNERGY_DEFS: SynergyDef[] = [
  {
    key: 'blade',
    name: '«Лезо»',
    kind: 'adjacency',
    icon: 'blade',
    effect: '+крит за кожну пару Сила↔Сила',
    match: (a, b) => a === 'force' && b === 'force',
  },
  {
    key: 'outpost',
    name: '«Форпост»',
    kind: 'adjacency',
    icon: 'outpost',
    effect: '+HP за кожну пару Броня↔Тіло',
    match: (a, b) => (a === 'plate' && b === 'vital') || (a === 'vital' && b === 'plate'),
  },
  {
    key: 'kindle',
    name: '«Розпал»',
    kind: 'adjacency',
    icon: 'kindle',
    effect: '+маг.сила за кожну пару Жар↔Мана',
    match: (a, b) => (a === 'ember' && b === 'mana') || (a === 'mana' && b === 'ember'),
  },
  {
    key: 'flow',
    name: '«Потік»',
    kind: 'adjacency',
    icon: 'flow',
    effect: '+ухил за кожну пару Спритність↔Спритність',
    match: (a, b) => a === 'swift' && b === 'swift',
  },
  {
    key: 'amplify',
    name: '«Підсилення»',
    kind: 'adjacency',
    icon: 'amplify',
    effect: '+маг. за пару Каталізатор↔(стихія)',
    match: (a, b) =>
      (a === 'catalyst' && (ELEMENTS as readonly string[]).includes(b)) ||
      (b === 'catalyst' && (ELEMENTS as readonly string[]).includes(a)),
  },
  {
    key: 'venomweave',
    name: '«Сплетіння»',
    kind: 'adjacency',
    icon: 'venomweave',
    effect: '+DoT за пару Отрута↔Мана',
    match: (a, b) => (a === 'poison' && b === 'mana') || (a === 'mana' && b === 'poison'),
  },
];

function cellOf(
  byCell: Map<string, number>,
  build: Build,
  gx: number,
  gy: number
): { i: number; p: PlacedCube } | null {
  const i = byCell.get(gx + ',' + gy);
  return i === undefined ? null : { i, p: build[i]! };
}

/**
 * Shape-pattern definitions ported verbatim from poc/builder.html SHAPE_DEFS.
 * Each `detect` function mirrors the POC logic exactly.
 */
export const SHAPE_DEFS: ShapeDef[] = [
  {
    key: 'spike',
    name: '«Шип»',
    kind: 'shape',
    icon: 'spike',
    effect: '3+ Сила в лінію → +досяжність/атака',
    detect(build, byCell) {
      const sets: number[][] = [];
      const isForce = (gx: number, gy: number): number => {
        const c = cellOf(byCell, build, gx, gy);
        return c && c.p.type === 'force' ? c.i : -1;
      };
      for (let k = 0; k < build.length; k++) {
        const p = build[k]!;
        if (p.type !== 'force') continue;
        // horizontal run starting from leftmost
        if (isForce(p.gx - 1, p.gy) < 0) {
          const run: number[] = [];
          let gx = p.gx;
          let id: number;
          while ((id = isForce(gx, p.gy)) >= 0) { run.push(id); gx++; }
          if (run.length >= 3) sets.push(run.slice());
        }
        // vertical run starting from topmost
        if (isForce(p.gx, p.gy - 1) < 0) {
          const run: number[] = [];
          let gy = p.gy;
          let id: number;
          while ((id = isForce(p.gx, gy)) >= 0) { run.push(id); gy++; }
          if (run.length >= 3) sets.push(run.slice());
        }
      }
      return { count: sets.length, sets };
    },
  },
  {
    key: 'bastion',
    name: '«Бастіон»',
    kind: 'shape',
    icon: 'bastion',
    effect: '2×2 блок Броні → шанс блоку',
    detect(build, byCell) {
      const sets: number[][] = [];
      const isPlate = (gx: number, gy: number): number => {
        const c = cellOf(byCell, build, gx, gy);
        return c && c.p.type === 'plate' ? c.i : -1;
      };
      const seen = new Set<string>();
      for (let k = 0; k < build.length; k++) {
        const p = build[k]!;
        if (p.type !== 'plate') continue;
        const a = isPlate(p.gx, p.gy);
        const b = isPlate(p.gx + 1, p.gy);
        const c2 = isPlate(p.gx, p.gy + 1);
        const d = isPlate(p.gx + 1, p.gy + 1);
        if (a >= 0 && b >= 0 && c2 >= 0 && d >= 0) {
          const sig = p.gx + '_' + p.gy;
          if (!seen.has(sig)) {
            seen.add(sig);
            sets.push([a, b, c2, d]);
          }
        }
      }
      return { count: sets.length, sets };
    },
  },
  {
    key: 'heart',
    name: '«Серце»',
    kind: 'shape',
    icon: 'heart5',
    effect: '5 Тіло хрестом → +регенерація',
    detect(build, byCell) {
      const sets: number[][] = [];
      const isVital = (gx: number, gy: number): number => {
        const c = cellOf(byCell, build, gx, gy);
        return c && c.p.type === 'vital' ? c.i : -1;
      };
      for (let k = 0; k < build.length; k++) {
        const p = build[k]!;
        if (p.type !== 'vital') continue;
        const c0 = isVital(p.gx, p.gy);
        const up = isVital(p.gx, p.gy - 1);
        const dn = isVital(p.gx, p.gy + 1);
        const lf = isVital(p.gx - 1, p.gy);
        const rt = isVital(p.gx + 1, p.gy);
        if (c0 >= 0 && up >= 0 && dn >= 0 && lf >= 0 && rt >= 0) {
          sets.push([c0, up, dn, lf, rt]);
        }
      }
      return { count: sets.length, sets };
    },
  },
  {
    key: 'balance',
    name: '«Рівновага»',
    kind: 'shape',
    icon: 'balance',
    effect: 'дзеркальна симетрія L↔R → +точність',
    detect(build, byCell) {
      if (build.length < 3) return { count: 0, sets: [] };
      let minGx = Infinity;
      let maxGx = -Infinity;
      for (const p of build) {
        if (p.gx < minGx) minGx = p.gx;
        if (p.gx > maxGx) maxGx = p.gx;
      }
      const axis = minGx + maxGx;
      let offAxis = 0;
      let mirrored = true;
      for (const p of build) {
        const mx = axis - p.gx;
        if (mx !== p.gx) offAxis++;
        const c = cellOf(byCell, build, mx, p.gy);
        if (!c || c.p.type !== p.type) { mirrored = false; break; }
      }
      if (mirrored && offAxis >= 2) {
        return { count: 1, sets: [build.map((_, i) => i)] };
      }
      return { count: 0, sets: [] };
    },
  },
];
