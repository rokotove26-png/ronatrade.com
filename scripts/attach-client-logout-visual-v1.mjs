import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const htmlPath='dist/portal/client.html';
const integrityPath='dist/canonical-visual-integrity.json';
const runtimePath='dist/assets/portal-runtime/client-logout-visual-v1.js';
const id='rona-client-logout-visual-v1';
const src='/assets/portal-runtime/client-logout-visual-v1.js?v=20260830-force-red-v2';
const marker='20260830-client-logout-force-red-v2';
const sha256=b=>createHash('sha256').update(b).digest('hex');

const runtime=await readFile(runtimePath,'utf8');
if(!runtime.includes(marker))throw new Error(`CLIENT_LOGOUT_VISUAL_MARKER_MISSING: ${marker}`);
for(const required of ['justify-content:center!important','linear-gradient(110deg','ronaClientLogoutRedFlowV2','data-rona-logout-visual-v1',"style.setProperty(prop,value,'important')",'setInterval(()=>{if(document.visibilityState===\'visible\')apply()},1500)']){
  if(!runtime.includes(required))throw new Error(`CLIENT_LOGOUT_VISUAL_CONTRACT_MISSING: ${required}`);
}
if(/\/portal\/auth\/logout|fetch\s*\(/.test(runtime))throw new Error('CLIENT_LOGOUT_VISUAL_MUST_NOT_OWN_LOGOUT_BEHAVIOR');

let html=await readFile(htmlPath,'utf8');
if(html.includes(id)||html.includes('client-logout-visual-v1.js'))throw new Error('CLIENT_LOGOUT_VISUAL_ALREADY_PRESENT');
const close=html.toLowerCase().lastIndexOf('</body>');
if(close<0)throw new Error('CLIENT_BODY_CLOSE_MISSING');
const bridge=`<script id="${id}" src="${src}" defer></script>`;
html=html.slice(0,close)+bridge+html.slice(close);
await writeFile(htmlPath,html,'utf8');

const emitted=Buffer.from(html,'utf8');
const integrity=JSON.parse(await readFile(integrityPath,'utf8'));
integrity.client_runtime.emitted_sha256=sha256(emitted);
integrity.client_runtime.emitted_bytes=emitted.length;
integrity.client_runtime.logout_visual={
  id,
  src,
  marker,
  scope:'SINGLE_CANONICAL_CLIENT_LOGOUT_CONTROL',
  presentation:['CENTERED_LABEL','FORCED_RED_ANIMATED_GRADIENT','RED_GLOW','HOVER_BRIGHTEN'],
  enforcement:'INLINE_IMPORTANT_PLUS_SCOPED_STYLESHEET',
  layout_changed:false,
  logout_behavior_changed:false,
  business_logic_changed:false
};
await writeFile(integrityPath,JSON.stringify(integrity),'utf8');

if(!html.includes(`id="${id}"`)||!html.includes(src))throw new Error('CLIENT_LOGOUT_VISUAL_BRIDGE_MISSING_AFTER_WRITE');
console.log(`Client logout visual PASS: ${id} attached; forced red gradient + centered label; behavior unchanged.`);
