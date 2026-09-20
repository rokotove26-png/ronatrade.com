import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const sql=readFileSync(new URL('../supabase/migrations/20260920040000_serialize_core_runtime_minute_jobs_v1.sql',import.meta.url),'utf8');
const hardening=readFileSync(new URL('../supabase/migrations/20260920040800_core_runtime_minute_execute_hardening_v1.sql',import.meta.url),'utf8');

test('core runtime coordinator preserves required minute work and two dispatch passes',()=>{
  assert.match(sql,/create or replace function portal_private\.run_core_runtime_minute_v1\(\)/i);
  assert.equal((sql.match(/portal_private\.ai_runtime_dispatch_db\(100\)/g)||[]).length,2);
  assert.match(sql,/portal_private\.invoke_ai_model_executor\('run'\)/);
  assert.match(sql,/portal_private\.run_finance_materialization_maintenance_v7\(50,50,'PG_CRON'\)/);
  assert.match(sql,/portal_private\.refresh_finance_cash_projection_cache_v1\(false\)/);
});

test('migration touches only the intended five every-minute cron jobs',()=>{
  const expected=[
    'rona-ai-runtime-dispatch',
    'rona-ai-runtime-watchdog',
    'rona-ai-model-executor',
    'payments-v7-finance-materialization-maintenance-v7',
    'rona-finance-cash-projection-cache-v1',
  ];
  for(const name of expected) assert.match(sql,new RegExp(name.replace(/[.*+?^$()|[\]\\]/g,'\\$&')));
  for(const protectedName of [
    'rona-mail-sync-inbox',
    'rona-role-mail-sync-inbox',
    'rona-client-intake-reconcile-v1',
    'payments-v8-signed-schedule-watchdog',
    'payments-v8-stale-executor-recovery',
    'rail-route-assignments-v1',
  ]) assert.doesNotMatch(sql,new RegExp('jobname in \\([^)]*'+protectedName,'is'));
  assert.match(sql,/cron\.schedule\(\s*'rona-core-runtime-minute-v1'/s);
});

test('migration does not directly mutate business tables',()=>{
  assert.doesNotMatch(sql,/\b(delete\s+from|truncate\s+|update\s+portal_private\.|insert\s+into\s+portal_private\.)/i);
  assert.doesNotMatch(sql,/\b(clients|contracts|deals|payments|payment_allocations|documents|client_applications)\b\s*(set|values|where)/i);
});

test('core runtime coordinator is not executable by public portal roles',()=>{
  assert.match(hardening,/revoke all on function portal_private\.run_core_runtime_minute_v1\(\) from public/i);
  assert.match(hardening,/revoke all on function portal_private\.run_core_runtime_minute_v1\(\) from anon/i);
  assert.match(hardening,/revoke all on function portal_private\.run_core_runtime_minute_v1\(\) from authenticated/i);
  assert.match(hardening,/grant execute on function portal_private\.run_core_runtime_minute_v1\(\) to postgres/i);
});
