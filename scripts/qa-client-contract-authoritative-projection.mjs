import { readFile } from 'node:fs/promises';
import { brotliDecompressSync } from 'node:zlib';
import { strict as assert } from 'node:assert';
const read=path=>readFile(path,'utf8');
const runtime=await read('assets/portal-runtime/client-contract-download-v3.js');
const phase5d=await read('supabase/functions/rona-portal-api/phase5d.ts');
const router=await read('supabase/functions/rona-portal-api/index.ts');
const builtRuntime=await read('dist/assets/portal-runtime/client-contract-download-v3.js');
const builtClient=await read('dist/portal/client.html');
for(const marker of ['20260902-client-contract-v4-current-context-authority','20260829-client-contract-v3-authoritative-projection-v5','RONA_CLIENT_CONTEXT','authority.subscribe','/v1/client/context?clientId=','current_external_contract_number','legal_name','function hydrateFrozenClientModel',"typeof CLIENT_CONTEXTS!=='undefined'",'function currentContractDocument',"type(d)==='SIGNED_CONTRACT'&&materialized(d)",'new MutationObserver',"document.addEventListener('click',()=>scheduleRender(140),true)",'Скачать договор PDF','/v1/client/storage/','/signed-url','storage_object_id','Файл подписанного контракта не опубликован в кабинете'])assert(runtime.includes(marker),`runtime missing ${marker}`);
for(const forbidden of ['/v1/client/bootstrap','function selectedContextEntry','function hookContextSetter','01/РТ-01-1926','01/РТ-02-1926','01/PT-02-1926'])assert(!runtime.includes(forbidden),`runtime contains retired local authority ${forbidden}`);
assert(phase5d.includes('current_external_contract_number'),'client context must project external contract number');
assert(phase5d.includes("so.storage_state='VERIFIED'"),'client documents must require VERIFIED storage');
assert(router.includes('/v1/client/context'),'router must expose client context endpoint');
assert(router.includes('server_client_storage_object'),'signed-storage route must enforce server access gate');

function replaceExactOnce(source,from,to,label){
  assert(source.includes(from),`${label}: exact overlay target missing`);
  assert.equal(source.indexOf(from),source.lastIndexOf(from),`${label}: exact overlay target not unique`);
  return source.replace(from,to);
}
const pr431Helper="function allCompanyDirectoryActive(){const d=document.documentElement.dataset;return d.ronaClientCompanyDirectorySource==='AUTHORITATIVE_AUTHORIZED_CONTEXT_DIRECTORY_DB'&&d.ronaClientCompanyDirectoryDocumentsPredicate==='CURRENT_EFFECTIVE_CONTRACTUAL_ONLY'}";
let normalized=builtRuntime;
let pr431Overlay='ABSENT';
if(normalized.includes(pr431Helper)){
  normalized=replaceExactOnce(normalized,"window.addEventListener('rona:client-context-ready',()=>{primeFromAuthority(authority);refresh(true)});window.addEventListener('rona:client-context-changed',()=>{primeFromAuthority(authority);refresh(true)});window.addEventListener('rona:client-company-directory-ready',()=>scheduleRender(0));","window.addEventListener('rona:client-context-ready',()=>{primeFromAuthority(authority);refresh(true)});window.addEventListener('rona:client-context-changed',()=>{primeFromAuthority(authority);refresh(true)});",'PR431_V11_DIRECTORY_READY_STANDDOWN');
  normalized=replaceExactOnce(normalized,"function primeFromAuthority(authority){if(allCompanyDirectoryActive())return false;const current=authority?.getCurrentContext?.();return current?primeCompanyDirectory(current):false}","function primeFromAuthority(authority){const current=authority?.getCurrentContext?.();return current?primeCompanyDirectory(current):false}",'PR431_V11_PRIME_AUTHORITY_STANDDOWN');
  normalized=replaceExactOnce(normalized,"function render(){\n  if(state.rendering)return false;state.rendering=true;try{ensureStyle();if(allCompanyDirectoryActive()){document.documentElement.dataset.ronaClientContractRuntime='v11-standdown-all-authorized-directory';return true}const entry=state.entry;","function render(){\n  if(state.rendering)return false;state.rendering=true;try{ensureStyle();const entry=state.entry;",'PR431_V11_RENDER_STANDDOWN');
  normalized=replaceExactOnce(normalized,'function renderEntry(entry){\n  if(allCompanyDirectoryActive())return false;\n  const resolved=','function renderEntry(entry){\n  const resolved=','PR431_V11_ENTRY_STANDDOWN');
  normalized=replaceExactOnce(normalized,'function clearRuntimeButtons(entry){\n  if(allCompanyDirectoryActive())return 0;\n  for(const old','function clearRuntimeButtons(entry){\n  for(const old','PR431_V11_BUTTON_STANDDOWN');
  normalized=replaceExactOnce(normalized,'  if(!metrics.ready)return false;','  if(!metrics.ready)return neutralizeCompanyMetrics(resolved,ctx);','PR431_V11_NO_PENDING_NEUTRALIZE');
  normalized=replaceExactOnce(normalized,'function syncCompanyCard(entry,resolved){\n  if(allCompanyDirectoryActive()||!entry||!resolved)return false;','function syncCompanyCard(entry,resolved){\n  if(!entry||!resolved)return false;','PR431_V11_SYNC_STANDDOWN');
  normalized=replaceExactOnce(normalized,"  const sameReady=card.dataset.ronaCompanyDirectoryHydration==='ready'&&norm(card.dataset.ronaClientContractId)===norm(ctx.contract_id)&&norm(card.dataset.ronaClientId)===norm(ctx.client_id);\n  void sameReady;\n  bindCompanyOwner(resolved,ctx);return true;","  const sameReady=card.dataset.ronaCompanyDirectoryHydration==='ready'&&norm(card.dataset.ronaClientContractId)===norm(ctx.contract_id)&&norm(card.dataset.ronaClientId)===norm(ctx.client_id);\n  if(!sameReady&&!neutralizeCompanyMetrics(resolved,ctx))return false;\n  bindCompanyOwner(resolved,ctx);return true;",'PR431_V11_PRETAKEOVER_STABLE_SHELL');
  normalized=replaceExactOnce(normalized,'function primeCompanyDirectory(ctx){\n  if(!ctx||allCompanyDirectoryActive())return false;','function primeCompanyDirectory(ctx){\n  if(!ctx)return false;','PR431_V11_PRIME_STANDDOWN');
  normalized=replaceExactOnce(normalized,"function hydrateFrozenClientModel(entry){\n  if(allCompanyDirectoryActive())return 0;\n  const model=","function hydrateFrozenClientModel(entry){\n  const model=",'PR431_V11_FROZEN_MODEL_STANDDOWN');
  normalized=replaceExactOnce(normalized,"const TERMINAL_APPLICATIONS=new Set(['DEAL_REGISTERED','ARCHIVED','CANCELLED','REJECTED','CLOSED']);\n"+pr431Helper,"const TERMINAL_APPLICATIONS=new Set(['DEAL_REGISTERED','ARCHIVED','CANCELLED','REJECTED','CLOSED']);",'PR431_V11_DIRECTORY_ACTIVE_HELPER');
  pr431Overlay='EXACT_V11_STANDDOWN';
}

