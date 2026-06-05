import { describe, it, expect } from 'vitest';
import { detectSynergies, detectShapes, detectTraits } from '../src/derive/detectors';
import type { Build } from '../src/derive/types';

/** Mirror of the POC B() helper: rows of [gx, gy, type] → PlacedCube[] */
function B(rows: [number, number, string][]): Build {
  return rows.map(([gx, gy, type]) => ({ gx, gy, type }));
}

/** Extract magnitude for a given trait key (0 if absent) */
function traitMag(traits: { key: string; magnitude: number }[], key: string): number {
  const t = traits.find(x => x.key === key);
  return t ? t.magnitude : 0;
}

const core: Build = [{ gx: 0, gy: 0, type: 'core' }];

describe('detectors (ported from poc self-tests)', () => {

  it('bare core has no synergies or shapes', () => {
    expect(detectSynergies(core)).toEqual([]);
    expect(detectShapes(core)).toEqual([]);
  });

  // ---- SYNERGY TESTS ----

  it('blade: 3 force in a row -> 2 pairs', () => {
    const b = B([[0, 0, 'core'], [1, 0, 'force'], [2, 0, 'force'], [3, 0, 'force']]);
    expect(traitMag(detectSynergies(b), 'blade')).toBe(2);
  });

  it('outpost: 1 plate-vital pair', () => {
    const b = B([[0, 0, 'core'], [0, 1, 'vital'], [1, 1, 'plate']]);
    expect(traitMag(detectSynergies(b), 'outpost')).toBe(1);
  });

  it('outpost: diagonal does not bond', () => {
    const b2 = B([[0, 0, 'core'], [0, 1, 'vital'], [1, 2, 'plate'], [1, 1, 'force']]);
    expect(traitMag(detectSynergies(b2), 'outpost')).toBe(0);
  });

  it('kindle: ember-mana pair', () => {
    const b = B([[0, 0, 'core'], [1, 0, 'ember'], [2, 0, 'mana']]);
    expect(traitMag(detectSynergies(b), 'kindle')).toBe(1);
  });

  it('flow: L of 3 swift -> 2 pairs', () => {
    const b = B([[0, 0, 'core'], [0, 1, 'swift'], [1, 1, 'swift'], [1, 0, 'swift']]);
    expect(traitMag(detectSynergies(b), 'flow')).toBe(2);
  });

  it('amplify: catalyst+2 elements -> 2 pairs', () => {
    const b = B([[0, 0, 'core'], [1, 0, 'catalyst'], [2, 0, 'ember'], [1, 1, 'frost']]);
    expect(traitMag(detectSynergies(b), 'amplify')).toBe(2);
  });

  it('venomweave: poison-mana pair', () => {
    const b = B([[0, 0, 'core'], [1, 0, 'poison'], [2, 0, 'mana']]);
    expect(traitMag(detectSynergies(b), 'venomweave')).toBe(1);
  });

  // ---- SHAPE TESTS ----

  it('spike: vertical 3 force -> 1 line', () => {
    const b = B([[0, 0, 'core'], [0, -1, 'force'], [0, -2, 'force'], [0, -3, 'force']]);
    expect(traitMag(detectShapes(b), 'spike')).toBe(1);
  });

  it('spike: only 2 force -> none', () => {
    const b2 = B([[0, 0, 'core'], [1, 0, 'force'], [2, 0, 'force']]);
    expect(traitMag(detectShapes(b2), 'spike')).toBe(0);
  });

  it('bastion: 2x2 plate -> 1 block', () => {
    const b = B([[0, 0, 'core'], [0, 1, 'plate'], [1, 1, 'plate'], [0, 2, 'plate'], [1, 2, 'plate']]);
    expect(traitMag(detectShapes(b), 'bastion')).toBe(1);
  });

  it('heart: vital plus -> 1 cross', () => {
    const b = B([[0, 0, 'core'], [2, 0, 'vital'], [2, -1, 'vital'], [2, 1, 'vital'], [1, 0, 'vital'], [3, 0, 'vital']]);
    expect(traitMag(detectShapes(b), 'heart')).toBe(1);
  });

  it('balance: symmetric build -> active', () => {
    const b = B([[0, 0, 'core'], [-1, 0, 'force'], [1, 0, 'force'], [0, 1, 'vital']]);
    expect(traitMag(detectShapes(b), 'balance')).toBe(1);
  });

  it('balance: asymmetric -> inactive', () => {
    const b2 = B([[0, 0, 'core'], [1, 0, 'force'], [2, 0, 'vital'], [-1, 0, 'force']]);
    expect(traitMag(detectShapes(b2), 'balance')).toBe(0);
  });

  // ---- detectTraits union test ----

  it('detectTraits returns synergies then shapes (union)', () => {
    // blade synergy + spike shape in same build
    const b = B([[0, 0, 'core'], [0, -1, 'force'], [0, -2, 'force'], [0, -3, 'force'], [1, 0, 'force'], [2, 0, 'force'], [3, 0, 'force']]);
    const traits = detectTraits(b);
    const keys = traits.map(t => t.key);
    expect(keys).toContain('blade');
    expect(keys).toContain('spike');
    // synergies come before shapes (matching POC concat order)
    expect(keys.indexOf('blade')).toBeLessThan(keys.indexOf('spike'));
  });

  // ---- Trait shape checks ----

  it('detected synergy trait has required fields', () => {
    const b = B([[0, 0, 'core'], [1, 0, 'force'], [2, 0, 'force']]);
    const traits = detectSynergies(b);
    expect(traits.length).toBe(1);
    const t = traits[0]!;
    expect(t.key).toBe('blade');
    expect(typeof t.name).toBe('string');
    expect(typeof t.icon).toBe('string');
    expect(t.kind).toBe('adjacency');
    expect(typeof t.magnitude).toBe('number');
    expect(t.magnitude).toBeGreaterThan(0);
    expect(Array.isArray(t.pixelIndices)).toBe(true);
    expect(Array.isArray(t.bonds)).toBe(true);
    expect(typeof t.effect).toBe('string');
  });

  it('detected shape trait has required fields', () => {
    const b = B([[0, 0, 'core'], [0, -1, 'force'], [0, -2, 'force'], [0, -3, 'force']]);
    const traits = detectShapes(b);
    expect(traits.length).toBe(1);
    const t = traits[0]!;
    expect(t.key).toBe('spike');
    expect(typeof t.name).toBe('string');
    expect(typeof t.icon).toBe('string');
    expect(t.kind).toBe('shape');
    expect(typeof t.magnitude).toBe('number');
    expect(t.magnitude).toBeGreaterThan(0);
    expect(Array.isArray(t.pixelIndices)).toBe(true);
    expect(Array.isArray(t.sets)).toBe(true);
    expect(typeof t.effect).toBe('string');
  });
});
