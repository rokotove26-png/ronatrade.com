import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const sql=fs.readFileSync('supabase/migrations/20261021205000_ai_runtime_dlq_source_assessment_v3.sql','utf8');
const rollback=fs.readFileSync('supabase/rollback/20261021205000_ai_runtime_dlq_source_assessment_v3.rollback.sql','utf8');
test('do not alter original queue or business data',()=>{
  for(const table of ['ai_runtime_queue','ai_coordination_records','portal_reverse_events','staff_tasks','deals','payments','contracts','documents']){
    assert.doesNotMatch(sql,new RegExp('\\b(?:UPDATE|DELETE\\s+FROM|TRUNCATE|INSERT\\s+INTO|ALTER\\s+TABLE|DROP\\s+TABLE)\\s+portal_private\\.'+table+'\\b','i'));
    assert.doesNotMatch(rollback,new RegExp('\\b(?:UPDATE|DELETE\\s+FROM|TRUNCATE|INSERT\\s+INTO|ALTER\\s+TABLE|DROP\\s+TABLE)\\s+portal_private\\.'+table+'\\b','i'));
  }
  assert.doesNotMatch(sql,/rona_ai_executor_arm|rona_ai_executor_claim|replay\s*\(/i);
  assert.match(sql,/ON CONFLICT\(queue_id\) DO NOTHING/);
});
test('completed tasks require canonical staff status',()=>{
  assert.match(sql,/target_type='TASK' AND task_status='COMPLETED'/);
  assert.match(sql,/TASK_COMPLETED_PROVEN/);
});
test('cancelled Deals must have signed authority plus matching hold or rejection',()=>{
  assert.match(sql,/business_status='CANCELLED'/);
  assert.match(sql,/deal_lifecycle='CLOSED'/);
  assert.match(sql,/deal_authority='CONFIRMED'/);
  assert.match(sql,/original_record_status IN\('HOLD','REJECT'\)/);
});
test('unknown business outcomes are never auto marked completed',()=>{
  assert.match(sql,/ELSE 'SOURCE_ACTION_UNVERIFIED'/);
  assert.match(sql,/action_still_unverified/);
  assert.match(sql,/source_business_execution_proven',disposition='TASK_COMPLETED_PROVEN'/);
  assert.match(sql,/model_replay_allowed',false/);
});
test('cases retained individually and routed to correct canonical roles',()=>{
  assert.match(sql,/REFERENCES portal_private\.ai_runtime_dlq_triage_v1\(queue_id\)/);
  assert.match(sql,/ai_runtime_dlq_review_worklist_v2/);
  assert.match(sql,/WHEN original_target_role='MARKET_ANALYST' THEN 'COMMERCIAL_DIRECTOR'/);
  assert.match(sql,/source_record_id/);
  assert.match(sql,/effective_target_role/);
  assert.match(sql,/P0_PORTAL_SOURCE/);
  assert.match(sql,/P0_PAYMENT_AUTHORITY/);
  assert.match(sql,/P1_COMMIT_OUTCOME/);
});
test('RLS private, append only, view invoker and safe rollback',()=>{
  assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
  assert.match(sql,/BEFORE UPDATE OR DELETE/);
  assert.match(sql,/ASSESSMENT_V3_IMMUTABLE/);
  assert.match(sql,/WITH\(security_invoker=true\)/);
  assert.match(sql,/GRANT SELECT ON portal_private\.ai_runtime_dlq_source_actions_v3 TO service_role/);
  assert.match(sql,/REVOKE ALL ON portal_private\.ai_runtime_dlq_source_assessment_v3 FROM PUBLIC,anon,authenticated/);
  assert.match(rollback,/DROP TABLE IF EXISTS portal_private\.ai_runtime_dlq_source_assessment_v3/);
  assert.doesNotMatch(rollback,/ai_runtime_dlq_triage_v1|ai_runtime_dlq_evidence_v2/);
});
