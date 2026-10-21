-- Second-pass source-locked historical DLQ reconciliation.
-- Append-only technical evidence: do not rewrite queue state, business sources, or v1 classifications.
CREATE TABLE portal_private.ai_runtime_dlq_evidence_v2 (
 queue_id uuid PRIMARY KEY REFERENCES portal_private.ai_runtime_dlq_triage_v1(queue_id) ON DELETE RESTRICT,
 resolution text NOT NULL CHECK (resolution IN('SUPERSEDED_DELIVERY','EXPIRED_PERIODIC_SIGNAL','PROPOSAL_DECISION_RECORDED')),
 source_record_id uuid,
 confirming_record_id uuid,
 source_type text NOT NULL,
 source_error_code text,
 evidence jsonb NOT NULL,
 classification_version text NOT NULL DEFAULT 'AI_RUNTIME_DLQ_SOURCE_RECONCILIATION_V2',
 classified_at timestamptz NOT NULL DEFAULT now(),
 recorded_by text NOT NULL DEFAULT 'AI-SYSTEM-ADMIN',
 CHECK (resolution='EXPIRED_PERIODIC_SIGNAL' OR confirming_record_id IS NOT NULL)
);
ALTER TABLE portal_private.ai_runtime_dlq_evidence_v2 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON portal_private.ai_runtime_dlq_evidence_v2 FROM PUBLIC,anon,authenticated;
GRANT SELECT ON portal_private.ai_runtime_dlq_evidence_v2 TO service_role;
CREATE INDEX ai_runtime_dlq_evidence_v2_resolution_idx ON portal_private.ai_runtime_dlq_evidence_v2(resolution);
CREATE OR REPLACE FUNCTION portal_private.ai_runtime_dlq_evidence_v2_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'pg_catalog','portal_private'
AS $func$ BEGIN RAISE EXCEPTION 'AI_RUNTIME_DLQ_EVIDENCE_V2_APPEND_ONLY'; END $func$;
CREATE TRIGGER ai_runtime_dlq_evidence_v2_reject_change
 BEFORE UPDATE OR DELETE ON portal_private.ai_runtime_dlq_evidence_v2
 FOR EACH ROW EXECUTE FUNCTION portal_private.ai_runtime_dlq_evidence_v2_immutable();

WITH reviewed AS (
 SELECT q.id AS queue_id,q.source_type,q.last_error_code,q.created_at AS queue_created_at,
 q.source_record_id,c.record_type,c.target_type,c.target_id,c.created_at AS source_created_at
 FROM portal_private.ai_runtime_queue q
 JOIN portal_private.ai_runtime_dlq_triage_v1 t ON t.queue_id=q.id AND t.resolution='REVIEW_REQUIRED'
 LEFT JOIN portal_private.ai_coordination_records c ON c.record_id=q.source_record_id AND q.source_type='COORDINATION'
 WHERE q.state='DEAD_LETTER'
), successor AS (
 SELECT DISTINCT ON(r.queue_id)
  r.queue_id,'SUPERSEDED_DELIVERY'::text AS resolution,r.source_record_id,
  nx.record_id AS confirming_record_id,r.source_type,r.last_error_code,
  jsonb_build_object('source_version_superseded',true,'successor_record_id',nx.record_id,
    'source_record_type',r.record_type,'successor_status',nx.status,
    'successor_created_at',nx.created_at,'original_model_event_replay',false,
    'business_outcome_verified',false,
    'note','Only prior delivery version retired; latest canonical version retains own role workflow.') AS evidence
 FROM reviewed r
 JOIN portal_private.ai_coordination_records nx
  ON nx.supersedes_id=r.source_record_id AND nx.record_type=r.record_type
  AND nx.target_type=r.target_type AND nx.target_id=r.target_id AND nx.created_at>=r.source_created_at
 WHERE r.source_type='COORDINATION'
 ORDER BY r.queue_id,nx.created_at DESC,nx.record_id DESC
), stale AS (
 SELECT r.queue_id,'EXPIRED_PERIODIC_SIGNAL'::text AS resolution,r.source_record_id,
  NULL::uuid AS confirming_record_id,r.source_type,r.last_error_code,
  jsonb_build_object('source_type',r.source_type,
    'cutoff','2026-09-21T00:00:00Z','queue_created_at',r.queue_created_at,
    'original_model_event_replay',false,'current_monitoring_health_not_proven_by_this_record',true,
    'note','Expired periodic technical signal is not a pending business action.') AS evidence
 FROM reviewed r
 WHERE r.source_type IN('HEARTBEAT','SYSTEM_CHECK')
 AND r.queue_created_at<'2026-09-21T00:00:00Z'::timestamptz
), decided AS (
 SELECT DISTINCT ON(r.queue_id)
  r.queue_id,'PROPOSAL_DECISION_RECORDED'::text AS resolution,r.source_record_id,
  d.record_id AS confirming_record_id,r.source_type,r.last_error_code,
  jsonb_build_object('proposal_record_id',r.source_record_id,'operations_decision_record_id',d.record_id,
    'operations_decision_status',d.status,'decision_created_at',d.created_at,
    'original_model_event_replay',false,'downstream_business_execution_confirmed',false,
    'note','Decision exists, original proposal delivery must not be repeated; next-stage business actions remain under role/Owner gate.') AS evidence
 FROM reviewed r
 JOIN portal_private.ai_coordination_records d
  ON d.record_type='OPERATIONS_INTERNAL_DECISION'
 AND d.functional_role='OPERATIONS_DIRECTOR'
 AND d.payload->>'record_id'=r.source_record_id::text
 AND d.created_at>=r.source_created_at
 AND d.status IN ('APPROVE_FOR_NEXT_STAGE','REJECT','RETURN_FOR_REVISION')
 WHERE r.source_type='COORDINATION' AND r.record_type='BUSINESS_CHANGE_PROPOSAL'
 ORDER BY r.queue_id,d.created_at DESC,d.record_id DESC
), all_verified AS (
 SELECT * FROM successor
 UNION ALL SELECT * FROM stale
 UNION ALL SELECT * FROM decided
)
INSERT INTO portal_private.ai_runtime_dlq_evidence_v2
 (queue_id,resolution,source_record_id,confirming_record_id,source_type,source_error_code,evidence)
