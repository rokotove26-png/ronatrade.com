import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const htmlPath='dist/portal/client.html';
const integrityPath='dist/canonical-visual-integrity.json';
const runtimePath='dist/assets/portal-runtime/client-deals-authoritative-v1.js';
const scriptId='rona-client-deals-authoritative-v1';
const src='/assets/portal-runtime/client-deals-authoritative-v1.js?v=20260905-authoritative-v8-fail-closed-drawer';
const marker='20260905-client-deals-authoritative-live-render-v8-fail-closed-drawer';
const sha256=b=>createHash('sha256').update(b).digest('hex');

const runtime=await readFile(runtimePath,'utf8');
for(const required of [
  marker,'RONA_CLIENT_CONTEXT','/v1/client/context?clientId=','/v1/client/deal-documents/state?clientId=',
  'data-rona-deals-authoritative-list','data-rona-deals-authoritative-rendered','data-rona-canonical-deal-id','data-open-deal',
  'authoritative-v8','classList.contains(\'active\')','function visible(','function canonicalIn(r,id)',
  'function openAuthoritativeDeal(id)','function effectiveResource(d)','function drawerFor(id,key)',
  'function contextMatchesPayload(data,ctx,deal)','ronaAuthoritativeClientId','ronaAuthoritativeContractId',
  'current-context-v8','unauthorized-deal','authoritative-binding'
]){
  if(!runtime.includes(required))throw new Error(`CLIENT_DEALS_AUTHORITATIVE_RENDER_CONTRACT_MISSING:${required}`);
}
for(const forbidden of [
  'createElement(\'style\')','createElement("style")','insertRule(','<style','RONA-C004','DEAL-2026-007','DEAL-2026-008',
  'if(styled.length)return styled.sort','const suppressed=all.find(r=>r.dataset.ronaContextSuppressed)',
  "for(const h of exactLeafs(document,'Паспорт сделки'))"
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
  source:'CLIENT_CONTEXT_API',
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
const emitted=Buffer.from(html,'utf8');
integrity.client_runtime.emitted_sha256=sha256(emitted);
integrity.client_runtime.emitted_bytes=emitted.length;
await writeFile(integrityPath,JSON.stringify(integrity));
console.log(`CLIENT_DEALS_AUTHORITATIVE_RENDER=PASS marker=${marker}; active_root=true; detail_scope=CLIENT_ID_CONTRACT_ID_DEAL_ID; fail_closed_drawer=true; cross_context_reuse=false; visual_css_changed=false; source=CLIENT_CONTEXT_API; sha256=${integrity.client_runtime.emitted_sha256}`);
