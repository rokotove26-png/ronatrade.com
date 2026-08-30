import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const htmlPath='dist/portal/client.html';
const integrityPath='dist/canonical-visual-integrity.json';
const runtimePath='dist/assets/portal-runtime/client-home-night-panel-v4.js';
const id='rona-client-home-night-panel-v4';
const src='/assets/portal-runtime/client-home-night-panel-v4.js?v=20260830-night-cockpit-v4';
const marker='20260830-client-home-night-panel-v4';
const sha256=b=>createHash('sha256').update(b).digest('hex');

const runtime=await readFile(runtimePath,'utf8');
if(!runtime.includes(marker))throw new Error(`CLIENT_HOME_NIGHT_MARKER_MISSING: ${marker}`);
if(!runtime.includes('data-rona-home-night')||!runtime.includes('rona-night-left')||!runtime.includes('data-rona-night-empty'))throw new Error('CLIENT_HOME_NIGHT_REFLOW_CONTRACT_MISSING');
if(!runtime.includes('appendChild(finance)')||!runtime.includes('appendChild(control)'))throw new Error('CLIENT_HOME_NIGHT_GAP_REMOVAL_MISSING');
if(/RONA-C\d{3}|DEAL-2026-\d{3}|UNIVERSAL\s+SOLYARIS|FARGONA/iu.test(runtime))throw new Error('CLIENT_HOME_NIGHT_HARDCODED_BUSINESS_ENTITY_FORBIDDEN');
if(/<img|<svg|<canvas|background-image\s*:/iu.test(runtime))throw new Error('CLIENT_HOME_NIGHT_IMAGE_ASSET_FORBIDDEN');

let html=await readFile(htmlPath,'utf8');
if(html.includes(id)||html.includes('client-home-night-panel-v4.js'))throw new Error('CLIENT_HOME_NIGHT_BRIDGE_ALREADY_PRESENT');
if(!html.includes('client-home-command-center-v2.js')||!html.includes('client-home-tablet-visual-v3.js'))throw new Error('CLIENT_HOME_BASE_VISUAL_RUNTIME_MISSING');
const close=html.toLowerCase().lastIndexOf('</body>');
if(close<0)throw new Error('CLIENT_BODY_CLOSE_MISSING');
html=html.slice(0,close)+`<script id="${id}" src="${src}" defer></script>`+html.slice(close);
await writeFile(htmlPath,html,'utf8');

const emitted=Buffer.from(html,'utf8');
const integrity=JSON.parse(await readFile(integrityPath,'utf8'));
integrity.client_runtime.emitted_sha256=sha256(emitted);
integrity.client_runtime.emitted_bytes=emitted.length;
integrity.client_runtime.home_night_visual={id,src,marker,mode:'NIGHT_COCKPIT_VISUAL_V4',data_source:'UNCHANGED_SERVER_AUTHORITATIVE_HOME_V2',layout:'INDEPENDENT_LEFT_RIGHT_STACKS',gap_removal:'FINANCE_MOVED_BELOW_DEALS_AND_CONTROL_MOVED_BELOW_ACTIONS',visual_changes:['SOFT_EDGE_GLOW','STATUS_TONE_GLOW','INSTRUMENT_PANEL_DEPTH','FINANCE_TRACK_GLOW','STATIC_NO_BLINKING'],images_added:false,business_logic_changed:false,hardcoded_business_entities:false};
await writeFile(integrityPath,JSON.stringify(integrity));

console.log(`CLIENT_HOME_NIGHT_PANEL_V4=PASS sha256=${integrity.client_runtime.emitted_sha256} bytes=${emitted.length}`);
