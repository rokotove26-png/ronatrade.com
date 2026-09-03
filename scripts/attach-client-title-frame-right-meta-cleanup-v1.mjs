import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const htmlPath='dist/portal/client.html';
const integrityPath='dist/canonical-visual-integrity.json';
const runtimePath='dist/assets/portal-runtime/client-title-frame-right-meta-cleanup-v1.js';
const id='rona-client-title-frame-right-meta-cleanup-v1';
const marker='20260904-client-title-frame-right-meta-cleanup-v1';
const sha256=b=>createHash('sha256').update(b).digest('hex');

const runtime=await readFile(runtimePath,'utf8');
for(const token of [marker,'data-rona-title-frame-right-meta','findTitleFrame','hideRightMeta','MutationObserver']){
  if(!runtime.includes(token))throw new Error(`CLIENT_TITLE_FRAME_RIGHT_META_CONTRACT_MISSING: ${token}`);
}
if(/RONA-C\d{3}|DEAL-2026-\d{3}|UNIVERSAL\s+SOLYARIS|НИК[- ]?ОЙЛ/iu.test(runtime))throw new Error('CLIENT_TITLE_FRAME_RIGHT_META_HARDCODED_BUSINESS_ENTITY_FORBIDDEN');
if(/<img|<svg|<canvas|background-image\s*:/iu.test(runtime))throw new Error('CLIENT_TITLE_FRAME_RIGHT_META_IMAGE_ASSET_FORBIDDEN');

const digest=sha256(Buffer.from(runtime,'utf8'));
const src=`/assets/portal-runtime/client-title-frame-right-meta-cleanup-v1.js?v=${digest.slice(0,16)}`;
let html=await readFile(htmlPath,'utf8');
if(html.includes(`id="${id}"`)||html.includes('client-title-frame-right-meta-cleanup-v1.js'))throw new Error('CLIENT_TITLE_FRAME_RIGHT_META_BRIDGE_ALREADY_PRESENT');
const close=html.toLowerCase().lastIndexOf('</body>');
if(close<0)throw new Error('CLIENT_BODY_CLOSE_MISSING');
html=html.slice(0,close)+`<script id="${id}" src="${src}" defer></script>`+html.slice(close);
await writeFile(htmlPath,html,'utf8');

const emitted=Buffer.from(html,'utf8');
const integrity=JSON.parse(await readFile(integrityPath,'utf8'));
integrity.client_runtime=integrity.client_runtime||{};
integrity.client_runtime.emitted_sha256=sha256(emitted);
integrity.client_runtime.emitted_bytes=emitted.length;
integrity.client_runtime.title_frame_right_meta_cleanup={
  id,src,marker,
  scope:'ALL_CLIENT_SECTIONS',
  target:'RIGHT_SIDE_TEXT_INSIDE_PRIMARY_TITLE_FRAMES',
  interactive_controls_preserved:true,
  images_added:false,
  business_logic_changed:false,
  business_data_changed:false,
  hardcoded_business_entities:false
};
await writeFile(integrityPath,JSON.stringify(integrity));
console.log(`CLIENT_TITLE_FRAME_RIGHT_META_CLEANUP_V1=PASS marker=${marker} src=${src} sha256=${integrity.client_runtime.emitted_sha256} bytes=${emitted.length}`);
