import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const htmlPath='dist/portal/client.html';
const integrityPath='dist/canonical-visual-integrity.json';
const runtimePath='dist/assets/portal-runtime/client-context-selection-authority-v1.js';
const priceRuntimePath='dist/assets/portal-runtime/client-price-sync-v1.js';
const id='rona-client-context-selection-authority-v1';
const priceId='rona-client-price-sync-v1';
const sourceMarker='20260903-client-context-selection-authority-v4-header-current-context';
const marker='20260903-client-context-selection-authority-v5-generic-header-no-contract-download';
const priceMarker='20260902-authoritative-price-current-context-server-projection';
const sha256=b=>createHash('sha256').update(b).digest('hex');
function replaceOnce(source,from,to,label){if(!source.includes(from))throw new Error(`${label}_TARGET_MISSING`);if(source.indexOf(from)!==source.lastIndexOf(from))throw new Error(`${label}_TARGET_NOT_UNIQUE`);return source.replace(from,to)}

// Current-company KPI semantics are materialized in canonical source before build; do not rewrite dist.
let runtime=await readFile(runtimePath,'utf8');
if(!runtime.includes(marker)){
  if(!runtime.includes(sourceMarker))throw new Error(`CLIENT_CONTEXT_AUTHORITY_SOURCE_MARKER_MISSING: ${sourceMarker}`);
  runtime=runtime.replace(`const MARK='${sourceMarker}';`,`const MARK='${marker}';`);
}
const legacyRecordSource="function legacyCompatibilityRecord(){const ctx=state.selected,presented=projectionPresentation(ctx);return{clientId:norm(ctx?.client_id),company:presented?.legal_name||'',contractId:norm(ctx?.contract_id),contractNo:presented?.current_external_contract_number||'',contractDate:'',status:'',contractStateBlocked:false,applications:[],deals:[],documents:[],payments:[],closingStatus:'',closingRequirements:[],shipments:[],claims:[],actions:0}}";
const legacyProjectionBridge="function legacyDealId(v){return norm(v?.deal_id||v?.id)}function legacyNumber(v,max=3){const n=Number(v);return Number.isFinite(n)?new Intl.NumberFormat('ru-RU',{maximumFractionDigits:max}).format(n):''}function legacyProjectionDeals(){const data=projectionData();if(!data)return[];const apps=new Map((Array.isArray(data.applications)?data.applications:[]).map(app=>[legacyDealId(app),app]));return (Array.isArray(data.deals)?data.deals:[]).map(deal=>{const id=legacyDealId(deal),app=apps.get(id)||{},qty=legacyNumber(app.quantity_tonnes,3),price=legacyNumber(app.proposed_price,2),priceCurrency=norm(app.proposed_currency).toUpperCase(),amount=legacyNumber(deal.payment_obligation_amount,2),amountCurrency=norm(deal.payment_currency).toUpperCase(),status=norm(deal.current_status_label||deal.current_status||deal.business_status),resource=norm(deal.resource_status_label||deal.resource_label||deal.resource_status),next=norm(deal.next_action||deal.next_step)||'—';return{id,product:norm(app.product||deal.product),qty:qty?qty+' т':norm(deal.quantity||deal.qty),price:price?(priceCurrency?price+' '+priceCurrency+'/т':price):norm(deal.price),amount:amount?(amountCurrency?amount+' '+amountCurrency:amount):norm(deal.amount),basis:norm(app.delivery_basis||deal.delivery_basis||deal.basis),station:norm(app.destination||deal.destination||deal.station),resource,next,stage:status,status}}).filter(deal=>deal.id)}function legacyCompatibilityRecord(){const ctx=state.selected,presented=projectionPresentation(ctx),deals=legacyProjectionDeals();return{clientId:norm(ctx?.client_id),company:presented?.legal_name||'',contractId:norm(ctx?.contract_id),contractNo:presented?.current_external_contract_number||'',contractDate:'',status:'',contractStateBlocked:false,applications:[],deals,documents:[],payments:[],closingStatus:'',closingRequirements:[],shipments:[],claims:[],actions:0}}";
if(runtime.includes(legacyRecordSource))runtime=runtime.replace(legacyRecordSource,legacyProjectionBridge);
if(!runtime.includes('function legacyProjectionDeals()')||runtime.includes('applications:[],deals:[],documents:[]'))throw new Error('CLIENT_CONTEXT_NATIVE_DEAL_BRIDGE_TRANSFORM_FAILED');

