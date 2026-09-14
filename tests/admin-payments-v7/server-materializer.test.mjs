import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration=fs.readFileSync('supabase/migrations/20260915010000_admin_payments_v7_server_materializer.sql','utf8');
const edge=fs.readFileSync('supabase/functions/rona-finance-payments-v7-materializer/index.ts','utf8');

assert.match(migration,/materialize_finance_fact_v7\(p_actor jsonb,p_fact jsonb\)/);
assert.match(migration,/v_actor_role<>'FINANCE' or v_actor_id<>'AI-FINANCE'/);
assert.match(migration,/SOURCE_LOCK_INCOMPLETE/);
assert.match(migration,/FINANCE_SOURCE_LOCK_RECORD_INVALID/);
assert.match(migration,/TO_VERIFY_NOT_MATERIALIZED/);
assert.match(migration,/SYNTHETIC_FX_FORBIDDEN/);
assert.match(migration,/persist_finance_event_v7\(p_actor,v_event\)/);
assert.equal((migration.match(/persist_finance_event_v7\(p_actor,v_event\)/g)||[]).length,1,'materializer must have one canonical persistence call');

const forbiddenDirectDml=[
  /insert\s+into\s+portal_private\.payments\b/i,
  /update\s+portal_private\.payments\b/i,
  /delete\s+from\s+portal_private\.payments\b/i,
  /insert\s+into\s+portal_private\.payment_allocations\b/i,
  /insert\s+into\s+portal_private\.payment_business_attributions_v7\b/i,
  /insert\s+into\s+portal_private\.deal_finance_authority_v7\b/i,
  /insert\s+into\s+portal_private\.payment_resource_chains_v7\b/i,
];
for(const pattern of forbiddenDirectDml){
  assert.doesNotMatch(migration,pattern,'server materializer migration must not write Payments authority tables directly');
  assert.doesNotMatch(edge,pattern,'server materializer edge must not write Payments authority tables directly');
}

assert.match(edge,/RONA_FINANCE_MATERIALIZER_TOKEN/);
assert.match(edge,/role:\s*"FINANCE"/);
assert.match(edge,/identity_id:\s*"AI-FINANCE"/);
assert.match(edge,/materialize_finance_fact_v7/);
assert.doesNotMatch(edge,/finance_event_submit/,'server materializer must not depend on ChatGPT MCP tool registry');
assert.doesNotMatch(edge,/mcp_oauth_tokens/,'server materializer is an internal execution contour, not a ChatGPT OAuth surface');
assert.doesNotMatch(edge,/business_change_proposal_submit|functional_conclusion_submit/,'proposal/conclusion semantics must stay untouched');

console.log('SERVER MATERIALIZER STATIC CONTRACT PASS');
console.log('ONLY persist_finance_event_v7 performs authoritative Payments writes');
console.log('ChatGPT tool registry dependency: NONE');
