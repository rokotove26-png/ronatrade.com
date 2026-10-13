BEGIN;

-- Fail closed if the live objects no longer match the audited security contract.
DO $guard$
DECLARE
  v_complete text;
  v_lifecycle text;
BEGIN
  IF to_regclass('public.rona_market_news') IS NULL
     OR to_regclass('public.rona_market_news_sync_state') IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_MARKET_NEWS_TABLES_MISSING';
  END IF;
  IF to_regprocedure('public.rona_admin_rail_monitoring_complete_v1(text)') IS NULL
     OR to_regprocedure('public.rona_admin_rail_monitoring_lifecycle_v1()') IS NULL THEN
    RAISE EXCEPTION 'ADMIN_RAIL_MONITORING_RPC_MISSING';
  END IF;

  v_complete := pg_get_functiondef(to_regprocedure('public.rona_admin_rail_monitoring_complete_v1(text)'));
  v_lifecycle := pg_get_functiondef(to_regprocedure('public.rona_admin_rail_monitoring_lifecycle_v1()'));
  IF position('application_owner_admin_actor_v2' IN v_complete)=0
     OR position('application_owner_admin_actor_v2' IN v_lifecycle)=0 THEN
    RAISE EXCEPTION 'ADMIN_RAIL_RPC_ADMIN_GUARD_MISSING';
  END IF;
END
$guard$;

-- These raw/internal tables have RLS enabled but no policies. API roles must not
-- retain direct grants; server-side service-role and SECURITY DEFINER workflows remain intact.
REVOKE ALL PRIVILEGES ON TABLE public.rona_market_news FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.rona_market_news_sync_state FROM PUBLIC, anon, authenticated;

-- Both RPCs perform an explicit current-session ADMIN check. Only authenticated
-- callers need EXECUTE; anonymous invocation has no legitimate product use.
REVOKE EXECUTE ON FUNCTION public.rona_admin_rail_monitoring_complete_v1(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rona_admin_rail_monitoring_lifecycle_v1() FROM PUBLIC, anon;

-- This parser is not SECURITY DEFINER and uses only pg_catalog built-ins.
ALTER FUNCTION portal_private.mi_curve_code_value_v1(text, text) SET search_path TO pg_catalog;

COMMIT;
