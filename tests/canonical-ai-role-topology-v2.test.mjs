import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

const migration=read('supabase/migrations/20260928202000_canonical_ai_role_topology_v2.sql');
const gateway=read('supabase/functions/rona-mcp-gateway/index.ts');
const intake=read('supabase/functions/_shared/client-intake-v1/index.mjs');
const rollback=read('docs/canonical-ai-role-topology-v2-rollback.md');

test('canonical AI topology contains exactly the intended operational roles',()=>{
  assert.match(migration,/canonical_ai_roles/);
  for(const role of ['FINANCE','OPERATIONS_DIRECTOR','COMMERCIAL_DIRECTOR','LEGAL','RAIL_LOGISTICS','SYSTEM_ADMIN']){
    assert.match(migration,new RegExp("'"+role+"'"));
  }
  assert.match(migration,/delete from portal_private\.ai_role_authority_registry_v2[\s\S]*ACCOUNTING[\s\S]*EXECUTIVE_DIRECTOR/);
  assert.match(migration,/nonexistent_roles/);
  assert.match(migration,/ACCOUNTING','FINANCE/);
  assert.match(migration,/EXECUTIVE_DIRECTOR','OPERATIONS_DIRECTOR/);
});

test('client payment proof belongs to Finance Director',()=>{
  assert.match(migration,/CLIENT_PAYMENT_PROOF_SUBMIT_V1[\s\S]*FINANCE/);
  assert.match(migration,/p_event_type='CLIENT_PAYMENT_PROOF_SUBMIT'[\s\S]*FINANCE/);
  assert.match(intake,/CLIENT_PAYMENT_PROOF_SUBMIT_V1[\s\S]*responsible_role:'FINANCE'/);
  assert.doesNotMatch(intake,/CLIENT_PAYMENT_PROOF_SUBMIT_V1[^\n]*responsible_role:'ACCOUNTING'/);
});

test('gateway consumes topology V4 and role-state V5',()=>{
  assert.match(gateway,/ai_role_routing_contract_v4/);
  assert.match(gateway,/canonical_ai_handoff_targets/);
  assert.match(gateway,/ai_role_state_current_v5/);
  assert.match(gateway,/RONA_ROLE_STATE_RECOVERY_V5/);
  assert.match(gateway,/ROLE_STATE_V5_RESPONSE_BUDGET_EXCEEDED/);
});

test('rollback point never restores nonexistent roles',()=>{
  assert.match(rollback,/not separate RONA Trade roles/);
  assert.match(rollback,/CLIENT_PAYMENT_PROOF_SUBMIT remains FINANCE/);
  assert.match(rollback,/ACCOUNTING is not restored as a role/);
  assert.match(rollback,/EXECUTIVE_DIRECTOR is not restored as a role/);
});
