import { Application } from 'pixi.js';

const app = new Application();
await app.init({ background: '#070a0f', resizeTo: window, antialias: true });
document.body.appendChild(app.canvas);
// Slice 2 mounts the 2.5D billboard renderer here. No game rendering yet.
console.log('PocketHero shell ready — engine lives in src/sim, see `npm run sim`.');
