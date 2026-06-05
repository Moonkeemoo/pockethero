// src/render/scene-canvas.ts
// Engine-driven canvas combat scene.
// Replicates src/render/scene.ts event handling, drawing with canvas2D modules.
import { createFight, stepFight, makeRng, makeBus, PRESETS, deriveStats, CUBES, MOVES } from '../index';
import type { FightState, EventBus, Rng, Build } from '../index';
import { advance } from './loop';
import { drawArenaB } from './draw-arena';
import { drawCreature, buildMeta } from './draw-creature';
import type { ActorAnim, CreatureMeta } from './draw-creature';
import {
  drawParts, stepParts, spawnVfxB, VfxState, chunk, ring,
  drawProjectiles, drawBolts, drawSlashes, drawFloaters, drawStatusAuras,
  spawnProjectile, addFloater, makeBolt,
  spawnMeleeImpact, spawnBowImpact,
  spawnFireImpact, spawnFrostImpact, spawnSparkImpact, spawnPoisonImpact, spawnArcaneImpact,
  burst, spark,
} from './draw-vfx';
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
  /** recoil knockback offset (px), applied to the hit target, eases back to 0 */
  recoil: number;
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
        recoil: 0,
      },
      {
        build: presetB.build,
        meta: buildMeta(presetB.build),
        anim: makeAnim(-1, presetB.build.length * 1.3 % (Math.PI * 2)),
        cx: 0, cell: 0,
        flashFrames: 0, flashColor: '#ffffff',
        recoil: 0,
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

  /** Return the screen position of the creature's mid-body center */
  private screenPos(id: string): { x: number; y: number } {
    const i = id === 'p1' ? 0 : 1;
    const f = this.fighters[i];
    if (!f) return { x: this.W / 2, y: this.H / 2 };
    return {
      x: f.cx,
      y: this.groundY() - f.meta.hCells * f.cell * 0.5,
    };
  }

  /** Return the top of the creature body (used for floater spawn Y) */
  private bodyTop(id: string): number {
    const i = id === 'p1' ? 0 : 1;
    const f = this.fighters[i];
    if (!f) return this.H * 0.5;
    return this.groundY() - f.meta.hCells * f.cell;
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

      // --- drain events ---
      for (const e of this.bus.drain()) {
        if (e.type === 'move-start') {
          const actorIdx = e.actor === 'p1' ? 0 : 1;
          const targetIdx = actorIdx === 0 ? 1 : 0;
          const af = this.fighters[actorIdx]!;

          // Trigger the full attack animation (wind-up → lunge → recover) + sway
          // burst — verbatim prototype triggerAttack(); also a brief pre-attack flare.
          af.anim.attack = 0.0001;
          af.anim.flare = 1;

          // Spawn projectile if move is ranged
          const m = MOVES[e.move];
          if (m?.ranged) {
            const tf = this.fighters[targetIdx]!;
            const aPos = this.screenPos(e.actor);
            const tPos = this.screenPos(e.actor === 'p1' ? 'p2' : 'p1');
            // source X slightly toward target (ported from poc spawnProjectile)
            const srcX = aPos.x + af.anim.dir * 22;
            const srcY = aPos.y;
            const dstX = tPos.x;
            const dstY = tPos.y;
            spawnProjectile(
              this.vfx,
              m.kind,
              m.magicSchool,
              srcX, srcY,
              dstX, dstY,
            );
            void tf; // suppress unused
          }

        } else if (e.type === 'hit') {
          const targetIdx = e.target === 'p1' ? 0 : 1;
          const actorIdx = e.source === 'p1' ? 0 : 1;
          const tf = this.fighters[targetIdx]!;
          const af = this.fighters[actorIdx]!;

          // Flash (white on crit, warm-yellow on normal)
          tf.flashFrames = e.crit ? 4 : 3;
          tf.flashColor = e.crit ? '#ffffff' : '#fff2cc';

          // Shake + hitstop (strengthened for more punch)
          const heavy = Math.min(1, e.amount / 25);
          const critK = e.crit ? 1.6 : 1;
          this.vfx.shake = Math.max(this.vfx.shake, (3 + 7 * heavy) * critK);
          this.vfx.hitstop = Math.max(this.vfx.hitstop, Math.round((4 + 6 * heavy) * critK) / 60);

          // Deep squash on hit target + recoil knockback
          tf.anim.squash = Math.min(1, tf.anim.squash + 0.7 + e.amount * 0.05);
          // Recoil: target shifts back in the direction away from attacker
          const recoilDir = af.anim.dir; // attacker faces toward target, so target recoils that way
          tf.recoil = recoilDir * (8 + e.amount * 0.5) * (e.crit ? 1.5 : 1);

          // Spawn VFX at target mid-body
          const pos = this.screenPos(e.target);
          const impactY = pos.y;

          // Determine what kind of impact VFX to spawn
          const moveId = _lastMoveForActor[e.source];
          const moveDef = moveId != null ? MOVES[moveId] : undefined;
          const school = e.school ?? moveDef?.magicSchool;
          const kind = moveDef?.kind ?? 'fist';

          if (moveDef?.school === 'phys' && moveDef?.ranged === false) {
            // Melee: slash arc (sword) or spark (fist)
            spawnMeleeImpact(this.vfx, kind, pos.x, impactY, af.anim.dir);
          } else if (kind === 'bow') {
            spawnBowImpact(this.vfx, pos.x, impactY);
          } else if (school === 'fire') {
            spawnFireImpact(this.vfx, pos.x, impactY);
          } else if (school === 'frost') {
            spawnFrostImpact(this.vfx, pos.x, impactY);
          } else if (school === 'spark') {
            // bolt shape from the flying projectile if available, else generate fresh
            const matchPrj = _lastBolt[e.source];
            spawnSparkImpact(this.vfx, pos.x, impactY, matchPrj ?? makeBolt(pos.x - 80, impactY, pos.x, impactY));
            delete _lastBolt[e.source];
          } else if (school === 'poison') {
            spawnPoisonImpact(this.vfx, pos.x, impactY);
          } else if (school === 'arcane') {
            spawnArcaneImpact(this.vfx, pos.x, impactY);
          } else {
            // Generic fallback: chunk VFX (covers unknown/future move kinds)
            const nonCore = this.fighters[targetIdx]!.build.find(p => p.type !== 'core');
            const baseTint = CUBES[nonCore?.type ?? 'force']?.col ?? '#E0483F';
            const tint = lightenHex(baseTint, 0.2);
            spawnVfxB(this.vfx, pos.x, impactY, tint, af.anim.dir);
          }

          // Floating damage number (ported from poc/builder.html addFloater)
          const floatY = this.bodyTop(e.target) - 10;
          if (e.crit) {
            addFloater(this.vfx, pos.x, floatY, String(e.amount), '#ffe24a', true);
          } else {
            addFloater(this.vfx, pos.x, floatY, String(e.amount), '#ffffff', false);
          }

          const label = e.crit
            ? `CRIT ${e.source} → ${e.target}: ${e.amount}`
            : `${e.source} → ${e.target}: ${e.amount}`;
          pushLog(this.hud, label);

        } else if (e.type === 'block') {
          // "БЛОК" floater + steel flash
          const pos = this.screenPos(e.target);
          addFloater(this.vfx, pos.x, this.bodyTop(e.target) - 10, 'БЛОК', '#7CE0A0', false);
          spark(this.vfx, pos.x, pos.y, 10, '#7CE0A0', 120);
          pushLog(this.hud, `${e.target}: заблокував`);

        } else if (e.type === 'dodge') {
          // "УХИЛ" floater + brief sidestep on the dodger
          const tIdx = e.target === 'p1' ? 0 : 1;
          const tf = this.fighters[tIdx]!;
          const pos = this.screenPos(e.target);
          addFloater(this.vfx, pos.x, this.bodyTop(e.target) - 10, 'УХИЛ', '#9aa6b4', false);
          // Brief sidestep: give a small recoil away from the attacker
          tf.recoil = -tf.anim.dir * 12;
          spark(this.vfx, pos.x, pos.y, 4, '#7e8a99', 90);
          pushLog(this.hud, `${e.target}: ухилився`);

        } else if (e.type === 'status-applied') {
          // Small colour pop
          const pos = this.screenPos(e.target);
          const col = _statusCol(e.status);
          burst(this.vfx, pos.x, pos.y, 8, [col, '#ffffff'], 120, -40, 3);

        } else if (e.type === 'status-tick') {
          // Coloured damage floater
          const pos = this.screenPos(e.target);
          const col = _statusCol(e.status);
          addFloater(this.vfx, pos.x, this.bodyTop(e.target) - 10, String(e.amount), col, false);
          // Small burst at body
          if (e.status === 'burn') burst(this.vfx, pos.x, pos.y, 8, ['#ff7a2a', '#ffd24a'], 80, -160, 3);
          if (e.status === 'poison') burst(this.vfx, pos.x, pos.y, 8, ['#7bd64a', '#a6ff6a'], 70, -120, 3);

        } else if (e.type === 'heal') {
          const pos = this.screenPos(e.target);
          addFloater(this.vfx, pos.x, this.bodyTop(e.target) - 10, `+${e.amount}`, '#5BE08A', false);
          pushLog(this.hud, `+ heal ${e.target}: +${e.amount}`);

        } else if (e.type === 'ko') {
          const pos = this.screenPos(e.target);
          // Big KO burst
          burst(this.vfx, pos.x, pos.y, 30, ['#ffd24a', '#ffffff', '#ff7a2a'], 400, 60, 5);
          ring(this.vfx, pos.x, pos.y, '#ffd24a', 4, 300, true);
          addFloater(this.vfx, pos.x, this.bodyTop(e.target) - 20, 'K.O.', '#ffd24a', true);
          this.vfx.shake = Math.max(this.vfx.shake, 12);
          pushLog(this.hud, `★ ${e.target} KO'd!`);
        }

        // Track last move per actor (for impact VFX selection on the following hit event)
        if (e.type === 'move-start') {
          _lastMoveForActor[e.actor] = e.move;
          const m2 = MOVES[e.move];
          if (m2?.kind === 'spark') {
            const aPos = this.screenPos(e.actor);
            const tId = e.actor === 'p1' ? 'p2' : 'p1';
            const tPos = this.screenPos(tId);
            _lastBolt[e.actor] = makeBolt(aPos.x, aPos.y, tPos.x, tPos.y);
          }
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
      a.squash *= Math.pow(0.0003, dt);  // slower decay = more impactful squash
      a.lunge  *= Math.pow(0.0006, dt);

      // Punchier attack envelope: more lunge amplitude + faster advance
      if (a.attack > 0) {
        a.attack += dt * 2.0;  // faster envelope
        const p = a.attack;
        // Wind-up: pull back further (-0.45); Release: lunge forward harder (1.2)
        a.lunge = p < 1 ? -0.45 * Math.sin(p * Math.PI * 0.7) :
                  p < 1.6 ? 1.2 * Math.sin((p - 1) * Math.PI / 0.6) : 0;
        if (p > 2.2) a.attack = 0;
      }

      // Recoil eases back to 0 (spring-like, fast)
      f.recoil *= Math.pow(0.0008, dt);

      if (f.flashFrames > 0) f.flashFrames--;
    }

    // Check for projectiles that have reached their target — spawn impact FX
    for (let i = this.vfx.projectiles.length - 1; i >= 0; i--) {
      const p = this.vfx.projectiles[i]!;
      if (p.t >= p.dur) {
        // Impact FX at destination
        if (p.kind === 'bow') {
          spawnBowImpact(this.vfx, p.ex, p.ey);
        } else if (p.magicSchool === 'fire') {
          spawnFireImpact(this.vfx, p.ex, p.ey);
        } else if (p.magicSchool === 'frost') {
          spawnFrostImpact(this.vfx, p.ex, p.ey);
        } else if (p.magicSchool === 'spark') {
          spawnSparkImpact(this.vfx, p.ex, p.ey, p.bolt);
        } else if (p.magicSchool === 'poison') {
          spawnPoisonImpact(this.vfx, p.ex, p.ey);
        } else if (p.magicSchool === 'arcane') {
          spawnArcaneImpact(this.vfx, p.ex, p.ey);
        }
        this.vfx.projectiles.splice(i, 1);
      }
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
    const sy2 = (Math.random() - 0.5) * shakeAmp;
    ctx.save();
    ctx.translate(sx, sy2);

    // 3. Status auras (behind creatures)
    const sorted = [...this.fighters].sort((a, b) => a.cx - b.cx);
    for (let i = 0; i < this.fighters.length; i++) {
      const f = this.fighters[i]!;
      const fightState = this.state.fighters[i];
      if (!fightState || fightState.statuses.length === 0) continue;
      const bw = f.meta.wCells * f.cell;
      const bh = f.meta.hCells * f.cell;
      const bTop = groundY - bh;
      // Apply recoil offset
      ctx.save();
      ctx.translate(f.recoil, 0);
      drawStatusAuras(ctx, fightState.statuses, f.cx, bTop, bw, bh, f.anim.t);
      ctx.restore();
    }

    // 4. Creatures (left-to-right)
    for (const f of sorted) {
      // Find fighter index for state lookup
      const fIdx = this.fighters.indexOf(f);
      const fightState = this.state.fighters[fIdx];
      const doFlash = f.flashFrames > 0;

      // Apply recoil offset to creature drawing
      ctx.save();
      ctx.translate(f.recoil, 0);
      drawCreature(ctx, f.build, f.meta, f.cx, groundY, f.cell, f.anim);

      if (doFlash) {
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

      // 5. Attack flare bloom (verbatim prototype lines 406–409)
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

      void fightState;
    }

    // 6. Projectiles (flying through the air)
    drawProjectiles(ctx, this.vfx);

    // 7. Slash arcs
    drawSlashes(ctx, this.vfx);

    // 8. Lightning bolts
    drawBolts(ctx, this.vfx);

    // 9. VFX particles (debris, bursts)
    drawParts(ctx, this.vfx);

    ctx.restore(); // end shake translate

    // 10. Floating numbers (top layer, no shake)
    drawFloaters(ctx, this.vfx);

    // 11. HUD (no shake)
    drawHud(ctx, this.hud, W, H);
  }
}

// Module-level mutable tracking (render-only, cosmetic — not touching sim)
const _lastMoveForActor: Record<string, string> = {};
const _lastBolt: Record<string, import('./draw-vfx').BoltShape> = {};

/** Map status id to its colour */
function _statusCol(status: string): string {
  switch (status) {
    case 'burn':    return '#ff7a2a';
    case 'slow':    return '#5ad6ff';
    case 'shock':   return '#c79bff';
    case 'poison':  return '#7bd64a';
    default:        return '#ffffff';
  }
}
