import { readFile, access } from 'node:fs/promises';

const runtime=await readFile('assets/portal-runtime/client-deal-lifecycle-v1.js','utf8');
const passport=await readFile('assets/portal-runtime/client-deal-passport-v1.js','utf8');
const deals=await readFile('assets/portal-runtime/client-deals-authoritative-v1.js','utf8');
const gateway=await readFile('supabase/functions/rona-portal-api-candidate-20260817/client-rail-isolated-runtime-v1.ts','utf8');
const projector=await readFile('supabase/functions/rona-portal-api-candidate-20260817/client-deal-state-v1.mjs','utf8');
const attach=await readFile('scripts/attach-client-deal-documents.mjs','utf8');
const resourceGuard=await readFile('supabase/migrations/20260830122500_deal_resource_authority_and_payment_prerequisite_v1.sql','utf8');
const legacyNormalization=await readFile('supabase/migrations/20260830122600_materialize_legacy_executing_resource_confirmations_v2.sql','utf8');

for(const required of [
  '20260922-client-deal-realization-status-v7-canonical-deal-state','Статус реализации','CLIENT_DEAL_STATE_V1','RONA_CLIENT_DEAL_STATE_V1',
  'RONA_CLIENT_CONTEXT','function currentContext()','authority.subscribe','function acceptCanonicalDetail(detail)','deal_state','Требует решения',
  "const STAGE_ORDER=['contract','documents','resource','payment','logistics','close']",'function ensureFlow(root)',"ronaRealizationOwner='client-deal-state-v1'",
  'data-rona-authoritative-deal-id','data-rona-authoritative-context','rootIsAuthoritative','contextKey(ctx)',
]) if(!runtime.includes(required))throw new Error(`REALIZATION_RUNTIME_REQUIRED_MISSING:${required}`);
for(const forbidden of ['/v1/client/deal-documents/state','/v1/client/bootstrap','async function getJson','fetch(','ctx.map(','REFRESH_MS=7000','setInterval(()=>refresh','setTimeout(()=>refresh'])
  if(runtime.includes(forbidden))throw new Error(`REALIZATION_PARALLEL_OR_PERIODIC_SOURCE_FORBIDDEN:${forbidden}`);

for(const forbidden of ['function evidence(','function lifecycle(','cardTextOutside','resourceDone=','paymentPct=pctMatch','Статусы формируются из текущей карточки сделки','[data-rona-command-heading]'])
  if(runtime.includes(forbidden))throw new Error(`REALIZATION_BROWSER_INFERENCE_FORBIDDEN:${forbidden}`);

for(const required of [
  '20260831-client-deal-passport-v2-centered-status','Паспорт сделки','passport-only','data-rona-command-field',
  '[data-rona-command-field="stage"]','[data-rona-command-field="resource"]','justify-content:center!important','align-items:center!important',
]) if(!passport.includes(required))throw new Error(`DEAL_PASSPORT_REQUIRED_MISSING:${required}`);
for(const forbidden of ['Схема реализации сделки','Контракт и сделка','function stageData(','function renderFlow(','rona-deal-flow-v3__grid','setInterval(schedule,2200)'])
  if(passport.includes(forbidden))throw new Error(`RETIRED_LOCAL_REALIZATION_RENDERER_REMAINS:${forbidden}`);

try{await access('assets/portal-runtime/client-deal-command-center-v3.js');throw new Error('RETIRED_COMMAND_CENTER_FILE_STILL_PRESENT')}catch(error){if(error?.message==='RETIRED_COMMAND_CENTER_FILE_STILL_PRESENT')throw error;if(error?.code!=='ENOENT')throw error}

for(const required of [
  "route==='/v1/client/deal-state'","proxy(req,'/v1/client/context'",'CLIENT_DEAL_STATE_CONTRACT','resolve_deal_resource_state','rona_rail_deal_map_read_model_core_v1',
  'signed_documents_confirmed','projectClientCanonicalDealState','CLIENT_DEAL_STATE_RAIL_OPTIONAL_UNAVAILABLE',
  'CLIENT_RAIL_ISOLATED_V1_PLUS_CANONICAL_DEAL_STATE_V1','x-rona-admin-impersonation-token'
]) if(!gateway.includes(required))throw new Error(`DEAL_STATE_GATEWAY_REQUIRED_MISSING:${required}`);
for(const required of [
  "CLIENT_DEAL_STATE_CONTRACT='RONA_CLIENT_DEAL_STATE_V1'","CLIENT_DEAL_LIFECYCLE_SOURCE='CLIENT_DEAL_STATE_V1'",
  "status='NOT_DUE';label='Срок оплаты ещё не наступил'","railDocuments.length>0||wagonPositions.length>0||actualPoints.length>0",
  "return'Отгрузка ещё не начата'","return'ЖД-данные появятся после начала отгрузки'","if(!rail.available)return'Актуальные ЖД-данные временно недоступны'",
  "current_stage_key:currentKey",'facts:{','payment,','rail'
]) if(!projector.includes(required))throw new Error(`DEAL_STATE_PROJECTOR_REQUIRED_MISSING:${required}`);

