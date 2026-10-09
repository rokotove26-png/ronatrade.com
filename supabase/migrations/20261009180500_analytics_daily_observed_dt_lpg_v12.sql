
-- Read-only verified observation monitor shared by Admin and Client.
-- It is NOT a commercial publication mechanism and never inserts market facts.
CREATE OR REPLACE FUNCTION portal_private.market_intelligence_daily_monitor_v1(
  p_product text,p_reference_date date)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','portal_private','auth'
AS $daily$
WITH source_rows AS (
  SELECT f.as_of_date,f.assessment_value,f.created_at,f.fact_id,
         f.delivery_month,s.source_ref,s.source_doc_id
  FROM portal_private.market_intelligence_facts f
  JOIN portal_private.market_intelligence_source_documents s
    ON s.source_doc_id=f.source_doc_id
  WHERE p_product IN ('ДТ','СУГ')
    AND p_reference_date IS NOT NULL
    AND f.product=p_product
    AND f.as_of_date<=p_reference_date
    AND f.as_of_date>=p_reference_date -
      (CASE WHEN p_product='ДТ' THEN 50 ELSE 85 END)
    AND f.quality_status='CONFIRMED'
    AND f.assessment_value IS NOT NULL
    AND s.source_family='PLATTS'
    AND s.data_status='CONFIRMED'
    AND s.processing_state='INGESTED'
    AND (
      (p_product='ДТ' AND f.market_family='DIESEL_COMPONENT'
        AND f.value_type='PHYSICAL'
        AND f.basis='Cargoes CIF NWE/Basis ARA')
      OR
      (p_product='СУГ' AND f.market_family='FINANCIAL_FORWARD'
        AND f.value_type='FORWARD'
        AND f.basis='CIF NWE Large Cargo Financial'
        AND f.delivery_month=date_trunc('month',p_reference_date)::date)
    )
), dedup AS (
  SELECT *,row_number() OVER (
    PARTITION BY as_of_date ORDER BY created_at DESC,fact_id DESC) AS rn
  FROM source_rows
), ordered AS (
  SELECT as_of_date,assessment_value,source_ref,source_doc_id,
         lag(as_of_date) OVER (ORDER BY as_of_date) AS prev_date
  FROM dedup WHERE rn=1
), segments AS (
  SELECT *,
    sum(CASE WHEN prev_date IS NOT NULL AND as_of_date-prev_date>10
      THEN 1 ELSE 0 END) OVER (ORDER BY as_of_date ROWS UNBOUNDED PRECEDING)
       AS segment_id
  FROM ordered
), recent AS (
  SELECT *
  FROM segments
  WHERE segment_id=(SELECT max(segment_id) FROM segments)
), agg AS (
  SELECT
    count(*)::int AS point_count,
    coalesce(jsonb_agg(to_char(as_of_date,'DD.MM') ORDER BY as_of_date),'[]'::jsonb) AS dates,
    coalesce(jsonb_agg(assessment_value ORDER BY as_of_date),'[]'::jsonb) AS vals,
    coalesce(jsonb_agg(to_char(as_of_date,'YYYY-MM-DD') ORDER BY as_of_date),'[]'::jsonb) AS observed_dates,
    min(as_of_date) AS first_date,max(as_of_date) AS last_date,
    coalesce(jsonb_agg(source_ref ORDER BY as_of_date),'[]'::jsonb) AS source_refs
  FROM recent
)
SELECT jsonb_build_object(
  'version','RONA_MARKET_OBSERVED_DAILY_V1',
  'granularity','OBSERVATION_DATE',
  'product',p_product,
  'instrument',CASE WHEN p_product='ДТ' THEN 'DIESEL_PLATTS_ULSD_CIF_NWE_PHYSICAL_COMPONENT'
                  ELSE 'LPG_PLATTS_PROPANE_CIF_NWE_FINANCIAL_FIXED_DELIVERY' END,
  'sourceFamily','PLATTS','sourceStatus','CONFIRMED',
  'basis',CASE WHEN p_product='ДТ'
              THEN 'Platts Diesel ULSD 10 ppm · Cargoes CIF NWE/Basis ARA · отдельный физический компонент, не композит БНК'
              ELSE 'Platts Propane CIF NWE Large Cargo Financial · поставка '||
                    to_char(date_trunc('month',p_reference_date),'MM.YYYY') END,
  'unit','USD/т',
  'deliveryMonth',CASE WHEN p_product='СУГ' THEN to_char(date_trunc('month',p_reference_date),'YYYY-MM') ELSE NULL END,
  'dates',(SELECT dates FROM agg),
  'values',(SELECT vals FROM agg),
  'observedDates',(SELECT observed_dates FROM agg),
  'sourceRefs',(SELECT source_refs FROM agg),
  'observationCount',(SELECT point_count FROM agg),
  'availableTotal',(SELECT count(*)::int FROM segments),
  'firstAsOf',to_char((SELECT first_date FROM agg),'DD.MM.YYYY'),
  'lastAsOf',to_char((SELECT last_date FROM agg),'DD.MM.YYYY'),
  'referenceDate',to_char(p_reference_date,'DD.MM.YYYY'),
  'sourceGap',((SELECT count(*) FROM segments)>(SELECT point_count FROM agg)),
  'status',CASE WHEN (SELECT point_count FROM agg)=0 THEN 'SOURCE_ABSENT'
             WHEN p_reference_date-(SELECT last_date FROM agg)>5 THEN 'OBSERVATIONS_STALE'
             WHEN (SELECT point_count FROM agg)=1 THEN 'SINGLE_CONFIRMED_OBSERVATION'
             ELSE 'VERIFIED_DAILY_OBSERVATIONS' END,
  'noInterpolation',true,
  'notMonthlyMaturityCurve',true
);
$daily$;
-- Keep this function internal. Existing secured RPC and service-side
-- client authorization decide whether a derived series may be sent out.
REVOKE ALL ON FUNCTION portal_private.market_intelligence_daily_monitor_v1(text,date) FROM PUBLIC;

-- Admin canonical display: same dated observations, distinct forecast.
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
  RETURN v;
END
$function$

