-- ROLLBACK for 20261012173000_revoke_unneeded_public_api_grants_v1.sql
-- Execute only if reverting this migration after confirming the audited baseline is still desired.
BEGIN;
GRANT SELECT ON TABLE public.rona_market_news TO anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.rona_market_news_sync_state TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rona_admin_rail_monitoring_complete_v1(text) TO anon;
GRANT EXECUTE ON FUNCTION public.rona_admin_rail_monitoring_lifecycle_v1() TO anon;
ALTER FUNCTION portal_private.mi_curve_code_value_v1(text, text) RESET search_path;
COMMIT;