const issue432Marker="ISSUE432_CONTRACT_DIRECTORY_CENTRAL_PROJECTION_V1='ISSUE432_CONTRACT_DIRECTORY_CENTRAL_PROJECTION_V1'";
let issue432Overlay='ABSENT';
if(normalized.includes(issue432Marker)){
  const builtConst="const API='/portal/api',REFRESH_MS=30000,STYLE_ID='ronaClientContractDownloadV3Style',ISSUE432_CONTRACT_DIRECTORY_CENTRAL_PROJECTION_V1='ISSUE432_CONTRACT_DIRECTORY_CENTRAL_PROJECTION_V1';";
  const sourceConst="const API='/portal/api',REFRESH_MS=30000,STYLE_ID='ronaClientContractDownloadV3Style';";
  const builtRead="const projected=await authority.whenCurrentProjection('client-contract-download-v3');if(!projected)throw new Error('CLIENT_CONTEXT_PROJECTION_UNAVAILABLE');const detail={data:projected};";
  const sourceRead="const detail=await request('/v1/client/context?clientId='+encodeURIComponent(current.client_id)+'&contractId='+encodeURIComponent(current.contract_id));";
  assert(normalized.includes(builtConst),'Issue432 built contract marker must be exact');
  assert(normalized.includes(builtRead),'Issue432 built contract central projection read must be exact');
  assert(!normalized.includes('/v1/client/context?clientId='),'Issue432 built contract runtime must not own direct current-context fetch');
  normalized=replaceExactOnce(normalized,builtConst,sourceConst,'ISSUE432_CONTRACT_CONST');
  normalized=replaceExactOnce(normalized,builtRead,sourceRead,'ISSUE432_CONTRACT_CONTEXT_READ');
  issue432Overlay='EXACT_CENTRAL_PROJECTION';
}
assert.equal(normalized,runtime,'built contract runtime may differ from source only by exact Issue432 central projection plus exact PR431 v11 stand-down composition');

const srcs=[...builtClient.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)].map(m=>m[1]);
assert(srcs.some(src=>src.includes('client-contract-download-v3.js')),'build must load contract runtime');
const manifest=JSON.parse(await read('portal-src/current/client/manifest.json'));
const encoded=(await Promise.all(manifest.chunks.map(name=>read(`portal-src/current/client/${name}`)))).join('');
const frozen=brotliDecompressSync(Buffer.from(encoded,'base64')).toString('utf8');
for(const marker of ['id="clientContextSelect"','CLIENT_CONTEXTS','setClientContext','Номер уточняется','Контракт пока недоступен'])assert(frozen.includes(marker),`frozen Client bridge surface missing ${marker}`);
console.log(`CLIENT_CONTRACT_AUTHORITATIVE_PROJECTION=PASS context=RONA_CLIENT_CONTEXT scope=CURRENT_CONTEXT_ONLY issue432_overlay=${issue432Overlay} pr431_overlay=${pr431Overlay} composition=EXACT_ONLY`);
