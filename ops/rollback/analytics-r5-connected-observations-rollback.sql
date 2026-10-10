-- Emergency targeted R5 rollback. Restore the prior production 30-day
-- daily monitor definition only if the exact R5 patched definition is active.
-- Does NOT roll back the 30-day filter, client Edge v106, market data, roles or
-- pricing. No static UI files are changed by this rollback.
DO $r5_rollback_preflight$
BEGIN
  IF md5(pg_get_functiondef(
    'portal_private.market_intelligence_daily_monitor_v1(text,date)'::regprocedure
  )) <> '5a0fdacc196efc889cb8c047f0164330' THEN
    RAISE EXCEPTION 'R5_ROLLBACK_LIVE_SOURCE_LOCK_MISMATCH';
  END IF;
END $r5_rollback_preflight$;

CREATE OR REPLACE FUNCTION portal_private.market_intelligence_daily_monitor_v1(p_product text, p_reference_date date)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'portal_private', 'auth'
AS $function$
WITH source_rows AS (
  SELECT f.as_of_date,f.assessment_value,f.created_at,f.fact_id,
         f.delivery_month,s.source_ref,s.source_doc_id
  FROM portal_private.market_intelligence_facts f
  JOIN portal_private.market_intelligence_source_documents s
    ON s.source_doc_id=f.source_doc_id
  WHERE p_product IN ('ДТ','СУГ')
    AND p_reference_date IS NOT NULL
    AND f.product=p_product
    AND f.as_of_date<=least(p_reference_date,(now() at time zone 'Europe/Moscow')::date)
    AND f.as_of_date >= (now() at time zone 'Europe/Moscow')::date - 29
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
    sum(CASE WHEN prev_date IS NOT NULL AND as_of_date-prev_date>1
      THEN 1 ELSE 0 END) OVER (ORDER BY as_of_date ROWS UNBOUNDED PRECEDING)
       AS segment_id
  FROM ordered
), recent AS (
  SELECT *
  FROM segments
  WHERE true -- retain all verified same-delivery observations
), agg AS (
  SELECT
    count(*)::int AS point_count,
    coalesce(jsonb_agg(to_char(as_of_date,'DD.MM') ORDER BY as_of_date),'[]'::jsonb) AS dates,
    coalesce(jsonb_agg(assessment_value ORDER BY as_of_date),'[]'::jsonb) AS vals,
    coalesce(jsonb_agg(to_char(as_of_date,'YYYY-MM-DD') ORDER BY as_of_date),'[]'::jsonb) AS observed_dates,
    min(as_of_date) AS first_date,max(as_of_date) AS last_date,
    coalesce(jsonb_agg(source_ref ORDER BY as_of_date),'[]'::jsonb) AS source_refs,
    coalesce(jsonb_agg(segment_id ORDER BY as_of_date),'[]'::jsonb) AS segment_ids,
    coalesce(jsonb_agg(coalesce(as_of_date-prev_date,0) ORDER BY as_of_date),'[]'::jsonb) AS gap_before_days,
    count(DISTINCT segment_id)::int AS segment_count
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
  'segmentIds',(SELECT segment_ids FROM agg),
  'gapBeforeDays',(SELECT gap_before_days FROM agg),
  'segmentCount',(SELECT segment_count FROM agg),
  'firstAsOf',to_char((SELECT first_date FROM agg),'DD.MM.YYYY'),
  'lastAsOf',to_char((SELECT last_date FROM agg),'DD.MM.YYYY'),
  'referenceDate',to_char(p_reference_date,'DD.MM.YYYY'),
  'sourceGap',((SELECT segment_count FROM agg)>1),
  'status',CASE WHEN (SELECT point_count FROM agg)=0 THEN 'SOURCE_ABSENT'
             WHEN p_reference_date-(SELECT last_date FROM agg)>5 THEN 'OBSERVATIONS_STALE'
             WHEN (SELECT point_count FROM agg)=1 THEN 'SINGLE_CONFIRMED_OBSERVATION'
             ELSE 'VERIFIED_DAILY_OBSERVATIONS' END,
  'noInterpolation',true,
  'notMonthlyMaturityCurve',true,'historyIncludesAllGapSegments',true
);
$function$
;
