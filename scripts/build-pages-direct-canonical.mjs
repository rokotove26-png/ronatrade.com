import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { brotliDecompressSync } from 'node:zlib';

const ROOT = process.cwd();
const OUT = join(ROOT, 'dist');
const STATIC_ENTRIES = ['assets', 'en', 'investments', 'pages', 'index.html', '_routes.json'];
const AGENT_SOURCE = Object.freeze({
  path: 'portal-src/canonical/RONA_Trade_Agent_Portal_v0_4_3_EDITOR_SECURITY_STATUS_TYPOGRAPHY_FINAL_CANDIDATE_20260812.html',
  sha256: '4fc9de4e561c4e55cbba9507b5eb1122f77d1efa990bef2fb6a957b2b135484c',
  out: 'agent.html',
});
const CLIENT_CURRENT = Object.freeze({
  state: 'CURRENT_ONLY',
  route: '/portal/client',
  source_dir: 'portal-src/current/client',
  chunks: ['payload.00','payload.01','payload.02','payload.03','payload.04','payload.05','payload.06','payload.07','payload.08','payload.09'],
  encoding: 'base64+brotli',
  sha256: '0d9158b3487e1f5bd6b034b541fe7446ff6262b33671c12e6a4d45f73c89677e',
  bytes: 493060,
  out: 'client.html',
  visual_transform: 'NONE',
  functional_transform: 'PRICE_APPLICATION_SUBMIT_V1',
  retired_runtime_sources: [
    'portal-src/canonical/RONA_Trade_Client_Portal_v1_5_14_SIGNED_CONTRACT_AUTHORITY_FINAL_FIX_CANDIDATE_20260812.html',
    'portal-src/canonical-transfer-v1_1/client_externalized.html',
    'portal-src/client.html',
    'functions/portal/client.js',
    'functions/portal/client-claims-ui.js',
    'functions/portal/main-ui.js',
    'functions/portal/deals-r1-ui.js',
    'functions/portal/owner-acceptance-ui.js',
  ],
});
const ADMIN_CURRENT = Object.freeze({
  path: 'portal-src/current/admin.html',
  out: 'admin.html',
  max_bytes: 60000,
  lifecycle: 'CURRENT_ONLY',
  retired_runtime_sources: [
    'portal-src/canonical/RONA_Trade_Admin_Portal_v3_4_13_BOOT_ERROR_LATCH_FINAL_CANDIDATE_20260812.html',
    'portal-src/canonical-transfer-v1_1/admin_externalized.html',
  ],
});
const AGENT_LIFECYCLE = Object.freeze({
  state: 'CURRENT_ONLY',
  version: '0.4.3',
  route: '/portal/agent',
  source_path: AGENT_SOURCE.path,
  source_sha256: AGENT_SOURCE.sha256,
  retired_runtime_sources: ['portal-src/agent.html'],
});
const ASSETS = Object.freeze({
  png: { path: 'portal-src/canonical/canonical_background.png', mime: 'image/png', bytes: 2627000, sha256: '9f0022d1651ddcf14fe2c6c66a4151b9074804f237c7b347793fd6cd20f505cc', out: 'background.png' },
  svg: { path: 'portal-src/canonical/canonical_logo.svg', mime: 'image/svg+xml', bytes: 336904, sha256: '755f13d3ba5c7b08a2538b72d3bcb8e0a6d5bb9b24ffde57cda7eca27762ac65', out: 'logo.svg' },
});
const FORBIDDEN_TOP_LEVEL = new Set(['README_FIRST.txt','RONA_Trade_PUBLIC_BILINGUAL_QA_REPORT_v1_0_1.md','SHA256SUMS.txt','SOURCE_VERSIONS.txt','functions','workers','scripts','portal-src','package.json','package-lock.json','node_modules']);
const FORBIDDEN_ADMIN_MARKERS = Object.freeze([
  'adminLoginGate',
  'rona-admin-auth-v3413',
  'Временный автономный вход',
  'admin_externalized',
  'v3.4.13',
  'BOOT_ERROR_LATCH_FINAL_CANDIDATE',
]);

