-- Only revert additive Argus technical functions; preserve all source/archive/market data.
-- Remove opt-in read wrapper before its dependent source readers.
REVOKE ALL ON FUNCTION portal_private.market_intelligence_admin_argus_sources_v1() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION portal_private.market_intelligence_argus_caspian_materialize_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION portal_private.market_intelligence_argus_eurobob_payload_v1() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION portal_private.market_intelligence_argus_caspian_payload_v1() FROM PUBLIC,anon,authenticated,service_role;
DROP FUNCTION IF EXISTS portal_private.market_intelligence_admin_argus_sources_v1();
DROP FUNCTION IF EXISTS portal_private.market_intelligence_argus_caspian_materialize_v1(uuid,uuid);
DROP FUNCTION IF EXISTS portal_private.market_intelligence_argus_eurobob_payload_v1();
DROP FUNCTION IF EXISTS portal_private.market_intelligence_argus_caspian_payload_v1();
