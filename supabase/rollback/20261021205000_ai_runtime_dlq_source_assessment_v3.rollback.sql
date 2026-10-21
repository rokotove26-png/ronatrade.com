-- Remove only v3 source assessment; preserve v1 and v2 ledgers and original queue.
BEGIN;
DROP VIEW IF EXISTS portal_private.ai_runtime_dlq_source_action_summary_v3;
DROP VIEW IF EXISTS portal_private.ai_runtime_dlq_source_actions_v3;
DROP VIEW IF EXISTS portal_private.ai_runtime_dlq_final_summary_v3;
DROP VIEW IF EXISTS portal_private.ai_runtime_dlq_final_state_v3;
DROP TABLE IF EXISTS portal_private.ai_runtime_dlq_source_assessment_v3;
DROP FUNCTION IF EXISTS portal_private.ai_runtime_dlq_source_assessment_v3_immutable();
COMMIT;
