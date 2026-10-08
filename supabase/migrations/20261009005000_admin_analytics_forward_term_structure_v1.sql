-- RONA Admin Analytics: source-locked forward TERM STRUCTURE (delivery months, not trade-date time series).
-- Owner-authenticated projection only; no inserts/updates to authoritative market quotes, prices or publications.
-- Rollback: supabase/rollbacks/20261009005000_admin_analytics_forward_term_structure_v1_rollback.sql
CREATE OR REPLACE FUNCTION portal_private.market_intelligence_admin_forward_term_structure_v1(
  p_product text,
  p_trade_date date
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'pg_catalog', 'public', 'portal_private'
AS $function$
WITH eligible AS (
  SELECT f.product, f.as_of_date, f.delivery_month, f.source_doc_id, f.source_ref,
         f.index_name, f.basis, coalesce(f.calc_value,f.assessment_value) AS quote
  FROM portal_private.market_intelligence_facts f
  JOIN portal_private.market_intelligence_source_documents d ON d.source_doc_id=f.source_doc_id
  WHERE p_trade_date IS NOT NULL
    AND p_product IN ('ДТ','СУГ')
    AND f.product=p_product
    AND f.as_of_date=p_trade_date
    AND f.market_family='FINANCIAL_FORWARD'
    AND f.value_type='FORWARD'
    AND d.source_family='PLATTS'
    AND d.data_status='CONFIRMED'
    AND d.processing_state='INGESTED'
    AND f.data_status IN ('CONFIRMED','CALCULATED')
    AND (
      (p_product='ДТ' AND f.index_name='Composite ULSD 10 ppmS FOB ARA + CIF NWE Cargo Financial' AND f.quality_status='CALCULATED')
      OR
      (p_product='СУГ' AND f.index_name='Propane CIF NWE Large Cargo Financial' AND f.quality_status='CONFIRMED')
    )
    AND coalesce(f.calc_value,f.assessment_value) IS NOT NULL
    AND f.delivery_month>=date_trunc('month',p_trade_date)::date
    AND f.delivery_month<(date_trunc('month',p_trade_date)+interval '3 months')::date
), grouped AS (
  SELECT product, as_of_date, source_doc_id, source_ref, index_name, basis,
         count(*) AS n, count(distinct delivery_month) AS distinct_months,
         min(delivery_month) AS first_month, max(delivery_month) AS last_month,
         jsonb_agg(to_char(delivery_month,'MM.YYYY') ORDER BY delivery_month) AS dates,
         jsonb_agg(quote ORDER BY delivery_month) AS vals,
         jsonb_agg(to_char(delivery_month,'YYYY-MM') ORDER BY delivery_month) AS delivery_months
  FROM eligible
  GROUP BY product, as_of_date, source_doc_id, source_ref, index_name, basis
)
SELECT jsonb_build_object(
  'kind','FORWARD_TERM_STRUCTURE',
  'sourceFamily','PLATTS',
  'sourceStatus','CONFIRMED',
  'asOfDate',to_char(as_of_date,'DD.MM.YYYY'),
  'sourceRef',source_ref,
  'sourceDocId',source_doc_id,
  'indexName',index_name,
  'basis',basis,
  'unit','USD/т',
  'dates',dates,
  'values',vals,
  'deliveryMonths',delivery_months,
  'observationCount',n
)
FROM grouped
WHERE n=3 AND distinct_months=3
  AND first_month=date_trunc('month',p_trade_date)::date
  AND last_month=(date_trunc('month',p_trade_date)+interval '2 months')::date
ORDER BY source_doc_id
LIMIT 1
$function$;
REVOKE EXECUTE ON FUNCTION portal_private.market_intelligence_admin_forward_term_structure_v1(text,date) FROM PUBLIC;

-- The established ADMIN role check remains in owner_analytics_admin_bootstrap_base_v1;
-- the wrapper is SECURITY DEFINER and only adds an explicitly labelled source projection.
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
    IF ref IS NOT NULL THEN
      v:=jsonb_set(v,ARRAY['canonicalAnalytics','products',r.k,'rona','reference'],to_jsonb(ref),true);
    END IF;

    -- Never substitute this for physical BNK Composite or for same-delivery-month history.
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
$function$;
