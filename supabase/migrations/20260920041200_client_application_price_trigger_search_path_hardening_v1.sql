-- Supabase advisor hardening: fix mutable search_path on client application price trigger function.
alter function portal_private.sync_client_application_effective_price()
  set search_path = pg_catalog, portal_private;

-- Trigger-only function: remove direct execution from public portal roles.
revoke all on function portal_private.sync_client_application_effective_price() from public;
revoke all on function portal_private.sync_client_application_effective_price() from anon;
revoke all on function portal_private.sync_client_application_effective_price() from authenticated;
grant execute on function portal_private.sync_client_application_effective_price() to postgres;
