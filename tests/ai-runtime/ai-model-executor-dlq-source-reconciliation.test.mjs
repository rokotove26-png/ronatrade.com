import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const m=fs.readFileSync('supabase/migrations/20261021201500_ai_runtime_dlq_source_reconciliation_v2.sql','utf8');
const r=fs.readFileSync('supabase/rollback/20261021201500_ai_runtime_dlq_source_reconciliation_v2.rollback.sql','utf8');
test('prohibit all original queue and business source mutations, arm and replay',()=>{
  assert.doesNotMatch(m,/\bUPDATE\s+portal_private\.ai_runtime_queue\b/i);
  assert.doesNotMatch(m,/\bDELETE\s+FROM\s+portal_private\.ai_runtime_queue\b/i);
  assert.doesNotMatch(m,/\b(?:INSERT\s+INTO|TRUNCATE|ALTER\s+TABLE|DROP\s+TABLE)\s+portal_private\.ai_runtime_queue\b/i);
  assert.doesNotMatch(m,/\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+portal_private\.(?:ai_coordination_records|portal_reverse_events|staff_tasks)\b/i);
  assert.doesNotMatch(m,/rona_ai_executor_arm|ai_runtime_claim|replay_dead_letter/i);
  assert.match(m,/ON CONFLICT\(queue_id\) DO NOTHING/);
});
test('superseded event requires exact same entity and record type newer canonical version',()=>{
  assert.match(m,/nx\.supersedes_id=r\.source_record_id/);
  assert.match(m,/nx\.record_type=r\.record_type/);
  assert.match(m,/nx\.target_type=r\.target_type/);
  assert.match(m,/nx\.target_id=r\.target_id/);
  assert.match(m,/nx\.created_at>=r\.source_created_at/);
  assert.match(m,/business_outcome_verified',false/);
});
test('expired technical signals require age and only heartbeat/system check',()=>{
  assert.match(m,/r\.source_type IN\('HEARTBEAT','SYSTEM_CHECK'\)/);
  assert.match(m,/r\.queue_created_at<'2026-09-21T00:00:00Z'::timestamptz/);
  assert.match(m,/current_monitoring_health_not_proven_by_this_record',true/);
});
test('existing Ops decision must reference exact proposal and occur after source',()=>{
  assert.match(m,/d\.record_type='OPERATIONS_INTERNAL_DECISION'/);
  assert.match(m,/d\.functional_role='OPERATIONS_DIRECTOR'/);
  assert.match(m,/d\.payload->>'record_id'=r\.source_record_id::text/);
  assert.match(m,/d\.created_at>=r\.source_created_at/);
  assert.match(m,/downstream_business_execution_confirmed',false/);
  assert.match(m,/d\.status IN \('APPROVE_FOR_NEXT_STAGE','REJECT','RETURN_FOR_REVISION'\)/);
});
test('immutable private metadata, service-only read and review list',()=>{
  assert.match(m,/ai_runtime_dlq_evidence_v2/);
  assert.match(m,/ON DELETE RESTRICT/);
  assert.match(m,/ENABLE ROW LEVEL SECURITY/);
  assert.match(m,/BEFORE UPDATE OR DELETE/);
  assert.match(m,/APPEND_ONLY/);
  assert.match(m,/REVOKE ALL ON portal_private\.ai_runtime_dlq_evidence_v2 FROM PUBLIC,anon,authenticated/);
  assert.match(m,/GRANT SELECT ON portal_private\.ai_runtime_dlq_review_worklist_v2 TO service_role/);
  assert.match(m,/WHERE d\.remains_actionable_review/);
});
test('rollback only v2 sidecar, v1 classifications and underlying queue remain intact',()=>{
  assert.match(r,/DROP VIEW IF EXISTS portal_private\.ai_runtime_dlq_effective_v2/);
  assert.match(r,/DROP TABLE IF EXISTS portal_private\.ai_runtime_dlq_evidence_v2/);
  assert.doesNotMatch(r,/\b(?:DROP|UPDATE|DELETE|TRUNCATE|INSERT)\s+(?:TABLE\s+|FROM\s+|INTO\s+)?portal_private\.(?:ai_runtime_queue|ai_runtime_dlq_triage_v1|ai_coordination_records|portal_reverse_events)\b/i);
});
