import fs from 'node:fs';
import assert from 'node:assert/strict';

const migration=fs.readFileSync(
  'supabase/migrations/20260928163500_market_watchdog_core_consolidation.sql',
  'utf8'
);
const rollback=fs.readFileSync(
  'supabase/rollback/20260928163500_market_watchdog_core_consolidation.rollback.sql',
  'utf8'
);

assert.match(migration,/run_core_runtime_minute_v1/);
assert.match(migration,/market_intelligence_watchdog_v1\(\)/);
assert.match(migration,/mod\(extract\(minute from clock_timestamp\(\)\)::integer,5\)=3/);
assert.match(migration,/market_intelligence_watchdog_skipped',false/);
assert.match(migration,/market_intelligence_watchdog_skip_reason','FIVE_MINUTE_CORE_GATE'/);
assert.match(migration,/step','market_intelligence_watchdog'/);
assert.match(migration,/cron\.alter_job/);
assert.match(migration,/active := false/);
assert.match(migration,/finance_materialization_gate_minutes',10/);
assert.match(migration,/sla_escalation_gate_minutes', 5/);
assert.match(migration,/refresh_finance_cash_projection_cache_v1\(false\)/);
assert.doesNotMatch(migration,/delete\s+from/i);
assert.doesNotMatch(migration,/drop\s+table/i);

assert.match(rollback,/CREATE OR REPLACE FUNCTION portal_private\.run_core_runtime_minute_v1\(\)/i);
assert.match(rollback,/active := true/);

console.log('MARKET WATCHDOG CORE CONSOLIDATION CONTRACT PASS');
