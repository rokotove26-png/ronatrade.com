import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FINANCE_PAYMENTS_V7_TOOL } from '../../supabase/functions/rona-mcp-gateway/finance-payments-v7-extension.mjs';

const migration=readFileSync('supabase/migrations/20260914210000_admin_payments_v7_finance_controlled_write.sql','utf8');
const gateway=readFileSync('supabase/functions/rona-mcp-gateway/index.ts','utf8');
const extension=readFileSync('supabase/functions/rona-mcp-gateway/finance-payments-v7-extension.mjs','utf8');
const uiRuntime=readFileSync('scripts/admin-payments-v7-final-live-source.mjs','utf8');

const EVENT_TYPES=[
 'CLIENT_PAYMENT_CONFIRMED','DEAL_FINANCIAL_OBLIGATION_CONFIRMED','DEAL_PAYMENT_SCHEDULE_CONFIRMED','PAYMENT_TRIGGER_CONFIRMED',
 'OUTGOING_PAYMENT_CONFIRMED','OUTGOING_PAYMENT_DEAL_ALLOCATION_CONFIRMED','PAYMENT_RESOURCE_CHAIN_CONFIRMED','DOCUMENTARY_STATUS_CONFIRMED'
];

test('Finance Pilot exposes one typed Finance-to-Payments mutation surface',()=>{
 assert.equal(FINANCE_PAYMENTS_V7_TOOL.name,'finance_event_submit');
 assert.deepEqual(new Set(FINANCE_PAYMENTS_V7_TOOL.inputSchema.properties.event_type.enum),new Set(EVENT_TYPES));
 assert.equal(FINANCE_PAYMENTS_V7_TOOL.annotations.readOnlyHint,false);
 assert.equal(FINANCE_PAYMENTS_V7_TOOL.annotations.idempotentHint,true);
 assert.match(extension,/ctx\.role!=='FINANCE'/);
 assert.match(extension,/ctx\.identity_id!=='AI-FINANCE'/);
 assert.match(extension,/ctx\.server_slug!=='rona-mcp-finance-pilot'/);
 assert.doesNotMatch(extension,/browser|localStorage|sessionStorage/i);
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

test('gateway delegates current release semantics and browser never becomes Finance authority',()=>{
 assert.match(gateway,/FINANCE_GATEWAY_UPSTREAM_COMMIT='0c136582cbe825149257994465d784f28a24ab0c'/);
 assert.match(gateway,/raw\.githubusercontent\.com\/rokotove26-png\/ronatrade\.com/);
 assert.match(extension,/mcp_oauth_tokens/);
 assert.match(extension,/persist_finance_event_v7/);
 assert.doesNotMatch(extension,/amount.*window|window.*amount|document\.querySelector/i);
});

test('Finance automation delta does not modify the visually accepted Payments renderer',()=>{
 assert.match(uiRuntime,/ADMIN_PAYMENTS_V7_EXECUTIVE_DENSE_V1|ADMIN_PAYMENTS_V7/);
 const financeFiles=[migration,gateway,extension].join('\n');
 assert.doesNotMatch(financeFiles,/rona-payments-v7-kpi|rona-payments-v7-deal-grid|paymentsV7InstallStyle|renderPayments\(/);
});
