import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const htmlPath='dist/portal/client.html';
const integrityPath='dist/canonical-visual-integrity.json';
const runtimePath='dist/assets/portal-runtime/client-home-actions-polish-v1.js';
const id='rona-client-home-actions-polish-v1';
const marker='20260904-client-home-actions-polish-v1';
const sha256=b=>createHash('sha256').update(b).digest('hex');

const runtime=await readFile(runtimePath,'utf8');
if(!runtime.includes(marker))throw new Error(`CLIENT_HOME_ACTIONS_POLISH_MARKER_MISSING: ${marker}`);
for(const token of [
  'контур управления',
  'panel.remove()',
  'data-rona-actions-polished',
  'data-rona-action-ready',
  'sectionTrigger',
  'aria-disabled',
  ':focus-visible',
  "data-home-action=\"section\""
])if(!runtime.includes(token))throw new Error(`CLIENT_HOME_ACTIONS_POLISH_CONTRACT_MISSING: ${token}`);
if(/RONA-C\d{3}|DEAL-2026-\d{3}|UNIVERSAL\s+SOLYARIS|FARGONA/iu.test(runtime))throw new Error('CLIENT_HOME_ACTIONS_POLISH_HARDCODED_BUSINESS_ENTITY_FORBIDDEN');
if(/<img|<svg|<canvas|background-image\s*:/iu.test(runtime))throw new Error('CLIENT_HOME_ACTIONS_POLISH_IMAGE_ASSET_FORBIDDEN');

const digest=sha256(Buffer.from(runtime,'utf8'));
const src=`/assets/portal-runtime/client-home-actions-polish-v1.js?v=${digest.slice(0,16)}`;
let html=await readFile(htmlPath,'utf8');
if(html.includes(`id="${id}"`)||html.includes('client-home-actions-polish-v1.js'))throw new Error('CLIENT_HOME_ACTIONS_POLISH_BRIDGE_ALREADY_PRESENT');
if(!html.includes('client-home-command-center-v2.js')||!html.includes('client-home-night-panel-v4.js'))throw new Error('CLIENT_HOME_ACTIONS_POLISH_BASE_RUNTIME_MISSING');
const close=html.toLowerCase().lastIndexOf('</body>');
if(close<0)throw new Error('CLIENT_BODY_CLOSE_MISSING');
html=html.slice(0,close)+`<script id="${id}" src="${src}" defer></script>`+html.slice(close);
await writeFile(htmlPath,html,'utf8');

const emitted=Buffer.from(html,'utf8');
const integrity=JSON.parse(await readFile(integrityPath,'utf8'));
integrity.client_runtime=integrity.client_runtime||{};
integrity.client_runtime.emitted_sha256=sha256(emitted);
integrity.client_runtime.emitted_bytes=emitted.length;
integrity.client_runtime.home_actions_polish={
  id,src,marker,
  scope:'HOME_ONLY',
  control_contour:'PHYSICALLY_REMOVED',
  quick_actions:'POLISHED_REAL_SECTION_NAVIGATION',
  navigation_source:'EXISTING_CLIENT_SIDEBAR_CONTROLS',
  states:['DEFAULT','HOVER','ACTIVE','FOCUS_VISIBLE','DISABLED_IF_TARGET_ABSENT'],
  images_added:false,
  business_logic_changed:false,
  business_data_changed:false,
  hardcoded_business_entities:false
};
await writeFile(integrityPath,JSON.stringify(integrity));
console.log(`CLIENT_HOME_ACTIONS_POLISH_V1=PASS marker=${marker} src=${src} sha256=${integrity.client_runtime.emitted_sha256} bytes=${emitted.length}`);
