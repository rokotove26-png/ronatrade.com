import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

const migration=read('supabase/migrations/20260928200500_owner_ai_office_control_v4.sql');
const operations=read('supabase/functions/rona-owner-acceptance/operations-center.ts');
const ui=read('functions/portal/admin-operations-command-center-v5.js');

test('human topology is owner and treasury only',()=>{
  assert.match(migration,/ONLY_OWNER_AND_TREASURY_ARE_HUMAN/);
  assert.match(migration,/'OWNER','OWNER','Собственник'/);
  assert.match(migration,/'TREASURY','TREASURY','Казначей'/);
  assert.match(migration,/actor_kind='AI',human_materialized=false/);
  assert.match(migration,/EXECUTIVE_DIRECTOR/);
  assert.match(migration,/ACCOUNTING/);
});

test('dependency materializer is consolidated into core runtime instead of new cron fanout',()=>{
  assert.match(migration,/ai_task_dependencies_materialize_v2/);
  assert.match(migration,/run_core_runtime_minute_v5/);
  assert.match(migration,/mod\(extract\(minute from clock_timestamp\(\)\)::integer,5\)=2/);
  assert.match(migration,/rona-core-runtime-minute-v1/);
  assert.match(migration,/run_core_runtime_minute_v5/);
});

test('owner operations backend treats technical task roles as AI, not employees',()=>{
  assert.match(operations,/ai_role_authority_registry_v2/);
  assert.match(operations,/actor_kind/);
  assert.match(operations,/aiOffice/);
  assert.match(operations,/ONLY_OWNER_AND_TREASURY_ARE_HUMAN/);
  assert.match(operations,/AI_TASK_EXCEPTION/);
  assert.doesNotMatch(operations,/не назначена/);
});

test('owner UI explicitly exposes owner plus treasury human model',()=>{
  assert.match(ui,/OWNER AI COMMAND CENTER/);
  assert.match(ui,/Центр собственника/);
  assert.match(ui,/люди: собственник и казначей/);
  assert.match(ui,/Активные ИИ-роли/);
  assert.match(ui,/Решение человека/);
  assert.match(ui,/ИИ-офис/);
});
