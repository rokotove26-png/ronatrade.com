-- Restore exact previous owner admin bootstrap; does not modify quote tables or users.
CREATE OR REPLACE FUNCTION public.owner_analytics_admin_bootstrap_base_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'portal_private', 'auth'
AS $function$
declare v jsonb;
begin
  v:=public.owner_analytics_admin_bootstrap_core_v1();
  v:=jsonb_set(v,'{canonicalAnalytics}',portal_private.market_intelligence_admin_canonical_payload_v1(),true);
  return jsonb_set(v,'{gate}',to_jsonb('OWNER_AUTHORIZED_AUTO_DERIVED_ANALYTICS; LEGACY_MANUAL_PUBLICATIONS_REMAIN_GATED'::text),true);
end;
$function$;