const sha256 = b => createHash('sha256').update(b).digest('hex');
async function exists(p){ try { await stat(p); return true; } catch { return false; } }
async function walk(dir){ const out=[]; for(const e of await readdir(dir,{withFileTypes:true})){ const p=join(dir,e.name); if(e.isDirectory()) out.push(...await walk(p)); else out.push(p); } return out; }
function requireExact(label, bytes, expected){ const got=sha256(bytes); if(got!==expected) throw new Error(`${label} SHA-256 mismatch: ${got}`); }
function requireSize(label, bytes, expected){ if(bytes.length!==expected) throw new Error(`${label} byte mismatch: ${bytes.length}`); }

function applyClientFunctionalTransform(bytes){
  const source=bytes.toString('utf8');
  const disabled="document.getElementById('ronaOrderForm')?.addEventListener('submit',e=>{e.preventDefault();const draft=buildDraft();if(!draft){if(typeof toast==='function')toast('Проверьте обязательные поля заявки и текущий договорный контекст.');return}if(typeof toast==='function')toast('Заявка заполнена, но отправка пока недоступна.')});";
  const enabled=`let applicationSubmitState={signature:'',key:''};
 const applicationUuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 function applicationPeriod(value){const s=String(value||'').trim();let m=s.match(/(\\d{4}-\\d{2}-\\d{2})\\D+(\\d{4}-\\d{2}-\\d{2})/);if(m)return{from:m[1],to:m[2]};m=s.match(/(\\d{2})\\.(\\d{2})\\.(\\d{4})\\D+(\\d{2})\\.(\\d{2})\\.(\\d{4})/);if(m)return{from:m[3]+'-'+m[2]+'-'+m[1],to:m[6]+'-'+m[5]+'-'+m[4]};return null}
 function applicationDestination(offer,draft){const raw=String(offer?.namedPlace||offer?.basis||draft?.basis||'').trim();if(/Озинки/i.test(raw))return{country:'Россия',station:'Озинки'};if(/Наушки/i.test(raw))return{country:'Россия',station:'Наушки'};if(/Сарыагаш/i.test(raw))return{country:'Казахстан',station:'Сарыагаш'};return null}
 function applicationPublicationItemId(offer,draft){return[offer?.id,offer?.offerId,draft?.offer_id].map(x=>String(x||'').trim()).find(x=>applicationUuid.test(x))||''}
 function applicationKey(draft,itemId){const signature=[draft.client_id,draft.contract_id,draft.publication_id,itemId,draft.quantity_tons,draft.price_by_list?'LIST':'PROPOSED',draft.price_by_list?'':draft.proposed_price].join('|');if(applicationSubmitState.signature!==signature){const nonce=(window.crypto&&typeof window.crypto.randomUUID==='function')?window.crypto.randomUUID():String(Date.now())+'-'+Math.random().toString(36).slice(2);applicationSubmitState={signature,key:'PRICE-APP-'+nonce}}return applicationSubmitState.key}
 async function postApplicationComment(draft,applicationId,idempotencyKey){const comment=String(draft.comment||'').trim();if(!comment)return true;const key=idempotencyKey+'-COMMENT';const r=await fetch('/portal/api/v1/events',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'content-type':'application/json','accept':'application/json','x-idempotency-key':key},body:JSON.stringify({role:'CLIENT',event_type:'CLIENT_MESSAGE_SUBMIT',authority_domain:'APPLICATION',authority_target_type:'APPLICATION',authority_target_id:applicationId,client_id:draft.client_id,contract_id:draft.contract_id,payload:{application_id:applicationId,message_type:'APPLICATION_COMMENT',comment},idempotency_key:key})});const j=await r.json().catch(()=>null);return r.ok&&j?.ok===true}
 async function submitApplicationDraft(draft){const pub=currentPublication(),offer=findOffer(pub,draft.offer_id),itemId=applicationPublicationItemId(offer,draft),period=applicationPeriod(offer?.deliveryPeriod||draft.delivery_period),dest=applicationDestination(offer,draft);if(!itemId)throw new Error('PRICE_OFFER_ID_INVALID');if(!period)throw new Error('PRICE_PERIOD_INVALID');if(!dest)throw new Error('PRICE_DESTINATION_INVALID');const key=applicationKey(draft,itemId);const payload={clientId:draft.client_id,contractId:draft.contract_id,publicationItemId:itemId,quantityTonnes:draft.quantity_tons,priceMode:draft.price_by_list?'ACCEPT_PUBLISHED_PRICE':'CLIENT_PROPOSED_PRICE',proposedPrice:draft.price_by_list?null:draft.proposed_price,proposedCurrency:draft.price_by_list?null:draft.currency,destinationCountry:dest.country,destinationStation:dest.station,deliveryPeriodFrom:period.from,deliveryPeriodTo:period.to,idempotencyKey:key};const r=await fetch('/portal/api/v1/client/applications',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'content-type':'application/json','accept':'application/json','x-idempotency-key':key},body:JSON.stringify(payload)});const j=await r.json().catch(()=>null);if(!r.ok||j?.ok!==true)throw new Error(String(j?.code||j?.error?.code||'APPLICATION_SUBMIT_FAILED'));const app=j?.application||j?.data||{},id=String(app.application_id||app.applicationId||'').trim();if(!id)throw new Error('APPLICATION_ID_MISSING');const commentOk=await postApplicationComment(draft,id,key).catch(()=>false);applicationSubmitState={signature:'',key:''};return{id,status:String(app.status||'SUBMITTED'),commentOk}}
 document.getElementById('ronaOrderForm')?.addEventListener('submit',async e=>{e.preventDefault();const draft=buildDraft();if(!draft){if(typeof toast==='function')toast('Проверьте обязательные поля заявки и текущий договорный контекст.');return}const form=e.currentTarget,button=form?.querySelector('button[type="submit"]');if(button?.disabled)return;if(button)button.disabled=true;try{const result=await submitApplicationDraft(draft);close();if(typeof toast==='function')toast(result.commentOk?'Заявка '+result.id+' подана.':'Заявка '+result.id+' подана. Комментарий не передан.');window.dispatchEvent(new CustomEvent('rona:client-application-submitted',{detail:{applicationId:result.id,status:result.status}}))}catch(error){const code=String(error?.message||'');let message='Не удалось подать заявку. Обновите данные и повторите.';if(code==='PRICE_OFFER_ID_INVALID')message='Подача заявки недоступна: отсутствует ИД ценового предложения.';else if(code==='PRICE_PERIOD_INVALID')message='Подача заявки недоступна: период поставки не подтверждён.';else if(code==='PRICE_DESTINATION_INVALID')message='Подача заявки недоступна: пункт поставки не подтверждён.';if(typeof toast==='function')toast(message)}finally{if(button)button.disabled=false}});`;
  const count=source.split(disabled).length-1;
  if(count!==1) throw new Error(`CLIENT_APPLICATION_SUBMIT_PATCH_TARGET_COUNT:${count}`);
  const transformed=source.replace(disabled,enabled);
  for(const marker of ['/portal/api/v1/client/applications','ACCEPT_PUBLISHED_PRICE','CLIENT_PROPOSED_PRICE','publicationItemId','destinationCountry','deliveryPeriodFrom','CLIENT_MESSAGE_SUBMIT','rona:client-application-submitted']){
    if(!transformed.includes(marker)) throw new Error(`CLIENT_APPLICATION_SUBMIT_MARKER_MISSING:${marker}`);
  }
  if(transformed.includes('Заявка заполнена, но отправка пока недоступна.')) throw new Error('CLIENT_APPLICATION_SUBMIT_DISABLED_HANDLER_REMAINS');
  return Buffer.from(transformed,'utf8');
}

