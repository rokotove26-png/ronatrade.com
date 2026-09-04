import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const htmlPath='dist/portal/client.html';
const integrityPath='dist/canonical-visual-integrity.json';
const sourceRuntimePath='assets/portal-runtime/client-applications-live-render-v1.js';
const runtimePath='dist/assets/portal-runtime/client-applications-live-render-v1.js';
const id='rona-client-applications-live-render-v1';
const marker='20260904-client-applications-live-render-v1-single-owner-uat';
const src='/assets/portal-runtime/client-applications-live-render-v1.js?v=20260904-single-owner-uat-v1';
const sha256=b=>createHash('sha256').update(b).digest('hex');

const runtime=await readFile(sourceRuntimePath,'utf8');
for(const required of [marker,'application_price','resource_status','Цена заявки','Подтверждение ресурса','applications-title-frame','data-rona-live-applications="v1"']){
  if(!runtime.includes(required))throw new Error(`CLIENT_APPLICATIONS_SINGLE_OWNER_REQUIRED_MARKER_MISSING: ${required}`);
}
for(const forbidden of ['ACCEPT_PUBLISHED_PRICE','price_mode','Режим цены','portal-client-applications-uat-v2','portal-client-applications-uat-v3']){
  if(runtime.includes(forbidden))throw new Error(`CLIENT_APPLICATIONS_SINGLE_OWNER_FORBIDDEN_OUTPUT: ${forbidden}`);
}
if(/<img|<svg|<canvas|background-image\s*:/iu.test(runtime))throw new Error('CLIENT_APPLICATIONS_SINGLE_OWNER_IMAGE_ASSET_FORBIDDEN');

await copyFile(sourceRuntimePath,runtimePath);
let html=await readFile(htmlPath,'utf8');
for(const forbidden of ['rona-portal-client-applications-uat-v2','rona-portal-client-applications-uat-v3','client-applications-live-render-v2.js','client-applications-canonical-layout-v1.js']){
  if(html.includes(forbidden))throw new Error(`CLIENT_APPLICATIONS_COMPETING_RENDERER_PRESENT: ${forbidden}`);
}
if(html.includes(id)||html.includes('client-applications-live-render-v1.js'))throw new Error('CLIENT_APPLICATIONS_SINGLE_OWNER_ALREADY_PRESENT');
const close=html.toLowerCase().lastIndexOf('</body>');
if(close<0)throw new Error('CLIENT_BODY_CLOSE_MISSING');
html=html.slice(0,close)+`<script id="${id}" src="${src}" defer></script>`+html.slice(close);
if((html.match(/client-applications-live-render-v1\.js/g)||[]).length!==1)throw new Error('CLIENT_APPLICATIONS_SINGLE_OWNER_NOT_SINGLE');
await writeFile(htmlPath,html,'utf8');

const integrity=JSON.parse(await readFile(integrityPath,'utf8'));
const emitted=Buffer.from(html,'utf8');
integrity.client_runtime.emitted_sha256=sha256(emitted);
integrity.client_runtime.emitted_bytes=emitted.length;
integrity.client_runtime.applications_live_render={
  id,
  src,
  marker,
  ownership:'SINGLE_RENDERER',
  source:'CURRENT_AUTHORIZED_CLIENT_CONTEXT',
  endpoint:'/portal/api/v1/client/context',
  alignment:'PRIMARY_APPLICATIONS_TITLE_FRAME',
  price:'ACTUAL_APPLICATION_PRICE',
  resource_status:['RESOURCE_NOT_CONFIRMED','RESOURCE_CONFIRMED'],
  internal_price_mode_visible:false,
  competing_renderers:false,
  refresh_ms:30000,
  startup:'IMMEDIATE_PLUS_FAST_RETRY',
  images_added:false
};
await writeFile(integrityPath,JSON.stringify(integrity));
console.log(`CLIENT_APPLICATIONS_LIVE_RENDER_SINGLE_OWNER=PASS sha256=${integrity.client_runtime.emitted_sha256} bytes=${emitted.length}`);
