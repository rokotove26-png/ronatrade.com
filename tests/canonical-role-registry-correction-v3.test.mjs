import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const migration=readFileSync(new URL('../supabase/migrations/20260928204500_canonical_role_registry_correction_v3.sql',import.meta.url),'utf8');
const rollback=readFileSync(new URL('../supabase/rollback/20260928204500_canonical_role_registry_correction_v3.rollback.sql',import.meta.url),'utf8');
const intake=readFileSync(new URL('../supabase/functions/_shared/client-intake-v1/index.mjs',import.meta.url),'utf8');

test('nonexistent roles are removed from canonical registry',()=>{
  assert.match(migration,/delete from portal_private\.ai_role_authority_registry_v2/);
  assert.match(migration,/ACCOUNTING','EXECUTIVE_DIRECTOR/);
  assert.match(migration,/nonexistent_roles/);
  assert.match(migration,/ACCOUNTING','FINANCE/);
  assert.match(migration,/EXECUTIVE_DIRECTOR','OPERATIONS_DIRECTOR/);
});

test('routing contract V4 and role state V5 are materialized with compatibility bridges',()=>{
  assert.match(migration,/RONA_ROLE_ROUTING_CONTRACT_V4/);
  assert.match(migration,/RONA_ROLE_STATE_RECOVERY_V5/);
  assert.match(migration,/create or replace function portal_private\.ai_role_routing_contract_v3/);
  assert.match(migration,/select portal_private\.ai_role_routing_contract_v4\(\)/);
  assert.match(migration,/create or replace function portal_private\.ai_role_state_current_v4/);
  assert.match(migration,/select portal_private\.ai_role_state_current_v5/);
});

test('payment proof routing belongs to Finance Director',()=>{
  assert.match(migration,/CLIENT_PAYMENT_PROOF_SUBMIT_V1/);
  assert.match(migration,/responsible_role='FINANCE'/);
  assert.match(migration,/CLIENT_PAYMENT_PROOF_SUBMIT'[\s\S]*FINANCE/);
  assert.match(intake,/CLIENT_PAYMENT_PROOF_SUBMIT_V1[^\n]*responsible_role:'FINANCE'/);
  assert.doesNotMatch(intake,/CLIENT_PAYMENT_PROOF_SUBMIT_V1[^\n]*responsible_role:'ACCOUNTING'/);
});

test('rollback never restores nonexistent organizational roles',()=>{
  assert.match(rollback,/must not be restored as separate AI roles/i);
  assert.doesNotMatch(rollback,/insert into portal_private\.ai_role_authority_registry_v2/);
  assert.doesNotMatch(rollback,/responsible_role='ACCOUNTING'/);
});
