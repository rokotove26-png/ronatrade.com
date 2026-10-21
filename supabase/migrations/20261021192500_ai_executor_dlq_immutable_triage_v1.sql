-- AI Executor DLQ v1: immutable, private technical triage ledger. Never mutate or replay original queue.
-- Owner instruction 2026-10-21: classify historic failures without rewriting business source state.
BEGIN;
CREATE TABLE portal_private.ai_runtime_dlq_triage_v1 (
  queue_id uuid PRIMARY KEY REFERENCES portal_private.ai_runtime_queue(id) ON DELETE RESTRICT,
  resolution text NOT NULL CHECK (resolution IN ('ARCHIVED_TECHNICAL','SOURCE_TERMINAL','REVIEW_REQUIRED')),
  review_lane text NOT NULL,
  source_type text NOT NULL,
  source_error_code text,
  source_state_snapshot text,
  source_record_id uuid,
  triage_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  policy_version text NOT NULL DEFAULT 'AI_RUNTIME_DLQ_TRIAGE_V1',
  classified_at timestamptz NOT NULL DEFAULT now(),
  recorded_by text NOT NULL DEFAULT 'AI-SYSTEM-ADMIN'
);
ALTER TABLE portal_private.ai_runtime_dlq_triage_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON portal_private.ai_runtime_dlq_triage_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT ON portal_private.ai_runtime_dlq_triage_v1 TO service_role;
CREATE INDEX ai_runtime_dlq_triage_resolution_lane_idx ON portal_private.ai_runtime_dlq_triage_v1 (resolution,review_lane);
CREATE OR REPLACE FUNCTION portal_private.ai_runtime_dlq_triage_reject_change_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'pg_catalog','portal_private'
AS $fn$ BEGIN RAISE EXCEPTION 'AI_RUNTIME_DLQ_TRIAGE_APPEND_ONLY'; END $fn$;
CREATE TRIGGER ai_runtime_dlq_triage_immutable
BEFORE UPDATE OR DELETE ON portal_private.ai_runtime_dlq_triage_v1
FOR EACH ROW EXECUTE FUNCTION portal_private.ai_runtime_dlq_triage_reject_change_v1();

WITH source_snapshot AS (
  SELECT q.id,q.source_type,q.last_error_code,q.source_record_id,q.source_id,q.created_at,
    e.processing_state::text AS portal_state,e.acknowledgement_state::text AS portal_ack,
    st.status::text AS task_state,co.status::text AS coordination_state,
    EXISTS(SELECT 1 FROM portal_private.ai_coordination_records nx WHERE nx.supersedes_id=co.record_id) AS coordination_superseded
  FROM portal_private.ai_runtime_queue q
  LEFT JOIN portal_private.portal_reverse_events e
    ON q.source_type='PORTAL_REVERSE_EVENT' AND e.id=q.source_record_id
  LEFT JOIN portal_private.staff_tasks st
    ON q.source_type='STAFF_TASK' AND st.task_id=q.source_id
  LEFT JOIN portal_private.ai_coordination_records co
    ON q.source_type='COORDINATION' AND co.record_id=q.source_record_id
  WHERE q.state='DEAD_LETTER'
), classified AS (
  SELECT s.*,
    CASE
      WHEN source_type IN ('HEARTBEAT','SYSTEM_CHECK')
        AND last_error_code='RUNTIME_RECOVERY_STALE_TECHNICAL'
        THEN 'ARCHIVED_TECHNICAL'
      WHEN source_type='PORTAL_REVERSE_EVENT'
        AND portal_state IN ('APPLIED','ACKNOWLEDGED')
        AND portal_ack='ACKNOWLEDGED'
        THEN 'SOURCE_TERMINAL'
      WHEN source_type='STAFF_TASK' AND task_state='COMPLETED'
        THEN 'SOURCE_TERMINAL'
      ELSE 'REVIEW_REQUIRED'
    END AS resolution,
    COALESCE(portal_state,task_state,coordination_state,'NOT_LINKED') AS source_state
  FROM source_snapshot s
), final AS (
  SELECT c.*,
    CASE
      WHEN resolution='ARCHIVED_TECHNICAL' THEN 'STALE_SERVICE_SIGNAL'
      WHEN resolution='SOURCE_TERMINAL' THEN 'SOURCE_ALREADY_TERMINAL'
      WHEN source_type='COORDINATION' AND coordination_superseded THEN 'COORDINATION_SUPERSEDED_REVIEW'
      WHEN source_type='PORTAL_REVERSE_EVENT' THEN 'PORTAL_SOURCE_REVIEW'
      WHEN last_error_code LIKE 'RPC_RONA_AI_EXECUTOR_COMMIT%FAILED' THEN 'COMMIT_OUTCOME_REVIEW'
      WHEN source_type='COORDINATION' THEN 'COORDINATION_CURRENT_REVIEW'
      ELSE 'TECHNICAL_FAILURE_REVIEW'
    END AS lane
  FROM classified c
)
INSERT INTO portal_private.ai_runtime_dlq_triage_v1
  (queue_id,resolution,review_lane,source_type,source_error_code,source_state_snapshot,source_record_id,triage_evidence)
SELECT id,resolution,lane,source_type,last_error_code,source_state,source_record_id,
  jsonb_build_object(
    'queue_state_at_triage','DEAD_LETTER',
    'queue_created_at',created_at,
    'source_state_at_triage',source_state,
    'coordination_superseded',coordination_superseded,
    'owner_authorization_ref','OWNER:2026-10-21:DLQ_TECHNICAL_TRIAGE',
    'original_queue_row_preserved',true,
    'automatic_replay',false
  )
FROM final
ON CONFLICT(queue_id) DO NOTHING;

CREATE VIEW portal_private.ai_runtime_dlq_triage_current_v1
WITH (security_invoker=true) AS
SELECT q.id AS queue_id,q.source_type,q.target_role,q.created_at,q.last_error_code,
  COALESCE(t.resolution,'REVIEW_REQUIRED') AS resolution,
  COALESCE(t.review_lane,'UNCLASSIFIED_NEW_DEAD_LETTER') AS review_lane,
  t.classified_at
FROM portal_private.ai_runtime_queue q
LEFT JOIN portal_private.ai_runtime_dlq_triage_v1 t ON t.queue_id=q.id
WHERE q.state='DEAD_LETTER';

CREATE VIEW portal_private.ai_runtime_dlq_triage_summary_v1
WITH (security_invoker=true) AS
SELECT resolution,review_lane,count(*)::integer AS records
FROM portal_private.ai_runtime_dlq_triage_current_v1
GROUP BY resolution,review_lane;

REVOKE ALL ON portal_private.ai_runtime_dlq_triage_current_v1 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON portal_private.ai_runtime_dlq_triage_summary_v1 FROM PUBLIC,anon,authenticated;
GRANT SELECT ON portal_private.ai_runtime_dlq_triage_current_v1 TO service_role;
GRANT SELECT ON portal_private.ai_runtime_dlq_triage_summary_v1 TO service_role;
COMMIT;
