-- LK post-acceptance least-privilege correction: two exact Admin Rail RPCs,
-- and an internal immutable text parser with a fixed PostgreSQL search_path.
-- No table writes, index drop, role widening or schema object deletion.
-- Source-lock live grants 2026-10-13: direct EXECUTE to anon,
-- authenticated, service_role, postgres; no PUBLIC EXECUTE entry.
BEGIN;

DO $guard$
BEGIN
  IF to_regprocedure('public.rona_admin_rail_monitoring_complete_v1(text)') IS NULL
    OR to_regprocedure('public.rona_admin_rail_monitoring_lifecycle_v1()') IS NULL
    OR to_regprocedure('portal_private.mi_curve_code_value_v1(text,text)') IS NULL
  THEN
    RAISE EXCEPTION 'LK_CLEANUP_SOURCE_LOCK_FUNCTION_MISSING';
  END IF;
  IF NOT has_function_privilege('authenticated','public.rona_admin_rail_monitoring_complete_v1(text)','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.rona_admin_rail_monitoring_lifecycle_v1()','EXECUTE')
  THEN
    RAISE EXCEPTION 'LK_CLEANUP_AUTHORIZED_RAIL_CALLER_MISSING';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.oid=to_regprocedure('portal_private.mi_curve_code_value_v1(text,text)')
      AND p.prosecdef
  ) THEN
    RAISE EXCEPTION 'LK_CLEANUP_INTERNAL_PARSER_SECURITY_MODE_DRIFT';
  END IF;
END
$guard$;

-- Anonymous callers were already denied by portal_private.application_owner_admin_actor_v2().
-- Revoke only unnecessary explicit grants; preserve authenticated and service-role callers.
REVOKE EXECUTE ON FUNCTION public.rona_admin_rail_monitoring_complete_v1(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rona_admin_rail_monitoring_lifecycle_v1() FROM anon;

-- pg_catalog-only builtins (regexp_match, upper) need no caller-defined search path.
ALTER FUNCTION portal_private.mi_curve_code_value_v1(text,text)
  SET search_path TO pg_catalog, pg_temp;

DO $verify$
BEGIN
  IF has_function_privilege('anon','public.rona_admin_rail_monitoring_complete_v1(text)','EXECUTE')
    OR has_function_privilege('anon','public.rona_admin_rail_monitoring_lifecycle_v1()','EXECUTE')
  THEN
    RAISE EXCEPTION 'LK_CLEANUP_ANON_RAIL_EXECUTE_STILL_GRANTED';
  END IF;
  IF NOT has_function_privilege('authenticated','public.rona_admin_rail_monitoring_complete_v1(text)','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.rona_admin_rail_monitoring_lifecycle_v1()','EXECUTE')
  THEN
    RAISE EXCEPTION 'LK_CLEANUP_AUTHENTICATED_RAIL_EXECUTE_REGRESSED';
  END IF;
END
$verify$;
COMMIT;
