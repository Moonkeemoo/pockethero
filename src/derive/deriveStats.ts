/**
 * deriveStats — ported faithfully from poc/builder.html lines 475-557.
 * Folds cube counts → base stats → new-cube effects → detected trait magnitudes.
 */
import type { Build } from './types';
import type { Trait } from './types';
import { detectTraits } from './detectors';

// ---------------------------------------------------------------------------
// STAT base coefficients  (poc lines 231-252)
// ---------------------------------------------------------------------------
const STAT = {
  hpBase:            60,
  hpPerVital:         9,
  armorPerPlate:      2.4,
  atkBase:            6,
  atkPerForce:        3.0,
  spdBase:            0.82,
  spdPerSwift:        0.05,
  dodgePerSwift:      0.035,
  dodgeCap:           0.34,
  critPerFocus:       0.05,
  critCap:            0.45,
  accPerFocus:        0.03,
  magPerElement:      5.0,
  magPerCatalyst:     4.0,
  magCatalystMul:     0.18,
  regenPerRegen:      1.4,
  lifestealPer:       0.06,
  pierceArmorPer:     0.14,
  berserkAtkPer:      2.2,
  blockPerBlock:      0.06,
  thornsPer:          0.10,
  wardPer:            0.10,
  hastePerHaste:      0.10,
  evasionPer:         0.03,
  magPerArcane:       11.0,
  magPerEmberFrost:   5.0,
};

// ---------------------------------------------------------------------------
// TRAIT_K constants  (poc lines 129-139)
// ---------------------------------------------------------------------------
const TRAIT_K = {
  blade_critPerPair:    0.04,
  outpost_hpPerPair:    7,
  kindle_magPerPair:    4.0,
  flow_dodgePerPair:    0.025,
  amplify_magPerPair:   3.5,
  spike_atkPerLine:     4.0,
  bastion_blockPerSet:  0.12,
  heart_regenPerSet:    1.6,
  balance_accPerSym:    0.06,
};

const BASTION_BLOCK_CAP = 0.6;   // poc line 140
const FLOW_DODGE_CAP    = 0.30;  // poc line 141

// Element cube types (poc line 314)
const ELEMENTS = ['ember', 'frost', 'spark', 'poison', 'arcane'];