SELECT v.queue_id,v.resolution,v.source_record_id,v.confirming_record_id,v.source_type,v.last_error_code,
v.evidence||jsonb_build_object('owner_authorization','OWNER:2026-10-21:EXECUTE_450_SOURCE_RECONCILIATION',
'operations_gate','OPERATIONS_DIRECTOR_AUDITED_NEXT_STAGE_DECISION')
FROM all_verified v
ON CONFLICT(queue_id) DO NOTHING;

CREATE VIEW portal_private.ai_runtime_dlq_effective_v2
WITH(security_invoker=true) AS
SELECT t.queue_id,q.source_type,q.target_role,q.priority,q.last_error_code,q.created_at,
 t.resolution AS first_pass_resolution,t.review_lane AS first_pass_lane,
 COALESCE(v.resolution,t.resolution) AS resolution,
 COALESCE(v.classified_at,t.classified_at) AS evidence_at,
 v.confirming_record_id,v.evidence,
 (COALESCE(v.resolution,t.resolution)='REVIEW_REQUIRED') AS remains_actionable_review
FROM portal_private.ai_runtime_dlq_triage_v1 t
JOIN portal_private.ai_runtime_queue q ON q.id=t.queue_id AND q.state='DEAD_LETTER'
LEFT JOIN portal_private.ai_runtime_dlq_evidence_v2 v ON v.queue_id=t.queue_id;

CREATE VIEW portal_private.ai_runtime_dlq_effective_summary_v2
WITH(security_invoker=true) AS
SELECT resolution,count(*)::int AS records
FROM portal_private.ai_runtime_dlq_effective_v2
GROUP BY resolution;

CREATE VIEW portal_private.ai_runtime_dlq_review_worklist_v2
WITH(security_invoker=true) AS
SELECT d.queue_id,q.source_record_id,q.source_type,q.target_role,q.priority,q.last_error_code,q.created_at,
 t.review_lane AS triage_lane,co.record_type AS coordination_type,co.status AS coordination_state,
 evt.processing_state::text AS portal_processing_state,
 evt.acknowledgement_state::text AS portal_ack_state,
 d.first_pass_resolution
FROM portal_private.ai_runtime_dlq_effective_v2 d
JOIN portal_private.ai_runtime_queue q ON q.id=d.queue_id
JOIN portal_private.ai_runtime_dlq_triage_v1 t ON t.queue_id=q.id
LEFT JOIN portal_private.ai_coordination_records co ON q.source_type='COORDINATION' AND co.record_id=q.source_record_id
LEFT JOIN portal_private.portal_reverse_events evt ON q.source_type='PORTAL_REVERSE_EVENT' AND evt.id=q.source_record_id
WHERE d.remains_actionable_review;

REVOKE ALL ON portal_private.ai_runtime_dlq_effective_v2 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON portal_private.ai_runtime_dlq_effective_summary_v2 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON portal_private.ai_runtime_dlq_review_worklist_v2 FROM PUBLIC,anon,authenticated;
GRANT SELECT ON portal_private.ai_runtime_dlq_effective_v2 TO service_role;
GRANT SELECT ON portal_private.ai_runtime_dlq_effective_summary_v2 TO service_role;
GRANT SELECT ON portal_private.ai_runtime_dlq_review_worklist_v2 TO service_role;
