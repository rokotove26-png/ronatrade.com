import { readFile } from 'node:fs/promises';
import { brotliDecompressSync } from 'node:zlib';

const manifest=JSON.parse(await readFile('portal-src/current/client/manifest.json','utf8'));
const encoded=(await Promise.all(manifest.chunks.map(n=>readFile('portal-src/current/client/'+n,'utf8')))).join('');
const source=brotliDecompressSync(Buffer.from(encoded,'base64')).toString('utf8');

const needles=[
  '/portal/api/v1/client/bootstrap',
  '/v1/client/bootstrap',
  'bootstrap',
  'XMLHttpRequest',
  'fetch(',
  'window.fetch',
  'RONA_CLIENT_CONTEXT',
  'DOMContentLoaded',
  'load',
  'admin_entity_preview',
  'read_only',
  'clientContextSelect',
  'data-rona-client-home-state'
];

console.log('CLIENT_SOURCE_BYTES',source.length);
for(const needle of needles){
  let i=0,count=0;
  while((i=source.indexOf(needle,i))>=0 && count<12){
    const a=Math.max(0,i-700),b=Math.min(source.length,i+1800);
    console.log('\n=== NEEDLE '+needle+' #'+(++count)+' @'+i+' ===\n'+source.slice(a,b).replace(/\s+/g,' '));
    i+=needle.length;
  }
  console.log('COUNT '+needle+' '+count);
}

const scripts=[...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
console.log('SCRIPT_TAG_COUNT',scripts.length);
scripts.slice(0,30).forEach((m,idx)=>{
  const body=m[1]||'';
  const net=/fetch\(|XMLHttpRequest|\/portal\/api|\/functions\/v1\/rona-portal-api|bootstrap/i.test(body);
  if(net) console.log('\n=== SCRIPT_NETWORK '+idx+' len='+body.length+' ===\n'+body.slice(0,6000).replace(/\s+/g,' '));
});

const externalScripts=[...source.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/gi)].map(m=>m[1]);
console.log('EXTERNAL_SCRIPT_SRCS',JSON.stringify(externalScripts));
const externalStyles=[...source.matchAll(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi)].map(m=>m[1]);
console.log('EXTERNAL_LINK_HREFS',JSON.stringify(externalStyles));