for(const retired of AGENT_LIFECYCLE.retired_runtime_sources){
  if(await exists(join(ROOT,...retired.split('/')))) throw new Error(`RETIRED_AGENT_RUNTIME_SOURCE_PRESENT: ${retired}`);
}
for(const retired of CLIENT_CURRENT.retired_runtime_sources){
  if(await exists(join(ROOT,...retired.split('/')))) throw new Error(`RETIRED_CLIENT_RUNTIME_SOURCE_PRESENT: ${retired}`);
}

const agentPath=join(ROOT,...AGENT_SOURCE.path.split('/'));
if(!(await exists(agentPath))) throw new Error(`CANONICAL_SOURCE_MISSING: ${AGENT_SOURCE.path}; substitutions are prohibited`);
const agentBytes=await readFile(agentPath);
requireExact('Frozen agent source',agentBytes,AGENT_SOURCE.sha256);

const clientChunkBytes=[];
for(const name of CLIENT_CURRENT.chunks){
  const p=join(ROOT,...CLIENT_CURRENT.source_dir.split('/'),name);
  if(!(await exists(p))) throw new Error(`CURRENT_CLIENT_CHUNK_MISSING: ${CLIENT_CURRENT.source_dir}/${name}`);
  clientChunkBytes.push(await readFile(p,'utf8'));
}
const clientEncoded=clientChunkBytes.join('');
let clientBytes;
try { clientBytes=brotliDecompressSync(Buffer.from(clientEncoded,'base64')); }
catch (error) { throw new Error(`CURRENT_CLIENT_DECODE_FAILED: ${error?.message||error}`); }
requireSize('Current client source',clientBytes,CLIENT_CURRENT.bytes);
requireExact('Current client source',clientBytes,CLIENT_CURRENT.sha256);
const clientOutputBytes=applyClientFunctionalTransform(clientBytes);

