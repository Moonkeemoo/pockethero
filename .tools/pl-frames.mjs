import fs from 'node:fs';
const KEY=fs.readFileSync('.pixellab.key','utf8').trim();
const H={Authorization:'Bearer '+KEY};
const TERM=new Set(['completed','complete','finished','succeeded','success','done','failed','error']);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const DIR='app/public/sprites'; fs.mkdirSync(DIR,{recursive:true});
const jobs=JSON.parse(process.argv[2]); // [{job,prefix}]
for(const {job,prefix} of jobs){
  let j;
  for(let i=0;i<45;i++){
    const r=await fetch(`https://api.pixellab.ai/v2/background-jobs/${job}`,{headers:H}); j=await r.json();
    const st=(j.status||'').toLowerCase();
    if(TERM.has(st)||TERM.has((j.last_response&&j.last_response.status||'').toLowerCase())) break;
    await sleep(8000);
  }
  const frames=(j.last_response&&j.last_response.storage_urls&&j.last_response.storage_urls.frames)||[];
  let k=0;
  for(const url of frames){ const rr=await fetch(url); const ab=await rr.arrayBuffer(); const f=`${DIR}/${prefix}_${k}.png`; fs.writeFileSync(f,Buffer.from(ab)); k++; }
  console.log(prefix, 'frames:', frames.length);
}
