import { readFile } from 'node:fs/promises';

const runtime=await readFile('assets/portal-runtime/client-deal-lifecycle-v1.js','utf8');
const backend=await readFile('supabase/functions/rona-client-deal-documents/index.ts','utf8');
const attach=await readFile('scripts/attach-client-deal-documents.mjs','utf8');

for(const required of [
  '20260830-client-deal-realization-status-v2-server-authoritative',
  'Статус реализации',
  'SERVER_AUTHORITATIVE_REALIZATION_V1',
  '/v1/client/deal-documents/state?clientId=',
  'REFRESH_MS=7000',
  'Требует решения',
]) if(!runtime.includes(required))throw new Error(`REALIZATION_RUNTIME_REQUIRED_MISSING:${required}`);

for(const forbidden of ['function evidence(','function lifecycle(','cardTextOutside','resourceDone=','paymentPct=pctMatch'])
  if(runtime.includes(forbidden))throw new Error(`REALIZATION_BROWSER_INFERENCE_FORBIDDEN:${forbidden}`);

for(const required of [
  'SERVER_AUTHORITATIVE_REALIZATION_V1',
  'owner_deal_finance_summary',
  'resource_decisions',
  'portal_private.shipments',
  'signed_supplement_document_key',
  'accounting_closure_status',
  'Оплачено ${pct}% · осталось ${100-pct}%',
  'Ресурс пока не подтверждён',
  'Отгрузка ещё не начата',
]) if(!backend.includes(required))throw new Error(`REALIZATION_BACKEND_REQUIRED_MISSING:${required}`);

if(!attach.includes("lifecycle_data_policy:'SERVER_AUTHORITATIVE_DEAL_STATE_ONLY'"))throw new Error('REALIZATION_INTEGRITY_POLICY_MISSING');
if(!attach.includes('20260830-realization-status-server-v2'))throw new Error('REALIZATION_CACHE_BUST_MISSING');

for(const forbidden of ['RONA-C003','DEAL-2026-004','DEAL-2026-005','DEAL-2026-006','FARGONA GAZ','UNIVERSAL SOLYARIS']){
  if(runtime.includes(forbidden)||backend.includes(forbidden))throw new Error(`REALIZATION_HARDCODING_FORBIDDEN:${forbidden}`);
}

console.log('CLIENT_REALIZATION_STATUS_AUTHORITATIVE_QA=PASS');
