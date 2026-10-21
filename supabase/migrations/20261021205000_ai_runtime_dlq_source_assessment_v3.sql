-- DLQ FINAL SOURCE CHECK, scoped to 296 previously unresolved old model deliveries.
-- Does not assert business completion unless the canonical source is terminal.
-- All 1207 historical model queue rows stay unchanged; no replay or model arm.
CREATE TABLE portal_private.ai_runtime_dlq_source_assessment_v3(
 queue_id uuid PRIMARY KEY REFERENCES portal_private.ai_runtime_dlq_triage_v1(queue_id) ON DELETE RESTRICT,
 disposition text NOT NULL CHECK(disposition IN('TASK_COMPLETED_PROVEN','CANCELLED_DEAL_HOLD_PROVEN','SOURCE_ACTION_UNVERIFIED')),
 source_type text NOT NULL,
 original_target_role text NOT NULL,
 effective_target_role text NOT NULL,
 source_record_id uuid,
 target_type text,
 target_id text,
 record_type text,
 original_record_status text,
 canonical_source_state text,
 followup_action text,
 source_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
 policy_version text NOT NULL DEFAULT 'AI_RUNTIME_DLQ_SOURCE_ASSESSMENT_V3',
 assessed_at timestamptz NOT NULL DEFAULT now(),
 assessed_by text NOT NULL DEFAULT 'AI-SYSTEM-ADMIN',
 CHECK(disposition<>'SOURCE_ACTION_UNVERIFIED' OR (followup_action IS NOT NULL AND effective_target_role IS NOT NULL))
);
ALTER TABLE portal_private.ai_runtime_dlq_source_assessment_v3 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON portal_private.ai_runtime_dlq_source_assessment_v3 FROM PUBLIC,anon,authenticated;
GRANT SELECT ON portal_private.ai_runtime_dlq_source_assessment_v3 TO service_role;
CREATE INDEX ai_runtime_dlq_source_assessment_v3_work_idx
 ON portal_private.ai_runtime_dlq_source_assessment_v3(disposition,effective_target_role,record_type);
CREATE OR REPLACE FUNCTION portal_private.ai_runtime_dlq_source_assessment_v3_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'pg_catalog','portal_private'
AS $body$ BEGIN RAISE EXCEPTION 'AI_RUNTIME_DLQ_SOURCE_ASSESSMENT_V3_IMMUTABLE'; END $body$;
CREATE TRIGGER ai_runtime_dlq_source_assessment_v3_reject_change
 BEFORE UPDATE OR DELETE ON portal_private.ai_runtime_dlq_source_assessment_v3
 FOR EACH ROW EXECUTE FUNCTION portal_private.ai_runtime_dlq_source_assessment_v3_immutable();

