-- OWNER 2026-10-11 / SYSTEM_ADMIN / V9. Restores previously agreed
-- Platts next-month netback + current confirmed RONA rail tariff per CPT destination.
-- Quote and tariff facts are NOT created by this migration. Admin-only extension.
-- PREDECESSOR_OWNER_BOOTSTRAP_PG_MD5=973c775f6d984fe5b293510270dba9be
DO $source_lock$
BEGIN
  IF md5(pg_get_functiondef('public.owner_analytics_admin_bootstrap()'::regprocedure))
       <> '973c775f6d984fe5b293510270dba9be' THEN
    RAISE EXCEPTION 'V9_OWNER_ANALYTICS_PREDECESSOR_SOURCE_DRIFT';
  END IF;
END
$source_lock$;

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

-- Existing SECURITY DEFINER owner scope remains unchanged; its auth gate
-- in owner_analytics_admin_bootstrap_core_v1() executes before this overlay.

CREATE OR REPLACE FUNCTION public.owner_analytics_admin_bootstrap()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'portal_private', 'auth'
AS $function$
DECLARE
  v jsonb;
  r record;
  vals jsonb;
  n int;
  ref numeric;
  fc jsonb;
  curve jsonb;
  daily jsonb;
  trade_date date;
BEGIN
  v:=public.owner_analytics_admin_bootstrap_base_v1();

  FOR r IN
    SELECT * FROM (VALUES
      ('AI92'::text,'АИ-92'::text),
      ('AI95'::text,'АИ-95'::text),
      ('DT'::text,'ДТ'::text),
      ('LPG'::text,'СУГ'::text)
    ) x(k,product)
  LOOP
    vals:=v #> ARRAY['canonicalAnalytics','products',r.k,'values'];
    ref:=NULL;
    IF jsonb_typeof(vals)='array' THEN
      n:=jsonb_array_length(vals);
      IF n>0 AND (vals->>(n-1)) ~ '^-?[0-9]+([.][0-9]+)?$' THEN
        ref:=(vals->>(n-1))::numeric;
      END IF;
    END IF;

    SELECT jsonb_build_object(
      'month',to_char(s.target_month,'YYYY-MM'),
      'low',s.low_usd_t,'base',s.base_usd_t,'high',s.high_usd_t,
      'forward',s.forward_implied_usd_t,'direction',s.direction,
      'confidence',s.confidence,'curveType',s.curve_type,
      'reference',ref,'sourceRef',s.source_ref
    )
    INTO fc
    FROM portal_private.market_intelligence_forecast_snapshots s
    WHERE s.product=r.product AND s.model_version='RONA_FULL_PLATTS_CURVE_V1'
    ORDER BY s.target_month DESC,s.created_at DESC
    LIMIT 1;

    IF fc IS NOT NULL THEN
      v:=jsonb_set(v,ARRAY['canonicalAnalytics','products',r.k,'forecast'],
        coalesce(v #> ARRAY['canonicalAnalytics','products',r.k,'forecast'],'{}'::jsonb)||fc,true);
    END IF;
    IF ref IS NOT NULL AND r.k NOT IN ('DT','LPG') THEN
      v:=jsonb_set(v,ARRAY['canonicalAnalytics','products',r.k,'rona','reference'],to_jsonb(ref),true);
    END IF;

    -- Exactly the same audited DAILY observed price monitor used for Client.
    -- Never plot maturity points (M1/M2/M3) as a time series.
    IF r.k IN ('DT','LPG') THEN
      trade_date:=to_date(v #>> '{canonicalAnalytics,latestTradeDate}','DD.MM.YYYY');
      daily:=portal_private.market_intelligence_daily_monitor_v1(r.product,trade_date);
      IF daily IS NOT NULL AND daily->>'version'='RONA_MARKET_OBSERVED_DAILY_V1' THEN
        v:=jsonb_set(v,ARRAY['canonicalAnalytics','products',r.k,'dates'],coalesce(daily->'dates','[]'::jsonb),true);
        v:=jsonb_set(v,ARRAY['canonicalAnalytics','products',r.k,'values'],coalesce(daily->'values','[]'::jsonb),true);
        v:=jsonb_set(v,ARRAY['canonicalAnalytics','products',r.k,'basis'],to_jsonb(daily->>'basis'),true);
        v:=jsonb_set(v,ARRAY['canonicalAnalytics','products',r.k,'dailyMonitor'],daily,true);
      END IF;
    END IF;
    -- Financial term structures are metadata for the forecast only; never chart maturities as daily prices.
    IF r.k IN ('DT','LPG') THEN
      trade_date:=to_date(v #>> '{canonicalAnalytics,latestTradeDate}','DD.MM.YYYY');
      curve:=portal_private.market_intelligence_admin_forward_term_structure_v1(r.product,trade_date);
      IF curve IS NOT NULL THEN
        v:=jsonb_set(v,ARRAY['canonicalAnalytics','products',r.k,'termCurve'],curve,true);
      END IF;
    END IF;
  END LOOP;
  RETURN portal_private.market_intelligence_admin_lpg_tariff_bridge_v1(v);
END
$function$
;
