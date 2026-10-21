\set ON_ERROR_STOP on
DO $test$
DECLARE
 v jsonb;
BEGIN
 v:=public.owner_analytics_admin_bootstrap_base_v1();
 IF v->>'gate'<>'OWNER_AUTHORIZED_AUTO_DERIVED_ANALYTICS; LEGACY_MANUAL_PUBLICATIONS_REMAIN_GATED' THEN
   RAISE EXCEPTION 'OWNER_GATE_CHANGED';
 END IF;
 IF NOT (v->'canonicalAnalytics' ? 'argusCaspian') THEN
   RAISE EXCEPTION 'CASPIAN_MISSING_FROM_OWNER_ADMIN_BACKEND';
 END IF;
 IF v->'canonicalAnalytics'->'argusCaspian'->>'available'<>'false' THEN
   RAISE EXCEPTION 'CASPIAN_UNLICENSED_DATA_LEAK';
 END IF;
 IF v->'canonicalAnalytics'->'argus'->>'available'<>'false' THEN
   RAISE EXCEPTION 'EUROBOB_UNLICENSED_DATA_LEAK';
 END IF;
 IF NOT (v->'canonicalAnalytics'->'products' ? 'AI92') THEN
   RAISE EXCEPTION 'LEGACY_ANALYTICS_BROKEN';
 END IF;
 IF jsonb_array_length(v->'marketNewsFeed')<>0 THEN
   RAISE EXCEPTION 'UNRELATED_ADMIN_BOOTSTRAP_MODIFIED';
 END IF;
END
$test$;
