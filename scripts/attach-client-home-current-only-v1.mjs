import { readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const htmlPath='dist/portal/client.html';
const integrityPath='dist/canonical-visual-integrity.json';
const runtimePath='dist/assets/portal-runtime/client-home-current-only-v1.js';
const retiredRepoPath='assets/portal-runtime/client-home-authoritative-v1.js';
const retiredDistPath='dist/assets/portal-runtime/client-home-authoritative-v1.js';
const id='rona-client-home-current-only-v1';
const src='/assets/portal-runtime/client-home-current-only-v1.js?v=20260901-bounded-rescue-v1';
const marker='20260901-client-home-current-only-v1-bounded-rescue';
const sha256=b=>createHash('sha256').update(b).digest('hex');
const exists=async p=>{try{await stat(p);return true}catch{return false}};

if(await exists(retiredRepoPath))throw new Error(`RETIRED_CLIENT_HOME_RUNTIME_PRESENT: ${retiredRepoPath}`);
if(await exists(retiredDistPath))throw new Error(`RETIRED_CLIENT_HOME_RUNTIME_DEPLOYED: ${retiredDistPath}`);

const runtime=await readFile(runtimePath,'utf8');
for(const token of [
  marker,
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
  'homeStateObserver.observe'
])if(!runtime.includes(token))throw new Error(`CLIENT_HOME_CURRENT_ONLY_CONTRACT_MISSING: ${token}`);
if(runtime.includes("setAttribute('data-rona-home-legacy-hidden'"))throw new Error('CLIENT_HOME_CURRENT_ONLY_HIDE_ONLY_SANITATION_FORBIDDEN');
if(/RONA-C\d{3}|DEAL-2026-\d{3}|UNIVERSAL\s+SOLYARIS|FARGONA/iu.test(runtime))throw new Error('CLIENT_HOME_CURRENT_ONLY_HARDCODED_BUSINESS_ENTITY_FORBIDDEN');

let html=await readFile(htmlPath,'utf8');
for(const retired of ['client-home-authoritative-v1.js','data-rona-client-home-owner="authoritative-v1"','id="rona-client-home-authoritative-v1"']){
  if(html.includes(retired))throw new Error(`RETIRED_CLIENT_HOME_REFERENCE_EMITTED: ${retired}`);
}
if(!html.includes('id="rona-client-home-command-center-v2"'))throw new Error('CURRENT_CLIENT_HOME_OWNER_RUNTIME_MISSING');
if(!html.includes('id="rona-client-home-first-paint-guard"'))throw new Error('CURRENT_CLIENT_HOME_PREPAINT_GUARD_MISSING');
if(!html.includes('data-rona-client-home-prepaint="released"'))throw new Error('CURRENT_CLIENT_HOME_BOUNDED_GUARD_SELECTOR_MISSING');
if(html.includes(id)||html.includes('client-home-current-only-v1.js'))throw new Error('CLIENT_HOME_CURRENT_ONLY_BRIDGE_ALREADY_PRESENT');
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
  prepaint_rescue:{mode:'BOUNDED_FAIL_OPEN',max_block_ms:5000,release_on:['COMMAND_CENTER_READY','COMMAND_CENTER_ERROR','TIMEOUT'],canonical_fallback:true},
  reinsertion_policy:'REMOVE_BEFORE_NEXT_PAINT',
  preserves:['HOME_TITLE_FRAME','HOME_CONTEXT_FRAME','COMMAND_CENTER_V2_OWNER'],
  business_logic_changed:false,
  business_data_changed:false,
  hardcoded_business_entities:false
};
await writeFile(integrityPath,JSON.stringify(integrity));

console.log(`CLIENT_HOME_CURRENT_ONLY_V1=PASS sha256=${integrity.client_runtime.emitted_sha256} bytes=${emitted.length}`);