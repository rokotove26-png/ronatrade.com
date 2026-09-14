import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration=fs.readFileSync('supabase/migrations/20260915010000_admin_payments_v7_server_materializer.sql','utf8');
const edge=fs.readFileSync('supabase/functions/rona-finance-payments-v7-materializer/index.ts','utf8');

assert.match(migration,/materialize_finance_manifest_v7\(p_actor jsonb,p_request jsonb\)/);
assert.doesNotMatch(migration,/materialize_finance_fact_v7\(/,'caller-supplied Finance fact materializer must be removed');
assert.match(migration,/v_actor_role<>'FINANCE' or v_actor_id<>'AI-FINANCE'/);
assert.match(migration,/CALLER_PAYLOAD_OVERRIDE_FORBIDDEN/);
assert.match(migration,/BUSINESS_CHANGE_PROPOSAL/);
assert.match(migration,/business_change_proposal_submit/);
assert.match(migration,/functional_conclusion_submit/);
assert.match(migration,/PAYMENTS_V7_MATERIALIZE/);
assert.match(migration,/payments_v7_materialization_manifest/);
assert.match(migration,/PAYMENTS_V7_MATERIALIZATION_MANIFEST_V1/);
assert.match(migration,/MANIFEST_CONCLUSION_NOT_CONFIRMED/);
assert.match(migration,/CONCLUSION_MANIFEST_BINDING_REQUIRED/);
assert.match(migration,/MANIFEST_SUPERSEDED/);
assert.match(migration,/MANIFEST_NOT_CURRENT/);
assert.match(migration,/MANIFEST_CONCLUSION_SUPERSEDED/);
assert.match(migration,/MANIFEST_CONCLUSION_NOT_CURRENT/);
assert.match(migration,/manifest_payload_sha256/);
assert.match(migration,/event_payload_sha256/);
assert.match(migration,/sha256\(convert_to\(v_manifest_state::text,'UTF8'\)\)/);
assert.match(migration,/sha256\(convert_to\(v_event::text,'UTF8'\)\)/);
assert.match(migration,/TO_VERIFY_NOT_MATERIALIZED/);
assert.match(migration,/SYNTHETIC_FX_FORBIDDEN/);
assert.match(migration,/persist_finance_event_v7\(v_persist_actor,v_event\)/);
assert.equal((migration.match(/persist_finance_event_v7\(v_persist_actor,v_event\)/g)||[]).length,1,'materializer must have one canonical persistence call');

const forbiddenDirectDml=[
  /insert\s+into\s+portal_private\.payments\b/i,
  /update\s+portal_private\.payments\b/i,
  /delete\s+from\s+portal_private\.payments\b/i,
  /insert\s+into\s+portal_private\.payment_allocations\b/i,
  /update\s+portal_private\.payment_allocations\b/i,
  /delete\s+from\s+portal_private\.payment_allocations\b/i,
  /insert\s+into\s+portal_private\.payment_business_attributions_v7\b/i,
  /update\s+portal_private\.payment_business_attributions_v7\b/i,
  /delete\s+from\s+portal_private\.payment_business_attributions_v7\b/i,
  /insert\s+into\s+portal_private\.deal_finance_authority_v7\b/i,
  /update\s+portal_private\.deal_finance_authority_v7\b/i,
  /delete\s+from\s+portal_private\.deal_finance_authority_v7\b/i,
  /insert\s+into\s+portal_private\.payment_resource_chains_v7\b/i,
  /update\s+portal_private\.payment_resource_chains_v7\b/i,
  /delete\s+from\s+portal_private\.payment_resource_chains_v7\b/i,
];
for(const pattern of forbiddenDirectDml){
  assert.doesNotMatch(migration,pattern,'server materializer migration must not write Payments authority tables directly');
  assert.doesNotMatch(edge,pattern,'server materializer edge must not write Payments authority tables directly');
}

const forbiddenCoordinationMutation=[
  /insert\s+into\s+portal_private\.ai_coordination_records\b/i,
  /update\s+portal_private\.ai_coordination_records\b/i,
  /delete\s+from\s+portal_private\.ai_coordination_records\b/i,
];
for(const pattern of forbiddenCoordinationMutation){
  assert.doesNotMatch(migration,pattern,'materializer must read proposal/conclusion records without changing their semantics');
  assert.doesNotMatch(edge,pattern,'edge materializer must not mutate coordination records');
}

assert.match(edge,/RONA_FINANCE_MATERIALIZER_TOKEN/);
assert.match(edge,/const REQUEST_KEYS = new Set\(\["manifest_id", "conclusion_id"\]\)/);
assert.match(edge,/keys\.length !== 2/);
assert.match(edge,/CALLER_PAYLOAD_OVERRIDE_FORBIDDEN/);
assert.match(edge,/role:\s*"FINANCE"/);
assert.match(edge,/identity_id:\s*"AI-FINANCE"/);
assert.match(edge,/SERVER_MATERIALIZER_MANIFEST_BOUND/);
assert.match(edge,/materialize_finance_manifest_v7/);
assert.doesNotMatch(edge,/materialize_finance_fact_v7/);
assert.doesNotMatch(edge,/payload\?\.fact|request\.amount|request\.currency|request\.deal_id|request\.payment_id|request\.allocation|request\.event_type/,'edge must not accept caller business content');
assert.doesNotMatch(edge,/finance_event_submit/,'server materializer must not depend on ChatGPT MCP tool registry');
assert.doesNotMatch(edge,/mcp_oauth_tokens/,'server materializer is an internal execution contour, not a ChatGPT OAuth surface');

console.log('SERVER MATERIALIZER MANIFEST CONTENT BINDING PASS');
console.log('CALLER BUSINESS PAYLOAD OVERRIDE: FORBIDDEN');
console.log('ONLY persist_finance_event_v7 performs authoritative Payments writes');
console.log('PROPOSAL/CONCLUSION SEMANTICS: READ-ONLY SOURCE LOCK');
console.log('ChatGPT tool registry dependency: NONE');
