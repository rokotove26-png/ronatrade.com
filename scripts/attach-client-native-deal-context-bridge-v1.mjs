import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const htmlPath='dist/portal/client.html';
const integrityPath='dist/canonical-visual-integrity.json';
const runtimePath='dist/assets/portal-runtime/client-native-deal-context-bridge-v1.js';
const scriptId='rona-client-native-deal-context-bridge-v1';
const src='/assets/portal-runtime/client-native-deal-context-bridge-v1.js?v=20260905-current-context-native-passport';
const marker='20260905-client-native-deal-context-bridge-v1';
const sha256=b=>createHash('sha256').update(b).digest('hex');

const runtime=await readFile(runtimePath,'utf8');
for(const required of [marker,'RONA_CLIENT_CONTEXT','getCurrentProjection','activeClientContext','record.deals=deals','rona:client-current-projection','rona:client-context-changed']){
  if(!runtime.includes(required))throw new Error(`CLIENT_NATIVE_DEAL_CONTEXT_BRIDGE_CONTRACT_MISSING:${required}`);
}
for(const forbidden of ['openDrawer(','createElement(\'dialog\')','createElement("dialog")','RONA-C004','DEAL-2026-007','DEAL-2026-008']){
  if(runtime.includes(forbidden))throw new Error(`CLIENT_NATIVE_DEAL_CONTEXT_BRIDGE_FORBIDDEN:${forbidden}`);
}
let html=await readFile(htmlPath,'utf8');
if(html.includes(`id="${scriptId}"`)||html.includes('client-native-deal-context-bridge-v1.js'))throw new Error('CLIENT_NATIVE_DEAL_CONTEXT_BRIDGE_ALREADY_PRESENT');
const bodyClose=html.toLowerCase().lastIndexOf('</body>');
if(bodyClose<0)throw new Error('CLIENT_BODY_CLOSE_MISSING');
html=html.slice(0,bodyClose)+`<script id="${scriptId}" src="${src}" defer></script>`+html.slice(bodyClose);
await writeFile(htmlPath,html,'utf8');
const integrity=JSON.parse(await readFile(integrityPath,'utf8'));
integrity.client_runtime.native_deal_context_bridge={id:scriptId,src,marker,scope:'CURRENT_AUTHORIZED_CLIENT_CONTEXT_ONLY',projection_source:'RONA_CLIENT_CONTEXT_CURRENT_PROJECTION',native_drawer_owner:'LEGACY_OPEN_DEAL_OPEN_DRAWER',creates_drawer:false,hardcoded_business_entities:false};
const emitted=Buffer.from(html,'utf8');
integrity.client_runtime.emitted_sha256=sha256(emitted);
integrity.client_runtime.emitted_bytes=emitted.length;
await writeFile(integrityPath,JSON.stringify(integrity));
console.log(`CLIENT_NATIVE_DEAL_CONTEXT_BRIDGE=PASS marker=${marker}; scope=CURRENT_AUTHORIZED_CLIENT_CONTEXT_ONLY; creates_drawer=false; sha256=${integrity.client_runtime.emitted_sha256}`);
