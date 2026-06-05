import { describe, it, expect } from 'vitest';
import { PRESETS, PRESET_IDS } from '../src/builds/presets';
import { deriveStats } from '../src/derive/deriveStats';

describe('presets', () => {
  it('exposes the four playable builds, each a valid build with a core', () => {
    expect(PRESET_IDS).toEqual(expect.arrayContaining(['hero', 'brute', 'mage', 'titan']));
    for (const id of PRESET_IDS) {
      const b = PRESETS[id]!.build;
      expect(b.some((p) => p.type === 'core')).toBe(true);
      expect(deriveStats(b).maxHP).toBeGreaterThan(0);
    }
  });
  it('TITAN is the biggest build and beats the bare core on HP', () => {
    const core = [{ gx: 0, gy: 0, type: 'core' }];
    expect(deriveStats(PRESETS['titan']!.build).maxHP).toBeGreaterThan(deriveStats(core).maxHP);
    expect(PRESETS['titan']!.build.length).toBeGreaterThan(PRESETS['hero']!.build.length);
  });
});