const setSelectedSource="function setSelected(ctx,source,emit=true){const next=ctx?contextByIds(ctx.client_id,ctx.contract_id):null,before=key(state.selected),after=key(next);if(before!==after)clearCurrentSlots();state.selected=next;if(before!==after){invalidateProjection();syncAndRenderLegacyContext();if(next)primeProjection('client-context-selection-authority-v1:context-change')}exposeSelection();scheduleSync();if(emit&&before!==after)emitSelection(source);return next}";
const setSelectedRuntime="function closeLegacyTransientSurface(){try{if(typeof window.closeDrawer==='function')window.closeDrawer()}catch{}}function setSelected(ctx,source,emit=true){const next=ctx?contextByIds(ctx.client_id,ctx.contract_id):null,before=key(state.selected),after=key(next);if(before!==after){clearCurrentSlots();if(before)closeLegacyTransientSurface()}state.selected=next;if(before!==after){invalidateProjection();syncAndRenderLegacyContext();if(next)primeProjection('client-context-selection-authority-v1:context-change')}exposeSelection();scheduleSync();if(emit&&before!==after)emitSelection(source);return next}";
if(runtime.includes(setSelectedSource))runtime=runtime.replace(setSelectedSource,setSelectedRuntime);
if(!runtime.includes('function closeLegacyTransientSurface()'))throw new Error('CLIENT_CONTEXT_TRANSIENT_SURFACE_QUARANTINE_FAILED');
await writeFile(runtimePath,runtime,'utf8');

