import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const htmlPath='dist/portal/client.html';
const integrityPath='dist/canonical-visual-integrity.json';
const runtimePath='dist/assets/portal-runtime/client-price-sync-v1.js';
const scriptId='rona-client-price-sync-v1';
const src='/assets/portal-runtime/client-price-sync-v1.js?v=20260905-current-context-runtime-owner';
const marker='20260902-authoritative-price-current-context-server-projection';
const sha256=b=>createHash('sha256').update(b).digest('hex');

const runtime=await readFile(runtimePath,'utf8');
for(const required of [marker,'RONA_CLIENT_CONTEXT','/v1/client/prices?clientId=','client-price-sync-v1:prices','SERVER_AUTHORITATIVE_PRICE_PROJECTION','__RONA_CLIENT_PRICE_SYNC_STATE__']){
  if(!runtime.includes(required))throw new Error(`CLIENT_PRICE_SYNC_CONTRACT_MISSING:${required}`);
}
for(const forbidden of ['RONA-C004','DEAL-2026-007','DEAL-2026-008']){
  if(runtime.includes(forbidden))throw new Error(`CLIENT_PRICE_SYNC_FORBIDDEN:${forbidden}`);
}
let html=await readFile(htmlPath,'utf8');
if(html.includes(`id="${scriptId}"`)||html.includes('client-price-sync-v1.js'))throw new Error('CLIENT_PRICE_SYNC_ALREADY_PRESENT');
const bodyClose=html.toLowerCase().lastIndexOf('</body>');
if(bodyClose<0)throw new Error('CLIENT_BODY_CLOSE_MISSING');
html=html.slice(0,bodyClose)+`<script id="${scriptId}" src="${src}" defer></script>`+html.slice(bodyClose);
await writeFile(htmlPath,html,'utf8');
const integrity=JSON.parse(await readFile(integrityPath,'utf8'));
integrity.client_runtime.price_sync={id:scriptId,src,marker,scope:'CURRENT_AUTHORIZED_CLIENT_CONTEXT_ONLY',endpoint:'/portal/api/v1/client/prices',source:'client-price-sync-v1:prices',authority:'SERVER_AUTHORITATIVE_PRICE_PROJECTION',hardcoded_business_entities:false};
const emitted=Buffer.from(html,'utf8');
integrity.client_runtime.emitted_sha256=sha256(emitted);
integrity.client_runtime.emitted_bytes=emitted.length;
await writeFile(integrityPath,JSON.stringify(integrity));
console.log(`CLIENT_PRICE_SYNC=PASS marker=${marker}; endpoint=/portal/api/v1/client/prices; source=client-price-sync-v1:prices; sha256=${integrity.client_runtime.emitted_sha256}`);
