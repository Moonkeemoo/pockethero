// src/render/app-canvas.ts
// Canvas bootstrap — replaces the Pixi app.ts.
// Creates/gets a <canvas>, DPR-scales it, runs the rAF loop.
import { CanvasScene } from './scene-canvas';

export function startApp(): void {
  // Create canvas (verbatim from poc/art-routes.html setup)
  const cv = document.createElement('canvas');
  cv.id = 'cv';
  cv.style.cssText = 'position:fixed;inset:0;display:block;';
  document.body.appendChild(cv);

  const scene = new CanvasScene(cv);
  scene.start(0xC0FFEE);

  let last = 0;
  function frame(now: number): void {
    if (!last) last = now;
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05; // cap at 50ms (verbatim from prototype)
    scene.frame(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
