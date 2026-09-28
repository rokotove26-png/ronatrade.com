import fs from 'node:fs';
import assert from 'node:assert/strict';

const migration=fs.readFileSync('supabase/migrations/20260928165000_client_intake_core_wrapper.sql','utf8');
const rollback=fs.readFileSync('supabase/rollback/20260928165000_client_intake_core_wrapper.rollback.sql','utf8');

assert.match(migration,/run_core_runtime_minute_v2/);
assert.match(migration,/run_core_runtime_minute_v1\(\)/);
assert.match(migration,/client_intake_reconciliation_tick_v1\(\)/);
assert.match(migration,/mod\(extract\(minute from clock_timestamp\(\)\)::integer,5\)=1/);
assert.match(migration,/client_intake_reconciliation_phase_minute_mod5',1/);
assert.match(migration,/active := false/);
assert.match(migration,/revoke all on function portal_private\.run_core_runtime_minute_v2\(\) from public/i);
assert.doesNotMatch(migration,/delete\s+from/i);
assert.doesNotMatch(migration,/drop\s+table/i);
assert.match(rollback,/run_core_runtime_minute_v1\(\)/);
assert.match(rollback,/active := true/);
assert.match(rollback,/drop function if exists portal_private\.run_core_runtime_minute_v2\(\)/);

console.log('CLIENT INTAKE CORE WRAPPER CONTRACT PASS');
