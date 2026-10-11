-- RONA Analytics V12 / SYSTEM_ADMIN / owner UAT source-backed correction / delta only.
-- Current Platts: latest same-instrument October observation M1=775 (07.10.2026)
-- Forecast: November M2=725 (same as-of/source), delta=-50 USD/t.
-- Correct Owner/Admin indicative calculation: published CPT R12 price + Platts market delta.
-- No extra rail charge: R12 CPT sale price already includes destination rail.
-- Exact source: Commercial Director proposal 5697e762-4cdc-47a8-972c-eeb4a2a67c8f
-- (PROPOSED), Operations next-stage approval b295fe31-92ca-4702-8e5c-4a199699fb30.
-- Direct Owner corrective instruction dated 2026-10-11.
-- No authoritative pricing, railway, market facts, CRM/client or RLS write.
DO $v12_preflight$
BEGIN
  IF md5(pg_get_functiondef('public.owner_analytics_admin_bootstrap()'::regprocedure))
      <> '3cc97a53ee493b6af6d5ae8ae17e9d29' THEN
    RAISE EXCEPTION 'V12_OWNER_BOOTSTRAP_SOURCE_DRIFT';
  END IF;
  IF to_regprocedure('portal_private.market_intelligence_admin_lpg_scenario_v11(jsonb)') IS NULL THEN
    RAISE EXCEPTION 'V12_PREDECESSOR_V11_MISSING';
  END IF;
END
$v12_preflight$;

