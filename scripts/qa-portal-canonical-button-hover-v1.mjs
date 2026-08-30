import { readFile } from 'node:fs/promises';

const runtime=await readFile('dist/assets/portal-runtime/portal-canonical-button-hover-v1.js','utf8');
for(const token of ['20260830-portal-canonical-button-hover-v1','brightness(1.11)','drop-shadow(0 0 5px','prefers-reduced-motion']){
  if(!runtime.includes(token))throw new Error(`CANONICAL_BUTTON_HOVER_QA_RUNTIME_MISSING: ${token}`);
}
for(const [name,path] of [['admin','dist/portal/admin.html'],['client','dist/portal/client.html']]){
  const html=await readFile(path,'utf8');
  if(!html.includes('id="rona-portal-canonical-button-hover-v1"'))throw new Error(`CANONICAL_BUTTON_HOVER_QA_BRIDGE_MISSING: ${name}`);
  if(!html.includes('/assets/portal-runtime/portal-canonical-button-hover-v1.js?v=20260830-canonical-hover-v1'))throw new Error(`CANONICAL_BUTTON_HOVER_QA_SRC_MISSING: ${name}`);
}
const headers=await readFile('dist/_headers','utf8');
if(!headers.includes('/assets/portal-runtime/portal-canonical-button-hover-v1.js'))throw new Error('CANONICAL_BUTTON_HOVER_QA_CACHE_POLICY_MISSING');
console.log('PORTAL_CANONICAL_BUTTON_HOVER_QA=PASS admin+client hover brightness/glow canonical; presentation only');
