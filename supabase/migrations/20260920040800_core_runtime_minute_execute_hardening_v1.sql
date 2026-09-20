-- Restrict the cron coordinator to the database owner/runtime only.
-- The function lives in portal_private, but default function privileges grant EXECUTE to PUBLIC.
revoke all on function portal_private.run_core_runtime_minute_v1() from public;
revoke all on function portal_private.run_core_runtime_minute_v1() from anon;
revoke all on function portal_private.run_core_runtime_minute_v1() from authenticated;
grant execute on function portal_private.run_core_runtime_minute_v1() to postgres;
