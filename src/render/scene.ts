// src/render/scene.ts
// Walking-skeleton integration: two preset creatures stand on the arena, depth-scaled
// and Y-sorted, driven by the engine's fixed-step loop to K.O.
import { Container } from 'pixi.js';
import type { Application } from 'pixi.js';
import { createFight, stepFight, makeRng, makeBus, PRESETS, deriveStats } from '../index';
import type { FightState, EventBus, Rng } from '../index';
import { routeB } from './theme';
import { advance } from './loop';
import { Arena } from './arena';
import { Creature } from './creature';

export class Scene {
  private world = new Container();
  private arena = new Arena(routeB);
  private creatures: Creature[] = [];
  private state!: FightState;
  private rng!: Rng;
  private bus!: EventBus;
  private acc = 0;
  private maxHP: number[] = [];
  private _started = false;

  constructor(private app: Application) {
    this.app.stage.addChild(this.arena.root);
    this.app.stage.addChild(this.world);
  }

  async start(seed: number): Promise<void> {
    this.rng = makeRng(seed);
    this.bus = makeBus();
    const a = PRESETS['hero']!;
    const b = PRESETS['brute']!;
    this.state = createFight(
      { id: 'p1', name: a.name, side: -1, build: a.build },
      { id: 'p2', name: b.name, side: 1, build: b.build },
    );
    this.maxHP = [deriveStats(a.build).maxHP, deriveStats(b.build).maxHP];
    // Destroy previous creatures to avoid WebGL buffer leaks on restart
    for (const c of this.creatures) c.root.destroy({ children: true });
    this.creatures = [];
    this.world.removeChildren();
    this.creatures = [new Creature(a.build, routeB), new Creature(b.build, routeB)];
    for (const c of this.creatures) this.world.addChild(c.root);
    this.layout();
    if (!this._started) {
      window.addEventListener('resize', () => this.layout());
      this.app.ticker.add((tk) => this.frame(tk.deltaMS / 1000));
      this._started = true;
    }
  }

  private layout(): void {
    const W = this.app.screen.width, H = this.app.screen.height;
    this.arena.resize(W, H);
    const groundY = H * 0.82;
    this.creatures.forEach((c, i) => {
      const side: -1 | 1 = i === 0 ? -1 : 1;
      const scale = Math.min(W * 0.30 / (c.meta.wCells * 14), H * 0.45 / (c.meta.hCells * 14));
      c.root.scale.set(scale);
      c.root.position.set(W * 0.5 + side * W * 0.22, groundY);
      c.facing = i === 0 ? 1 : -1;
      const sh = this.arena.shadowFor(i);
      sh.position.set(c.root.x, groundY + 4);
      sh.width = c.meta.wCells * 14 * scale * 1.2; sh.height = 14 * scale * 1.2;
    });
  }

  private frame(realDt: number): void {
    const r = advance(this.acc, realDt); this.acc = r.acc;
    for (let i = 0; i < r.steps; i++) {
      if (this.state.phase === 'fight') { stepFight(this.state, this.rng, this.bus); }
    }
    this.bus.drain(); // events consumed for real in Task 12; drain to avoid unbounded buffer
    for (const c of this.creatures) c.update(realDt);
    // Y-sort: lower on screen draws in front (depth comes in Task 13)
  }
}
