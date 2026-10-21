\set ON_ERROR_STOP on
-- Isolated simulation of the existing Owner-authorized bootstrap (not a replacement production authenticator).
CREATE OR REPLACE FUNCTION public.owner_analytics_admin_bootstrap_core_v1()
RETURNS jsonb LANGUAGE sql AS $core$
 SELECT '{"generatedAt":"fixture","currentAnalytics":null,"marketNewsFeed":[],"publications":[]}'::jsonb
$core$;
