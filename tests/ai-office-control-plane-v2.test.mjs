import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const migration=fs.readFileSync(
  'supabase/migrations/20260928190000_ai_office_control_plane_v2.sql',
  'utf8'
);
const rollback=fs.readFileSync(
  'supabase/rollback/20260928190000_ai_office_control_plane_v2.rollback.sql',
  'utf8'
);

test('AI office control plane V2 materializes canonical role routing',()=>{
  assert.match(migration,/ai_role_authority_registry_v2/);
  assert.match(migration,/RONA_ROLE_ROUTING_CONTRACT_V2/);
  assert.match(migration,/COMMERCIAL_DIRECTOR/);
  assert.match(migration,/MARKET_ANALYST.*LEGACY/s);
  assert.match(migration,/ACCOUNTING.*GAP/s);
  assert.match(migration,/TREASURY.*GAP/s);
});

test('AI office control plane V2 exposes exception and dependency projections',()=>{
  assert.match(migration,/ai_task_dependencies_v1/);
  assert.match(migration,/ai_task_dependency_graph_v1/);
  assert.match(migration,/ai_role_exception_cockpit_v1/);
  assert.match(migration,/ai_role_state_current_v3/);
});

test('AI office control plane V2 remains fail-closed and private',()=>{
  assert.match(migration,/enable row level security/i);
  assert.match(migration,/revoke all .* from public, anon, authenticated, service_role/i);
  assert.match(migration,/task_id is distinct from depends_on_task_id/i);
});

test('rollback removes only V2 control-plane objects',()=>{
  assert.match(rollback,/drop function if exists portal_private\.ai_role_state_current_v3/);
  assert.match(rollback,/drop table if exists portal_private\.ai_task_dependencies_v1/);
  assert.match(rollback,/drop table if exists portal_private\.ai_role_authority_registry_v2/);
  assert.doesNotMatch(rollback,/staff_tasks/);
  assert.doesNotMatch(rollback,/payments/);
  assert.doesNotMatch(rollback,/deals/);
});
