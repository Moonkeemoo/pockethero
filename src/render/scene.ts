// src/render/scene.ts
// Assembles the full combat view: arena + 2 creatures + HUD + VFX + depth/Y-sort.
// Drives the sim via fixed-step loop; maps CombatEvents → VFX intents each frame.
import { Container } from 'pixi.js';
import type { Application } from 'pixi.js';
import { createFight, stepFight, makeRng, makeBus, PRESETS, deriveStats } from '../index';
import type { FightState, EventBus, Rng } from '../index';
import { routeB } from './theme';
import { advance } from './loop';
import { mapEventToVfx } from './events-to-vfx';
import { Arena } from './arena';
import { Creature } from './creature';
import { Hud } from './hud';
import { Vfx } from './vfx';

export class Scene {
  private world = new Container();
  private arena = new Arena(routeB);
  private creatures: Creature[] = [];
  private hud!: Hud;
  private vfx = new Vfx();
  private state!: FightState;
  private rng!: Rng;
  private bus!: EventBus;
  private acc = 0;
  private maxHP: number[] = [];
  private seed = 0xC0FFEE;
  private _started = false;
  // depth Z per creature (0 = front, +1 = deep back); eases toward 0
  private creatureZ: number[] = [0, 0];
  // lunge X offset for the actor on move-start
  private lungeX: number[] = [0, 0];

  constructor(private app: Application) {
    this.app.stage.addChild(this.arena.root);
    this.app.stage.addChild(this.world);
    // HUD is created once; restart wires after start() is first called
  }

  /** LCG seed sequence — deterministic per-session variety. */
  private nextSeed(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed;
  }

  async start(seed: number): Promise<void> {
    this.seed = seed;
    this.rng = makeRng(seed);
    this.bus = makeBus();
    const a = PRESETS['hero']!;
    const b = PRESETS['brute']!;
    this.state = createFight(
      { id: 'p1', name: a.name, side: -1, build: a.build },
      { id: 'p2', name: b.name, side: 1, build: b.build },
    );
    this.maxHP = [deriveStats(a.build).maxHP, deriveStats(b.build).maxHP];
    this.creatureZ = [0, 0];
    this.lungeX = [0, 0];

    // Destroy previous creatures to avoid WebGL buffer leaks on restart
    for (const c of this.creatures) c.root.destroy({ children: true });
    this.creatures = [];
    this.world.removeChildren();

    this.creatures = [new Creature(a.build, routeB), new Creature(b.build, routeB)];
    for (const c of this.creatures) this.world.addChild(c.root);
    this.world.addChild(this.vfx.layer); // VFX layer above creatures

    if (!this._started) {
      this.hud = new Hud(
        [a.name, b.name],
        () => { void this.start(this.nextSeed()); },
      );
      this.app.stage.addChild(this.hud.root);
      window.addEventListener('resize', () => this.layout());
      this.app.ticker.add((tk) => this.frame(tk.deltaMS / 1000));
      this._started = true;
    }

    // reset HUD log on restart
    this.hud.pushLog(`— ${a.name} vs ${b.name} (seed ${seed.toString(16)}) —`);
    this.layout();
  }

  private layout(): void {
    const W = this.app.screen.width, H = this.app.screen.height;
    this.arena.resize(W, H);
    const groundY = H * 0.82;
    this.creatures.forEach((c, i) => {
      const side: -1 | 1 = i === 0 ? -1 : 1;
      const baseScale = Math.min(W * 0.30 / (c.meta.wCells * 14), H * 0.45 / (c.meta.hCells * 14));
      c.root.scale.set(baseScale);
      c.root.position.set(W * 0.5 + side * W * 0.22, groundY);
      c.facing = i === 0 ? 1 : -1;
      const sh = this.arena.shadowFor(i);
      sh.position.set(c.root.x, groundY + 4);
      sh.width = c.meta.wCells * 14 * baseScale * 1.2;
      sh.height = 14 * baseScale * 1.2;
    });
    this.hud.layout(W, H);
  }

  /** Return the screen-space midpoint for a fighter id (used for VFX targeting). */
  private screenPos(id: string): { x: number; y: number } {
    const i = id === 'p1' ? 0 : 1;
    const c = this.creatures[i];
    if (!c) return { x: this.app.screen.width / 2, y: this.app.screen.height / 2 };
    return {
      x: c.root.x,
      y: c.root.y - (c.meta.hCells * 14 * Math.abs(c.root.scale.y)) * 0.5,
    };
  }

