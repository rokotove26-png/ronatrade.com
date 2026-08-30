import { readFile, access } from 'node:fs/promises';

const runtime=await readFile('assets/portal-runtime/client-deal-lifecycle-v1.js','utf8');
const passport=await readFile('assets/portal-runtime/client-deal-passport-v1.js','utf8');
const backend=await readFile('supabase/functions/rona-client-deal-documents/index.ts','utf8');
const attach=await readFile('scripts/attach-client-deal-documents.mjs','utf8');
const resourceGuard=await readFile('supabase/migrations/20260830122500_deal_resource_authority_and_payment_prerequisite_v1.sql','utf8');
const legacyNormalization=await readFile('supabase/migrations/20260830122600_materialize_legacy_executing_resource_confirmations_v2.sql','utf8');

for(const required of [
  '20260831-client-deal-realization-status-v3-single-owner','Статус реализации','SERVER_AUTHORITATIVE_REALIZATION_V1',
  '/v1/client/deal-documents/state?clientId=','REFRESH_MS=7000','Требует решения',
  "const STAGE_ORDER=['contract','documents','resource','payment','logistics','close']",'function ensureFlow(root)',"ronaRealizationOwner='server-authoritative-v3'",
]) if(!runtime.includes(required))throw new Error(`REALIZATION_RUNTIME_REQUIRED_MISSING:${required}`);

for(const forbidden of ['function evidence(','function lifecycle(','cardTextOutside','resourceDone=','paymentPct=pctMatch','Статусы формируются из текущей карточки сделки'])
  if(runtime.includes(forbidden))throw new Error(`REALIZATION_BROWSER_INFERENCE_FORBIDDEN:${forbidden}`);

for(const required of ['20260831-client-deal-passport-v1','Паспорт сделки','passport-only','data-rona-command-field'])
  if(!passport.includes(required))throw new Error(`DEAL_PASSPORT_REQUIRED_MISSING:${required}`);
for(const forbidden of ['Схема реализации сделки','Контракт и сделка','function stageData(','function renderFlow(','rona-deal-flow-v3__grid','setInterval(schedule,2200)'])
  if(passport.includes(forbidden))throw new Error(`RETIRED_LOCAL_REALIZATION_RENDERER_REMAINS:${forbidden}`);

try{await access('assets/portal-runtime/client-deal-command-center-v3.js');throw new Error('RETIRED_COMMAND_CENTER_FILE_STILL_PRESENT')}catch(error){if(error?.message==='RETIRED_COMMAND_CENTER_FILE_STILL_PRESENT')throw error;if(error?.code!=='ENOENT')throw error}

for(const required of [
  'SERVER_AUTHORITATIVE_REALIZATION_V1','owner_deal_finance_summary','resource_decisions','portal_private.shipments','signed_supplement_document_key','accounting_closure_status',
  'Оплачено ${pct}% · осталось ${100-pct}%','Ресурс пока не подтверждён','Отгрузка ещё не начата',
]) if(!backend.includes(required))throw new Error(`REALIZATION_BACKEND_REQUIRED_MISSING:${required}`);

for(const required of ['resolve_deal_resource_state','RESOURCE_CONFIRMATION_REQUIRED_BEFORE_PAYMENT','RESOURCE_CONFIRMATION_REQUIRED_BEFORE_FINANCE_RECEIPT','EXECUTING alone is never treated as resource confirmation'])
  if(!resourceGuard.includes(required))throw new Error(`RESOURCE_AUTHORITY_GUARD_MISSING:${required}`);
for(const required of ['CANONICAL_LEGACY_RESOURCE_MATERIALIZATION','RESOURCE_CONFIRMATION_REQUIRED_BEFORE_EXECUTING',"d.source_system like 'SOURCE_FREEZE_V5%'"])
  if(!legacyNormalization.includes(required))throw new Error(`RESOURCE_LEGACY_NORMALIZATION_MISSING:${required}`);

for(const required of [
  "lifecycle_data_policy:'SERVER_AUTHORITATIVE_DEAL_STATE_ONLY'",'20260831-realization-single-owner-v3',"retired_local_realization_renderer:'PHYSICALLY_REMOVED'",'lifecycle_single_owner:true',
  'client-deal-passport-v1.js?v=20260831-passport-only-v1',
]) if(!attach.includes(required))throw new Error(`REALIZATION_INTEGRITY_POLICY_MISSING:${required}`);
if(attach.includes('client-deal-command-center-v3.js'))throw new Error('RETIRED_COMMAND_CENTER_REFERENCE_REMAINS_IN_ATTACH');

for(const forbidden of ['RONA-C003','DEAL-2026-004','DEAL-2026-005','DEAL-2026-006','FARGONA GAZ','UNIVERSAL SOLYARIS']){
  if(runtime.includes(forbidden)||passport.includes(forbidden)||backend.includes(forbidden)||resourceGuard.includes(forbidden)||legacyNormalization.includes(forbidden))throw new Error(`REALIZATION_HARDCODING_FORBIDDEN:${forbidden}`);
}
console.log('CLIENT_REALIZATION_STATUS_AUTHORITATIVE_QA=PASS single-owner=SERVER_AUTHORITATIVE_V3 retired-local-renderer=absent');
