import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = process.cwd();
const EXPECT = {
  png: { sha256: '9f0022d1651ddcf14fe2c6c66a4151b9074804f237c7b347793fd6cd20f505cc', bytes: 2627000 },
  svg: { sha256: '755f13d3ba5c7b08a2538b72d3bcb8e0a6d5bb9b24ffde57cda7eca27762ac65', bytes: 336904 },
};
const skipDirs = new Set(['.git','node_modules','dist']);
function sha256(b){ return createHash('sha256').update(b).digest('hex'); }
async function walk(dir){
  const out=[];
  for(const e of await readdir(dir,{withFileTypes:true})){
    if(e.isDirectory() && skipDirs.has(e.name)) continue;
    const p=join(dir,e.name);
    if(e.isDirectory()) out.push(...await walk(p)); else out.push(p);
  }
  return out;
}
const files=await walk(ROOT);
const found={png:[],svg:[]};
for(const p of files){
  let b; try{ b=await readFile(p); }catch{ continue; }
  const h=sha256(b);
  for(const [k,v] of Object.entries(EXPECT)) if(b.length===v.bytes && h===v.sha256) found[k].push({kind:'file',path:relative(ROOT,p)});
  if(b.length > 20_000_000) continue;
  const s=b.toString('utf8');
  const specs=[['png','image/png'],['svg','image/svg+xml']];
  for(const [k,mime] of specs){
    const needle=`data:${mime};base64,`;
    let pos=0;
    while((pos=s.indexOf(needle,pos))>=0){
      const start=pos+needle.length;
      let end=start;
      while(end<s.length && /[A-Za-z0-9+/=]/.test(s[end])) end++;
      if(end>start){
        try{
          const raw=Buffer.from(s.slice(start,end),'base64');
          if(raw.length===EXPECT[k].bytes && sha256(raw)===EXPECT[k].sha256) found[k].push({kind:'data-uri',path:relative(ROOT,p),offset:pos});
        }catch{}
      }
      pos=Math.max(end,pos+needle.length);
    }
  }
}
console.log(JSON.stringify({found,expected:EXPECT},null,2));
if(!found.png.length || !found.svg.length){
  console.error(`CANONICAL_ASSET_SCAN_HOLD png=${found.png.length} svg=${found.svg.length}`);
  process.exit(2);
}
console.log(`CANONICAL_ASSET_SCAN_PASS png=${found.png.length} svg=${found.svg.length}`);