WITH raw AS (
 SELECT v.queue_id,q.source_type,q.target_role::text original_target_role,q.source_record_id,q.created_at queue_created_at,q.last_error_code,
 c.record_type,c.target_type,c.target_id,c.status original_record_status,c.created_at source_created_at,
 st.status::text task_status,st.assigned_functional_role::text assigned_task_role,st.updated_at task_updated_at,
 d.business_status, d.lifecycle_state::text deal_lifecycle,d.authority_state::text deal_authority,d.closed_at,
 evt.processing_state::text portal_processing_state,evt.acknowledgement_state::text portal_ack,
 evt.lifecycle_state::text portal_lifecycle,evt.event_type::text portal_event_type,evt.updated_at portal_updated_at
 FROM portal_private.ai_runtime_dlq_review_worklist_v2 v
 JOIN portal_private.ai_runtime_queue q ON q.id=v.queue_id AND q.state='DEAD_LETTER'
 LEFT JOIN portal_private.ai_coordination_records c ON q.source_type='COORDINATION' AND c.record_id=q.source_record_id
 LEFT JOIN portal_private.staff_tasks st ON c.target_type='TASK' AND st.task_id=c.target_id
 LEFT JOIN portal_private.deals d ON c.target_type='DEAL' AND d.deal_id=c.target_id
 LEFT JOIN portal_private.portal_reverse_events evt ON q.source_type='PORTAL_REVERSE_EVENT' AND evt.id=q.source_record_id
), checked AS (
 SELECT r.*,
 CASE WHEN target_type='TASK' AND task_status='COMPLETED' THEN 'TASK_COMPLETED_PROVEN'
 WHEN target_type='DEAL' AND business_status='CANCELLED' AND deal_lifecycle='CLOSED' AND deal_authority='CONFIRMED'
      AND original_record_status IN('HOLD','REJECT') THEN 'CANCELLED_DEAL_HOLD_PROVEN'
 ELSE 'SOURCE_ACTION_UNVERIFIED' END AS disposition,
 CASE WHEN original_target_role='MARKET_ANALYST' THEN 'COMMERCIAL_DIRECTOR'
      ELSE original_target_role END effective_target_role
 FROM raw r
), classified AS (
 SELECT c.*,
 CASE
 WHEN disposition<>'SOURCE_ACTION_UNVERIFIED' THEN NULL
 WHEN source_type='PORTAL_REVERSE_EVENT' AND portal_processing_state IN('QUEUED','PROCESSING','FAILED') THEN
   'Check exact portal event, source client response and authoritative task; no replay or synthetic acknowledgment'
 WHEN record_type='HANDOFF_REQUEST' THEN
   'Verify original handoff request against target authority and current latest role response; perform only via canonical role workflow'
 WHEN record_type='BUSINESS_CHANGE_PROPOSAL' THEN
   'Verify exact proposal, any Owner/Operations decision and whether an authorized source operation was materially executed'
 WHEN record_type='OPERATIONS_INTERNAL_DECISION' THEN
   'Verify downstream stage after the recorded Operations decision; do not equate approval-for-next-stage to actual execution'
 WHEN record_type='FUNCTIONAL_CONCLUSION' THEN
   'Verify latest functional conclusion and outstanding mandatory conditions for exact authority target'
 ELSE 'Escalate unknown original event to the role owner after source-lock check'
 END AS followup_action,
 CASE WHEN disposition<>'SOURCE_ACTION_UNVERIFIED' THEN 'CANONICAL_TERMINAL_PROVEN'
 WHEN source_type='PORTAL_REVERSE_EVENT' THEN coalesce(portal_processing_state,'MISSING_PORTAL_EVENT')
 WHEN target_type='TASK' THEN coalesce(task_status,'MISSING_STAFF_TASK')
 WHEN target_type='DEAL' THEN coalesce(business_status,'MISSING_DEAL')
 ELSE coalesce(original_record_status,'MISSING_ORIGIN_RECORD') END canonical_source_state
 FROM checked c
)
INSERT INTO portal_private.ai_runtime_dlq_source_assessment_v3
(queue_id,disposition,source_type,original_target_role,effective_target_role,source_record_id,target_type,target_id,
 record_type,original_record_status,canonical_source_state,followup_action,source_evidence)
SELECT queue_id,disposition,source_type,original_target_role,effective_target_role,source_record_id,target_type,target_id,
 record_type,original_record_status,canonical_source_state,followup_action,
 jsonb_build_object(
 'historical_model_error',last_error_code,'original_queue_created_at',queue_created_at,
 'original_coordination_created_at',source_created_at,
 'task_status',task_status,'task_role',assigned_task_role,'task_status_updated_at',task_updated_at,
 'deal_business_status',business_status,'deal_lifecycle',deal_lifecycle,'deal_authority',deal_authority,'deal_closed_at',closed_at,
 'portal_event_type',portal_event_type,'portal_processing_state',portal_processing_state,
 'portal_ack_state',portal_ack,'portal_lifecycle',portal_lifecycle,'portal_status_updated_at',portal_updated_at,
 'model_replay_allowed',false,
 'technical_delivery_close_only',true,
 'source_business_execution_proven',disposition='TASK_COMPLETED_PROVEN',
 'owner_reference','OWNER_2026_10_21_COMPLETE_SOURCE_TRIAGE'
 )
