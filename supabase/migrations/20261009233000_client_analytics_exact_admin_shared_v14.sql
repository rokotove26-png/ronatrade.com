-- 100% Admin Analytics canonical data/forecast/daily monitor, read-only Client projection.
-- The body is copied from the approved Admin enrichment routine with only the Admin-only
-- bootstrap replaced by the canonical market payload and canonicalAnalytics extracted.
-- The Client receives NO role-based or published-product filtering inside Analytics.
-- Portal authentication remains mandatory; this does not grant Admin API access.
BEGIN;
CREATE OR REPLACE FUNCTION portal_private.market_intelligence_admin_client_shared_payload_v14()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY INVOKER
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
  v:=jsonb_build_object('canonicalAnalytics',portal_private.market_intelligence_admin_canonical_payload_v1());

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
  RETURN v->'canonicalAnalytics';
END
$function$;

REVOKE ALL ON FUNCTION portal_private.market_intelligence_admin_client_shared_payload_v14() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION portal_private.market_intelligence_admin_client_shared_payload_v14() TO service_role,postgres;
COMMIT;
