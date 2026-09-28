-- RONA Trade DB connection stability: relax postgres role idle session timeout.
-- Candidate write #13, 2026-09-28.
-- Current production setting is 15s (role-level). Last 24h telemetry showed
-- 3184 forced postgres.js idle-session terminations and no connection-limit errors.
-- Raise only the postgres role idle_session_timeout to 60s to reduce reconnect churn
-- while retaining a finite server-side idle-session cap.
-- No cron cadence, function logic, schema objects, or business data are changed.

alter role postgres set idle_session_timeout = '60s';