if(!runtime.includes(marker))throw new Error(`CLIENT_CONTEXT_AUTHORITY_MARKER_MISSING: ${marker}`);
if(!runtime.includes('/portal/api/v1/client/bootstrap')||!runtime.includes('CLIENT_CONTEXT_SELECTION_REQUIRED'))throw new Error('CLIENT_CONTEXT_AUTHORITY_SERVER_CONTRACT_MISSING');
for(const token of [
  'clientContextSelect','companyDisplayName','rona:client-context-changed','RONA_CLIENT_CONTEXT','getCurrentContext','getAuthorizedContexts','whenReady','subscribe',
  'scopedBootstrapResponse','normalizeHeaderTitle','purgeHeaderContractDownload','loadCurrentProjection','getCurrentProjection','getCallerMap','x-rona-client-source',
  'data-rona-current-context-slot','legacyContextScopes','bindLegacyScope','bindHeaderSlots','renderSlot','CURRENT_SLOT','legacyProjectionDeals','closeLegacyTransientSurface'
])if(!runtime.includes(token))throw new Error(`CLIENT_CONTEXT_AUTHORITY_SELECTION_CONTRACT_MISSING: ${token}`);
if(/RONA-C\d{3}|DEAL-2026-\d{3}|UNIVERSAL\s+SOLYARIS|FARG(?:[‘'ʼ])?ONA/iu.test(runtime))throw new Error('CLIENT_CONTEXT_AUTHORITY_HARDCODED_BUSINESS_ENTITY_FORBIDDEN');
for(const forbidden of [
  'staleHeaderNames','companyCandidate','syncContextScope','replace(CONTRACT_RE','replace(CLIENT_RE','ronaClientBaseText',
  "attributeFilter:['value','data-client-id','data-contract-id']","document.querySelectorAll('body *')"
])if(runtime.includes(forbidden))throw new Error(`CLIENT_CONTEXT_AUTHORITY_GLOBAL_TEXT_REWRITE_FORBIDDEN: ${forbidden}`);
if(!runtime.includes("state.observer.observe(document.body,{childList:true,subtree:true})"))throw new Error('CLIENT_CONTEXT_AUTHORITY_EVENT_SAFE_OBSERVER_MISSING');

const priceRuntime=await readFile(priceRuntimePath,'utf8');
for(const required of [priceMarker,'RONA_CLIENT_CONTEXT','/v1/client/prices?clientId=','client-price-sync-v1:prices','SERVER_AUTHORITATIVE_PRICE_PROJECTION','__RONA_CLIENT_PRICE_SYNC_STATE__']){
  if(!priceRuntime.includes(required))throw new Error(`CLIENT_PRICE_SYNC_CONTRACT_MISSING: ${required}`);
}
if(/RONA-C\d{3}|DEAL-2026-\d{3}|UNIVERSAL\s+SOLYARIS|FARG(?:[‘'ʼ])?ONA/iu.test(priceRuntime))throw new Error('CLIENT_PRICE_SYNC_HARDCODED_BUSINESS_ENTITY_FORBIDDEN');

const digest=sha256(Buffer.from(runtime,'utf8')).slice(0,16);
const priceDigest=sha256(Buffer.from(priceRuntime,'utf8')).slice(0,16);
const src=`/assets/portal-runtime/client-context-selection-authority-v1.js?v=${digest}`;
const priceSrc=`/assets/portal-runtime/client-price-sync-v1.js?v=${priceDigest}`;
let html=await readFile(htmlPath,'utf8');
if(html.includes(`id="${id}"`)||html.includes('client-context-selection-authority-v1.js'))throw new Error('CLIENT_CONTEXT_AUTHORITY_BRIDGE_ALREADY_PRESENT');
if(html.includes(`id="${priceId}"`)||html.includes('client-price-sync-v1.js'))throw new Error('CLIENT_PRICE_SYNC_BRIDGE_ALREADY_PRESENT');
const headClose=html.toLowerCase().lastIndexOf('</head>');
if(headClose<0)throw new Error('CLIENT_CONTEXT_AUTHORITY_HEAD_CLOSE_MISSING');
const bridge=`<script id="${id}" src="${src}" defer></script><script id="${priceId}" src="${priceSrc}" defer></script>`;
html=html.slice(0,headClose)+bridge+html.slice(headClose);
await writeFile(htmlPath,html,'utf8');

const emitted=Buffer.from(html,'utf8');
const integrity=JSON.parse(await readFile(integrityPath,'utf8'));
integrity.client_runtime=integrity.client_runtime||{};
integrity.client_runtime.emitted_sha256=sha256(emitted);
integrity.client_runtime.emitted_bytes=emitted.length;
integrity.client_runtime.context_selection_authority={
  id,src,marker,source:'SERVER_SESSION_AUTHORITY',scope:'ALL_AUTHORIZED_CLIENT_CABINETS',selection:'EXPLICIT_AUTHORIZED_CONTEXT_OR_SINGLE_AUTO',multi_context_first_fallback:false,
  api_rewrite:'SELECTED_AUTHORIZED_CONTEXT',bootstrap_projection:'SELECTED_CONTEXT_ONLY_OR_EMPTY_UNTIL_SELECTION',public_api:'RONA_CLIENT_CONTEXT',execution_order:'HEAD_DEFER_BEFORE_CLIENT_CONSUMERS',
  company_label:'COMPACT_LEGAL_DISPLAY',header_title:'GENERIC_CLIENT_CABINET',header_contract_download:false,legacy_context_zone:'EXPLICIT_SELECTED_CONTEXT_SLOTS',
  hardcoded_business_entities:false,initial_projection_owner:'RONA_CLIENT_CONTEXT',diagnostic_source_tags:true,self_exciting_attribute_observer:false,global_text_replacement:false,
  visual_context_binding:'CLIENT_ID_CONTRACT_ID_DIRECT_SLOT_RENDER',native_deal_bridge:'CURRENT_PROJECTION_TO_NATIVE_OPEN_DEAL_ONLY',transient_surface_policy:'CLOSE_NATIVE_DRAWER_SYNCHRONOUSLY_ON_CONTEXT_SWITCH',company_kpi_semantics:'CANONICAL_APPLICATIONS_LIVE_AND_DEALS_AUTHORITATIVE_PREDICATES'
};
integrity.client_runtime.price_sync={
  id:priceId,src:priceSrc,marker:priceMarker,scope:'CURRENT_AUTHORIZED_CLIENT_CONTEXT_ONLY',endpoint:'/portal/api/v1/client/prices',source:'client-price-sync-v1:prices',authority:'SERVER_AUTHORITATIVE_PRICE_PROJECTION',hardcoded_business_entities:false
};
await writeFile(integrityPath,JSON.stringify(integrity,null,2)+'\n','utf8');
console.log(`CLIENT_CONTEXT_SELECTION_AUTHORITY=PASS marker=${marker} asset=${src} order=head-defer-before-client-consumers header=generic contract-download=removed bootstrap=selected-only initial-projection=single-owner observer=child-list-only current-slots=direct native-deals=current-projection native-drawer-switch=close-sync global-text-replacement=false company-kpi=canonical-source-product-semantics`);
console.log(`CLIENT_PRICE_SYNC_ATTACH=PASS marker=${priceMarker} asset=${priceSrc} scope=CURRENT_AUTHORIZED_CLIENT_CONTEXT_ONLY`);
