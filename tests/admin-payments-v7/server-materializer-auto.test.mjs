import assert from 'node:assert/strict';
import fs from 'node:fs';

const auto=fs.readFileSync('supabase/migrations/20260915023000_admin_payments_v7_auto_materialization.sql','utf8');
const gateway=fs.readFileSync('supabase/functions/rona-mcp-gateway/index.ts','utf8');
const finance=fs.readFileSync('supabase/functions/rona-mcp-gateway/finance-payments-v7-extension.mjs','utf8');

assert.match(auto,/finance_auto_materialize_after_conclusion_v7/);
assert.match(auto,/after insert on portal_private\.ai_coordination_records/i);
assert.match(auto,/new\.functional_role::text<>'FINANCE'/);
assert.match(auto,/new\.identity_id<>'AI-FINANCE'/);
assert.match(auto,/functional_conclusion_submit/);
assert.match(auto,/business_change_proposal_submit/);
assert.match(auto,/PAYMENTS_V7_MATERIALIZE/);
assert.match(auto,/PAYMENTS_V7_MATERIALIZATION_MANIFEST_V1/);
assert.match(auto,/attempt_finance_materialization_job_v7/);
assert.match(auto,/materialize_finance_manifest_v7\(v_actor,v_request\)/);
assert.match(auto,/recover_finance_materialization_jobs_v7/);
assert.match(auto,/IDEMPOTENT_REPLAY/);
assert.match(auto,/status='RETRY'/);
assert.match(auto,/Materialization automation must never invalidate an already valid Finance conclusion/);
assert.match(auto,/finance_materialization_attempts_v7/);

for(const pattern of [
  /insert\s+into\s+portal_private\.payments\b/i,
  /update\s+portal_private\.payments\b/i,
  /delete\s+from\s+portal_private\.payments\b/i,
  /insert\s+into\s+portal_private\.payment_allocations\b/i,
  /update\s+portal_private\.payment_allocations\b/i,
  /delete\s+from\s+portal_private\.payment_allocations\b/i,
  /insert\s+into\s+portal_private\.finance_events_v7\b/i,
  /update\s+portal_private\.finance_events_v7\b/i,
  /delete\s+from\s+portal_private\.finance_events_v7\b/i,
]){
  assert.doesNotMatch(auto,pattern,'auto layer must delegate business persistence to canonical materializer only');
}

assert.doesNotMatch(finance,/name:\s*['"]finance_event_submit['"]/,'Finance Pilot must not expose a ninth Payments write tool');
assert.doesNotMatch(finance,/persist_finance_event_v7/,'Finance MCP compatibility layer must not write Payments');
assert.match(finance,/x-rona-finance-tools-count','8'/);
assert.match(gateway,/createFinancePaymentsV7NativeHooks/,'gateway compatibility wrapper remains structurally stable');

console.log('PAYMENTS V7 AUTOMATIC MATERIALIZATION STATIC CONTRACT PASS');
console.log('FINANCE PILOT = LEGACY 8 TOOLS');
console.log('PROPOSAL + CONCLUSION => SERVER MATERIALIZER; CHATGPT WRITE TOOL = NONE');
