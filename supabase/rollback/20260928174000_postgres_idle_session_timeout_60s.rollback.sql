-- ROLLBACK ONLY — do not run automatically.
-- Restores the exact pre-write #13 postgres role idle_session_timeout.

alter role postgres set idle_session_timeout = '15s';
