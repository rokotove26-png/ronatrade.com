import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {brotliDecompressSync} from 'node:zlib';

const root=process.cwd();
const dir=join(root,'portal-src/current/client');
const manifest=JSON.parse(readFileSync(join(dir,'manifest.json'),'utf8'));
assert.equal(manifest.schema,'RONA_CLIENT_CURRENT_CANONICAL/1.0');
assert.equal(manifest.encoding,'base64+brotli');
const encoded=manifest.chunks.map(name=>readFileSync(join(dir,name),'utf8')).join('');
const decoded=brotliDecompressSync(Buffer.from(encoded,'base64'));
const digest=createHash('sha256').update(decoded).digest('hex');
assert.equal(digest,manifest.sha256,'canonical Client payload SHA-256 must match manifest');
const html=decoded.toString('utf8');
console.log('CLIENT_CANONICAL_PAYLOAD_SHA256=PASS '+digest);
console.log('CLIENT_CANONICAL_PAYLOAD_BYTES='+decoded.length);

const markers=[
 'CLIENT_CONTEXT_PROJECTION_STALE_RESPONSE',
 'CLIENT_CONTEXT_CHANGED_DURING_PROJECTION',
 'CLIENT_CONTEXT_PROJECTION_SCOPE_MISMATCH',
 'payment_obligation_amount',
 'passport_amount',
 'client-context-selection-authority-v1.js?v=371d49966c2d406b'
];
for(const marker of markers){
 const positions=[];
 let start=0;
 while(positions.length<4){
  const i=html.indexOf(marker,start);
  if(i<0)break;
  positions.push(i);start=i+marker.length;
 }
 console.log('MARKER '+JSON.stringify(marker)+' count='+positions.length+(positions.length?' positions='+positions.join(','):''));
 for(const i of positions.slice(0,2)){
  const context=html.slice(Math.max(0,i-360),Math.min(html.length,i+600)).replace(/\s+/g,' ');
  console.log('CONTEXT '+JSON.stringify(marker)+' '+context);
 }
}
console.log('CHECKED_IN_CONTEXT_ASSET_CONTAINS_STALE_CODE='+readFileSync(join(root,'assets/portal-runtime/client-context-selection-authority-v1.js'),'utf8').includes('CLIENT_CONTEXT_PROJECTION_STALE_RESPONSE'));
