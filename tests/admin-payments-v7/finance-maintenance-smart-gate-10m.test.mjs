import fs from 'node:fs';
import assert from 'node:assert/strict';

const migration=fs.readFileSync(
  'supabase/migrations/20260928150500_finance_maintenance_smart_gate_10m.sql',
  'utf8'
);
const rollback=fs.readFileSync(
  'supabase/rollback/20260928150500_finance_maintenance_smart_gate_10m.rollback.sql',
  'utf8'
);

assert.match(migration,/mod\(extract\(minute from clock_timestamp\(\)\)::integer,10\)=0/);
assert.match(migration,/run_finance_materialization_maintenance_v7\(50,50,'PG_CRON'\)/);
assert.match(migration,/status in \('QUEUED','RETRY'\)/);
assert.match(migration,/recover_finance_materialization_jobs_v7\(50\)/);
assert.match(migration,/finance_materialization_mode','RECOVERY_ONLY'/);
assert.match(migration,/finance_materialization_mode','SKIPPED_NO_DUE_WORK'/);
assert.match(migration,/refresh_finance_cash_projection_cache_v1\(false\)/);
assert.match(migration,/sla_escalation_gate_minutes', 5/);
assert.match(migration,/model_executor_skip_reason', 'NO_ELIGIBLE_WORK'/);
assert.doesNotMatch(migration,/drop\s+trigger/i);
assert.doesNotMatch(migration,/delete\s+from\s+portal_private\.finance_/i);
assert.match(rollback,/CREATE OR REPLACE FUNCTION portal_private\.run_core_runtime_minute_v1\(\)/i);

console.log('FINANCE MAINTENANCE SMART GATE 10M CONTRACT PASS');
