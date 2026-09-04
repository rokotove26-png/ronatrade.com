import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const htmlPath='dist/portal/client.html';
const integrityPath='dist/canonical-visual-integrity.json';
const sourceRuntimePath='assets/portal-runtime/client-applications-live-render-v1.js';
const runtimePath='dist/assets/portal-runtime/client-applications-live-render-v1.js';
const id='rona-client-applications-live-render-v1';
const marker='20260904-client-applications-live-render-v1';
const src='/assets/portal-runtime/client-applications-live-render-v1.js?v=20260904-live-authoritative-v1';
const sha256=b=>createHash('sha256').update(b).digest('hex');

const runtime=await readFile(sourceRuntimePath,'utf8');
if(!runtime.includes(marker))throw new Error(`CLIENT_APPLICATIONS_LIVE_RENDER_MARKER_MISSING: ${marker}`);
if(!runtime.includes('RONA_CLIENT_CONTEXT')||!runtime.includes('/v1/client/context?clientId='))throw new Error('CLIENT_APPLICATIONS_LIVE_RENDER_CURRENT_CONTEXT_SOURCE_MISSING');
if(runtime.includes('/v1/client/bootstrap'))throw new Error('CLIENT_APPLICATIONS_LIVE_RENDER_BOOTSTRAP_FORBIDDEN');
if(/RONA-C\d{3}|DEAL-2026-\d{3}|UNIVERSAL\s+SOLYARIS|FARGONA/iu.test(runtime))throw new Error('CLIENT_APPLICATIONS_LIVE_RENDER_HARDCODED_BUSINESS_ENTITY_FORBIDDEN');
if(/<img|<svg|<canvas|background-image\s*:/iu.test(runtime))throw new Error('CLIENT_APPLICATIONS_LIVE_RENDER_IMAGE_ASSET_FORBIDDEN');
if(!runtime.includes('data-rona-live-applications')||!runtime.includes('rona:client-application-submitted'))throw new Error('CLIENT_APPLICATIONS_LIVE_RENDER_CONTRACT_MISSING');

await copyFile(sourceRuntimePath,runtimePath);

let html=await readFile(htmlPath,'utf8');
if(html.includes(id)||html.includes('client-applications-live-render-v1.js'))throw new Error('CLIENT_APPLICATIONS_LIVE_RENDER_ALREADY_PRESENT');
const close=html.toLowerCase().lastIndexOf('</body>');
if(close<0)throw new Error('CLIENT_BODY_CLOSE_MISSING');
const bridge=`<script id="${id}" src="${src}" defer></script>`;
html=html.slice(0,close)+bridge+html.slice(close);
await writeFile(htmlPath,html,'utf8');

const integrity=JSON.parse(await readFile(integrityPath,'utf8'));
const emitted=Buffer.from(html,'utf8');
integrity.client_runtime.emitted_sha256=sha256(emitted);
integrity.client_runtime.emitted_bytes=emitted.length;
integrity.client_runtime.applications_live_render={
  id,
  src,
  marker,
  source:'CURRENT_AUTHORIZED_CLIENT_CONTEXT',
  endpoint:'/portal/api/v1/client/context',
  scope:'CURRENT_AUTHORIZED_CLIENT_CONTEXT',
  context_source:'RONA_CLIENT_CONTEXT_AUTHORITY',
  render_mode:'SERVER_APPLICATION_ROWS',
  terminal_application_policy:'HIDE_AFTER_TERMINAL_OR_LINKED_DEAL',
  refresh_ms:30000,
  submission_refresh:'EVENT_DRIVEN',
  filters:['SEARCH','STATUS'],
  interactive_details:true,
  hardcoded_business_entities:false,
  images_added:false
};
await writeFile(integrityPath,JSON.stringify(integrity));

console.log(`CLIENT_APPLICATIONS_LIVE_RENDER=PASS sha256=${integrity.client_runtime.emitted_sha256} bytes=${emitted.length}`);
