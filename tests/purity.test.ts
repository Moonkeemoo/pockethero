import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
  });
}

describe('sim/ purity (no Pixi / no DOM)', () => {
  it('src/sim imports nothing from pixi.js or the DOM', () => {
    const offenders: string[] = [];
    for (const file of walk('src/sim')) {
      const src = readFileSync(file, 'utf8');
      if (/from\s+['"]pixi\.js['"]/.test(src)) offenders.push(`${file}: imports pixi.js`);
      if (/\b(document|window)\b/.test(src)) offenders.push(`${file}: references DOM global`);
    }
    expect(offenders).toEqual([]);
  });
});
