import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const htmlPath='dist/portal/client.html';
const integrityPath='dist/canonical-visual-integrity.json';
const approvalPath='governance/client-portal-visual-freeze.json';
const sourceRuntimePath='assets/portal-runtime/portal-client-applications-canonical-v1.js';
const runtimePath='dist/assets/portal-runtime/portal-client-applications-canonical-v1.js';
const id='rona-portal-client-applications-canonical-v1';
const marker='20260904-portal-client-applications-canonical-v2-deal-visual-parity';
const src='/assets/portal-runtime/portal-client-applications-canonical-v1.js?v=20260904-deal-visual-parity-v2';
const sha256=b=>createHash('sha256').update(b).digest('hex');

const approval=JSON.parse(await readFile(approvalPath,'utf8'));
if(approval?.client_applications_live_render_correction?.authorized_source!=='OWNER_IN_CHAT')throw new Error('CLIENT_APPLICATIONS_OWNER_APPROVAL_MISSING');
const runtime=await readFile(sourceRuntimePath,'utf8');
for(const required of [
  marker,
  'applications-projection',
  'application_price',
  'resource_status',
  'Цена заявки',
  'Подтверждение ресурса',
  'applications-filter-frame',
  'data-rona-live-applications="canonical-v1"',
  'rona-live-app-summary',
  'rona-live-app-terms',
  'rona-live-app-state-strip',
  'grid-template-columns:minmax(0,1fr) auto auto',
  'flex-wrap:nowrap',
  'font-size:14px',
  'font-size:13.5px',
  'font:740 12.2px/1',
]){
  if(!runtime.includes(required))throw new Error(`CLIENT_APPLICATIONS_CANONICAL_REQUIRED_MISSING: ${required}`);
}
for(const forbidden of ['ACCEPT_PUBLISHED_PRICE','price_mode','Режим цены','portal-client-applications-uat-v2','portal-client-applications-uat-v3','rona-live-app-state-lines']){
  if(runtime.includes(forbidden))throw new Error(`CLIENT_APPLICATIONS_CANONICAL_FORBIDDEN_OUTPUT: ${forbidden}`);
}
if(/<img|<svg|<canvas|background-image\s*:/iu.test(runtime))throw new Error('CLIENT_APPLICATIONS_CANONICAL_IMAGE_ASSET_FORBIDDEN');

await copyFile(sourceRuntimePath,runtimePath);
let html=await readFile(htmlPath,'utf8');
for(const competing of ['rona-client-applications-live-render-v1','rona-client-applications-live-render-v2','rona-portal-client-applications-uat-v2','rona-portal-client-applications-uat-v3','client-applications-canonical-layout-v1.js']){
  if(html.includes(competing))throw new Error(`CLIENT_APPLICATIONS_COMPETING_RENDERER_PRESENT: ${competing}`);
}
if(html.includes(id)||html.includes('portal-client-applications-canonical-v1.js'))throw new Error('CLIENT_APPLICATIONS_CANONICAL_ALREADY_PRESENT');
const close=html.toLowerCase().lastIndexOf('</body>');
if(close<0)throw new Error('CLIENT_BODY_CLOSE_MISSING');
html=html.slice(0,close)+`<script id="${id}" src="${src}" defer></script>`+html.slice(close);
if((html.match(/portal-client-applications-canonical-v1\.js/g)||[]).length!==1)throw new Error('CLIENT_APPLICATIONS_CANONICAL_NOT_SINGLE_OWNER');
await writeFile(htmlPath,html,'utf8');

const integrity=JSON.parse(await readFile(integrityPath,'utf8'));
const emitted=Buffer.from(html,'utf8');
integrity.client_runtime.emitted_sha256=sha256(emitted);
integrity.client_runtime.emitted_bytes=emitted.length;
integrity.client_runtime.applications_live_render={
  id,src,marker,
  ownership:'SINGLE_RENDERER',
  source:'CLIENT_APPLICATIONS_AUTHORITATIVE_V1',
  endpoint:'/portal/api/v1/client/applications-projection',
  alignment:'APPLICATIONS_FILTER_FRAME',
  price:'IMMUTABLE_SUBMITTED_APPLICATION_PRICE',
  resource_status:['RESOURCE_NOT_CONFIRMED','RESOURCE_CONFIRMED'],
  internal_price_mode_visible:false,
  visual_context:'DEAL_CARD_VISUAL_PARITY',
  layout:'HEADLINE_PRICE_ACTION_TERMS_STATE_STRIP',
  status_layout:'SINGLE_LINE_INDICATOR_STRIP',
  typography:'DEAL_CARD_SCALE',
  competing_renderers:false,
  refresh_ms:30000,
  images_added:false
};
await writeFile(integrityPath,JSON.stringify(integrity));
console.log(`CLIENT_APPLICATIONS_CANONICAL=PASS sha256=${integrity.client_runtime.emitted_sha256} bytes=${emitted.length}; visual=DEAL_CARD_VISUAL_PARITY; status=SINGLE_LINE_INDICATOR_STRIP`);
