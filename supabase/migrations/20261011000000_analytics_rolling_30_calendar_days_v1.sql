-- Owner-approved exact-source-locked STATIC DDL. Two existing read-only
-- projections only: last 30 Europe/Moscow calendar dates, inclusive today.
-- Source market rows, forecast math, role/IAM and permissions stay unchanged.
DO $rolling30_guard$
BEGIN
  IF md5(pg_get_functiondef(
    'portal_private.market_intelligence_admin_canonical_payload_v1()'::regprocedure
  )) <> '8ad47e1c97b748017369e0cb870f4bda'
  OR md5(pg_get_functiondef(
    'portal_private.market_intelligence_daily_monitor_v1(text,date)'::regprocedure
  )) <> 'ae96b04c319334197eb9d81fcb84f09e' THEN
    RAISE EXCEPTION 'ROLLING30_STATIC_SOURCE_LOCK_MISMATCH';
  END IF;
END $rolling30_guard$;

CREATE OR REPLACE FUNCTION portal_private.market_intelligence_admin_canonical_payload_v1()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'portal_private', 'auth'
AS $function$
with source_anchor as (
  select max(f.as_of_date)::date as latest_trade_date
  from portal_private.market_intelligence_facts f
  join portal_private.market_intelligence_source_documents s on s.source_doc_id=f.source_doc_id
  where s.source_family='PLATTS'
    and s.data_status='CONFIRMED'
    and f.product in ('АИ-92','ДТ','СУГ')
    and f.quality_status in ('CONFIRMED','CALCULATED')
    and f.as_of_date <= (now() at time zone 'Europe/Moscow')::date
),
target as (
  select
    latest_trade_date,
    ((now() at time zone 'Europe/Moscow')::date - 29) as source_month,
    coalesce(
      (
        select min(fs.target_month)
        from portal_private.market_intelligence_forecast_snapshots fs
        where fs.product in ('АИ-92','АИ-95','ДТ')
          and fs.target_month>date_trunc('month',latest_trade_date)::date
      ),
      date_trunc('month',latest_trade_date+interval '1 month')::date
    ) as target_month
  from source_anchor
),
latest_fc as (
  select distinct on (product)
    product,snapshot_date,target_month,forward_implied_usd_t,mtd_at_snapshot_usd_t,
    low_usd_t,base_usd_t,high_usd_t,direction,confidence,curve_type
  from portal_private.market_intelligence_forecast_snapshots
  where target_month=(select target_month from target)
    and snapshot_date between (now() at time zone 'Europe/Moscow')::date - 29
      and (now() at time zone 'Europe/Moscow')::date
    and product in ('АИ-92','АИ-95','ДТ')
  order by product,snapshot_date desc,created_at desc
),
ai92 as (
  select
    jsonb_agg(to_char(as_of_date,'DD.MM') order by as_of_date) as dates,
    jsonb_agg(assessment_value order by as_of_date) as vals,
    max(as_of_date) as latest_date,
    (array_agg(assessment_value order by as_of_date desc))[1] as latest_value
  from portal_private.market_intelligence_facts
  where product='АИ-92'
    and market_family='GASOLINE'
    and value_type='PHYSICAL'
    and quality_status='CONFIRMED'
    and as_of_date>=(select source_month from target)
    and as_of_date<=(select latest_trade_date from target)
    and as_of_date<=(now() at time zone 'Europe/Moscow')::date
),
ai95 as (
  select
    jsonb_agg(to_char(as_of_date,'DD.MM') order by as_of_date) as dates,
    jsonb_agg(assessment_value+40 order by as_of_date) as vals,
    max(as_of_date) as latest_date,
    (array_agg(assessment_value+40 order by as_of_date desc))[1] as latest_value
  from portal_private.market_intelligence_facts
  where product='АИ-92'
    and market_family='GASOLINE'
    and value_type='PHYSICAL'
    and quality_status='CONFIRMED'
    and as_of_date>=(select source_month from target)
    and as_of_date<=(select latest_trade_date from target)
    and as_of_date<=(now() at time zone 'Europe/Moscow')::date
),
dt as (
  select
    jsonb_agg(to_char(as_of_date,'DD.MM') order by as_of_date) as dates,
    jsonb_agg(calc_value order by as_of_date) as vals,
    max(as_of_date) as latest_date,
    (array_agg(calc_value order by as_of_date desc))[1] as latest_value
  from portal_private.market_intelligence_facts
  where product='ДТ'
    and market_family='BNK_COMPOSITE'
    and value_type='CALCULATED'
    and quality_status='CALCULATED'
    and as_of_date>=(select source_month from target)
    and as_of_date<=(select latest_trade_date from target)
    and as_of_date<=(now() at time zone 'Europe/Moscow')::date
),
lpg as (
  select
    jsonb_agg(to_char(as_of_date,'DD.MM') order by as_of_date) as dates,
    jsonb_agg(assessment_value order by as_of_date) as vals,
    max(as_of_date) as latest_date,
    (array_agg(assessment_value order by as_of_date desc))[1] as latest_value
  from portal_private.market_intelligence_facts
  where product='СУГ'
    and market_family='FINANCIAL_FORWARD'
    and value_type='FORWARD'
    and quality_status='CONFIRMED'
    and delivery_month=(select target_month from target)
    and as_of_date>=(select source_month from target)
    and as_of_date<=(select latest_trade_date from target)
    and as_of_date<=(now() at time zone 'Europe/Moscow')::date
),
lpg_regional as (
  select
    as_of_date,assessment_value,
    (metadata->>'min')::numeric as low,
    (metadata->>'max')::numeric as high,
    (metadata->>'weekly_change')::numeric as weekly_change
  from portal_private.market_intelligence_facts
  where product='СУГ'
    and market_family='CENTRAL_ASIA_LPG'
    and upper(coalesce(basis,'')) like '%САРЫАГАШ%'
    and as_of_date between (now() at time zone 'Europe/Moscow')::date - 29
      and (now() at time zone 'Europe/Moscow')::date
  order by as_of_date desc,created_at desc
  limit 1
),
latest_price_ref as (
  select source_reference
  from portal_private.owner_price_snapshots
  where business_status='PUBLISHED' and publish_client=true
  order by published_at desc nulls last,updated_at desc
  limit 1
),
price_bases as (
  select
    case
      when product like 'АИ-92%' then 'AI92'
      when product like 'АИ-95%' then 'AI95'
      when product like 'ДТ%' then 'DT'
      when product like 'СУГ%' then 'LPG'
    end as key,
    jsonb_agg(
      jsonb_build_array('CPT '||final_station,sale_price)
      order by case final_station when 'Озинки' then 1 when 'Сарыагаш' then 2 when 'Турксиб' then 3 when 'Наушки' then 4 else 9 end
    ) as bases
  from portal_private.owner_price_snapshots
  where source_reference=(select source_reference from latest_price_ref)
    and business_status='PUBLISHED'
    and publish_client=true
  group by 1
)
select jsonb_build_object(
  'version','RONA_ADMIN_ANALYTICS_CANONICAL_DAILY_V1',
  'cutoff',to_char((select latest_trade_date from target),'DD.MM.YYYY'),
  'latestTradeDate',to_char((select latest_trade_date from target),'DD.MM.YYYY'),
  'products',jsonb_build_object(
    'AI92',jsonb_build_object(
      'name','АИ-92',
      'basis','Platts European Marketscan · Gasoline Prem Unleaded 10 ppm · FOB Med (Italy)',
      'dates',(select dates from ai92),
      'values',(select vals from ai92),
      'forecast',jsonb_build_object(
        'month',to_char((select target_month from target),'MM.YYYY'),
        'reference',(select mtd_at_snapshot_usd_t from latest_fc where product='АИ-92'),
        'forward',(select forward_implied_usd_t from latest_fc where product='АИ-92'),
        'forwardLabel','Forward '||to_char((select target_month from target),'MM.YYYY'),
        'low',(select low_usd_t from latest_fc where product='АИ-92'),
        'base',(select base_usd_t from latest_fc where product='АИ-92'),
        'high',(select high_usd_t from latest_fc where product='АИ-92'),
        'direction',(select direction from latest_fc where product='АИ-92'),
        'confidence',(select confidence from latest_fc where product='АИ-92'),
        'curve',(select curve_type from latest_fc where product='АИ-92'),
        'comment','Ежедневный ряд Platts FOB Med; прогнозный блок — следующий месяц.'
      ),
      'rona',jsonb_build_object(
        'reference',(select mtd_at_snapshot_usd_t from latest_fc where product='АИ-92'),
        'bases',(select bases from price_bases where key='AI92')
      )
    ),
    'AI95',jsonb_build_object(
      'name','АИ-95',
      'basis','Расчетный planning-layer: АИ-92 + 40 USD/т',
      'dates',(select dates from ai95),
      'values',(select vals from ai95),
      'calculationRule','AI92+40',
      'forecast',jsonb_build_object(
        'month',to_char((select target_month from target),'MM.YYYY'),
        'reference',(select mtd_at_snapshot_usd_t from latest_fc where product='АИ-95'),
        'forward',(select forward_implied_usd_t from latest_fc where product='АИ-95'),
        'forwardLabel','Forward '||to_char((select target_month from target),'MM.YYYY'),
        'low',(select low_usd_t from latest_fc where product='АИ-95'),
        'base',(select base_usd_t from latest_fc where product='АИ-95'),
        'high',(select high_usd_t from latest_fc where product='АИ-95'),
        'direction',(select direction from latest_fc where product='АИ-95'),
        'confidence',(select confidence from latest_fc where product='АИ-95'),
        'curve',(select curve_type from latest_fc where product='АИ-95'),
        'comment','АИ-95 = фактический ряд АИ-92 + 40 USD/т; расчетный слой, не отдельная котировка Platts.'
      ),
      'rona',jsonb_build_object(
        'reference',(select mtd_at_snapshot_usd_t from latest_fc where product='АИ-95'),
        'bases',(select bases from price_bases where key='AI95')
      )
    ),
    'DT',jsonb_build_object(
      'name','ДТ',
      'basis','BNK Diesel Composite · ULSD 10 ppm CIF NWE/Basis ARA + Diesel 10 ppm FOB Rotterdam',
      'dates',(select dates from dt),
      'values',(select vals from dt),
      'forecast',jsonb_build_object(
        'month',to_char((select target_month from target),'MM.YYYY'),
        'reference',(select mtd_at_snapshot_usd_t from latest_fc where product='ДТ'),
        'forward',(select forward_implied_usd_t from latest_fc where product='ДТ'),
        'forwardLabel','Forward '||to_char((select target_month from target),'MM.YYYY'),
        'low',(select low_usd_t from latest_fc where product='ДТ'),
        'base',(select base_usd_t from latest_fc where product='ДТ'),
        'high',(select high_usd_t from latest_fc where product='ДТ'),
        'direction',(select direction from latest_fc where product='ДТ'),
        'confidence',(select confidence from latest_fc where product='ДТ'),
        'curve',(select curve_type from latest_fc where product='ДТ'),
        'comment','Ежедневный расчетный BNK Diesel Composite; прогнозный блок — следующий месяц.'
      ),
      'rona',jsonb_build_object(
        'reference',(select mtd_at_snapshot_usd_t from latest_fc where product='ДТ'),
        'bases',(select bases from price_bases where key='DT')
      )
    ),
    'LPG',jsonb_build_object(
      'name','LPG / СУГ',
      'basis','Platts Propane CIF NWE Large Cargo Financial · target-period benchmark',
      'dates',(select dates from lpg),
      'values',(select vals from lpg),
      'forecast',jsonb_build_object(
        'month',to_char((select target_month from target),'MM.YYYY'),
        'reference',(select assessment_value from lpg_regional),
        'forward',(select latest_value from lpg),
        'forwardLabel','Platts propane '||to_char((select target_month from target),'MM.YYYY'),
        'low',(select low from lpg_regional),
        'base',(select assessment_value from lpg_regional),
        'high',(select high from lpg_regional),
        'direction',case when (select weekly_change from lpg_regional)>0 then 'РОСТ' when (select weekly_change from lpg_regional)<0 then 'СНИЖЕНИЕ' else 'БЕЗ ИЗМЕНЕНИЙ' end,
        'confidence','СРЕДНЯЯ',
        'curve','Target '||to_char((select target_month from target),'MM.YYYY'),
        'comment','График — ежедневный Platts Propane для целевого периода '||to_char((select target_month from target),'MM.YYYY')||'; DAP Сарыагаш используется отдельно как региональный benchmark.'
      ),
      'rona',jsonb_build_object(
        'reference',(select assessment_value from lpg_regional),
        'bases',(select bases from price_bases where key='LPG')
      ),
      'regionalBenchmark',jsonb_build_object(
        'name','Petromarket · DAP Сарыагаш',
        'date',to_char((select as_of_date from lpg_regional),'DD.MM.YYYY'),
        'low',(select low from lpg_regional),
        'base',(select assessment_value from lpg_regional),
        'high',(select high from lpg_regional)
      )
    )
  ),
  'argus',jsonb_build_object(
    'available',false,
    'required','Argus European Products · EUROBOB Oxy · Northwest Europe - barge',
    'reason','Требуемый ряд Argus в текущем структурированном контуре не загружен; подмена другим индексом запрещена.'
  )
);
$function$
;

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
