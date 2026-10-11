-- V10 rollback only: restore exact source-locked V9 private bridge; no business records touched.
DO $source_check$
BEGIN
 IF position('netbackTariffCoverage' IN pg_get_functiondef('portal_private.market_intelligence_admin_lpg_tariff_bridge_v1(jsonb)'::regprocedure))=0 THEN
  RAISE EXCEPTION 'V10_ROLLBACK_CURRENT_NOT_V10';
 END IF;
END
$source_check$;

CREATE OR REPLACE FUNCTION portal_private.market_intelligence_admin_lpg_tariff_bridge_v1(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','portal_private','auth'
AS $lpg_bridge$
DECLARE
  v_forecast jsonb:=p #> '{canonicalAnalytics,products,LPG,forecast}';
  v_bases jsonb:=p #> '{canonicalAnalytics,products,LPG,rona,bases}';
  v_bridges jsonb:='{}'::jsonb;
  v_month text;
  v_today_month text:=to_char((now() at time zone 'Europe/Moscow')::date,'YYYY-MM');
  r record;
BEGIN
  -- Only sourced, complete, current/future month indicative Platts forecasts.
  -- The agreed pricing calculation is performed by the approved Admin R4
  -- visual contract; the DB supplies approved logistics inputs alone.
  v_month:=v_forecast->>'month';
  IF v_forecast IS NULL OR
     v_month !~ '^[0-9]{4}-[0-9]{2}$' OR
     v_month<v_today_month OR
     nullif(btrim(v_forecast->>'sourceRef'),'') IS NULL OR
     EXISTS(SELECT 1 FROM (VALUES ('low'),('base'),('high')) AS f(field)
       WHERE jsonb_typeof(v_forecast->f.field) IS DISTINCT FROM 'number') OR
     jsonb_typeof(v_bases)<>'array' THEN
     RETURN p;
  END IF;

  FOR r IN
    SELECT b.item->>0 as basis, t.tariff_usd_per_t,
           t.tariff_key,t.route_text,t.source_provider,t.source_refs,
           t.source_version,t.approved_at,t.valid_to
    FROM jsonb_array_elements(v_bases) AS b(item)
    JOIN portal_private.owner_rail_tariff_matrix t
      ON btrim(regexp_replace(t.route_text, '^.*→', ''))=
         substring(b.item->>0 from 5)
    WHERE jsonb_typeof(b.item)='array'
      AND jsonb_array_length(b.item)=2
      AND b.item->>0 LIKE 'CPT %'
      AND t.product_group='LPG_SPBT'
      AND t.route_text LIKE 'Озинки → %'
      AND t.status='WORKING_CONFIRMED'
      AND t.tariff_usd_per_t IS NOT NULL
      AND t.tariff_usd_per_t>0
      AND t.approved_at IS NOT NULL
      AND (t.valid_to IS NULL OR t.valid_to >= (now() at time zone 'Europe/Moscow')::date)
      AND t.source_refs IS NOT NULL AND jsonb_typeof(t.source_refs)='array'
      AND jsonb_array_length(t.source_refs)>0
      -- No arbitrary selection among two valid tariff routes to same CPT.
      AND NOT EXISTS(
        SELECT 1 FROM portal_private.owner_rail_tariff_matrix other
        WHERE other.id<>t.id
          AND other.product_group='LPG_SPBT'
          AND other.route_text LIKE 'Озинки → %'
          AND btrim(regexp_replace(other.route_text,'^.*→',''))=
              substring(b.item->>0 from 5)
          AND other.status='WORKING_CONFIRMED'
          AND other.approved_at IS NOT NULL
          AND other.tariff_usd_per_t IS NOT NULL
          AND (other.valid_to IS NULL OR other.valid_to >= (now() at time zone 'Europe/Moscow')::date)
      )
  LOOP
    v_bridges:=jsonb_set(v_bridges,ARRAY[r.basis],
      jsonb_build_object(
        'model','PLATTS_NETBACK_PLUS_CONFIRMED_RAIL_V1',
        'railUsdT',r.tariff_usd_per_t,
        'route',r.route_text,
        'tariffKey',r.tariff_key,
        'sourceProvider',r.source_provider,
        'sourceRefs',r.source_refs,
        'sourceVersion',r.source_version,
        'tariffStatus','WORKING_CONFIRMED',
        'approvedAt',r.approved_at,
        'validTo',r.valid_to,
        'marketSourceRef',v_forecast->>'sourceRef',
        'marketMonth',v_month,
        'commercialComponent','NOT_INCLUDED'
      ),true);
  END LOOP;
  IF v_bridges='{}'::jsonb THEN RETURN p; END IF;
  RETURN jsonb_set(p,
    '{canonicalAnalytics,products,LPG,rona,netbackTariffBridges}',
    v_bridges,true);
END
$lpg_bridge$;

REVOKE ALL ON FUNCTION portal_private.market_intelligence_admin_lpg_tariff_bridge_v1(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION portal_private.market_intelligence_admin_lpg_tariff_bridge_v1(jsonb) FROM anon, authenticated;
