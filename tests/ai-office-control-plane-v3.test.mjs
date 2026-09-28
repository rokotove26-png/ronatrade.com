import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const migration=fs.readFileSync('supabase/migrations/20260928191500_ai_office_control_plane_v3_owner_treasury.sql','utf8');
const rollback=fs.readFileSync('supabase/rollback/20260928191500_ai_office_control_plane_v3_owner_treasury.rollback.sql','utf8');

test('human topology is owner plus treasury only',()=>{
  assert.match(migration,/ONLY_OWNER_AND_TREASURY_ARE_HUMAN/);
  assert.match(migration,/'OWNER','OWNER','Собственник'.*'HUMAN',true/s);
  assert.match(migration,/'TREASURY','TREASURY','Казначей'.*'HUMAN',true/s);
  assert.match(migration,/role_key in \('OPERATIONS_DIRECTOR','FINANCE','LEGAL','COMMERCIAL_DIRECTOR','RAIL_LOGISTICS','SYSTEM_ADMIN'\)/);
  assert.match(migration,/actor_kind='AI'/);
});

test('technical staff role taxonomy is explicitly not human headcount',()=>{
  assert.match(migration,/TECHNICAL_ROLE_TAXONOMY_NOT_HUMAN_HEADCOUNT/);
  assert.match(migration,/staff_materialized[\s\S]*does NOT mean a human employee exists/i);
});

test('dependency materializer is source-locked and non-business-mutating',()=>{
  assert.match(migration,/ai_task_dependencies_materialize_v2/);
  assert.match(migration,/HANDOFF_REQUEST/);
  assert.match(migration,/HOLD_SOURCE_ENTITY_ABSENT/);
  assert.match(migration,/SOURCE_ENTITY_PRESENT/);
  assert.match(migration,/business_data_mutated',false/);
});

test('core runtime integrates dependency materialization without new cron fanout',()=>{
  assert.match(migration,/run_core_runtime_minute_v5/);
  assert.match(migration,/FIVE_MINUTE_CORE_GATE/);
  assert.match(migration,/set command='select portal_private\.run_core_runtime_minute_v5\(\);'/);
});

test('rollback returns core runtime to v4 and removes v3-only objects',()=>{
  assert.match(rollback,/run_core_runtime_minute_v4/);
  assert.match(rollback,/drop function if exists portal_private\.ai_role_state_current_v4/);
  assert.match(rollback,/drop function if exists portal_private\.ai_task_dependencies_materialize_v2/);
});
