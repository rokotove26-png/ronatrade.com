import fs from 'node:fs';
import assert from 'node:assert/strict';

const migration=fs.readFileSync(
  'supabase/migrations/20260928171000_payments_v8_watchdog_smart_gate.sql',
  'utf8'
);
const rollback=fs.readFileSync(
  'supabase/rollback/20260928171000_payments_v8_watchdog_smart_gate.rollback.sql',
  'utf8'
);

assert.match(migration,/finance_signed_schedule_watchdog_smart_tick_v8/);
assert.match(migration,/run_finance_signed_schedule_watchdog_v8\(\)/);
assert.match(migration,/HOURLY_FULL_VERIFICATION/);
assert.match(migration,/SKIPPED_NO_WORK/);
assert.match(migration,/v_minute=2/);
assert.match(migration,/run_core_runtime_minute_v3/);
assert.match(migration,/run_core_runtime_minute_v2\(\)/);
assert.match(migration,/mod\(extract\(minute from clock_timestamp\(\)\)::integer,5\)=2/);
assert.match(migration,/payments-v8-signed-schedule-watchdog/);
assert.match(migration,/active:=false/);
assert.match(migration,/payments-v8-stale-executor-recovery/,{message:'migration must document or preserve stale recovery cron'});
assert.doesNotMatch(migration,/delete\s+from/i);
assert.doesNotMatch(migration,/drop\s+table/i);

assert.match(rollback,/run_core_runtime_minute_v2\(\)/);
assert.match(rollback,/active:=true/);
assert.match(rollback,/drop function if exists portal_private\.run_core_runtime_minute_v3\(\)/);
assert.match(rollback,/drop function if exists portal_private\.finance_signed_schedule_watchdog_smart_tick_v8\(\)/);

console.log('PAYMENTS V8 WATCHDOG SMART GATE CONTRACT PASS');