const adminPath=join(ROOT,...ADMIN_CURRENT.path.split('/'));
if(!(await exists(adminPath))) throw new Error(`CURRENT_ADMIN_SOURCE_MISSING: ${ADMIN_CURRENT.path}`);
const adminBytes=await readFile(adminPath);
if(adminBytes.length>ADMIN_CURRENT.max_bytes) throw new Error(`CURRENT_ADMIN_PAYLOAD_TOO_LARGE: ${adminBytes.length}`);
const adminText=adminBytes.toString('utf8');
for(const marker of FORBIDDEN_ADMIN_MARKERS) if(adminText.includes(marker)) throw new Error(`CURRENT_ADMIN_FORBIDDEN_LEGACY_MARKER: ${marker}`);
for(const required of ['rona-admin-shell" content="current-only-v2','data-rona-admin-shell="current-only-v2','id="nav"','id="page-home"','id="page-prices"','id="page-access"','id="page-claims"','portal-admin-shell-fast-v1.js','current-only-router-v2']) if(!adminText.includes(required)) throw new Error(`CURRENT_ADMIN_REQUIRED_MARKER_MISSING: ${required}`);

const assetBytes={};
for(const [kind,spec] of Object.entries(ASSETS)){
  const p=join(ROOT,...spec.path.split('/'));
  if(!(await exists(p))) throw new Error(`CANONICAL_ASSET_MISSING: ${spec.path}`);
  const bytes=await readFile(p);
  requireSize(`Canonical ${kind}`,bytes,spec.bytes);
  requireExact(`Canonical ${kind}`,bytes,spec.sha256);
  assetBytes[kind]=bytes;
}

await rm(OUT,{recursive:true,force:true});
await mkdir(OUT,{recursive:true});
for(const entry of STATIC_ENTRIES){ const src=join(ROOT,entry); if(!(await exists(src))) throw new Error(`Required public entry missing: ${entry}`); await cp(src,join(OUT,entry),{recursive:true,force:true}); }
await mkdir(join(OUT,'portal'),{recursive:true});
await mkdir(join(OUT,'assets','portal-canonical'),{recursive:true});
for(const [kind,spec] of Object.entries(ASSETS)) await writeFile(join(OUT,'assets','portal-canonical',spec.out),assetBytes[kind]);
await writeFile(join(OUT,'portal',ADMIN_CURRENT.out),adminBytes);
await writeFile(join(OUT,'portal',AGENT_SOURCE.out),agentBytes);
await writeFile(join(OUT,'portal',CLIENT_CURRENT.out),clientOutputBytes);

