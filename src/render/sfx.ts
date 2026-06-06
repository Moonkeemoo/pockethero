/**
 * src/render/sfx.ts — tiny synthesized WebAudio SFX layer (no audio assets).
 * Lazy AudioContext, created/resumed on first user gesture (autoplay policy).
 * Each cue is a short oscillator envelope. Cheap, deterministic-enough feel.
 */

let ac: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;

function audio(): AudioContext | null {
  if (!enabled) return null;
  if (!ac) {
    try {
      const AC: typeof AudioContext =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) { enabled = false; return null; }
      ac = new AC();
      master = ac.createGain();
      master.gain.value = 0.32;
      master.connect(ac.destination);
    } catch { enabled = false; return null; }
  }
  if (ac.state === 'suspended') void ac.resume();
  return ac;
}

/** One enveloped oscillator note. t0 = start offset (s), optional pitch slide. */
function tone(
  freq: number, t0: number, dur: number,
  type: OscillatorType = 'sine', vol = 0.5, slideTo?: number,
): void {
  const a = audio(); if (!a || !master) return;
  const now = a.currentTime + t0;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, now);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), now + dur);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.linearRampToValueAtTime(vol, now + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  o.connect(g); g.connect(master);
  o.start(now);
  o.stop(now + dur + 0.03);
}

let lastCoin = 0; // round-robin throttle for coin pings

export const sfx = {
  setEnabled(v: boolean): void { enabled = v; },
  /** Call from a user-gesture handler to unlock audio. */
  resume(): void { audio(); },

  stageWin(): void { tone(660, 0, 0.11, 'triangle', 0.38); tone(990, 0.09, 0.17, 'triangle', 0.38); },
  coin(tNow: number): void {
    // cap to ~12/s so a spray doesn't machine-gun
    if (tNow - lastCoin < 0.06) return;
    lastCoin = tNow;
    tone(1180 + Math.random() * 220, 0, 0.05, 'square', 0.14);
  },
  cube(): void { tone(520, 0, 0.09, 'sine', 0.28, 300); },
  levelUp(): void { [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.075, 0.17, 'triangle', 0.32)); },
  rare(): void { tone(1400, 0, 0.09, 'sine', 0.3); tone(2100, 0.07, 0.22, 'sine', 0.28); },
  newType(): void { tone(880, 0, 0.08, 'triangle', 0.3); tone(1320, 0.08, 0.2, 'triangle', 0.3); },
  bossIntro(): void { tone(72, 0, 0.5, 'sawtooth', 0.5, 46); tone(110, 0.05, 0.4, 'square', 0.22); },
  levelComplete(): void { [392, 523, 659, 880].forEach((f, i) => tone(f, i * 0.11, 0.42, 'triangle', 0.38)); },
  chestRattle(): void { tone(170, 0, 0.55, 'sawtooth', 0.1, 250); },
  chestOpen(): void { tone(140, 0, 0.16, 'square', 0.38); tone(1600, 0.1, 0.32, 'sine', 0.26); },
  loss(): void { tone(330, 0, 0.5, 'sine', 0.26, 150); },
  spike(): void { tone(440, 0, 0.07, 'square', 0.32); tone(660, 0.06, 0.14, 'square', 0.32); tone(880, 0.14, 0.2, 'triangle', 0.32); },
};