// ---------------------------------------------------------------------------
// Stats interface — matches the POC return object field-for-field
// ---------------------------------------------------------------------------
export interface Stats {
  maxHP:        number;
  armor:        number;
  atk:          number;
  speed:        number;
  dodge:        number;
  crit:         number;
  acc:          number;
  magic:        number;
  blockChance:  number;
  regenPerSec:  number;
  lifesteal:    number;
  pierce:       number;
  berserk:      number;
  thorns:       number;
  magResist:    number;
  haste:        number;
  traits:       Trait[];
  traitDelta:   Record<string, string>;
  cubeDelta:    Record<string, string>;
  counts: {
    vital:     number;
    plate:     number;
    force:     number;
    swift:     number;
    focus:     number;
    catalyst:  number;
    elements:  number;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function count(build: Build, type: string): number {
  let n = 0;
  for (const p of build) if (p.type === type) n++;
  return n;
}

/** adjacentAny — diagonal + orthogonal (poc line 473) */
function adjacentAny(
  a: { gx: number; gy: number },
  b: { gx: number; gy: number },
): boolean {
  return (
    Math.abs(a.gx - b.gx) <= 1 &&
    Math.abs(a.gy - b.gy) <= 1 &&
    !(a.gx === b.gx && a.gy === b.gy)
  );
}

// ---------------------------------------------------------------------------
// deriveStats  (poc lines 475-557)
// ---------------------------------------------------------------------------
export function deriveStats(build: Build): Stats {
  const c = (t: string) => count(build, t);
  const vital    = c('vital');
  const plate    = c('plate');
  const force    = c('force');
  const swift    = c('swift');
  const focus    = c('focus');
  const catalyst = c('catalyst');
  const elements =
    c('ember') + c('frost') + c('spark') + c('poison') + c('arcane');

  // base magic (incl. catalyst adjacency boost)
  let mag = elements * STAT.magPerElement + catalyst * STAT.magPerCatalyst;
  mag += c('arcane') * STAT.magPerArcane; // arcane is big raw magic

  if (catalyst > 0 && elements > 0) {
    let adjEl = 0;
    for (const p of build) {
      if (!ELEMENTS.includes(p.type)) continue;
      for (const q of build) {
        if (q.type === 'catalyst' && adjacentAny(p, q)) {
          adjEl++;
          break;
        }
      }
    }
    mag *= 1 + STAT.magCatalystMul * catalyst;
    mag += adjEl * 3.0;
  }

  let maxHP = STAT.hpBase + vital * STAT.hpPerVital;
  let armor = plate * STAT.armorPerPlate;
  let atk   = STAT.atkBase + force * STAT.atkPerForce;
  let speed = STAT.spdBase + swift * STAT.spdPerSwift;
  let dodge = Math.min(STAT.dodgeCap, swift * STAT.dodgePerSwift);
  let crit  = Math.min(STAT.critCap, focus * STAT.critPerFocus);
  let acc   = focus * STAT.accPerFocus;

  // ---- NEW CUBE EFFECTS (per-cube, additive) (poc lines 502-522) ----------
  const cubeDelta: Record<string, string> = {};
  let regenPerSec = 0;
  let lifesteal   = 0;
  let pierce      = 0;
  let berserk     = 0;
  let blockChance = 0;
  let thorns      = 0;
  let magResist   = 0;
  let haste       = 0;

  const nRegen   = c('regen');
  const nLife    = c('lifesteal');
  const nPierce  = c('pierce');
  const nBerserk = c('berserk');
  const nBlock   = c('block');
  const nThorns  = c('thorns');
  const nWard    = c('ward');
  const nHaste   = c('haste');
  const nEvade   = c('evasion');

  if (nRegen)   { const d = nRegen  * STAT.regenPerRegen;                regenPerSec += d; cubeDelta['regen']    = '+' + d.toFixed(1) + ' рег/с'; }
  if (nLife)    { const d = nLife   * STAT.lifestealPer;                 lifesteal   += d; cubeDelta['lifesteal']= '+' + (d * 100).toFixed(0) + '% вамп.'; }
  if (nPierce)  { const d = Math.min(0.85, nPierce * STAT.pierceArmorPer); pierce    += d; cubeDelta['pierce']   = '-' + (d * 100).toFixed(0) + '% броні ціль'; }
  if (nBerserk) { const d = nBerserk * STAT.berserkAtkPer;               berserk     += d; cubeDelta['berserk']  = '+' + d.toFixed(1) + ' атака (низьке HP)'; }
  if (nBlock)   { const d = nBlock   * STAT.blockPerBlock;               blockChance += d; cubeDelta['block']    = '+' + (d * 100).toFixed(0) + '% блок'; }
  if (nThorns)  { const d = nThorns  * STAT.thornsPer;                   thorns      += d; cubeDelta['thorns']   = '+' + (d * 100).toFixed(0) + '% відбиття'; }
  if (nWard)    { const d = Math.min(0.7, nWard * STAT.wardPer);          magResist   += d; cubeDelta['ward']     = '+' + (d * 100).toFixed(0) + '% маг.опір'; }
  if (nHaste)   { const d = nHaste   * STAT.hastePerHaste;               haste       += d; cubeDelta['haste']    = '+' + (d * 100).toFixed(0) + '% ATB'; }
  if (nEvade)   { const d = nEvade   * STAT.evasionPer;                  dodge       += d; cubeDelta['evasion']  = '+' + (d * 100).toFixed(0) + '% ухил'; }

  // ---- FOLD TRAITS (poc lines 524-542) ------------------------------------
  const traits = detectTraits(build);
  const traitDelta: Record<string, string> = {};
  let extraDodge = 0;

  for (const tr of traits) {
    const m = tr.magnitude;
    switch (tr.key) {
      case 'blade': {
        const d = m * TRAIT_K.blade_critPerPair;
        crit = Math.min(STAT.critCap + 0.3, crit + d);
        traitDelta[tr.key] = '+' + (d * 100).toFixed(0) + '% крит';
        break;
      }
      case 'outpost': {
        const d = m * TRAIT_K.outpost_hpPerPair;
        maxHP += d;
        traitDelta[tr.key] = '+' + d + ' HP';
        break;
      }
      case 'kindle': {
        const d = m * TRAIT_K.kindle_magPerPair;
        mag += d;
        traitDelta[tr.key] = '+' + d.toFixed(0) + ' маг.';
        break;
      }
      case 'flow': {
        const d = Math.min(FLOW_DODGE_CAP, m * TRAIT_K.flow_dodgePerPair);
        extraDodge += d;
        traitDelta[tr.key] = '+' + (d * 100).toFixed(0) + '% ухил';
        break;
      }
      case 'amplify': {
        const d = m * TRAIT_K.amplify_magPerPair;
        mag += d;
        traitDelta[tr.key] = '+' + d.toFixed(0) + ' маг.';
        break;
      }
      case 'venomweave': {
        const d = m * 2.0;
        mag += d;
        traitDelta[tr.key] = '+' + d.toFixed(0) + ' маг.(DoT)';
        break;
      }
      case 'spike': {
        const d = m * TRAIT_K.spike_atkPerLine;
        atk += d;
        traitDelta[tr.key] = '+' + d.toFixed(0) + ' атака';
        break;
      }
      case 'bastion': {
        const d = Math.min(BASTION_BLOCK_CAP, m * TRAIT_K.bastion_blockPerSet);
        blockChance = Math.max(blockChance, blockChance + d);
        traitDelta[tr.key] = '+' + (d * 100).toFixed(0) + '% блок';
        break;
      }
      case 'heart': {
        const d = m * TRAIT_K.heart_regenPerSet;
        regenPerSec += d;
        traitDelta[tr.key] = '+' + d.toFixed(1) + ' рег/с';
        break;
      }
      case 'balance': {
        const d = TRAIT_K.balance_accPerSym;
        acc += d;
        traitDelta[tr.key] = '+' + (d * 100).toFixed(0) + '% точн.';
        break;
      }
    }
  }

  dodge = Math.min(STAT.dodgeCap + FLOW_DODGE_CAP + 0.3, dodge + extraDodge);
  blockChance = Math.min(BASTION_BLOCK_CAP, blockChance);

  return {
    maxHP:       Math.round(maxHP),
    armor:       +armor.toFixed(1),
    atk,
    speed,
    dodge,
    crit,
    acc,
    magic:       +mag.toFixed(1),
    blockChance,
    regenPerSec,
    lifesteal,
    pierce,
    berserk,
    thorns,
    magResist,
    haste,
    traits,
    traitDelta,
    cubeDelta,
    counts: { vital, plate, force, swift, focus, catalyst, elements },
  };
}
