import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const htmlPath='dist/portal/client.html';
const integrityPath='dist/canonical-visual-integrity.json';
const runtimePath='dist/assets/portal-runtime/client-deals-authoritative-v1.js';
const drawerRuntimePath='dist/assets/portal-runtime/client-deal-drawer-lifecycle-v1.js';
const scriptId='rona-client-deals-authoritative-v1';
const drawerScriptId='rona-client-deal-drawer-lifecycle-v1';
const src='/assets/portal-runtime/client-deals-authoritative-v1.js?v=20260905-authoritative-v8-fail-closed-drawer';
const drawerSrc='/assets/portal-runtime/client-deal-drawer-lifecycle-v1.js?v=20260905-deterministic-close-v1';
const marker='20260905-client-deals-authoritative-live-render-v8-fail-closed-drawer';
const drawerMarker='20260905-client-deal-drawer-lifecycle-v1';
const sha256=b=>createHash('sha256').update(b).digest('hex');

const runtime=await readFile(runtimePath,'utf8');
for(const required of [
  marker,'RONA_CLIENT_CONTEXT','getCurrentProjection','currentProjection','adoptCurrentProjection','rona:client-current-projection','RONA_CLIENT_CONTEXT_CURRENT_PROJECTION',
  '/v1/client/deal-documents/state?clientId=',
  'data-rona-deals-authoritative-list','data-rona-deals-authoritative-rendered','data-rona-canonical-deal-id','data-open-deal',
  'authoritative-v8','classList.contains(\'active\')','function visible(','function canonicalIn(r,id)',
  'function openAuthoritativeDeal(id)','function effectiveResource(d)','function drawerFor(id,key)',
  'function contextMatchesPayload(data,ctx,deal)','ronaAuthoritativeClientId','ronaAuthoritativeContractId',
  'current-context-v8','unauthorized-deal','authoritative-binding','state.payload=projection'
]){
  if(!runtime.includes(required))throw new Error(`CLIENT_DEALS_AUTHORITATIVE_RENDER_CONTRACT_MISSING:${required}`);
}
for(const forbidden of [
  '/v1/client/context','createElement(\'style\')','createElement("style")','insertRule(','<style','RONA-C004','DEAL-2026-007','DEAL-2026-008',
  'if(styled.length)return styled.sort','const suppressed=all.find(r=>r.dataset.ronaContextSuppressed)',
  "for(const h of exactLeafs(document,'Паспорт сделки'))","whenCurrentProjection('","whenCurrentProjection(\""
]){
  if(runtime.includes(forbidden))throw new Error(`CLIENT_DEALS_AUTHORITATIVE_RENDER_FORBIDDEN:${forbidden}`);
}

const drawerRuntime=await readFile(drawerRuntimePath,'utf8');
for(const required of [drawerMarker,'rona:client:deal-authoritative-detail','function enforceSingleAuthoritative','function closeControl','function modalBackdropFor','user-control','backdrop','Escape']){
  if(!drawerRuntime.includes(required))throw new Error(`CLIENT_DEAL_DRAWER_LIFECYCLE_CONTRACT_MISSING:${required}`);
}
for(const forbidden of ['/v1/client/context','RONA-C004','DEAL-2026-007','DEAL-2026-008','FARGONA GAZ','FARG‘ONA GAZ','document.querySelectorAll(\'body *\')']){
  if(drawerRuntime.includes(forbidden))throw new Error(`CLIENT_DEAL_DRAWER_LIFECYCLE_FORBIDDEN:${forbidden}`);
}

let html=await readFile(htmlPath,'utf8');
if(html.includes(`id="${scriptId}"`)||html.includes('client-deals-authoritative-v1.js'))throw new Error('CLIENT_DEALS_AUTHORITATIVE_RENDER_ALREADY_PRESENT');
if(html.includes(`id="${drawerScriptId}"`)||html.includes('client-deal-drawer-lifecycle-v1.js'))throw new Error('CLIENT_DEAL_DRAWER_LIFECYCLE_ALREADY_PRESENT');
const bodyClose=html.toLowerCase().lastIndexOf('</body>');
if(bodyClose<0)throw new Error('CLIENT_BODY_CLOSE_MISSING');
const bridges=`<script id="${scriptId}" src="${src}" defer></script><script id="${drawerScriptId}" src="${drawerSrc}" defer></script>`;
html=html.slice(0,bodyClose)+bridges+html.slice(bodyClose);
if((html.match(/client-deals-authoritative-v1\.js/gu)||[]).length!==1)throw new Error('CLIENT_DEALS_AUTHORITATIVE_RENDER_NOT_SINGLE');
if((html.match(/client-deal-drawer-lifecycle-v1\.js/gu)||[]).length!==1)throw new Error('CLIENT_DEAL_DRAWER_LIFECYCLE_NOT_SINGLE');
await writeFile(htmlPath,html,'utf8');

const integrity=JSON.parse(await readFile(integrityPath,'utf8'));
integrity.client_runtime.deals_authoritative_renderer={
  id:scriptId,src,marker,
  scope:'CURRENT_AUTHORIZED_CLIENT_CONTEXT_ACTIVE_DEALS_SECTION',
  source:'RONA_CLIENT_CONTEXT_CURRENT_PROJECTION',
  projection_network_owner:'RONA_CLIENT_CONTEXT',
  own_context_fetch:false,
  current_projection_adopted_on_open:true,
  current_projection_event_replaces_state_payload:true,
  detail_source:'CURRENT_CONTEXT_PLUS_SERVER_AUTHORITATIVE_REALIZATION_V2',
  detail_scope_key:'CLIENT_ID_CONTRACT_ID_DEAL_ID',
  role:'FUNCTIONAL_RENDER_ONLY',
  visual_css_changed:false,
  canonical_visual_owner:'client-deal-canonical-visual-v2',
  active_root_required:true,
  stale_hidden_root_suppression:false,
  stale_detail_retention:false,
  strict_selected_deal_binding:true,
  fail_closed_drawer_binding:true,
  cross_context_drawer_reuse:false,
  authoritative_context_markers:['data-rona-authoritative-client-id','data-rona-authoritative-contract-id'],
  inferred_resource_confirmation_blocked:true,
  hardcoded_business_entities:false
};
integrity.client_runtime.deal_drawer_lifecycle={
  id:drawerScriptId,src:drawerSrc,marker:drawerMarker,
  scope:'AUTHORITATIVE_DEAL_DRAWER_UI_LIFECYCLE_ONLY',
  close_controls:['BACKDROP','X','CLOSE_TEXT','ESCAPE'],
  single_visible_drawer:true,
  authoritative_event:'rona:client:deal-authoritative-detail',
  business_data_changed:false,
  visual_css_changed:false,
  hardcoded_business_entities:false
};
const emitted=Buffer.from(html,'utf8');
integrity.client_runtime.emitted_sha256=sha256(emitted);
integrity.client_runtime.emitted_bytes=emitted.length;
await writeFile(integrityPath,JSON.stringify(integrity));
console.log(`CLIENT_DEALS_AUTHORITATIVE_RENDER=PASS marker=${marker}; active_root=true; source=RONA_CLIENT_CONTEXT_CURRENT_PROJECTION; own_context_fetch=false; projection_event_replaces_payload=true; detail_scope=CLIENT_ID_CONTRACT_ID_DEAL_ID; fail_closed_drawer=true; drawer_lifecycle=DETERMINISTIC_SINGLE_VISIBLE_CLOSE; visual_css_changed=false; sha256=${integrity.client_runtime.emitted_sha256}`);