FROM classified
ON CONFLICT(queue_id) DO NOTHING;

CREATE VIEW portal_private.ai_runtime_dlq_final_state_v3
WITH(security_invoker=true) AS
SELECT v.queue_id,v.source_type,v.target_role,v.last_error_code,v.created_at,
 v.resolution previous_disposition,
 coalesce(x.disposition,v.resolution) AS disposition,
 x.effective_target_role,x.target_type,x.target_id,x.record_type,x.canonical_source_state,x.followup_action,
 x.assessed_at,
 (coalesce(x.disposition,v.resolution)='SOURCE_ACTION_UNVERIFIED') AS action_still_unverified
FROM portal_private.ai_runtime_dlq_effective_v2 v
LEFT JOIN portal_private.ai_runtime_dlq_source_assessment_v3 x ON x.queue_id=v.queue_id;

CREATE VIEW portal_private.ai_runtime_dlq_final_summary_v3
WITH(security_invoker=true) AS
SELECT disposition,count(*)::int AS records FROM portal_private.ai_runtime_dlq_final_state_v3 GROUP BY disposition;

CREATE VIEW portal_private.ai_runtime_dlq_source_actions_v3
WITH(security_invoker=true) AS
SELECT a.queue_id,a.source_record_id,a.target_type,a.target_id,a.record_type,a.original_record_status,
 a.original_target_role,a.effective_target_role,a.canonical_source_state,a.followup_action,
 q.last_error_code,q.created_at AS source_queue_created_at,
 CASE WHEN a.source_type='PORTAL_REVERSE_EVENT' THEN 'P0_PORTAL_SOURCE'
      WHEN a.target_type='PAYMENT' THEN 'P0_PAYMENT_AUTHORITY'
      WHEN q.last_error_code LIKE 'RPC_RONA_AI_EXECUTOR_COMMIT%FAILED' THEN 'P1_COMMIT_OUTCOME'
      WHEN a.target_type='TASK' THEN 'P1_TASK_AUTHORITY'
      WHEN a.record_type='HANDOFF_REQUEST' THEN 'P1_HANDOFF_RESPONSE'
      ELSE 'P2_SOURCE_RECONCILIATION' END AS review_priority,
 a.source_evidence
FROM portal_private.ai_runtime_dlq_source_assessment_v3 a
JOIN portal_private.ai_runtime_queue q ON q.id=a.queue_id
WHERE a.disposition='SOURCE_ACTION_UNVERIFIED';

CREATE VIEW portal_private.ai_runtime_dlq_source_action_summary_v3
WITH(security_invoker=true) AS
SELECT effective_target_role,review_priority,record_type,count(*)::int AS cases,count(DISTINCT (target_type,target_id))::int AS distinct_targets
FROM portal_private.ai_runtime_dlq_source_actions_v3
GROUP BY effective_target_role,review_priority,record_type;

REVOKE ALL ON portal_private.ai_runtime_dlq_final_state_v3 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON portal_private.ai_runtime_dlq_final_summary_v3 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON portal_private.ai_runtime_dlq_source_actions_v3 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON portal_private.ai_runtime_dlq_source_action_summary_v3 FROM PUBLIC,anon,authenticated;
GRANT SELECT ON portal_private.ai_runtime_dlq_final_state_v3 TO service_role;
GRANT SELECT ON portal_private.ai_runtime_dlq_final_summary_v3 TO service_role;
GRANT SELECT ON portal_private.ai_runtime_dlq_source_actions_v3 TO service_role;
GRANT SELECT ON portal_private.ai_runtime_dlq_source_action_summary_v3 TO service_role;
