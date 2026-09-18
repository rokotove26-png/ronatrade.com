import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration=await readFile(new URL('../supabase/migrations/20260918005000_payments_final_automation_hardening.sql',import.meta.url),'utf8');
const start=migration.indexOf('create or replace function portal_private.finance_v8_contour_health_v1()');
const health=migration.slice(start);

test('Finance V8 health uses semantic lineage rather than source-version naming',()=>{
  assert.match(health,/with recursive/);
  assert.match(health,/PAYMENT_SCHEDULE/);
  assert.match(health,/DOCUMENT_VERSION/);
  assert.match(health,/t\.total_to_receive is not distinct from l\.total_to_receive/);
  assert.match(health,/t\.due_now is not distinct from l\.due_now/);
  assert.match(health,/t\.expected_not_due is not distinct from l\.expected_not_due/);
  assert.match(health,/t\.future_conditional is not distinct from l\.future_conditional/);
  assert.doesNotMatch(health,/source_version[^\n]*not like\s+'FINANCE_SIGNED_SCHEDULE_V8/i);
  assert.doesNotMatch(health,/CURRENT_AUTHORITY_NOT_V8/);
});

test('health remains fail-closed for missing schedule, multiple terminal authorities and open integrity alerts',()=>{
  assert.match(health,/SIGNED_JOB_NOT_MATERIALIZED/);
  assert.match(health,/V8_PLAN_MISSING/);
  assert.match(health,/CURRENT_AUTHORITY_V8_LINEAGE_MISSING/);
  assert.match(health,/MULTIPLE_TERMINAL_AUTHORITIES/);
  assert.match(health,/OPEN_V8_ALERT/);
});
