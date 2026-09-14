import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FINANCE_PILOT_LEGACY_TOOL_NAMES } from '../../supabase/functions/rona-mcp-gateway/finance-payments-v7-extension.mjs';

const migration=readFileSync('supabase/migrations/20260914210000_admin_payments_v7_finance_controlled_write.sql','utf8');
const materializer=readFileSync('supabase/migrations/20260915010000_admin_payments_v7_server_materializer.sql','utf8');
const auto=readFileSync('supabase/migrations/20260915023000_admin_payments_v7_auto_materialization.sql','utf8');
const gateway=readFileSync('supabase/functions/rona-mcp-gateway/index.ts','utf8');
const extension=readFileSync('supabase/functions/rona-mcp-gateway/finance-payments-v7-extension.mjs','utf8');
const uiRuntime=readFileSync('scripts/admin-payments-v7-final-live-source.mjs','utf8');

const EVENT_TYPES=[
 'CLIENT_PAYMENT_CONFIRMED','DEAL_FINANCIAL_OBLIGATION_CONFIRMED','DEAL_PAYMENT_SCHEDULE_CONFIRMED','PAYMENT_TRIGGER_CONFIRMED',
 'OUTGOING_PAYMENT_CONFIRMED','OUTGOING_PAYMENT_DEAL_ALLOCATION_CONFIRMED','PAYMENT_RESOURCE_CHAIN_CONFIRMED','DOCUMENTARY_STATUS_CONFIRMED'
];

const LEGACY_EIGHT=[
 'current_state','history','document_read','task_acknowledge','task_progress_submit','functional_conclusion_submit','handoff_request_submit','business_change_proposal_submit'
];

test('Finance Pilot remains the existing eight-tool source-lock surface with no Payments write tool',()=>{
 assert.deepEqual([...FINANCE_PILOT_LEGACY_TOOL_NAMES],LEGACY_EIGHT);
 assert.equal(FINANCE_PILOT_LEGACY_TOOL_NAMES.length,8);
 assert.doesNotMatch(extension,/name:\s*['"]finance_event_submit['"]/);
 assert.doesNotMatch(extension,/persist_finance_event_v7/);
 assert.match(extension,/x-rona-finance-tools-count','8'/);
 assert.doesNotMatch(extension,/window\.|localStorage|sessionStorage|document\./i);
});

test('Finance proposal plus confirmed conclusion drives the manifest-bound canonical persistence path server-side',()=>{
 assert.match(auto,/new\.functional_role::text<>'FINANCE'/);
 assert.match(auto,/new\.identity_id<>'AI-FINANCE'/);
 assert.match(auto,/business_change_proposal_submit/);
 assert.match(auto,/functional_conclusion_submit/);
 assert.match(auto,/PAYMENTS_V7_MATERIALIZE/);
 assert.match(auto,/materialize_finance_manifest_v7\(v_actor,v_request\)/);
 assert.match(materializer,/persist_finance_event_v7\(v_persist_actor,v_event\)/);
 assert.equal((materializer.match(/persist_finance_event_v7\(v_persist_actor,v_event\)/g)||[]).length,1);
 assert.doesNotMatch(auto,/insert\s+into\s+portal_private\.finance_events_v7\b/i);
 assert.doesNotMatch(auto,/insert\s+into\s+portal_private\.payments\b/i);
});

test('sealed persistence is append-only, stale guarded, idempotent and source locked',()=>{
 for(const type of EVENT_TYPES)assert.match(migration,new RegExp(type));
 assert.match(migration,/FINANCE_EVENT_IDEMPOTENCY_CONFLICT/);
 assert.match(migration,/STALE_AUTHORITY/);
 assert.match(migration,/source_refs jsonb not null/);
 assert.match(migration,/actor_id text not null check \(actor_id='AI-FINANCE'\)/);
 assert.match(migration,/actor_role text not null check \(actor_role='FINANCE'\)/);
 assert.match(migration,/finance_events_v7_immutable/);
 assert.match(migration,/payment_resource_chains_v7_immutable/);
 assert.match(migration,/revoke all on function portal_private\.persist_finance_event_v7/);
});

test('cross-currency spend accepts only Finance actual resource-chain authority',()=>{
 assert.match(migration,/payment_resource_chains_v7/);
 assert.match(migration,/SYNTHETIC_FX_FORBIDDEN/);
 assert.match(migration,/ACTUAL_SETTLEMENT_FACT|conversion_source_basis/);
 assert.match(migration,/v_native_amount<>v_line_amount/);
 assert.doesNotMatch(migration,/cbr\.ru|central bank|market rate|exchange-rate-api/i);
});

test('shared payment never receives an inferred proportional split',()=>{
 assert.match(migration,/SHARED_DEAL_SCOPE_SPLIT_TO_VERIFY/);
 assert.match(migration,/attribution_mode='SCOPE_ONLY'/);
 assert.doesNotMatch(migration,/50\s*\/\s*50|proportional|ratio|weight/i);
});

test('automatic materialization is idempotent, audited and separately recoverable',()=>{
 assert.match(auto,/unique\(manifest_record_id\)/i);
 assert.match(auto,/IDEMPOTENT_REPLAY/);
 assert.match(auto,/finance_materialization_attempts_v7/);
 assert.match(auto,/recover_finance_materialization_jobs_v7/);
 assert.match(auto,/for update skip locked/i);
 assert.match(auto,/status='RETRY'/);
 assert.match(auto,/Materialization automation must never invalidate an already valid Finance conclusion/);
});

test('gateway preserves canonical production semantics while Finance Payments authority is no longer a ChatGPT tool',()=>{
 assert.match(gateway,/36727a94820e1e85e95d4abfc5d6aab8234c5c18\/supabase\/functions\/rona-mcp-gateway\/index\.js/);
 assert.equal((gateway.match(/\(Deno\)\.serve = function/g)||[]).length,1);
 assert.doesNotMatch(gateway,/mutableDeno|financeServe|FINANCE_GATEWAY_UPSTREAM_HANDLER_NOT_CAPTURED/);
 assert.doesNotMatch(extension,/mcp_oauth_tokens/);
 assert.doesNotMatch(extension,/persist_finance_event_v7/);
 assert.doesNotMatch(extension,/amount.*window|window.*amount|document\.querySelector/i);
});

test('Finance automation delta does not modify the visually accepted Payments renderer',()=>{
 assert.match(uiRuntime,/ADMIN_PAYMENTS_V7_EXECUTIVE_DENSE_V1|ADMIN_PAYMENTS_V7/);
 const financeFiles=[migration,materializer,auto,gateway,extension].join('\n');
 assert.doesNotMatch(financeFiles,/rona-payments-v7-kpi|rona-payments-v7-deal-grid|paymentsV7InstallStyle|renderPayments\(/);
});