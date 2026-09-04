import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const htmlPath='dist/portal/client.html';
const integrityPath='dist/canonical-visual-integrity.json';
const sourceRuntimePath='assets/portal-runtime/portal-client-applications-uat-v2.js';
const runtimePath='dist/assets/portal-runtime/portal-client-applications-uat-v2.js';
const id='rona-portal-client-applications-uat-v2';
const marker='20260904-portal-client-applications-uat-v2';
const src='/assets/portal-runtime/portal-client-applications-uat-v2.js?v=20260904-title-price-resource-v2';
const sha256=b=>createHash('sha256').update(b).digest('hex');

const runtime=await readFile(sourceRuntimePath,'utf8');
if(!runtime.includes(marker))throw new Error(`PORTAL_CLIENT_APPLICATIONS_UAT_V2_MARKER_MISSING: ${marker}`);
if(!runtime.includes('applications-title-frame'))throw new Error('PORTAL_CLIENT_APPLICATIONS_UAT_V2_TITLE_FRAME_ALIGNMENT_MISSING');
if(!runtime.includes('application_price')||!runtime.includes('resource_status'))throw new Error('PORTAL_CLIENT_APPLICATIONS_UAT_V2_AUTHORITY_FIELDS_MISSING');
if(/<img|<svg|<canvas|background-image\s*:/iu.test(runtime))throw new Error('PORTAL_CLIENT_APPLICATIONS_UAT_V2_IMAGE_ASSET_FORBIDDEN');

await copyFile(sourceRuntimePath,runtimePath);
let html=await readFile(htmlPath,'utf8');
if(html.includes(id)||html.includes('portal-client-applications-uat-v2.js'))throw new Error('PORTAL_CLIENT_APPLICATIONS_UAT_V2_ALREADY_PRESENT');
const close=html.toLowerCase().lastIndexOf('</body>');
if(close<0)throw new Error('CLIENT_BODY_CLOSE_MISSING');
html=html.slice(0,close)+`<script id="${id}" src="${src}" defer></script>`+html.slice(close);
await writeFile(htmlPath,html,'utf8');

const integrity=JSON.parse(await readFile(integrityPath,'utf8'));
const emitted=Buffer.from(html,'utf8');
integrity.client_runtime.emitted_sha256=sha256(emitted);
integrity.client_runtime.emitted_bytes=emitted.length;
integrity.client_runtime.applications_uat_v2={
  id,
  src,
  marker,
  alignment:'PRIMARY_TITLE_FRAME',
  price:'SUBMITTED_APPLICATION_LINE_ACTUAL_PRICE',
  resource_status:['RESOURCE_NOT_CONFIRMED','RESOURCE_CONFIRMED'],
  source:'SERVER_AUTHORITATIVE_CLIENT_CONTEXT',
  images_added:false
};
await writeFile(integrityPath,JSON.stringify(integrity));
console.log(`PORTAL_CLIENT_APPLICATIONS_UAT_V2=PASS sha256=${integrity.client_runtime.emitted_sha256} bytes=${emitted.length}`);
