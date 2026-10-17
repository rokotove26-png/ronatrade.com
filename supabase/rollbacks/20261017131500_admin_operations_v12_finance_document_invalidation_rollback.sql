-- Operations V12 signal-only rollback; never alters Finance or business records.
DROP TRIGGER IF EXISTS rona_admin_operations_signal_v1 ON portal_private.deal_finance_authority_v7;
DROP TRIGGER IF EXISTS rona_admin_operations_signal_v1 ON portal_private.finance_signed_schedule_jobs_v8;
DROP TRIGGER IF EXISTS rona_admin_operations_signal_v1 ON portal_private.document_versions;
