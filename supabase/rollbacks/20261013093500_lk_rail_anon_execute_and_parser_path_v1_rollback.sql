-- Reversible exact pre-migration grant/search_path state; use only on controlled rollback.
-- Original 2026-10-13 catalog: anon explicit EXECUTE on two exact Rail functions;
-- portal_private.mi_curve_code_value_v1 had NULL proconfig.
BEGIN;
ALTER FUNCTION portal_private.mi_curve_code_value_v1(text,text) RESET search_path;
GRANT EXECUTE ON FUNCTION public.rona_admin_rail_monitoring_complete_v1(text) TO anon;
GRANT EXECUTE ON FUNCTION public.rona_admin_rail_monitoring_lifecycle_v1() TO anon;
COMMIT;
