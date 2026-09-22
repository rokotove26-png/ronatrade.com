import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const htmlPath='dist/portal/client.html';
const integrityPath='dist/canonical-visual-integrity.json';
const runtimePath='dist/assets/portal-runtime/client-deals-authoritative-v1.js';
const scriptId='rona-client-deals-authoritative-v1';
const src='/assets/portal-runtime/client-deals-authoritative-v1.js?v=20260922-authoritative-v13-canonical-deal-state';
const marker='20260922-client-deals-authoritative-canonical-deal-state-v10';
const sha256=b=>createHash('sha256').update(b).digest('hex');

const runtime=await readFile(runtimePath,'utf8');
for(const required of [
  marker,'RONA_CLIENT_CONTEXT','getCurrentProjection','currentProjection','adoptCurrentProjection','rona:client-current-projection','RONA_CLIENT_CONTEXT_CURRENT_PROJECTION',
  '/v1/client/deal-state?clientId=','RONA_CLIENT_DEAL_STATE_V1','CLIENT_DEAL_STATE_V1',
  'data-rona-deals-authoritative-list','data-rona-deals-authoritative-rendered','data-rona-canonical-deal-id','data-open-deal',
  'classList.contains(\'active\')','function visible(','function canonicalIn(r,id)',
  'function openAuthoritativeDeal(id)','canonical-deal-state-v1-fresh-on-open','20260922-deal-state-v1-fresh-on-open','pending-canonical-deal-state','function canonicalStateValid(canonical,id,ctx)','function renderCanonicalContextSlots(r,canonical,ctx)','ronaResourceAuthority','function drawerFor(id,key)',
  'function contextMatchesPayload(data,ctx,deal)','function passportSlotsReady(r)','function clearDrawerBinding(drawer','function waitForExactDrawer(id,key,token',
  'ronaAuthoritativeClientId','ronaAuthoritativeContractId','deal-state-v1','unauthorized-deal','canonical-deal-state-binding','state.payload=projection',
  'data-rona-current-context-slot','deal_state:canonical'
]){
  if(!runtime.includes(required))throw new Error(`CLIENT_DEALS_AUTHORITATIVE_RENDER_CONTRACT_MISSING:${required}`);
}
for(const forbidden of [
  '/v1/client/context?clientId=','/v1/client/deal-documents/state?clientId=','whenCurrentProjection(\'deal-passport-open\')','invalidateCurrentProjection();const [freshProjection',
  'createElement(\'style\')','createElement("style")','insertRule(','<style','RONA-C004','DEAL-2026-007','DEAL-2026-008',
  'if(styled.length)return styled.sort','const suppressed=all.find(r=>r.dataset.ronaContextSuppressed)',
  "for(const h of exactLeafs(document,'Паспорт сделки'))",
  'function rewriteTextNodes','function exactLeafs','function fieldContainer','function setCompanyContext','function setLegal',
  'scheduleDrawerBind(id,null','return unbound.length===1','Синхронизация с сервером','SERVER_AUTHORITATIVE_REALIZATION_V1'
]){
  if(runtime.includes(forbidden))throw new Error(`CLIENT_DEALS_AUTHORITATIVE_RENDER_FORBIDDEN:${forbidden}`);
}

let html=await readFile(htmlPath,'utf8');
if(html.includes(`id="${scriptId}"`)||html.includes('client-deals-authoritative-v1.js'))throw new Error('CLIENT_DEALS_AUTHORITATIVE_RENDER_ALREADY_PRESENT');
const bodyClose=html.toLowerCase().lastIndexOf('</body>');
if(bodyClose<0)throw new Error('CLIENT_BODY_CLOSE_MISSING');
html=html.slice(0,bodyClose)+`<script id="${scriptId}" src="${src}" defer></script>`+html.slice(bodyClose);
if((html.match(/client-deals-authoritative-v1\.js/gu)||[]).length!==1)throw new Error('CLIENT_DEALS_AUTHORITATIVE_RENDER_NOT_SINGLE');
await writeFile(htmlPath,html,'utf8');

const integrity=JSON.parse(await readFile(integrityPath,'utf8'));
integrity.client_runtime.deals_authoritative_renderer={
  id:scriptId,src,marker,
  scope:'CURRENT_AUTHORIZED_CLIENT_CONTEXT_ACTIVE_DEALS_SECTION',
  source:'RONA_CLIENT_CONTEXT_CURRENT_PROJECTION',
  projection_network_owner:'RONA_CLIENT_CONTEXT',
  own_context_fetch:false,
  current_projection_adopted_on_open:false,
  passport_projection_freshness:'CANONICAL_DEAL_STATE_NO_STORE_ON_EVERY_OPEN',
  passport_projection_refresh_authority:'/v1/client/deal-state',
  current_projection_event_replaces_state_payload:false,
  detail_source:'RONA_CLIENT_DEAL_STATE_V1',
  detail_scope_key:'CLIENT_ID_CONTRACT_ID_DEAL_ID',
  role:'FUNCTIONAL_RENDER_AND_NATIVE_PASSPORT_BINDER_ONLY',
  visual_css_changed:false,
  canonical_visual_owner:'client-deal-canonical-visual-v2',
  native_passport_owner:'client-deal-passport-v1',
  active_root_required:true,
  stale_hidden_root_suppression:false,
  stale_detail_retention:false,
  strict_selected_deal_binding:true,
  fail_closed_drawer_binding:true,
  exact_visible_native_drawer_required:true,
  unbound_drawer_fallback:false,
  pre_workflow_bind:false,
  single_detail_endpoint:true,
  passport_field_binding:'EXPLICIT_PRODUCTION_FIELD_SLOTS_ONLY',
  passport_context_binding:'EXPLICIT_CURRENT_CONTEXT_SLOTS_ONLY',
  lifecycle_owner:'client-deal-lifecycle-v1',
  lifecycle_removed_by_binder:false,
  cross_context_drawer_reuse:false,
  authoritative_context_markers:['data-rona-authoritative-client-id','data-rona-authoritative-contract-id'],
  inferred_resource_confirmation_blocked:true,
  passport_resource_authority:'RONA_CLIENT_DEAL_STATE_V1',
  hardcoded_business_entities:false
};
const emitted=Buffer.from(html,'utf8');
integrity.client_runtime.emitted_sha256=sha256(emitted);
integrity.client_runtime.emitted_bytes=emitted.length;
await writeFile(integrityPath,JSON.stringify(integrity));
console.log(`CLIENT_DEALS_AUTHORITATIVE_RENDER=PASS marker=${marker}; active_root=true; cards=RONA_CLIENT_CONTEXT_CURRENT_PROJECTION; passport=RONA_CLIENT_DEAL_STATE_V1; passport-freshness=SINGLE_NO_STORE_DEAL_STATE_ON_EVERY_OPEN; exact_native_passport=true; lifecycle_owner=client-deal-lifecycle-v1; detail_scope=CLIENT_ID_CONTRACT_ID_DEAL_ID; visual_css_changed=false; sha256=${integrity.client_runtime.emitted_sha256}`);
