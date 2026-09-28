import fs from 'node:fs';
import assert from 'node:assert/strict';

const migration=fs.readFileSync(
  'supabase/migrations/20260928174000_postgres_idle_session_timeout_60s.sql',
  'utf8'
);
const rollback=fs.readFileSync(
  'supabase/rollback/20260928174000_postgres_idle_session_timeout_60s.rollback.sql',
  'utf8'
);

assert.match(migration,/alter role postgres set idle_session_timeout = '60s'/i);
assert.match(rollback,/alter role postgres set idle_session_timeout = '15s'/i);
assert.doesNotMatch(migration,/max_connections/i);
assert.doesNotMatch(migration,/statement_timeout/i);
assert.doesNotMatch(migration,/cron\.alter_job/i);
assert.doesNotMatch(migration,/create\s+table/i);
assert.doesNotMatch(migration,/drop\s+table/i);
assert.doesNotMatch(migration,/insert\s+into/i);
assert.doesNotMatch(migration,/update\s+/i);
assert.doesNotMatch(migration,/delete\s+from/i);

console.log('POSTGRES IDLE SESSION TIMEOUT 60S CONTRACT PASS');
