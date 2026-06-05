// CDP: capture a "before" frame, optionally click at (x,y), then capture N frames.
// Usage: node cdp-click.mjs [clickX clickY] [waitMs] [N] [gapMs]
import http from 'node:http';
import fs from 'node:fs';
const PORT = 9222, OUT = process.env.TEMP;
const [,, cxs, cys, waitMsS, NS, gapS] = process.argv;
const clickX = cxs ? Number(cxs) : null, clickY = cys ? Number(cys) : null;
const waitMs = Number(waitMsS) || 3500, N = Number(NS) || 6, gap = Number(gapS) || 220;

const get = (p) => new Promise((res, rej) => {
  http.get(`http://127.0.0.1:${PORT}${p}`, (r) => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>res(d)); }).on('error', rej);
});
const targets = JSON.parse(await get('/json'));
const t = targets.find(x => x.type==='page' && x.webSocketDebuggerUrl) || targets[0];
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id=0; const pending=new Map();
const send=(m,p={})=>new Promise(r=>{const i=++id;pending.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:p}));});
await new Promise(r=>ws.addEventListener('open',r));
ws.addEventListener('message',e=>{const m=JSON.parse(e.data); if(m.id&&pending.has(m.id)){pending.get(m.id)(m.result);pending.delete(m.id);}});
await send('Page.enable');
const shot = async (name) => { const r = await send('Page.captureScreenshot',{format:'png'}); if(r?.data) fs.writeFileSync(`${OUT}\\${name}.png`, Buffer.from(r.data,'base64')); };
await shot('cdp_pre');
if (clickX != null) {
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:clickX,y:clickY});
  await send('Input.dispatchMouseEvent',{type:'mousePressed',x:clickX,y:clickY,button:'left',clickCount:1});
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:clickX,y:clickY,button:'left',clickCount:1});
  await new Promise(r=>setTimeout(r, waitMs));
  for(let k=0;k<N;k++){ await shot(`cdp_${k}`); await new Promise(r=>setTimeout(r,gap)); }
}
console.log('done');
process.exit(0);
