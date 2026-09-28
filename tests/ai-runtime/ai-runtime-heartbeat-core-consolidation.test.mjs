import fs from 'node:fs';
import assert from 'node:assert/strict';

const migration=fs.readFileSync(
  'supabase/migrations/20260928172500_ai_runtime_heartbeat_core_consolidation.sql',
  'utf8'
);
const rollback=fs.readFileSync(
  'supabase/rollback/20260928172500_ai_runtime_heartbeat_core_consolidation.rollback.sql',
  'utf8'
);

assert.match(migration,/run_core_runtime_minute_v4/);
assert.match(migration,/run_core_runtime_minute_v3\(\)/);
assert.match(migration,/enqueue_ai_runtime_heartbeat\(\)/);
assert.match(migration,/mod\(extract\(minute from clock_timestamp\(\)\)::integer,15\)=0/);
assert.match(migration,/ai_runtime_heartbeat_gate_minutes',15/);
assert.match(migration,/rona-ai-runtime-heartbeat/);
assert.match(migration,/active:=false/);
assert.match(migration,/revoke all on function portal_private\.run_core_runtime_minute_v4\(\) from public/i);
assert.doesNotMatch(migration,/ai_runtime_mark_sla_breaches\(\)/);
assert.doesNotMatch(migration,/ai_runtime_enqueue_sla_escalation_db\(\)/);
assert.doesNotMatch(migration,/ai_runtime_dispatch_db\(/);
assert.doesNotMatch(migration,/delete\s+from/i);
assert.doesNotMatch(migration,/drop\s+table/i);

assert.match(rollback,/run_core_runtime_minute_v3\(\)/);
assert.match(rollback,/active:=true/);
assert.match(rollback,/drop function if exists portal_private\.run_core_runtime_minute_v4\(\)/);

console.log('AI RUNTIME HEARTBEAT CORE CONSOLIDATION CONTRACT PASS');
