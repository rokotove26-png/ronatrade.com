import { readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const htmlPath='dist/portal/client.html';
const integrityPath='dist/canonical-visual-integrity.json';
const runtimePath='dist/assets/portal-runtime/client-home-current-only-v1.js';
const retiredRepoPath='assets/portal-runtime/client-home-authoritative-v1.js';
const retiredDistPath='dist/assets/portal-runtime/client-home-authoritative-v1.js';
const id='rona-client-home-current-only-v1';
const sha256=b=>createHash('sha256').update(b).digest('hex');
const exists=async p=>{try{await stat(p);return true}catch{return false}};

if(await exists(retiredRepoPath))throw new Error(`RETIRED_CLIENT_HOME_RUNTIME_PRESENT: ${retiredRepoPath}`);
if(await exists(retiredDistPath))throw new Error(`RETIRED_CLIENT_HOME_RUNTIME_DEPLOYED: ${retiredDistPath}`);

const runtime=await readFile(runtimePath,'utf8');
const markerMatch=runtime.match(/\bconst\s+MARK\s*=\s*(['"])([^'"]+)\1\s*;/);
if(!markerMatch)throw new Error('CLIENT_HOME_CURRENT_ONLY_MARKER_MISSING');
const marker=markerMatch[2];
if(!/^\d{8}-client-home-current-only-v1-[a-z0-9-]+$/i.test(marker))throw new Error(`CLIENT_HOME_CURRENT_ONLY_MARKER_INVALID: ${marker}`);
const runtimeDigest=sha256(Buffer.from(runtime,'utf8'));
const src=`/assets/portal-runtime/client-home-current-only-v1.js?v=${runtimeDigest.slice(0,16)}`;

for(const token of [
  'CURRENT_ONLY_PHYSICAL_V1',
  "legacy_dom:'PHYSICALLY_REMOVED'",
  "child.remove()",
  "stale.remove()",
  "hidden.remove()",
  "document.addEventListener('pointerdown',prepaint,true)",
  "removeAttribute('data-rona-client-home-ready')",
  'data-rona-client-home-current-only',
  'PREPAINT_MAX_MS=5000',
  "data-rona-client-home-prepaint','released",
  "'bounded-timeout'",
  'homeStateObserver.observe',
  'neutralizeOwner',
  'contextGeneration',
  'readyBelongsToCurrentGeneration',
  'currentProjectionConfirmed',
  "window.addEventListener('rona:client-context-changed'",
  "window.addEventListener('rona:client-current-projection'",
  'data-rona-client-home-degraded',
  "FIRST_PAINT_GUARD_ID='rona-client-home-first-paint-guard'",
  'setFirstPaintGuardEnabled',
  "guard.media=enabled?'all':'not all'",
  "first_paint_guard:'REUSABLE_FAIL_CLOSED_NEUTRAL'",
  'stale_business_visibility:false',
  'context_generation_guard:true',
  "observer_scope:'HOME_ROOT_ONLY'",
  'observer.observe(root,{childList:true,subtree:true})'
])if(!runtime.includes(token))throw new Error(`CLIENT_HOME_CURRENT_ONLY_CONTRACT_MISSING: ${token}`);
if(runtime.includes('stale-preserved'))throw new Error('CLIENT_HOME_STALE_PRESERVED_FORBIDDEN');
if(runtime.includes('observer.observe(document.body'))throw new Error('CLIENT_HOME_WHOLE_BODY_OBSERVER_FORBIDDEN');
if(runtime.includes("setAttribute('data-rona-home-legacy-hidden'"))throw new Error('CLIENT_HOME_CURRENT_ONLY_HIDE_ONLY_SANITATION_FORBIDDEN');
if(runtime.includes('guard.remove()')||runtime.includes('removeFirstPaintGuard'))throw new Error('CLIENT_HOME_CURRENT_ONLY_REUSABLE_GUARD_MUST_NOT_BE_REMOVED');
if(/RONA-C\d{3}|DEAL-2026-\d{3}|UNIVERSAL\s+SOLYARIS|FARGONA/iu.test(runtime))throw new Error('CLIENT_HOME_CURRENT_ONLY_HARDCODED_BUSINESS_ENTITY_FORBIDDEN');

let html=await readFile(htmlPath,'utf8');
for(const retired of ['client-home-authoritative-v1.js','data-rona-client-home-owner="authoritative-v1"','id="rona-client-home-authoritative-v1"']){
  if(html.includes(retired))throw new Error(`RETIRED_CLIENT_HOME_REFERENCE_EMITTED: ${retired}`);
}
if(!html.includes('id="rona-client-home-command-center-v2"'))throw new Error('CURRENT_CLIENT_HOME_OWNER_RUNTIME_MISSING');
if(!html.includes('id="rona-client-home-first-paint-guard"'))throw new Error('CURRENT_CLIENT_HOME_PREPAINT_GUARD_MISSING');
if(!html.includes('data-rona-client-home-prepaint="released"'))throw new Error('CURRENT_CLIENT_HOME_BOUNDED_GUARD_SELECTOR_MISSING');
if(html.includes(id)||html.includes('client-home-current-only-v1.js'))throw new Error('CLIENT_HOME_CURRENT_ONLY_BRIDGE_ALREADY_PRESENT');

const unsafeClockTick=`function tick(){const d=new Date();document.getElementById('clockTime').textContent=d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});document.getElementById('clockDate').textContent=d.toLocaleDateString('ru-RU',{day:'2-digit',month:'long',year:'numeric'});}tick();setInterval(tick,30000);`;
const safeClockTick=`function tick(){const d=new Date(),clockTime=document.getElementById('clockTime'),clockDate=document.getElementById('clockDate');if(clockTime)clockTime.textContent=d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});if(clockDate)clockDate.textContent=d.toLocaleDateString('ru-RU',{day:'2-digit',month:'long',year:'numeric'});}tick();setInterval(tick,30000);`;
if(html.includes(unsafeClockTick))html=html.replace(unsafeClockTick,safeClockTick);
else if(!html.includes(safeClockTick))throw new Error('CLIENT_HOME_LEGACY_CLOCK_COMPAT_TARGET_MISSING');

const close=html.toLowerCase().lastIndexOf('</body>');
if(close<0)throw new Error('CLIENT_BODY_CLOSE_MISSING');
html=html.slice(0,close)+`<script id="${id}" src="${src}" defer></script>`+html.slice(close);
await writeFile(htmlPath,html,'utf8');

const emitted=Buffer.from(html,'utf8');
const integrity=JSON.parse(await readFile(integrityPath,'utf8'));
integrity.client_runtime.emitted_sha256=sha256(emitted);
integrity.client_runtime.emitted_bytes=emitted.length;
integrity.client_runtime.home_current_only={
  id,src,marker,
  owner:'command-center-v2',
  mode:'PHYSICAL_CURRENT_ONLY_DOM_V1',
  legacy_dom:'PHYSICALLY_REMOVED',
  legacy_runtime_asset:'ABSENT',
  navigation_prepaint_reset:true,
  prepaint_rescue:{mode:'BOUNDED_REUSABLE_FAIL_CLOSED_NEUTRAL',max_block_ms:5000,release_on:['COMMAND_CENTER_READY_CURRENT_CONTEXT','COMMAND_CENTER_ERROR','TIMEOUT','SELECTION_REQUIRED'],canonical_fallback:false,neutral_fallback:true,reusable_guard:true,hard_release:'STYLE_MEDIA_NOT_ALL',rearm_on_navigation:true},
  degraded_error_owner:true,
  error_fallback:'CONTROLLED_NEUTRAL_STATE',
  stale_business_visibility:false,
  current_projection_required:true,
  context_generation_guard:true,
  observer_scope:'HOME_ROOT_ONLY',
  whole_body_observer:false,
  legacy_clock_tick:'NULL_SAFE_COMPAT',
  reinsertion_policy:'REMOVE_BEFORE_NEXT_PAINT',
  preserves:['HOME_TITLE_FRAME','HOME_CONTEXT_FRAME','COMMAND_CENTER_V2_OWNER','LOADED_HOME_VISUAL_CLASSES'],
  business_logic_changed:false,
  business_data_changed:false,
  hardcoded_business_entities:false
};
await writeFile(integrityPath,JSON.stringify(integrity));

console.log(`CLIENT_HOME_CURRENT_ONLY_V1=PASS marker=${marker} src=${src} sha256=${integrity.client_runtime.emitted_sha256} bytes=${emitted.length} stale_business_visibility=false context_generation_guard=true observer_scope=HOME_ROOT_ONLY`);