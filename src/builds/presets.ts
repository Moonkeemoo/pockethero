import type { Build } from '../derive/types';

/** Build-from-rows helper, ported faithfully from poc/builder.html line 571.
 *  Each row is a tuple [gx, gy, type]; core sits at [0, 0, 'core'].
 */
function B(rows: [number, number, string][]): Build {
  return rows.map(([gx, gy, type]) => ({ gx, gy, type }));
}

export const HERO_BUILD: Build = B([
  [0, 0, 'core'],
  [-1, 0, 'vital'], [0, 1, 'vital'], [-1, 1, 'vital'], [1, 1, 'vital'],
  [-1, 2, 'vital'], [0, 2, 'vital'], [1, 2, 'vital'],
  [-2, 1, 'plate'], [-2, 2, 'plate'],
  [1, 0, 'force'], [2, 0, 'force'], [3, 0, 'force'],
  [0, -1, 'focus'],
  [2, -1, 'ember'], [1, -1, 'mana'],
  [-1, 3, 'vital'], [1, 3, 'vital'],
]);

export const BRUTE_BUILD: Build = B([
  [0, 0, 'core'],
  [-1, 0, 'vital'], [1, 0, 'vital'],
  [-2, 1, 'vital'], [-1, 1, 'vital'], [0, 1, 'vital'], [1, 1, 'vital'], [2, 1, 'vital'],
  [-2, 2, 'vital'], [-1, 2, 'vital'], [0, 2, 'vital'], [1, 2, 'vital'], [2, 2, 'vital'],
  [-2, 3, 'vital'], [-1, 3, 'vital'], [0, 3, 'vital'], [1, 3, 'vital'], [2, 3, 'vital'],
  [-3, 1, 'plate'], [-3, 2, 'plate'], [-3, 3, 'plate'],
  [3, 1, 'plate'], [3, 2, 'plate'], [3, 3, 'plate'],
  [-1, -1, 'plate'], [0, -1, 'plate'], [1, -1, 'plate'],
  [2, 0, 'force'], [3, 0, 'force'], [4, 0, 'force'],
  [-1, 4, 'vital'], [1, 4, 'vital'],
]);

export const MAGE_BUILD: Build = B([
  [0, 0, 'core'],
  [0, 1, 'vital'], [-1, 1, 'vital'], [1, 1, 'vital'],
  [0, 2, 'vital'],
  [-1, 0, 'ember'], [1, 0, 'frost'],
  [-1, -1, 'ember'], [1, -1, 'frost'],
  [0, -1, 'catalyst'],
  [-2, 0, 'mana'], [2, 0, 'mana'],
  [-1, 2, 'vital'], [1, 2, 'vital'],
]);

export const TITAN_BUILD: Build = B([
  [0, 0, 'core'],
  [-1, 0, 'vital'], [1, 0, 'vital'], [-2, 0, 'vital'], [2, 0, 'vital'],
  [-2, 1, 'vital'], [-1, 1, 'vital'], [0, 1, 'vital'], [1, 1, 'vital'], [2, 1, 'vital'],
  [-2, 2, 'vital'], [-1, 2, 'vital'], [0, 2, 'vital'], [1, 2, 'vital'], [2, 2, 'vital'],
  [-2, 3, 'vital'], [-1, 3, 'vital'], [0, 3, 'vital'], [1, 3, 'vital'], [2, 3, 'vital'],
  [-1, 4, 'vital'], [0, 4, 'vital'], [1, 4, 'vital'],
  [-3, 0, 'plate'], [-4, 0, 'plate'], [-3, 1, 'plate'], [-4, 1, 'plate'],
  [3, 0, 'plate'], [4, 0, 'plate'], [3, 1, 'plate'], [4, 1, 'plate'],
  [-3, 2, 'plate'], [-3, 3, 'plate'], [3, 2, 'plate'], [3, 3, 'plate'],
  [-1, -1, 'plate'], [0, -1, 'plate'], [1, -1, 'plate'],
  [5, 0, 'force'], [6, 0, 'force'], [7, 0, 'force'],
  [-5, 0, 'force'], [-6, 0, 'force'], [-7, 0, 'force'],
  [5, 1, 'force'], [-5, 1, 'force'],
  [2, -1, 'swift'], [3, -1, 'swift'], [4, -1, 'swift'],
  [-2, -1, 'swift'], [-3, -1, 'swift'], [-4, -1, 'swift'],
  [0, -2, 'focus'], [-1, -2, 'focus'], [1, -2, 'focus'], [0, -3, 'focus'],
  [-2, -2, 'ember'], [-2, -3, 'mana'], [-3, -2, 'mana'],
  [2, -2, 'frost'], [2, -3, 'mana'], [3, -2, 'mana'],
  [0, -4, 'spark'],
  [-1, -3, 'catalyst'], [1, -3, 'catalyst'], [-3, -3, 'catalyst'], [3, -3, 'catalyst'],
  [-2, 4, 'vital'], [2, 4, 'vital'], [-1, 5, 'vital'], [0, 5, 'vital'], [1, 5, 'vital'],
]);

export const PRESETS: Record<string, { name: string; build: Build }> = {
  hero:  { name: '«Піксель» (Герой)', build: HERO_BUILD },
  mage:  { name: '«Чаклун» (Маг)',    build: MAGE_BUILD },
  brute: { name: '«Громило»',         build: BRUTE_BUILD },
  titan: { name: '«Титан» (великий)', build: TITAN_BUILD },
};

export const PRESET_IDS = Object.keys(PRESETS);
