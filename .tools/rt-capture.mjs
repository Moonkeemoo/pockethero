// Real-time multi-frame capture via Chrome DevTools Protocol (no virtual-time).
// Connects to a Chrome started with --remote-debugging-port=9222, grabs N PNG
// frames at real wall-clock intervals so animation/combat is actually captured.
import http from 'node:http';
import fs from 'node:fs';

const PORT = 9222;
const OUT = process.env.TEMP;
const N = Number(process.argv[2]) || 7, GAP_MS = Number(process.argv[3]) || 200;

const get = (path) => new Promise((res, rej) => {
  http.get(`http://127.0.0.1:${PORT}${path}`, (r) => {
    let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => res(d));
  }).on('error', rej);
});

const targets = JSON.parse(await get('/json'));
const t = targets.find((x) => x.type === 'page' && x.webSocketDebuggerUrl) || targets[0];
if (!t) { console.error('no page target'); process.exit(1); }

const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
const send = (method, params = {}) => new Promise((r) => {
  const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params }));
});
await new Promise((r) => ws.addEventListener('open', r));
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
});

await send('Page.enable');
for (let k = 0; k < N; k++) {
  const res = await send('Page.captureScreenshot', { format: 'png' });
  if (res && res.data) fs.writeFileSync(`${OUT}\\rt_${k}.png`, Buffer.from(res.data, 'base64'));
  await new Promise((r) => setTimeout(r, GAP_MS));
}
console.log('captured', N, 'frames to', OUT);
process.exit(0);
