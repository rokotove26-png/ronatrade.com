-- RONA Trade admin/runtime recent queue read optimization.
-- Candidate write #14, 2026-09-28.
-- Exact production query:
--   qa_only=false
--   source_type in ('PORTAL_REVERSE_EVENT','STAFF_TASK','COORDINATION')
--   order by created_at desc
--   limit 24
--
-- Current production EXPLAIN scans ~992 rows, touches ~3,928 shared blocks,
-- then performs a top-N sort. pg_stat_statements: 914 calls, mean ~616 ms,
-- max ~12.9 s. This partial ordered index lets Postgres start from the newest
-- matching rows and stop after the required 24 heap fetches.
--
-- No business facts, authority, queue state, or runtime cadence are changed.

create index if not exists ai_runtime_queue_admin_recent_idx_v1
on portal_private.ai_runtime_queue (created_at desc)
where qa_only=false
  and source_type in ('PORTAL_REVERSE_EVENT','STAFF_TASK','COORDINATION');

analyze portal_private.ai_runtime_queue;
