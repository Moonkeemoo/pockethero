// src/render/hud.ts
import { Container, Graphics, Text } from 'pixi.js';

export class Hud {
  readonly root = new Container();
  private bars: { bg: Graphics; fill: Graphics; name: Text }[] = [];
  private log = new Text({ text: '', style: { fontFamily: 'system-ui', fontSize: 13, fill: 0xcfd6e6, wordWrap: true, wordWrapWidth: 360 } });
  private lines: string[] = [];
  private lastW = 800;

  constructor(names: [string, string], private onRestart: () => void) {
    for (let i = 0; i < 2; i++) {
      const bg = new Graphics(), fill = new Graphics();
      const name = new Text({ text: names[i]!, style: { fontFamily: 'system-ui', fontSize: 13, fontWeight: '700', fill: 0xffffff } });
      this.root.addChild(bg, fill, name);
      this.bars.push({ bg, fill, name });
    }
    this.root.addChild(this.log);

    const btn = new Text({ text: '↻ restart', style: { fontFamily: 'system-ui', fontSize: 14, fill: 0x9fc0ff } });
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.on('pointertap', onRestart);
    btn.position.set(12, 12);
    this.root.addChild(btn);
  }

  setHP(i: number, hp: number, maxHP: number): void {
    const b = this.bars[i]!;
    const W = 220, H = 14;
    const x = i === 0 ? 24 : (this.lastW - W - 24);
    const y = 40;
    b.name.position.set(x, y - 18);
    b.bg.clear().roundRect(x, y, W, H, 4).fill({ color: 0x1a1d26 });
    const f = Math.max(0, Math.min(1, maxHP > 0 ? hp / maxHP : 0));
    b.fill.clear().roundRect(x, y, W * f, H, 4).fill({ color: f > 0.3 ? 0x46d68c : 0xe0483f });
  }

  pushLog(line: string): void {
    this.lines.push(line);
    if (this.lines.length > 8) this.lines.shift();
    this.log.text = this.lines.join('\n');
  }

  layout(w: number, h: number): void {
    this.lastW = w;
    this.log.position.set(24, h - 150);
  }
}
