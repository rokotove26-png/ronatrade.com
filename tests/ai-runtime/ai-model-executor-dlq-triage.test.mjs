import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const sql=fs.readFileSync('supabase/migrations/20261021192500_ai_executor_dlq_immutable_triage_v1.sql','utf8');
const undo=fs.readFileSync('supabase/rollback/20261021192500_ai_executor_dlq_immutable_triage_v1.rollback.sql','utf8');
test('all classifications append immutable audit, never modify source queue',()=>{
 assert.match(sql,/ai_runtime_dlq_triage_v1/);
 assert.match(sql,/ON DELETE RESTRICT/);
 assert.match(sql,/BEFORE UPDATE OR DELETE/);
 assert.match(sql,/AI_RUNTIME_DLQ_TRIAGE_APPEND_ONLY/);
 assert.match(sql,/ON CONFLICT\(queue_id\) DO NOTHING/);
 assert.doesNotMatch(sql,/\bUPDATE\s+portal_private\.ai_runtime_queue\b/i);
 assert.doesNotMatch(sql,/\bDELETE\s+FROM\s+portal_private\.ai_runtime_queue\b/i);
 assert.doesNotMatch(sql,/\bTRUNCATE\s+(?:TABLE\s+)?portal_private\.ai_runtime_queue\b/i);
 assert.doesNotMatch(sql,/\b(?:rona_ai_executor_arm|rona_ai_executor_claim|rona_ai_executor_replay)\s*\(/i);
});
test('service-only views and row-level security',()=>{
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/REVOKE ALL ON portal_private\.ai_runtime_dlq_triage_v1 FROM PUBLIC, anon, authenticated/);
 assert.match(sql,/WITH \(security_invoker=true\)/);
 assert.match(sql,/GRANT SELECT ON portal_private\.ai_runtime_dlq_triage_summary_v1 TO service_role/);
 assert.doesNotMatch(sql,/GRANT\s+(?:INSERT|UPDATE|DELETE).*TO\s+(?:anon|authenticated)/i);
});
test('only exact stale historical HEARTBEAT/SYSTEM_CHECK automatically archived',()=>{
 assert.match(sql,/source_type IN \('HEARTBEAT','SYSTEM_CHECK'\)/);
 assert.match(sql,/last_error_code='RUNTIME_RECOVERY_STALE_TECHNICAL'/);
 assert.match(sql,/THEN 'ARCHIVED_TECHNICAL'/);
 assert.match(sql,/ELSE 'REVIEW_REQUIRED'/);
 assert.doesNotMatch(sql,/\bstate\s*=\s*'PROCESSED'/);
});
test('source-terminal events only after verified upstream completion',()=>{
 assert.match(sql,/portal_state IN \('APPLIED','ACKNOWLEDGED'\)/);
 assert.match(sql,/portal_ack='ACKNOWLEDGED'/);
 assert.match(sql,/task_state='COMPLETED'/);
 assert.match(sql,/THEN 'SOURCE_TERMINAL'/);
 assert.doesNotMatch(sql,/portal_state IN \('QUEUED','PROCESSING','FAILED'\)/);
});
test('commit and potentially superseded versions remain reviewable',()=>{
 assert.match(sql,/COORDINATION_SUPERSEDED_REVIEW/);
 assert.match(sql,/COMMIT_OUTCOME_REVIEW/);
 assert.match(sql,/PORTAL_SOURCE_REVIEW/);
 assert.match(sql,/UNCLASSIFIED_NEW_DEAD_LETTER/);
 assert.match(sql,/WHERE q\.state='DEAD_LETTER'/);
});
test('rollback affects sidecar only, not runtime queue',()=>{
 assert.match(undo,/DROP TABLE IF EXISTS portal_private\.ai_runtime_dlq_triage_v1/);
 assert.doesNotMatch(undo,/\b(?:DROP|DELETE|TRUNCATE|UPDATE)\s+(?:TABLE\s+|FROM\s+)?portal_private\.ai_runtime_queue\b/i);
});
