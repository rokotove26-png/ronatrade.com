-- Roll back only the technical DLQ triage sidecar; never delete or modify ai_runtime_queue.
-- This drops metadata classifications, NOT source queue or business records.
BEGIN;
DROP VIEW IF EXISTS portal_private.ai_runtime_dlq_triage_summary_v1;
DROP VIEW IF EXISTS portal_private.ai_runtime_dlq_triage_current_v1;
DROP TABLE IF EXISTS portal_private.ai_runtime_dlq_triage_v1;
DROP FUNCTION IF EXISTS portal_private.ai_runtime_dlq_triage_reject_change_v1();
COMMIT;
