import type { Cube } from './types';

export const CUBES: Record<string, Cube> = {
  // ---- Особливі ----
  core:      { id: 'core',      name: 'Ядро',        cat: 'special', rarity: 'legendary', cost: 0, glyph: 'star',    eff: "Серце героя — рівно одне, обовʼязкове",   col: '#F2C84B', tint: '#3a2c00' },
  // ---- Тіло (green) ----
  vital:     { id: 'vital',     name: 'Тіло',        cat: 'body',    rarity: 'common',    cost: 1, glyph: 'heart',   eff: '+HP (здоровʼя)',                            col: '#2FB873', tint: '#0a3a22' },
  regen:     { id: 'regen',     name: 'Реген',       cat: 'body',    rarity: 'rare',      cost: 2, glyph: 'pulse',   eff: '+регенерація HP/с',                         col: '#46d68c', tint: '#0a3a22' },
  lifesteal: { id: 'lifesteal', name: 'Вампіризм',   cat: 'body',    rarity: 'epic',      cost: 3, glyph: 'fang',    eff: 'лікує % завданої шкоди',                   col: '#a03050', tint: '#3a0a18' },
  // ---- Атака (red) ----
  force:     { id: 'force',     name: 'Сила',        cat: 'attack',  rarity: 'common',    cost: 1, glyph: 'blade',   eff: '+атака',                                   col: '#E0483F', tint: '#3a0d0a' },
  focus:     { id: 'focus',     name: 'Фокус',       cat: 'attack',  rarity: 'common',    cost: 1, glyph: 'diamond', eff: '+крит / +точність',                         col: '#EAEFF5', tint: '#2a3340' },
  pierce:    { id: 'pierce',    name: 'Пробій',      cat: 'attack',  rarity: 'rare',      cost: 2, glyph: 'arrowdn', eff: 'ігнорує % броні',                          col: '#ff7a5a', tint: '#3a0d0a' },
  berserk:   { id: 'berserk',   name: 'Лють',        cat: 'attack',  rarity: 'epic',      cost: 3, glyph: 'rage',    eff: '+атака зі зниженням HP',                   col: '#c2261e', tint: '#3a0606' },
  // ---- Захист (steel) ----
  plate:     { id: 'plate',     name: 'Броня',       cat: 'defense', rarity: 'common',    cost: 1, glyph: 'shield',  eff: '+броня',                                   col: '#7C8AA0', tint: '#1d2531' },
  block:     { id: 'block',     name: 'Блок',        cat: 'defense', rarity: 'rare',      cost: 2, glyph: 'brace',   eff: '+шанс блоку',                              col: '#9aa8bc', tint: '#1d2531' },
  thorns:    { id: 'thorns',    name: 'Шипи',        cat: 'defense', rarity: 'rare',      cost: 2, glyph: 'thorns',  eff: 'відбиває частину шкоди',                   col: '#6b7686', tint: '#15202a' },
  ward:      { id: 'ward',      name: 'Оберіг',      cat: 'defense', rarity: 'epic',      cost: 3, glyph: 'rune',    eff: 'магічний опір',                            col: '#8fa6d6', tint: '#15203a' },
  // ---- Спритність (amber) ----
  swift:     { id: 'swift',     name: 'Спритність',  cat: 'agility', rarity: 'common',    cost: 1, glyph: 'chevron', eff: '+швидкість / +ухил',                       col: '#F0C020', tint: '#3a2e00' },
  haste:     { id: 'haste',     name: 'Ривок',       cat: 'agility', rarity: 'rare',      cost: 2, glyph: 'dblchev', eff: '+наповнення ATB',                          col: '#ffd84a', tint: '#3a2e00' },
  evasion:   { id: 'evasion',   name: 'Ухил',        cat: 'agility', rarity: 'epic',      cost: 3, glyph: 'wisp',    eff: '+ухил',                                    col: '#e0b020', tint: '#3a2e00' },
  // ---- Магія (vivid) ----
  mana:      { id: 'mana',      name: 'Мана',        cat: 'magic',   rarity: 'common',    cost: 1, glyph: 'droplet', eff: 'паливо для магії',                         col: '#2D6FD0', tint: '#06203a' },
  catalyst:  { id: 'catalyst',  name: 'Каталізатор', cat: 'magic',   rarity: 'rare',      cost: 2, glyph: 'ring',    eff: 'підсилює суміжну магію',                   col: '#D14FA6', tint: '#3a0d2a' },
  ember:     { id: 'ember',     name: 'Жар',         cat: 'magic',   rarity: 'common',    cost: 1, glyph: 'flame',   eff: 'вогонь + Підпал',                          col: '#F07A1E', tint: '#3a1500' },
  frost:     { id: 'frost',     name: 'Мороз',       cat: 'magic',   rarity: 'common',    cost: 1, glyph: 'snow',    eff: 'лід + Сповільнення',                       col: '#39C6E8', tint: '#06303a' },
  spark:     { id: 'spark',     name: 'Іскра',       cat: 'magic',   rarity: 'rare',      cost: 2, glyph: 'bolt',    eff: 'блискавка + Шок',                          col: '#9B6BD6', tint: '#2a123a' },
  poison:    { id: 'poison',    name: 'Отрута',      cat: 'magic',   rarity: 'rare',      cost: 2, glyph: 'vial',    eff: 'отрута (DoT)',                             col: '#7bd64a', tint: '#16330a' },
  arcane:    { id: 'arcane',    name: 'Аркана',      cat: 'magic',   rarity: 'legendary', cost: 4, glyph: 'sigil',   eff: 'велика чиста магія',                       col: '#c060ff', tint: '#2a0a3a' },
};

export const CUBE_IDS = Object.keys(CUBES);