CREATE OR REPLACE FUNCTION portal_private.market_intelligence_admin_lpg_relative_price_v12(p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','portal_private'
AS $spread_v12$
DECLARE
 v_safe jsonb := p #- '{canonicalAnalytics,products,LPG,rona,octoberRateCarryForwardScenarioV11}';
 v_f jsonb := p #> '{canonicalAnalytics,products,LPG,forecast}';
 v_m jsonb := p #> '{canonicalAnalytics,products,LPG,dailyMonitor}';
 v_bases jsonb := p #> '{canonicalAnalytics,products,LPG,rona,bases}';
 v_n int;
 v_market numeric;
 v_delta numeric;
 v_latest_source text;
 v_published_price numeric;
 v_published_currency text;
 v_basis record;
 v_prices jsonb := '{}'::jsonb;
 v_count int := 0;
BEGIN
 -- Do not confuse the Platts European Financial INDEX with a delivered Ozinki cost.
 -- Only a same-instrument, same-dated index movement is applied to existing CPT quotes.
 IF jsonb_typeof(v_f) IS DISTINCT FROM 'object'
    OR jsonb_typeof(v_m) IS DISTINCT FROM 'object'
    OR jsonb_typeof(v_bases) IS DISTINCT FROM 'array'
    OR v_m->>'version' <> 'RONA_MARKET_OBSERVED_DAILY_V1'
    OR v_m->>'status' <> 'VERIFIED_DAILY_OBSERVATIONS'
    OR v_m->>'sourceStatus' <> 'CONFIRMED'
    OR v_m->>'sourceFamily' <> 'PLATTS'
    OR v_m->>'instrument' <> 'LPG_PLATTS_PROPANE_CIF_NWE_FINANCIAL_FIXED_DELIVERY'
    OR v_m->>'unit' <> 'USD/т'
    OR v_m->>'noInterpolation' <> 'true'
    OR (v_f->>'month') !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'
    OR (v_m->>'deliveryMonth') !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'
    OR v_f->>'month' <> to_char(((v_m->>'deliveryMonth')||'-01')::date
      + interval '1 month','YYYY-MM')
    OR NULLIF(v_f->>'sourceRef','') IS NULL
    OR (v_f->>'base') !~ '^[0-9]+([.][0-9]+)?$'
    OR (v_f->>'low') !~ '^[0-9]+([.][0-9]+)?$'
    OR (v_f->>'high') !~ '^[0-9]+([.][0-9]+)?$'
    OR jsonb_typeof(v_m->'values') IS DISTINCT FROM 'array'
    OR jsonb_typeof(v_m->'sourceRefs') IS DISTINCT FROM 'array' THEN
    RETURN v_safe;
 END IF;
 v_n:=jsonb_array_length(v_m->'values');
 IF v_n=0 OR jsonb_array_length(v_m->'sourceRefs')<>v_n
    OR v_m->'sourceRefs'->>(v_n-1) IS DISTINCT FROM v_f->>'sourceRef'
    OR (v_m->'values'->>(v_n-1)) !~ '^[0-9]+([.][0-9]+)?$' THEN
    RETURN v_safe;
 END IF;
 v_market:=(v_m->'values'->>(v_n-1))::numeric;
 v_delta:=(v_f->>'base')::numeric-v_market;
 -- Use the existing Owner-published commercial price itself as the reference.
 -- Never append GARANT RF, KZH or UTI tariff again.
 SELECT source_reference INTO v_latest_source
 FROM portal_private.owner_price_snapshots
 WHERE business_status='PUBLISHED' AND publish_client=true
 ORDER BY published_at DESC NULLS LAST,updated_at DESC LIMIT 1;
 IF v_latest_source IS NULL THEN RETURN v_safe; END IF;
 FOR v_basis IN
  SELECT row_item.item->>0 AS basis,row_item.item->>1 AS base_text
  FROM jsonb_array_elements(v_bases) AS row_item(item)
  WHERE jsonb_typeof(row_item.item)='array' AND jsonb_array_length(row_item.item)=2
 LOOP
  IF v_basis.basis IS NULL OR v_basis.basis NOT LIKE 'CPT %'
     OR v_basis.base_text !~ '^[0-9]+([.][0-9]+)?$' THEN
    CONTINUE;
  END IF;
  SELECT sale_price,currency INTO v_published_price,v_published_currency
  FROM portal_private.owner_price_snapshots
  WHERE source_reference=v_latest_source
    AND business_status='PUBLISHED' AND publish_client=true
    AND product='СУГ (СПБТ)'
    AND basis='CPT' AND final_station=substr(v_basis.basis,5)
  ORDER BY published_at DESC NULLS LAST LIMIT 1;
  IF v_published_price IS NULL OR v_published_currency<>'USD'
    OR v_published_price<>v_basis.base_text::numeric
    OR v_published_price+v_delta<=0 THEN
    CONTINUE;
  END IF;
  v_prices:=jsonb_set(v_prices,ARRAY[v_basis.basis],jsonb_build_object(
    'marketAdjustedPriceUsdT',round(v_published_price+v_delta,2),
    'publishedReferenceUsdT',v_published_price,
    'marketDeltaUsdT',round(v_delta,2),
    'marketAnchorUsdT',v_market,
    'forecastBaseUsdT',(v_f->>'base')::numeric,
    'tariffsReaddedUsdT',0,
    'officialPriceMutation',false
  ),true);
  v_count:=v_count+1;
 END LOOP;
 IF v_count<>5 OR NOT (v_prices ?& ARRAY[
    'CPT Озинки','CPT Сарыагаш','CPT Турксиб','CPT Уртааул','CPT Маргилан']) THEN
  RETURN v_safe;
 END IF;
 RETURN jsonb_set(v_safe,
   '{canonicalAnalytics,products,LPG,rona,referenceSpreadV12}',
   jsonb_build_object(
    'version','RONA_LPG_PUBLISHED_CPT_PLUS_SAME_PLATTS_FORWARD_DELTA_V12',
    'forecastMonth',v_f->>'month',
    'marketSourceRef',v_f->>'sourceRef',
    'marketAsOf',v_m->>'lastAsOf',
    'sameInstrument','LPG_PLATTS_PROPANE_CIF_NWE_FINANCIAL_FIXED_DELIVERY',
    'publishedSourceReference',v_latest_source,
    'marketDeltaUsdT',round(v_delta,2),
    'tariffsReaddedUsdT',0,
    'commercialOffer',false,
    'technicalProjectionOnly',true,
    'prices',v_prices
   ),true);
END
$spread_v12$;
REVOKE ALL ON FUNCTION portal_private.market_intelligence_admin_lpg_relative_price_v12(jsonb)
 FROM PUBLIC,anon,authenticated;

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
  RETURN portal_private.market_intelligence_admin_lpg_relative_price_v12(portal_private.market_intelligence_admin_lpg_tariff_bridge_v1(v));
END
$function$;

-- Transactional source-truth smoke using R12 facts + verified Platts observations.
DO $v12_smoke$
DECLARE
 v_test jsonb;
 v_result jsonb;
 v_prices jsonb;
 v_bad jsonb;
BEGIN
 v_test:=jsonb_build_object('canonicalAnalytics',jsonb_build_object('products',
   jsonb_build_object('LPG',jsonb_build_object(
     'forecast',jsonb_build_object('month','2026-11','low',698.5,'base',725,
       'high',775,'sourceRef','https://t.me/platts_digits/7510'),
     'dailyMonitor',portal_private.market_intelligence_daily_monitor_v1('СУГ','2026-10-07'::date),
     'rona',jsonb_build_object(
       'bases',(SELECT jsonb_agg(jsonb_build_array('CPT '||final_station,sale_price))
                FROM portal_private.owner_price_snapshots
                WHERE product='СУГ (СПБТ)' AND source_reference='RONA-PRICE-LIST-2026-09-R12'
                  AND business_status='PUBLISHED' AND publish_client=true)
     )
   ))));
 v_result:=portal_private.market_intelligence_admin_lpg_relative_price_v12(v_test);
 v_prices:=v_result #> '{canonicalAnalytics,products,LPG,rona,referenceSpreadV12,prices}';
 IF jsonb_typeof(v_prices) IS DISTINCT FROM 'object'
   OR jsonb_object_length(v_prices)<>5
   OR v_result #>> '{canonicalAnalytics,products,LPG,rona,referenceSpreadV12,marketDeltaUsdT}' <> '-50'
   OR (v_prices #>> '{CPT Озинки,marketAdjustedPriceUsdT}')::numeric<>560
   OR (v_prices #>> '{CPT Сарыагаш,marketAdjustedPriceUsdT}')::numeric<>695
   OR (v_prices #>> '{CPT Турксиб,marketAdjustedPriceUsdT}')::numeric<>740
   OR (v_prices #>> '{CPT Уртааул,marketAdjustedPriceUsdT}')::numeric<>730
   OR (v_prices #>> '{CPT Маргилан,marketAdjustedPriceUsdT}')::numeric<>745
   OR v_result #>> '{canonicalAnalytics,products,LPG,rona,referenceSpreadV12,tariffsReaddedUsdT}' <> '0'
   OR v_result #> '{canonicalAnalytics,products,LPG,rona,octoberRateCarryForwardScenarioV11}' IS NOT NULL
 THEN
  RAISE EXCEPTION 'V12_REAL_SOURCE_FIVE_CPT_NO_DOUBLE_RAIL_SMOKE_FAILED';
 END IF;
 v_bad:=jsonb_set(v_test,
   '{canonicalAnalytics,products,LPG,forecast,sourceRef}',to_jsonb('MISMATCH'::text),true);
 IF portal_private.market_intelligence_admin_lpg_relative_price_v12(v_bad)
    #> '{canonicalAnalytics,products,LPG,rona,referenceSpreadV12}' IS NOT NULL THEN
  RAISE EXCEPTION 'V12_SAME_INSTRUMENT_SOURCE_MISMATCH_FAIL_CLOSED';
 END IF;
END
$v12_smoke$;