-- Rollback metadata only; never alter original queues, v1 ledger, coordination or portal sources.
BEGIN;
DROP VIEW IF EXISTS portal_private.ai_runtime_dlq_review_worklist_v2;
DROP VIEW IF EXISTS portal_private.ai_runtime_dlq_effective_summary_v2;
DROP VIEW IF EXISTS portal_private.ai_runtime_dlq_effective_v2;
DROP TABLE IF EXISTS portal_private.ai_runtime_dlq_evidence_v2;
DROP FUNCTION IF EXISTS portal_private.ai_runtime_dlq_evidence_v2_immutable();
COMMIT;
