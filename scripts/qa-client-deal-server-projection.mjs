import { readFile } from 'node:fs/promises';
import { brotliDecompressSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const api=await readFile('supabase/functions/rona-portal-api/index.ts','utf8');
const runtime=await readFile('assets/portal-runtime/client-application-lifecycle-v1.js','utf8');
const attach=await readFile('scripts/attach-client-application-lifecycle.mjs','utf8');

const requiredApi=[
  "projection_contract:'ADMIN_CLIENT_SERVER_V1'",
  'owner_deal_finance_summary',
  'filterAuthoritativeClientPayments',
  'resource_decisions',
  'current_status_label',
  'payment_label',
  'payment_percent',
  'resource_label',
  "payment_source:'OWNER_DEAL_FINANCE_SUMMARY'",
  "payment_source:'BANK_CONFIRMED_VERIFIED_ALLOCATION'",
];
for(const probe of requiredApi)if(!api.includes(probe))throw new Error(`SERVER_PROJECTION_PROBE_MISSING ${probe}`);
for(const forbidden of ['DEAL-2026-005','DEAL-2026-006'])if(api.includes(forbidden)||runtime.includes(forbidden))throw new Error(`HARDCODED_DEAL_STATE_FORBIDDEN ${forbidden}`);
for(const localFn of ['operationsDealState','operationsResourceState','financePaymentState'])if(new RegExp(`function\\s+${localFn}\\b`).test(runtime))throw new Error(`CLIENT_LOCAL_BUSINESS_INFERENCE_FORBIDDEN ${localFn}`);
for(const probe of [
  "source:'CURRENT_AUTHORIZED_CLIENT_CONTEXT_SERVER_PROJECTION'",
  'CLIENT_DEAL_SERVER_PROJECTION_INCOMPLETE',
  'data-rona-deal-state-strip',
  'authoritative-v8',
  'applicationIsActive',
  'paymentReceived',
  'paymentObligation',
])if(!runtime.includes(probe))throw new Error(`CLIENT_RENDERER_PROBE_MISSING ${probe}`);
if(!attach.includes('CLIENT_LOCAL_BUSINESS_STATE_INFERENCE_FORBIDDEN'))throw new Error('BUILD_LOCAL_INFERENCE_GUARD_MISSING');
if(!attach.includes('SINGLE_COMPOSED_SEGMENTED_STRIP'))throw new Error('BUILD_STATUS_STRIP_CONTRACT_MISSING');
if(!attach.includes('LINKED_DEAL_OR_TERMINAL_APPLICATION_STATUS'))throw new Error('BUILD_APPLICATION_ARCHIVE_CONTRACT_MISSING');

const manifest=JSON.parse(await readFile('portal-src/current/client/manifest.json','utf8'));
const encoded=(await Promise.all(manifest.chunks.map(name=>readFile(`portal-src/current/client/${name}`,'utf8')))).join('');
const source=brotliDecompressSync(Buffer.from(encoded,'base64'));
const sha=createHash('sha256').update(source).digest('hex');
if(source.length!==484970||sha!=='d07d7cbee5fd3466c8729861a6e6a6acb4ba463ad6d89dd7f748209cacab6183')throw new Error(`CLIENT_FROZEN_SOURCE_CHANGED ${source.length}/${sha}`);

console.log('CLIENT_DEAL_SERVER_PROJECTION_QA=PASS server=ADMIN_CLIENT_SERVER_V1 renderer=THIN context=CURRENT_AUTHORIZED_CLIENT_CONTEXT status_strip=COMPOSED_SEGMENTED application_archive=LINKED_OR_TERMINAL frozen_source=UNCHANGED');