for(const required of ['resolve_deal_resource_state','RESOURCE_CONFIRMATION_REQUIRED_BEFORE_PAYMENT','RESOURCE_CONFIRMATION_REQUIRED_BEFORE_FINANCE_RECEIPT','EXECUTING alone is never treated as resource confirmation'])
  if(!resourceGuard.includes(required))throw new Error(`RESOURCE_AUTHORITY_GUARD_MISSING:${required}`);
for(const required of ['CANONICAL_LEGACY_RESOURCE_MATERIALIZATION','RESOURCE_CONFIRMATION_REQUIRED_BEFORE_EXECUTING',"d.source_system like 'SOURCE_FREEZE_V5%'"])
  if(!legacyNormalization.includes(required))throw new Error(`RESOURCE_LEGACY_NORMALIZATION_MISSING:${required}`);

for(const required of [
  "lifecycle_data_policy:'RONA_CLIENT_DEAL_STATE_V1_ONLY'",'20260922-canonical-deal-state-v7',"retired_local_realization_renderer:'PHYSICALLY_REMOVED'",'lifecycle_single_owner:true',"lifecycle_host_owner:'CLIENT_DEAL_STATE_V1'", "context_source:'RONA_CLIENT_CONTEXT_AUTHORITY'","lifecycle_refresh:'PASSPORT_OPEN_EVENT_ONLY'",
  'client-deal-passport-v1.js?v=20260831-status-center-v2',"passportMarker='20260831-client-deal-passport-v2-centered-status'",
]) if(!attach.includes(required))throw new Error(`REALIZATION_INTEGRITY_POLICY_MISSING:${required}`);
if(attach.includes('client-deal-command-center-v3.js'))throw new Error('RETIRED_COMMAND_CENTER_REFERENCE_REMAINS_IN_ATTACH');

for(const required of [
  '/v1/client/deal-state?clientId=','RONA_CLIENT_DEAL_STATE_V1','CLIENT_DEAL_STATE_V1','function canonicalStateValid(canonical,id,ctx)',
  'function renderCanonicalContextSlots(r,canonical,ctx)','canonical-deal-state-v1-fresh-on-open','deal_state:canonical',
  "resource=facts.resource||{}","setField(r,'next',next)"
]) if(!deals.includes(required))throw new Error(`PASSPORT_CANONICAL_DEAL_STATE_MISSING:${required}`);
const detailBlock=deals.slice(deals.indexOf('async function openAuthoritativeDeal'),deals.indexOf('function observeDealsRoot'));
for(const forbidden of ['/v1/client/deal-documents/state','invalidateCurrentProjection',"whenCurrentProjection('deal-passport-open')"])if(detailBlock.includes(forbidden))throw new Error(`PASSPORT_MULTISOURCE_DETAIL_FORBIDDEN:${forbidden}`);

for(const forbidden of ['RONA-C003','DEAL-2026-004','DEAL-2026-005','DEAL-2026-006','DEAL-2026-009','RONA-C005','FARGONA GAZ','UNIVERSAL SOLYARIS']){
  if(runtime.includes(forbidden)||passport.includes(forbidden)||deals.includes(forbidden)||gateway.includes(forbidden)||projector.includes(forbidden)||resourceGuard.includes(forbidden)||legacyNormalization.includes(forbidden))throw new Error(`REALIZATION_HARDCODING_FORBIDDEN:${forbidden}`);
}
console.log('CLIENT_REALIZATION_STATUS_AUTHORITATIVE_QA=PASS source=RONA_CLIENT_DEAL_STATE_V1 single-detail-endpoint=true payment=FINANCE_V7 rail=RAIL_V4 early-missing-facts=valid lifecycle-network-fetch=absent');