for(const [kind,spec] of Object.entries(ASSETS)){
  const emitted=await readFile(join(OUT,'assets','portal-canonical',spec.out));
  requireSize(`Emitted canonical ${kind}`,emitted,spec.bytes);
  requireExact(`Emitted canonical ${kind}`,emitted,spec.sha256);
}
const emittedAdmin=await readFile(join(OUT,'portal','admin.html'),'utf8');
for(const marker of FORBIDDEN_ADMIN_MARKERS) if(emittedAdmin.includes(marker)) throw new Error(`DEPLOYED_ADMIN_FORBIDDEN_LEGACY_MARKER: ${marker}`);
const emittedClient=await readFile(join(OUT,'portal',CLIENT_CURRENT.out));
requireSize('Emitted current client',emittedClient,clientOutputBytes.length);
requireExact('Emitted current client',emittedClient,sha256(clientOutputBytes));

const integrity={
  architecture:'CURRENT_ONLY_ADMIN_AND_CLIENT_WITH_FROZEN_CANONICAL_ASSETS',
  sources:{
    agent:{sha256:AGENT_SOURCE.sha256,bytes:agentBytes.length,path:AGENT_SOURCE.path},
    client:{sha256:CLIENT_CURRENT.sha256,bytes:clientBytes.length,path:CLIENT_CURRENT.source_dir,encoding:CLIENT_CURRENT.encoding},
  },
  admin_runtime:{
    state:ADMIN_CURRENT.lifecycle,
    source_path:ADMIN_CURRENT.path,
    source_sha256:sha256(adminBytes),
    emitted_bytes:adminBytes.length,
    max_bytes:ADMIN_CURRENT.max_bytes,
    legacy_runtime_in_deployment:false,
    retired_runtime_sources:ADMIN_CURRENT.retired_runtime_sources,
  },
  client_runtime:{
    state:CLIENT_CURRENT.state,
    route:CLIENT_CURRENT.route,
    source_dir:CLIENT_CURRENT.source_dir,
    source_sha256:CLIENT_CURRENT.sha256,
    source_bytes:CLIENT_CURRENT.bytes,
    emitted_sha256:sha256(clientOutputBytes),
    emitted_bytes:clientOutputBytes.length,
    visual_transform:CLIENT_CURRENT.visual_transform,
    functional_transform:CLIENT_CURRENT.functional_transform,
    legacy_runtime_in_deployment:false,
    retired_runtime_sources:CLIENT_CURRENT.retired_runtime_sources,
  },
  agent_lifecycle:AGENT_LIFECYCLE,
  canonical_assets:Object.fromEntries(Object.entries(ASSETS).map(([k,v])=>[k,{source_path:v.path,sha256:v.sha256,bytes:v.bytes,url:'/assets/portal-canonical/'+v.out}])),
  visual_transform:'ADMIN_REFERENCES_FROZEN_ASSETS; CLIENT_NONE',
  binary_repository_asset_required:true,
};
await writeFile(join(OUT,'canonical-visual-integrity.json'),JSON.stringify(integrity));
for(const name of FORBIDDEN_TOP_LEVEL) if(await exists(join(OUT,name))) throw new Error(`Forbidden deployment artifact detected: ${name}`);
const files=await walk(OUT);
for(const required of ['index.html','en/index.html','investments/index.html','en/investments/index.html','_routes.json','portal/admin.html','portal/agent.html','portal/client.html','assets/portal-canonical/background.png','assets/portal-canonical/logo.svg','canonical-visual-integrity.json']) if(!(await exists(join(OUT,...required.split('/'))))) throw new Error(`dist/${required} missing`);
console.log(`RONA direct build PASS: ${files.length} public files; Admin CURRENT_ONLY ${sha256(adminBytes)} (${adminBytes.length} bytes); Agent ${AGENT_SOURCE.sha256} CURRENT_ONLY; Client source CURRENT_ONLY ${CLIENT_CURRENT.sha256} (${CLIENT_CURRENT.bytes} bytes), emitted ${sha256(clientOutputBytes)} (${clientOutputBytes.length} bytes), functional transform ${CLIENT_CURRENT.functional_transform}, no legacy Client runtime, no Client visual transform; PNG ${ASSETS.png.sha256}/${ASSETS.png.bytes}; SVG ${ASSETS.svg.sha256}/${ASSETS.svg.bytes}.`);
