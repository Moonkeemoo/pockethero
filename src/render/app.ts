// src/render/app.ts
import { Application } from 'pixi.js';
import { Scene } from './scene';

export async function startApp(): Promise<void> {
  const app = new Application();
  await app.init({
    background: '#0e0f14', resizeTo: window, antialias: false,
    autoDensity: true, resolution: Math.min(window.devicePixelRatio || 1, 2),
  });
  document.body.appendChild(app.canvas);
  const scene = new Scene(app);
  await scene.start(0xC0FFEE); // initial seed
}
