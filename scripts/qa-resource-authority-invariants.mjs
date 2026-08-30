import { readFile } from 'node:fs/promises';
const runtime=await readFile('assets/portal-runtime/client-deal-lifecycle-v1.js','utf8');
const guard=await readFile('supabase/migrations/20260830122500_deal_resource_authority_and_payment_prerequisite_v1.sql','utf8');
const normalize=await readFile('supabase/migrations/20260830122600_materialize_legacy_executing_resource_confirmations_v2.sql','utf8');
if(!runtime.includes("const STAGE_ORDER=['contract','documents','resource','payment','logistics','close']"))throw new Error('RESOURCE_MUST_PRECEDE_PAYMENT_IN_REALIZATION_STATUS');
for(const s of ['resolve_deal_resource_state','trg_payment_allocation_requires_resource','trg_finance_receipt_requires_resource'])if(!guard.includes(s))throw new Error(`RESOURCE_GUARD_MISSING:${s}`);
for(const s of ['CANONICAL_LEGACY_RESOURCE_MATERIALIZATION','trg_deal_executing_requires_resource'])if(!normalize.includes(s))throw new Error(`RESOURCE_NORMALIZATION_MISSING:${s}`);
for(const forbidden of ['RONA-C003','DEAL-2026-004','DEAL-2026-005','DEAL-2026-006','FARGONA GAZ','UNIVERSAL SOLYARIS'])if(runtime.includes(forbidden)||guard.includes(forbidden)||normalize.includes(forbidden))throw new Error(`RESOURCE_LOCAL_HARDCODING_FORBIDDEN:${forbidden}`);
console.log('RESOURCE_AUTHORITY_INVARIANTS_QA=PASS');
