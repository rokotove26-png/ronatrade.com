import fs from 'node:fs';
import assert from 'node:assert/strict';

const migration=fs.readFileSync(
  'supabase/migrations/20260928181500_admin_runtime_recent_queue_index.sql',
  'utf8'
);
const rollback=fs.readFileSync(
  'supabase/rollback/20260928181500_admin_runtime_recent_queue_index.rollback.sql',
  'utf8'
);

assert.match(migration,/create index if not exists ai_runtime_queue_admin_recent_idx_v1/i);
assert.match(migration,/on portal_private\.ai_runtime_queue \(created_at desc\)/i);
assert.match(migration,/where qa_only=false/i);
assert.match(migration,/PORTAL_REVERSE_EVENT/);
assert.match(migration,/STAFF_TASK/);
assert.match(migration,/COORDINATION/);
assert.match(migration,/analyze portal_private\.ai_runtime_queue/i);

assert.doesNotMatch(migration,/insert\s+into/i);
assert.doesNotMatch(migration,/update\s+/i);
assert.doesNotMatch(migration,/delete\s+from/i);
assert.doesNotMatch(migration,/alter\s+table/i);
assert.doesNotMatch(migration,/cron\.alter_job/i);

assert.match(rollback,/drop index if exists portal_private\.ai_runtime_queue_admin_recent_idx_v1/i);

console.log('ADMIN RUNTIME RECENT QUEUE INDEX CONTRACT PASS');