  /** Flash helper — routes to the correct creature. */
  private flash(id: string, color: number, frames: number): void {
    const i = id === 'p1' ? 0 : 1;
    this.creatures[i]?.flash(frames, color);
  }

  private frame(realDt: number): void {
    // --- hitstop gate: freeze sim while hitstop remains ---
    if (this.vfx.hitstop > 0) {
      this.vfx.hitstop -= realDt;
      // still advance particles + update creatures (visual only)
    } else {
      const r = advance(this.acc, realDt);
      this.acc = r.acc;
      for (let i = 0; i < r.steps; i++) {
        if (this.state.phase === 'fight') {
          stepFight(this.state, this.rng, this.bus);
        }
      }
    }

    // --- drain events and play VFX ---
    for (const e of this.bus.drain()) {
      const intents = mapEventToVfx(e, routeB);
      for (const intent of intents) {
        this.vfx.play(intent, (id) => this.screenPos(id), (id, col, fr) => this.flash(id, col, fr));
      }

      // additional creature + HUD reactions per event type
      if (e.type === 'hit') {
        const targetIdx = e.target === 'p1' ? 0 : 1;
        const actorIdx = e.source === 'p1' ? 0 : 1;
        this.creatures[targetIdx]?.react(e.amount);
        // depth knockback: push target back into Z
        this.creatureZ[targetIdx] = Math.min(1, (this.creatureZ[targetIdx] ?? 0) + (e.crit ? 0.55 : 0.35));
        // actor lunge toward target
        const side: -1 | 1 = actorIdx === 0 ? 1 : -1;
        this.lungeX[actorIdx] = side * 18;
        const label = e.crit ? `CRIT ${e.source} → ${e.target}: ${e.amount}` : `${e.source} → ${e.target}: ${e.amount}`;
        this.hud.pushLog(label);
      } else if (e.type === 'move-start') {
        const actorIdx = e.actor === 'p1' ? 0 : 1;
        this.creatures[actorIdx]?.flare(8);
      } else if (e.type === 'ko') {
        this.hud.pushLog(`★ ${e.target} KO'd!`);
      } else if (e.type === 'heal') {
        const targetIdx = e.target === 'p1' ? 0 : 1;
        this.hud.pushLog(`+ heal ${e.target}: +${e.amount}`);
        // small upward spring on heal
        this.creatures[targetIdx]?.react(0);
      }
    }

    // --- update depth (Z) and lunge, ease back ---
    const W = this.app.screen.width, H = this.app.screen.height;
    const groundY = H * 0.82;
    this.creatures.forEach((c, i) => {
      const z = this.creatureZ[i] ?? 0;
      // ease Z back toward 0
      this.creatureZ[i] = z * Math.pow(0.001, realDt);

      // ease lunge back
      this.lungeX[i] = (this.lungeX[i] ?? 0) * Math.pow(0.0008, realDt);

      // map z to scale reduction (1.0 at front → ~0.85 at max depth) and y shift downward
      const depthScale = 1.0 - z * 0.15;
      const baseScale = Math.min(W * 0.30 / (c.meta.wCells * 14), H * 0.45 / (c.meta.hCells * 14));
      const effectiveScale = baseScale * depthScale;
      // keep facing sign from update()
      const side: -1 | 1 = i === 0 ? -1 : 1;
      c.root.scale.set(effectiveScale);
      c.facing = side;

      // base X + lunge offset; depth Y shift (deeper = lower on screen, adds to groundY)
      const baseX = W * 0.5 + side * W * 0.22;
      const depthYShift = z * 18; // pushed down in screen-space when knocked back
      c.root.position.set(
        baseX + (this.lungeX[i] ?? 0),
        groundY + depthYShift,
      );
    });

    // --- Y-sort world children by screen y (lower y = drawn in front) ---
    const sortable = [...this.world.children].filter((ch) => ch !== this.vfx.layer);
    sortable.sort((a, b) => a.y - b.y);
    for (let i = 0; i < sortable.length; i++) {
      const ch = sortable[i];
      if (ch) this.world.setChildIndex(ch, i);
    }

    // --- update creatures ---
    for (const c of this.creatures) c.update(realDt);

    // --- HP bars ---
    this.creatures.forEach((_, i) => {
      const fighter = this.state.fighters[i];
      if (fighter) {
        this.hud.setHP(i, fighter.hp, this.maxHP[i] ?? fighter.hp);
      }
    });

    // --- apply screenshake to world ---
    const sh = this.vfx.update(realDt);
    this.world.position.set(sh.x, sh.y);
  }
}
