import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const runtimePath='dist/assets/portal-runtime/portal-canonical-button-hover-v1.js';
const targets=[
  {kind:'admin',path:'dist/portal/admin.html'},
  {kind:'client',path:'dist/portal/client.html'},
];
const id='rona-portal-canonical-button-hover-v1';
const src='/assets/portal-runtime/portal-canonical-button-hover-v1.js?v=20260830-canonical-hover-v1';
const marker='20260830-portal-canonical-button-hover-v1';
const sha256=b=>createHash('sha256').update(b).digest('hex');

const runtime=await readFile(runtimePath,'utf8');
for(const token of [marker,':hover','brightness(1.11)','drop-shadow','prefers-reduced-motion']){
  if(!runtime.includes(token))throw new Error(`CANONICAL_BUTTON_HOVER_RUNTIME_CONTRACT_MISSING: ${token}`);
}
if(/fetch\s*\(|XMLHttpRequest|location\.|history\.|localStorage|sessionStorage/.test(runtime))throw new Error('CANONICAL_BUTTON_HOVER_MUST_BE_PRESENTATION_ONLY');

const emitted={};
for(const target of targets){
  let html=await readFile(target.path,'utf8');
  if(html.includes(id)||html.includes('portal-canonical-button-hover-v1.js'))throw new Error(`CANONICAL_BUTTON_HOVER_ALREADY_PRESENT: ${target.kind}`);
  const close=html.toLowerCase().lastIndexOf('</body>');
  if(close<0)throw new Error(`CANONICAL_BUTTON_HOVER_BODY_CLOSE_MISSING: ${target.kind}`);
  const bridge=`<script id="${id}" src="${src}" defer></script>`;
  html=html.slice(0,close)+bridge+html.slice(close);
  await writeFile(target.path,html,'utf8');
  const bytes=Buffer.from(html,'utf8');
  emitted[target.kind]={sha256:sha256(bytes),bytes:bytes.length};
}

const integrityPath='dist/canonical-visual-integrity.json';
const integrity=JSON.parse(await readFile(integrityPath,'utf8'));
integrity.admin_runtime.emitted_sha256=emitted.admin.sha256;
integrity.admin_runtime.emitted_bytes=emitted.admin.bytes;
integrity.admin_runtime.canonical_button_hover={id,src,marker,scope:'ALL_ADMIN_BUTTON_CONTROLS',presentation_only:true};
integrity.client_runtime.emitted_sha256=emitted.client.sha256;
integrity.client_runtime.emitted_bytes=emitted.client.bytes;
integrity.client_runtime.canonical_button_hover={id,src,marker,scope:'ALL_CLIENT_BUTTON_CONTROLS',presentation_only:true};
integrity.canonical_button_hover={
  rule:'ON_HOVER_SLIGHTLY_INCREASE_BRIGHTNESS_AND_GLOW',
  portals:['admin','client'],
  disabled_controls_unchanged:true,
  business_logic_changed:false,
  navigation_changed:false,
};
await writeFile(integrityPath,JSON.stringify(integrity),'utf8');

for(const target of targets){
  const html=await readFile(target.path,'utf8');
  if(!html.includes(`id="${id}"`)||!html.includes(src))throw new Error(`CANONICAL_BUTTON_HOVER_BRIDGE_MISSING: ${target.kind}`);
}
console.log(`PORTAL_CANONICAL_BUTTON_HOVER=PASS admin=${emitted.admin.sha256}/${emitted.admin.bytes} client=${emitted.client.sha256}/${emitted.client.bytes}`);
