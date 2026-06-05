// src/render/scene-canvas.ts
// Engine-driven canvas combat scene.
// Replicates src/render/scene.ts event handling, drawing with canvas2D modules.
import { createFight, stepFight, makeRng, makeBus, PRESETS, deriveStats, CUBES } from '../index';
import type { FightState, EventBus, Rng, Build } from '../index';
import { advance } from './loop';
import { drawArenaB } from './draw-arena';
import { drawCreature, buildMeta } from './draw-creature';
import type { ActorAnim, CreatureMeta } from './draw-creature';
import { drawParts, stepParts, spawnVfxB, VfxState } from './draw-vfx';
import { drawHud, makeHudState, pushLog, setHP } from './draw-hud';
import type { HudState } from './draw-hud';
import { lightenHex } from './draw-cube';

interface Fighter {
  build: Build;
  meta: CreatureMeta;
  anim: ActorAnim;
  cx: number;      // screen X (set in layout)
  cell: number;    // px per cube (set in layout)
  flashFrames: number;
  flashColor: string;
}

/** LCG seed stepper (verbatim from scene.ts nextSeed) */
function nextSeed(seed: number): number {
  return ((seed * 1664525 + 1013904223) >>> 0);
}

export class CanvasScene {
  private cv: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private DPR = 1;
  private W = 0;
  private H = 0;

  private vfx = new VfxState();
  private hud!: HudState;

  private fighters: Fighter[] = [];
  private state!: FightState;
  private rng!: Rng;
  private bus!: EventBus;
  private acc = 0;
  private maxHP: [number, number] = [1, 1];
  private seed = 0xC0FFEE;
  private _started = false;

  constructor(cv: HTMLCanvasElement) {
    this.cv = cv;
    this.ctx = cv.getContext('2d')!;
  }

  start(seed: number): void {
    this.seed = seed;
    this.rng = makeRng(seed);
    this.bus = makeBus();

    const presetA = PRESETS['hero']!;
    const presetB = PRESETS['brute']!;

    this.state = createFight(
      { id: 'p1', name: presetA.name, side: -1, build: presetA.build },
      { id: 'p2', name: presetB.name, side: 1, build: presetB.build },
    );
    this.maxHP = [
      deriveStats(presetA.build).maxHP,
      deriveStats(presetB.build).maxHP,
    ];

    const makeAnim = (dir: 1 | -1, phase: number): ActorAnim => ({
      t: 0, phase, squash: 0, flare: 0, lunge: 0, attack: 0, dir,
    });

    this.fighters = [
      {
        build: presetA.build,
        meta: buildMeta(presetA.build),
        anim: makeAnim(1, 0),
        cx: 0, cell: 0,
        flashFrames: 0, flashColor: '#ffffff',
      },
      {
        build: presetB.build,
        meta: buildMeta(presetB.build),
        anim: makeAnim(-1, presetB.build.length * 1.3 % (Math.PI * 2)),
        cx: 0, cell: 0,
        flashFrames: 0, flashColor: '#ffffff',
      },
    ];

    this.acc = 0;
    this.vfx = new VfxState();

    if (!this._started) {
      const onRestart = () => {
        this.seed = nextSeed(this.seed);
        this.start(this.seed);
      };
      this.hud = makeHudState(
        [presetA.name, presetB.name],
        onRestart,
      );
      window.addEventListener('resize', () => this.resize());
      this._started = true;
    }

    this.resize();
    pushLog(this.hud, `— ${presetA.name} vs ${presetB.name} (seed ${seed.toString(16)}) —`);
  }

