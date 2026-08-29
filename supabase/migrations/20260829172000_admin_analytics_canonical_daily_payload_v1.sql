create or replace function portal_private.market_intelligence_admin_canonical_payload_v1()
returns jsonb
language sql
stable
security definer
set search_path to 'pg_catalog','public','portal_private','auth'
as $function$
with target as (
  select date_trunc('month',(now() at time zone 'Europe/Moscow')::date + interval '1 month')::date as target_month
),
latest_fc as (
  select distinct on (product)
    product,snapshot_date,target_month,forward_implied_usd_t,mtd_at_snapshot_usd_t,
    low_usd_t,base_usd_t,high_usd_t,direction,confidence,curve_type
  from portal_private.market_intelligence_forecast_snapshots
  where target_month=(select target_month from target)
    and product in ('АИ-92','АИ-95','ДТ')
  order by product,snapshot_date desc,created_at desc
),
ai92 as (
  select jsonb_agg(to_char(as_of_date,'DD.MM') order by as_of_date) as dates,
         jsonb_agg(assessment_value order by as_of_date) as vals,
         max(as_of_date) as latest_date,
         (array_agg(assessment_value order by as_of_date desc))[1] as latest_value
  from portal_private.market_intelligence_facts
  where product='АИ-92' and market_family='GASOLINE' and value_type='PHYSICAL' and quality_status='CONFIRMED'
    and as_of_date>=date_trunc('month',(now() at time zone 'Europe/Moscow')::date)::date
),
ai95 as (
  select jsonb_agg(to_char(as_of_date,'DD.MM') order by as_of_date) as dates,
         jsonb_agg(assessment_value+40 order by as_of_date) as vals,
         max(as_of_date) as latest_date,
         (array_agg(assessment_value+40 order by as_of_date desc))[1] as latest_value
  from portal_private.market_intelligence_facts
  where product='АИ-92' and market_family='GASOLINE' and value_type='PHYSICAL' and quality_status='CONFIRMED'
    and as_of_date>=date_trunc('month',(now() at time zone 'Europe/Moscow')::date)::date
),
dt as (
  select jsonb_agg(to_char(as_of_date,'DD.MM') order by as_of_date) as dates,
         jsonb_agg(calc_value order by as_of_date) as vals,
         max(as_of_date) as latest_date,
         (array_agg(calc_value order by as_of_date desc))[1] as latest_value
  from portal_private.market_intelligence_facts
  where product='ДТ' and market_family='BNK_COMPOSITE' and value_type='CALCULATED' and quality_status='CALCULATED'
    and as_of_date>=date_trunc('month',(now() at time zone 'Europe/Moscow')::date)::date
),
lpg as (
  select jsonb_agg(to_char(as_of_date,'DD.MM') order by as_of_date) as dates,
         jsonb_agg(assessment_value order by as_of_date) as vals,
         max(as_of_date) as latest_date,
         (array_agg(assessment_value order by as_of_date desc))[1] as latest_value
  from portal_private.market_intelligence_facts
  where product='СУГ' and market_family='FINANCIAL_FORWARD' and value_type='FORWARD' and quality_status='CONFIRMED'
    and delivery_month=(select target_month from target)
    and as_of_date>=date_trunc('month',(now() at time zone 'Europe/Moscow')::date)::date
),
lpg_regional as (
  select as_of_date,assessment_value,(metadata->>'min')::numeric as low,(metadata->>'max')::numeric as high,(metadata->>'weekly_change')::numeric as weekly_change
  from portal_private.market_intelligence_facts
  where product='СУГ' and market_family='CENTRAL_ASIA_LPG' and upper(coalesce(basis,'')) like '%САРЫАГАШ%'
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
  select case
      when product like 'АИ-92%' then 'AI92'
      when product like 'АИ-95%' then 'AI95'
      when product like 'ДТ%' then 'DT'
      when product like 'СУГ%' then 'LPG'
    end as key,
    jsonb_agg(jsonb_build_array('CPT '||final_station,sale_price)
      order by case final_station when 'Озинки' then 1 when 'Сарыагаш' then 2 when 'Турксиб' then 3 when 'Наушки' then 4 else 9 end) as bases
  from portal_private.owner_price_snapshots
  where source_reference=(select source_reference from latest_price_ref)
    and business_status='PUBLISHED' and publish_client=true
  group by 1
)
select jsonb_build_object(
  'version','RONA_ADMIN_ANALYTICS_CANONICAL_DAILY_V1',
  'cutoff',to_char((select greatest(ai92.latest_date,dt.latest_date,lpg.latest_date) from ai92,dt,lpg),'DD.MM.YYYY'),
  'latestTradeDate',to_char((select ai92.latest_date from ai92),'DD.MM.YYYY'),
  'products',jsonb_build_object(
    'AI92',jsonb_build_object(
      'name','АИ-92','basis','Platts European Marketscan · Gasoline Prem Unleaded 10 ppm · FOB Med (Italy)',
      'dates',(select dates from ai92),'values',(select vals from ai92),
      'forecast',jsonb_build_object(
        'month',to_char((select target_month from target),'MM.YYYY'),
        'reference',(select mtd_at_snapshot_usd_t from latest_fc where product='АИ-92'),
        'forward',(select forward_implied_usd_t from latest_fc where product='АИ-92'),'forwardLabel','Forward Sep',
        'low',(select low_usd_t from latest_fc where product='АИ-92'),'base',(select base_usd_t from latest_fc where product='АИ-92'),'high',(select high_usd_t from latest_fc where product='АИ-92'),
        'direction',(select direction from latest_fc where product='АИ-92'),'confidence',(select confidence from latest_fc where product='АИ-92'),'curve',(select curve_type from latest_fc where product='АИ-92'),
        'comment','Ежедневный ряд Platts FOB Med; прогнозный блок — следующий месяц.'),
      'rona',jsonb_build_object('reference',(select mtd_at_snapshot_usd_t from latest_fc where product='АИ-92'),'bases',(select bases from price_bases where key='AI92'))),
    'AI95',jsonb_build_object(
      'name','АИ-95','basis','Расчетный planning-layer: АИ-92 + 40 USD/т',
      'dates',(select dates from ai95),'values',(select vals from ai95),'calculationRule','AI92+40',
      'forecast',jsonb_build_object(
        'month',to_char((select target_month from target),'MM.YYYY'),
        'reference',(select mtd_at_snapshot_usd_t from latest_fc where product='АИ-95'),
        'forward',(select forward_implied_usd_t from latest_fc where product='АИ-95'),'forwardLabel','Forward Sep',
        'low',(select low_usd_t from latest_fc where product='АИ-95'),'base',(select base_usd_t from latest_fc where product='АИ-95'),'high',(select high_usd_t from latest_fc where product='АИ-95'),
        'direction',(select direction from latest_fc where product='АИ-95'),'confidence',(select confidence from latest_fc where product='АИ-95'),'curve',(select curve_type from latest_fc where product='АИ-95'),
        'comment','АИ-95 = фактический ряд АИ-92 + 40 USD/т; расчетный слой, не отдельная котировка Platts.'),
      'rona',jsonb_build_object('reference',(select mtd_at_snapshot_usd_t from latest_fc where product='АИ-95'),'bases',(select bases from price_bases where key='AI95'))),
    'DT',jsonb_build_object(
      'name','ДТ','basis','BNK Diesel Composite · ULSD 10 ppm CIF NWE/Basis ARA + Diesel 10 ppm FOB Rotterdam',
      'dates',(select dates from dt),'values',(select vals from dt),
      'forecast',jsonb_build_object(
        'month',to_char((select target_month from target),'MM.YYYY'),
        'reference',(select mtd_at_snapshot_usd_t from latest_fc where product='ДТ'),
        'forward',(select forward_implied_usd_t from latest_fc where product='ДТ'),'forwardLabel','Forward Sep',
        'low',(select low_usd_t from latest_fc where product='ДТ'),'base',(select base_usd_t from latest_fc where product='ДТ'),'high',(select high_usd_t from latest_fc where product='ДТ'),
        'direction',(select direction from latest_fc where product='ДТ'),'confidence',(select confidence from latest_fc where product='ДТ'),'curve',(select curve_type from latest_fc where product='ДТ'),
        'comment','Ежедневный расчетный BNK Diesel Composite; прогнозный блок — следующий месяц.'),
      'rona',jsonb_build_object('reference',(select mtd_at_snapshot_usd_t from latest_fc where product='ДТ'),'bases',(select bases from price_bases where key='DT'))),
    'LPG',jsonb_build_object(
      'name','LPG / СУГ','basis','Platts Propane CIF NWE Large Cargo Financial · сентябрьский benchmark',
      'dates',(select dates from lpg),'values',(select vals from lpg),
      'forecast',jsonb_build_object(
        'month',to_char((select target_month from target),'MM.YYYY'),
        'reference',(select assessment_value from lpg_regional),'forward',(select latest_value from lpg),'forwardLabel','Platts propane Sep',
        'low',(select low from lpg_regional),'base',(select assessment_value from lpg_regional),'high',(select high from lpg_regional),
        'direction',case when (select weekly_change from lpg_regional)>0 then 'РОСТ' when (select weekly_change from lpg_regional)<0 then 'СНИЖЕНИЕ' else 'БЕЗ ИЗМЕНЕНИЙ' end,
        'confidence','СРЕДНЯЯ','curve','Platts Sep/Oct',
        'comment','График — ежедневный Platts Propane Sep; DAP Сарыагаш используется отдельно как региональный benchmark.'),
      'rona',jsonb_build_object('reference',(select assessment_value from lpg_regional),'bases',(select bases from price_bases where key='LPG')),
      'regionalBenchmark',jsonb_build_object('name','Petromarket · DAP Сарыагаш','date',to_char((select as_of_date from lpg_regional),'DD.MM.YYYY'),'low',(select low from lpg_regional),'base',(select assessment_value from lpg_regional),'high',(select high from lpg_regional)))
  ),
  'argus',jsonb_build_object('available',false,'required','Argus European Products · EUROBOB Oxy · Northwest Europe - barge','reason','Требуемый ряд Argus в текущем структурированном контуре не загружен; подмена другим индексом запрещена.')
);
$function$;

create or replace function public.owner_analytics_admin_bootstrap()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','portal_private','auth'
as $function$
declare v jsonb;
begin
  v:=public.owner_analytics_admin_bootstrap_core_v1();
  v:=jsonb_set(v,'{canonicalAnalytics}',portal_private.market_intelligence_admin_canonical_payload_v1(),true);
  return jsonb_set(v,'{gate}',to_jsonb('OWNER_AUTHORIZED_AUTO_DERIVED_ANALYTICS; LEGACY_MANUAL_PUBLICATIONS_REMAIN_GATED'::text),true);
end;
$function$;
