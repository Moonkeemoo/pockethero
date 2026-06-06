// Wait for a PixelLab job, then download the character's rotation PNGs.
// Usage: node .tools/pl-fetch.mjs <jobId> <characterId> <outPrefix>
import fs from 'node:fs';
const KEY = fs.readFileSync('.pixellab.key','utf8').trim();
const [JOB, CHAR, PREFIX] = process.argv.slice(2);
const SDIR = 'app/public/sprites';
fs.mkdirSync(SDIR, {recursive:true});
const H = { Authorization: 'Bearer '+KEY };
const TERMINAL = new Set(['completed','complete','finished','succeeded','success','done','failed','error','cancelled']);
const sleep = ms => new Promise(r=>setTimeout(r,ms));

for (let i=0;i<45;i++){
  const r = await fetch(`https://api.pixellab.ai/v2/background-jobs/${JOB}`,{headers:H});
  const j = await r.json();
  const st=(j.status||'').toLowerCase(), lst=(j.last_response&&(j.last_response.status||'')).toLowerCase();
  const prog=j.last_response&&j.last_response.progress;
  process.stdout.write(`#${i} ${st}/${lst} ${prog!=null?(prog*100|0)+'%':''}\n`);
  if (TERMINAL.has(st)||TERMINAL.has(lst)) break;
  await sleep(8000);
}
// fetch the character record → rotation_urls
const cr = await fetch(`https://api.pixellab.ai/v2/characters/${CHAR}`,{headers:H});
const c = await cr.json();
const urls = c.rotation_urls || {};
console.log('size', JSON.stringify(c.size), 'dirs', c.directions, 'mode', c.style_settings&&c.style_settings.generation_mode);
for (const [dir,url] of Object.entries(urls)){
  const resp = await fetch(url); const ab = await resp.arrayBuffer();
  const f = `${SDIR}/${PREFIX}_${dir}.png`;
  fs.writeFileSync(f, Buffer.from(ab));
  console.log('saved', f, Buffer.from(ab).length, 'b');
}
console.log('CHAR', CHAR);
