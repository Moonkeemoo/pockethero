import type { Move, Build } from './types';

/**
 * Local helpers ported verbatim from poc/builder.html (lines 306, 283).
 *   function count(build, type){ let n=0; for(const p of build) if(p.type===type) n++; return n; }
 *   function manaFuel(c){ return count(c,'mana'); }
 */
function count(build: Build, type: string): number {
  let n = 0;
  for (const p of build) if (p.type === type) n++;
  return n;
}
function manaFuel(build: Build): number {
  return count(build, 'mana');
}

/**
 * Move registry ported verbatim from poc/builder.html MOVES.
 * POC field `type` (damage school: 'phys'|'magic') is renamed to `school`.
 * POC field `school` (spell element: 'fire'|'frost'|'spark'|'poison'|'arcane')
 *   is stored as `magicSchool` to avoid collision.
 * `req` predicates restored from the POC exactly.
 * `id` == the registry key.
 */
export const MOVES: Record<string, Move> = {
  fist: {
    id: 'fist',
    kind: 'fist',
    icon: '👊',
    label: "б'є кулаком",
    windUp: 0.10,
    recover: 0.18,
    power: 9,
    school: 'phys',
    ranged: false,
    double: true,
    weight: 3.0,
    req: () => true,
  },
  sword: {
    id: 'sword',
    kind: 'sword',
    icon: '⚔️',
    label: "б'є мечем",
    windUp: 0.28,
    recover: 0.34,
    power: 20,
    school: 'phys',
    ranged: false,
    critBonus: 0.22,
    weight: 2.0,
    req: c => count(c, 'force') >= 3,
  },
  bow: {
    id: 'bow',
    kind: 'bow',
    icon: '🏹',
    label: 'стріляє з лука',
    windUp: 0.22,
    recover: 0.26,
    power: 15,
    school: 'phys',
    ranged: true,
    weight: 1.6,
    req: c => count(c, 'swift') >= 2,
  },
  fire: {
    id: 'fire',
    kind: 'fire',
    icon: '🔥',
    label: 'кастує Вогняну кулю',
    windUp: 0.40,
    recover: 0.36,
    power: 18,
    school: 'magic',
    ranged: true,
    magicSchool: 'fire',
    status: 'burn',
    weight: 1.3,
    req: c => count(c, 'ember') >= 1 && manaFuel(c) >= 1,
  },
  frost: {
    id: 'frost',
    kind: 'frost',
    icon: '❄️',
    label: 'кастує Крижану стрілу',
    windUp: 0.40,
    recover: 0.36,
    power: 14,
    school: 'magic',
    ranged: true,
    magicSchool: 'frost',
    status: 'slow',
    weight: 1.3,
    req: c => count(c, 'frost') >= 1 && manaFuel(c) >= 1,
  },
  spark: {
    id: 'spark',
    kind: 'spark',
    icon: '⚡',
    label: "б'є Розрядом",
    windUp: 0.34,
    recover: 0.34,
    power: 16,
    school: 'magic',
    ranged: true,
    magicSchool: 'spark',
    status: 'shock',
    weight: 1.2,
    req: c => count(c, 'spark') >= 1 && manaFuel(c) >= 1,
  },
  venom: {
    id: 'venom',
    kind: 'venom',
    icon: '☣️',
    label: 'кидає Отруту',
    windUp: 0.32,
    recover: 0.32,
    power: 11,
    school: 'magic',
    ranged: true,
    magicSchool: 'poison',
    status: 'poison',
    weight: 1.1,
    req: c => count(c, 'poison') >= 1 && manaFuel(c) >= 1,
  },
  arc: {
    id: 'arc',
    kind: 'arc',
    icon: '✦',
    label: 'вивільняє Аркану',
    windUp: 0.46,
    recover: 0.40,
    power: 30,
    school: 'magic',
    ranged: true,
    magicSchool: 'arcane',
    weight: 1.0,
    req: c => count(c, 'arcane') >= 1 && manaFuel(c) >= 1,
  },
};

export const MOVE_IDS = Object.keys(MOVES) as Array<keyof typeof MOVES>;