  private resize(): void {
    this.DPR = Math.min(window.devicePixelRatio || 1, 2);
    this.W = innerWidth;
    this.H = innerHeight;
    this.cv.width = Math.floor(this.W * this.DPR);
    this.cv.height = Math.floor(this.H * this.DPR);
    this.cv.style.width = this.W + 'px';
    this.cv.style.height = this.H + 'px';
    this.ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);
    this.layout();
  }

  private layout(): void {
    const W = this.W, H = this.H;
    const groundY = H * 0.82;
    // Uniform cube size across BOTH fighters (prototype uses a fixed cube px),
    // sized to fit the largest creature in the available combat space.
    const maxW = Math.max(...this.fighters.map(f => f.meta.wCells));
    const maxH = Math.max(...this.fighters.map(f => f.meta.hCells));
    const cell = Math.max(6, Math.round(Math.min(W * 0.46 / maxW, H * 0.58 / maxH)));
    this.fighters.forEach((f, i) => {
      const side: -1 | 1 = i === 0 ? -1 : 1;
      f.cx = W * 0.5 + side * W * 0.25;
      f.cell = cell;
    });
    // suppress unused warning — groundY needed for context
    void groundY;
  }

  private groundY(): number { return this.H * 0.82; }

  private screenPos(id: string): { x: number; y: number } {
    const i = id === 'p1' ? 0 : 1;
    const f = this.fighters[i];
    if (!f) return { x: this.W / 2, y: this.H / 2 };
    return {
      x: f.cx,
      y: this.groundY() - f.meta.hCells * f.cell * 0.5,
    };
  }

  /** Called by the rAF loop in app-canvas.ts. */
  frame(realDt: number): void {
    const { ctx, W, H } = this;

    // --- hitstop gate (verbatim from scene.ts) ---
    if (this.vfx.hitstop > 0) {
      this.vfx.hitstop -= realDt;
    } else {
      const r = advance(this.acc, realDt);
      this.acc = r.acc;
      for (let i = 0; i < r.steps; i++) {
        if (this.state.phase === 'fight') stepFight(this.state, this.rng, this.bus);
      }

      // --- drain events (verbatim mapping from scene.ts) ---
      for (const e of this.bus.drain()) {
        if (e.type === 'hit') {
          const targetIdx = e.target === 'p1' ? 0 : 1;
          const actorIdx = e.source === 'p1' ? 0 : 1;
          const tf = this.fighters[targetIdx]!;
          const af = this.fighters[actorIdx]!;

          // Flash (white on crit, warm-yellow on normal)
          tf.flashFrames = e.crit ? 4 : 3;
          tf.flashColor = e.crit ? '#ffffff' : '#fff2cc';

          // Shake + hitstop
          const heavy = Math.min(1, e.amount / 25);
          const critK = e.crit ? 1.6 : 1;
          this.vfx.shake = Math.max(this.vfx.shake, (2 + 5 * heavy) * critK);
          this.vfx.hitstop = Math.max(this.vfx.hitstop, Math.round((4 + 4 * heavy) * critK) / 60);

          // Squash on hit (target recoils); the attacker's lunge is driven by its
          // own move-start attack envelope (see below), matching the prototype.
          tf.anim.squash = Math.min(1, tf.anim.squash + 0.5 + e.amount * 0.04);

          // Spawn VFX at target mid-body
          const pos = this.screenPos(e.target);
          // tint = lighten(first non-core cube col, 0.2) — matches prototype's doImpact logic
          const nonCore = this.fighters[targetIdx]!.build.find(p => p.type !== 'core');
          const baseTint = CUBES[nonCore?.type ?? 'force']?.col ?? '#E0483F';
          const tint = lightenHex(baseTint, 0.2);
          spawnVfxB(this.vfx, pos.x, pos.y, tint, af.anim.dir);

          const label = e.crit ? `CRIT ${e.source} → ${e.target}: ${e.amount}` : `${e.source} → ${e.target}: ${e.amount}`;
          pushLog(this.hud, label);

        } else if (e.type === 'move-start') {
          const actorIdx = e.actor === 'p1' ? 0 : 1;
          // Trigger the full attack animation (wind-up → lunge → recover) + sway
          // burst — verbatim prototype triggerAttack(); also a brief pre-attack flare.
          this.fighters[actorIdx]!.anim.attack = 0.0001;
          this.fighters[actorIdx]!.anim.flare = 1;

        } else if (e.type === 'ko') {
          pushLog(this.hud, `★ ${e.target} KO'd!`);

        } else if (e.type === 'heal') {
          pushLog(this.hud, `+ heal ${e.target}: +${e.amount}`);
        }
      }
    }

    // --- Presentation-layer updates (always run, independent of hitstop) ---
    const dt = realDt;
    this.vfx.shake *= Math.pow(0.0001, dt);

    for (const f of this.fighters) {
      const a = f.anim;
      a.t += dt;
      a.flare  *= Math.pow(0.02, dt);
      a.squash *= Math.pow(0.0005, dt);
      a.lunge  *= Math.pow(0.0006, dt);

      if (a.attack > 0) {
        a.attack += dt * 1.7;
        const p = a.attack;
        a.lunge = p < 1 ? -0.25 * Math.sin(p * Math.PI * 0.7) :
                  p < 1.6 ? 0.7 * Math.sin((p - 1) * Math.PI / 0.6) : 0;
        if (p > 2.2) a.attack = 0;
      }

      if (f.flashFrames > 0) f.flashFrames--;
    }

    stepParts(this.vfx, dt);

    // --- HP bar data ---
    this.fighters.forEach((_, i) => {
      const fighter = this.state.fighters[i];
      if (fighter) setHP(this.hud, i as 0 | 1, fighter.hp, this.maxHP[i] ?? fighter.hp);
    });

    // --- Draw ---
    ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const groundY = this.groundY();

    // 1. Arena
    drawArenaB(ctx, W, H, groundY);

    // 2. Screenshake translate
    const shakeAmp = this.vfx.shake > 0.1 ? this.vfx.shake : 0;
    const sx = (Math.random() - 0.5) * shakeAmp;
    const sy = (Math.random() - 0.5) * shakeAmp;
    ctx.save();
    ctx.translate(sx, sy);

    // 3. Creatures (left-to-right)
    const sorted = [...this.fighters].sort((a, b) => a.cx - b.cx);
    for (const f of sorted) {
      // Apply hit flash: tint the whole creature white by drawing a white rect with globalCompositeOperation
      const doFlash = f.flashFrames > 0;
      ctx.save();
      drawCreature(ctx, f.build, f.meta, f.cx, groundY, f.cell, f.anim);
      if (doFlash) {
        // Overlay a flash-tinted rect over the creature bounding box
        const fw = f.meta.wCells * f.cell;
        const fh = f.meta.hCells * f.cell;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = f.flashColor;
        ctx.fillRect(f.cx - fw * 0.5, groundY - fh, fw, fh);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
      }
      ctx.restore();

      // 4. Hit-flash bloom (verbatim prototype lines 406–409)
      if (f.anim.flare > 0.4) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = f.anim.flare * 0.5;
        const bcy = groundY - f.meta.hCells * f.cell * 0.45;
        const fg = ctx.createRadialGradient(f.cx, bcy, 2, f.cx, bcy, f.meta.hCells * f.cell * 0.7);
        fg.addColorStop(0, 'rgba(255,255,255,0.9)');
        fg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = fg;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
    }

    // 5. VFX particles
    drawParts(ctx, this.vfx);

    ctx.restore(); // end shake translate

    // 6. HUD (no shake)
    drawHud(ctx, this.hud, W, H);
  }
}
