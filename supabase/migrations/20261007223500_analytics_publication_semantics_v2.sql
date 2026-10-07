-- RONA Analytics publication semantics V2
-- Owner instruction: functional Admin + Client Analytics launch under visual freeze.
-- Commercial authority: 6ce870c7-3d04-4f18-a588-aabc44b1ff90.
-- Operations approval: 9fbd8563-bf93-47f1-8083-bc8155dcfdcc.
-- No raw market-fact, price, DOM, CSS or visual-asset mutation.

create or replace view portal_private.market_intelligence_daily_metrics_v2 as
with source_anchor as (
  select max(f.as_of_date)::date as latest_trade_date
  from portal_private.market_intelligence_facts f
  join portal_private.market_intelligence_source_documents s on s.source_doc_id=f.source_doc_id
  where s.source_family='PLATTS' and s.data_status='CONFIRMED'
    and f.product in ('АИ-92','ДТ','СУГ') and f.quality_status in ('CONFIRMED','CALCULATED')
), target as (
  select latest_trade_date,
    date_trunc('month',latest_trade_date)::date as source_month,
    coalesce(
      (select min(fs.target_month) from portal_private.market_intelligence_forecast_snapshots fs
       where fs.product in ('АИ-92','АИ-95','ДТ','НАФТА')
         and fs.target_month>date_trunc('month',latest_trade_date)::date),
      date_trunc('month',latest_trade_date+interval '1 month')::date
    ) as target_month
  from source_anchor
), base as (
  select f.as_of_date,f.product,
    case when f.market_family='BNK_COMPOSITE' then f.calc_value else f.assessment_value end as value_usd_t,
    f.fact_id,f.source_ref
  from portal_private.market_intelligence_facts f
  where (((f.product in ('АИ-92','АИ-95')) and f.market_family='GASOLINE' and f.value_type='PHYSICAL')
      or (f.product='ДТ' and f.market_family='BNK_COMPOSITE' and f.value_type='CALCULATED')
      or (f.product='НАФТА' and f.market_family='NAPHTHA' and f.value_type='PHYSICAL'))
    and coalesce(case when f.market_family='BNK_COMPOSITE' then f.calc_value else f.assessment_value end,0)<>0
), ranked as (
  select b.*,
    lag(b.value_usd_t) over(partition by b.product order by b.as_of_date) as prev_value_usd_t,
    first_value(b.value_usd_t) over(partition by b.product,date_trunc('month',b.as_of_date::timestamptz) order by b.as_of_date) as month_first_value_usd_t,
    avg(b.value_usd_t) over(partition by b.product,date_trunc('month',b.as_of_date::timestamptz) order by b.as_of_date rows between unbounded preceding and current row) as mtd_avg_usd_t,
    min(b.value_usd_t) over(partition by b.product,date_trunc('month',b.as_of_date::timestamptz) order by b.as_of_date rows between unbounded preceding and current row) as mtd_min_usd_t,
    max(b.value_usd_t) over(partition by b.product,date_trunc('month',b.as_of_date::timestamptz) order by b.as_of_date rows between unbounded preceding and current row) as mtd_max_usd_t,
    count(*) over(partition by b.product,date_trunc('month',b.as_of_date::timestamptz) order by b.as_of_date rows between unbounded preceding and current row) as obs_count,
    row_number() over(partition by b.product order by b.as_of_date desc) as rn
  from base b
), fwd as (
  select distinct on (f.product) f.product,f.as_of_date as forward_as_of,f.delivery_month as forward_target_month,
    f.assessment_value as forward_usd_t,f.fact_id as forward_fact_id,f.source_ref as forward_source_ref
  from portal_private.market_intelligence_facts f
  where f.value_type='FORWARD' and f.delivery_month=(select target_month from target)
    and f.product in ('АИ-92','АИ-95','ДТ','НАФТА')
  order by f.product,f.as_of_date desc,f.created_at desc
), fc as (
  select distinct on (s.product) s.product,s.snapshot_id,s.snapshot_date,s.target_month as snapshot_target_month,
    s.low_usd_t,s.base_usd_t,s.high_usd_t,s.direction,s.confidence,s.curve_type,s.data_status,s.source_ref as forecast_source_ref
  from portal_private.market_intelligence_forecast_snapshots s
  where s.target_month=(select target_month from target) and s.product in ('АИ-92','АИ-95','ДТ','НАФТА')
  order by s.product,s.snapshot_date desc,s.created_at desc
)
select r.product,t.source_month,t.target_month,r.as_of_date as latest_date,r.value_usd_t as latest_value_usd_t,r.prev_value_usd_t,
  r.value_usd_t-r.prev_value_usd_t as d1_change_usd_t,
  case when r.prev_value_usd_t is null or r.prev_value_usd_t=0 then null else (r.value_usd_t-r.prev_value_usd_t)/r.prev_value_usd_t*100 end as d1_change_pct,
  r.mtd_avg_usd_t,r.mtd_min_usd_t,r.mtd_max_usd_t,r.month_first_value_usd_t,r.value_usd_t-r.month_first_value_usd_t as mtd_change_usd_t,
  r.obs_count,r.fact_id as latest_fact_id,r.source_ref as latest_source_ref,
  f.forward_as_of,f.forward_target_month,f.forward_usd_t,f.forward_fact_id,f.forward_source_ref,
  fc.snapshot_id,fc.snapshot_date,fc.low_usd_t,fc.base_usd_t,fc.high_usd_t,fc.direction as forecast_direction,
  fc.confidence,fc.curve_type,fc.data_status as forecast_data_status,fc.forecast_source_ref
from ranked r cross join target t left join fwd f using(product) left join fc using(product)
where r.rn=1;

comment on view portal_private.market_intelligence_daily_metrics_v2 is
'Dynamic current-period metrics. Forecast/forward target follows canonical future target month; no hardcoded September reuse. Authority: Commercial proposal 6ce870c7-3d04-4f18-a588-aabc44b1ff90 + Operations approval 9fbd8563-bf93-47f1-8083-bc8155dcfdcc.';

CREATE OR REPLACE FUNCTION portal_private.snapshot_market_intelligence_forecast_inputs_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'portal_private'
AS $function$
declare
  r record;
  prev record;
  current_month_forward numeric;
  adjusted_forward numeric;
  adjusted_mtd numeric;
  grade_diff numeric;
  marker text;
  snap_id text;
  v_direction text;
  v_physical text;
  v_curve text;
  v_spread numeric;
  v_news text;
  v_risk text;
  inserted_count int:=0;
  upside_count int:=0;
  downside_count int:=0;
begin
  select count(*) filter(where upper(coalesce(impact_direction,'')) like '%UPSIDE%')::int,
         count(*) filter(where upper(coalesce(impact_direction,'')) like '%DOWNSIDE%')::int
    into upside_count,downside_count
  from public.rona_market_news
  where verified=true and publication_status='ОПУБЛИКОВАНО' and source_published_at>=now()-interval '7 days';
  v_news:=case when upside_count>0 and downside_count>0 then 'СМЕШАННО' when upside_count>0 then 'ПОДДЕРЖИВАЕТ ЦЕНЫ' when downside_count>0 then 'ДАВИТ НА ЦЕНЫ' else 'НЕЙТРАЛЬНО' end;

  for r in select * from portal_private.market_intelligence_daily_metrics_v2 order by product
  loop
    select * into prev from portal_private.market_intelligence_forecast_snapshots
      where product=r.product and target_month=r.target_month
      order by snapshot_date desc,created_at desc limit 1;
    if prev.snapshot_id is null or r.forward_usd_t is null then continue; end if;

    grade_diff:=case when r.product='АИ-95' then 40 else 0 end;
    adjusted_forward:=r.forward_usd_t+grade_diff;
    adjusted_mtd:=r.mtd_avg_usd_t+grade_diff;

    select coalesce(assessment_value,calc_value) into current_month_forward
    from portal_private.market_intelligence_facts
    where product=r.product and value_type='FORWARD' and delivery_month=r.source_month
    order by as_of_date desc,created_at desc limit 1;
    if r.product='АИ-95' and current_month_forward is not null then current_month_forward:=current_month_forward+40; end if;

    marker:=md5(concat_ws('|',r.product,r.latest_date::text,coalesce(r.latest_value_usd_t,0)::text,coalesce(r.mtd_avg_usd_t,0)::text,coalesce(r.forward_usd_t,0)::text,coalesce(r.forward_as_of::text,''),coalesce(current_month_forward,0)::text,prev.low_usd_t::text,prev.base_usd_t::text,prev.high_usd_t::text));
    if exists(select 1 from portal_private.market_intelligence_forecast_snapshots f where f.product=r.product and f.target_month=r.target_month and f.metadata->>'market_input_marker'=marker) then continue; end if;

    v_direction:=case when adjusted_forward>adjusted_mtd+1 then 'РОСТ' when adjusted_forward<adjusted_mtd-1 then 'СНИЖЕНИЕ' else 'НЕЙТРАЛЬНО' end;
    v_physical:=case when r.d1_change_usd_t>0 then 'РОСТ' when r.d1_change_usd_t<0 then 'СНИЖЕНИЕ' else 'ФЛЭТ' end;
    if current_month_forward is not null then
      v_spread:=adjusted_forward-current_month_forward;
      v_curve:=case when v_spread< -1 then 'БЭКВОРДАЦИЯ' when v_spread>1 then 'КОНТАНГО' else 'ФЛЭТ' end;
    else
      v_spread:=prev.forward_spread_1m_usd_t;
      v_curve:=prev.curve_type;
    end if;
    v_risk:=case
      when adjusted_forward>prev.high_usd_t then format('Forward %s: %s USD/т выше действующего HIGH %s USD/т: MODEL REVIEW REQUIRED; сценарный коридор не изменен без отдельного управленческого решения.',to_char(r.target_month,'MM.YYYY'),to_char(adjusted_forward,'FM999999990D00'),to_char(prev.high_usd_t,'FM999999990D00'))
      when adjusted_forward<prev.low_usd_t then format('Forward %s: %s USD/т ниже действующего LOW %s USD/т: MODEL REVIEW REQUIRED; сценарный коридор не изменен без отдельного управленческого решения.',to_char(r.target_month,'MM.YYYY'),to_char(adjusted_forward,'FM999999990D00'),to_char(prev.low_usd_t,'FM999999990D00'))
      else coalesce(prev.risk_summary,'Сценарный коридор сохраняется; отслеживать forward, физический рынок, supply/demand и логистику.') end;
    snap_id:='FC-AUTO-'||to_char(clock_timestamp(),'YYYYMMDD-HH24MISSMS')||'-TGT-'||case r.product when 'АИ-92' then 'AI92' when 'АИ-95' then 'AI95' when 'ДТ' then 'DT' else 'NAFTA' end;
    insert into portal_private.market_intelligence_forecast_snapshots(snapshot_id,snapshot_date,target_month,product,forward_implied_usd_t,mtd_at_snapshot_usd_t,low_usd_t,base_usd_t,high_usd_t,direction,confidence,forward_spread_1m_usd_t,curve_type,physical_trend,news_signal,supply_demand_signal,driver_summary,risk_summary,model_version,data_status,rona_margin_usd_t,commercial_low_usd_t,commercial_base_usd_t,commercial_high_usd_t,margin_policy_version,source_ref,metadata)
    values(snap_id,current_date,r.target_month,r.product,adjusted_forward,adjusted_mtd,prev.low_usd_t,prev.base_usd_t,prev.high_usd_t,v_direction,coalesce(prev.confidence,'СРЕДНЯЯ'),v_spread,v_curve,v_physical,v_news,coalesce(prev.supply_demand_signal,'СМЕШАННЫЙ'),'Автоматически обновлены MTD/forward/market inputs; LOW/BASE/HIGH сохранены из последнего утвержденного сценарного коридора. Изменение коридора требует отдельного управленческого решения.',v_risk,'RONA_FORECAST_v1.2_AUTO_INPUT','INDICATIVE',40,prev.low_usd_t+40,prev.base_usd_t+40,prev.high_usd_t+40,'RONA_FORECAST_MARGIN_40_V1',concat_ws(';',r.latest_fact_id,r.forward_fact_id,prev.snapshot_id),jsonb_build_object('market_input_marker',marker,'auto_input_refresh',true,'scenario_corridor_changed',false,'latest_fact_id',r.latest_fact_id,'forward_fact_id',r.forward_fact_id,'previous_snapshot_id',prev.snapshot_id,'ai95_grade_diff_usd_t',grade_diff,'news_upside_7d',upside_count,'news_downside_7d',downside_count));
    inserted_count:=inserted_count+1;
  end loop;
  return jsonb_build_object('ok',true,'inserted',inserted_count);
end;
$function$


CREATE OR REPLACE FUNCTION portal_private.refresh_market_intelligence_analytics_core_v1(p_reason text DEFAULT 'AUTO'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'portal_private', 'auth'
AS $function$
declare
  v_ctl portal_private.market_intelligence_control%rowtype;
  v_sig text;
  v_run uuid;
  v_actor uuid;
  v_pub uuid;
  v_pub_id text;
  v_news_count int:=0;
  v_news_max timestamptz;
  v_fact_count int:=0;
  v_fc_count int:=0;
  v_src_count int:=0;
  v_m record;
  v_lpg record;
  v_content text;
  v_headline text;
  v_basis text;
  v_chart jsonb;
  v_sources jsonb;
  v_dir text;
  v_latest_display numeric;
  v_mtd_display numeric;
  v_forward_display numeric;
  v_grade_diff numeric;
  v_last_platts date;
  v_expected_platts date;
  v_source_gap boolean:=false;
  v_primary_telegram_ok boolean:=false;
  v_freshness_note text;
  v_telegram_note text;
  v_item_freshness text;
  v_mtd_label text;
  v_forward_label text;
  v_lpg_turksib numeric;
  v_lpg_bekabad numeric;
  v_lpg_saryagash numeric;
  v_lpg_turksib_change numeric;
  v_lpg_bekabad_change numeric;
  v_lpg_saryagash_change numeric;
begin
  perform pg_advisory_xact_lock(hashtext('RONA_MARKET_INTELLIGENCE_AUTO_V1'));
  select * into v_ctl from portal_private.market_intelligence_control where singleton=true for update;
  if not found or not v_ctl.enabled then
    return jsonb_build_object('ok',false,'status','DISABLED');
  end if;

  select count(*)::int into v_fact_count from portal_private.market_intelligence_facts;
  select count(*)::int into v_fc_count from portal_private.market_intelligence_forecast_snapshots;
  select count(*)::int into v_src_count from portal_private.market_intelligence_source_documents;
  select count(*)::int,max(updated_at) into v_news_count,v_news_max
  from public.rona_market_news
  where verified=true and publication_status='ОПУБЛИКОВАНО';

  select max(source_date) into v_last_platts
  from portal_private.market_intelligence_source_documents
  where source_family='PLATTS';

  v_expected_platts := case extract(isodow from (now() at time zone 'Europe/Moscow')::date)::int
    when 1 then (now() at time zone 'Europe/Moscow')::date - 3
    when 7 then (now() at time zone 'Europe/Moscow')::date - 2
    when 6 then (now() at time zone 'Europe/Moscow')::date - 1
    else (now() at time zone 'Europe/Moscow')::date - 1
  end;
  v_source_gap := v_last_platts is null or v_last_platts < v_expected_platts;

  select exists(
    select 1 from portal_private.telegram_market_channels t
    where t.enabled=true and t.channel_role='PRIMARY'
      and t.last_successful_ingest_at is not null
      and t.last_successful_ingest_at>=now()-interval '24 hours'
      and t.last_error_code is null
  ) into v_primary_telegram_ok;

  v_freshness_note := case when v_source_gap then
      'Последний доступный Platts: '||coalesce(to_char(v_last_platts,'DD.MM.YYYY'),'нет данных')||'; ожидаемый последний торговый день '||to_char(v_expected_platts,'DD.MM.YYYY')||' в контуре отсутствует. Источник помечен как РАЗРЫВ ДАННЫХ.'
    else
      'Platts актуален по последнему ожидаемому торговому дню: '||to_char(v_last_platts,'DD.MM.YYYY')||'.'
    end;
  v_telegram_note := case when v_primary_telegram_ok then
      'Основной Telegram-источник доступен.'
    else
      'Основной Telegram-источник Platts сейчас деградирован; данные не достраиваются и не подменяются.'
    end;

  select md5(concat_ws('|',
    (select count(*)::text from portal_private.market_intelligence_facts),
    (select coalesce(sum(coalesce(assessment_value,0)+coalesce(calc_value,0)+coalesce(value_low,0)+coalesce(value_high,0)),0)::text from portal_private.market_intelligence_facts),
    (select coalesce(max(as_of_date)::text,'') from portal_private.market_intelligence_facts),
    (select count(*)::text from portal_private.market_intelligence_forecast_snapshots),
    (select coalesce(sum(coalesce(low_usd_t,0)+coalesce(base_usd_t,0)+coalesce(high_usd_t,0)+coalesce(forward_implied_usd_t,0)),0)::text from portal_private.market_intelligence_forecast_snapshots),
    (select count(*)::text from portal_private.market_intelligence_rules where rule_status<>'RETIRED'),
    coalesce(v_news_count::text,'0'),coalesce(v_news_max::text,''),coalesce(v_last_platts::text,''),v_expected_platts::text,v_source_gap::text,v_primary_telegram_ok::text,
    'PUBLIC_DISPLAY_FACT_MTD_FORWARD_V3')) into v_sig;

  if not v_ctl.dirty and v_ctl.last_input_signature=v_sig then
    update portal_private.market_intelligence_control set last_run_at=now(),last_status='NO_CHANGE',last_error_code=null,updated_at=now() where singleton=true;
    return jsonb_build_object('ok',true,'status','NO_CHANGE','signature',v_sig,'publication_id',v_ctl.last_publication_id);
  end if;

  insert into portal_private.market_intelligence_runs(trigger_reason,status,material_change,input_signature,source_doc_count,fact_count,forecast_count,metadata)
  values(coalesce(nullif(btrim(p_reason),''),'AUTO'),'STARTED',true,v_sig,v_src_count,v_fact_count,v_fc_count,
         jsonb_build_object('owner_authorization_ref',v_ctl.owner_authorization_ref,'news_count',v_news_count,'news_max_updated_at',v_news_max,'last_platts_date',v_last_platts,'expected_platts_date',v_expected_platts,'source_gap',v_source_gap,'primary_telegram_ok',v_primary_telegram_ok,'public_display_semantics','FACT_MTD_FORWARD'))
  returning run_id into v_run;

  select id into v_actor from portal_private.portal_users where login_name='rokotove' and status='ACTIVE' and lifecycle_state='ACTIVE' order by created_at limit 1;
  if v_actor is null then raise exception 'OWNER_ADMIN_ACTOR_NOT_FOUND'; end if;

  if not exists(select 1 from portal_private.market_intelligence_daily_metrics_v1 where product='АИ-92' and latest_date>=date '2026-08-27') then
    raise exception 'CURRENT_PLATTS_FACTS_NOT_RESTORED';
  end if;

  update portal_private.publications
     set status='SUPERSEDED',lifecycle_state='ARCHIVED',authority_state='SUPERSEDED',updated_at=now()
   where source_system='RONA_MARKET_INTELLIGENCE_AUTO_V1'
     and publication_type='ANALYTICS'
     and lifecycle_state='ACTIVE';
  update portal_private.publication_items pi
     set distribution_allowed=false,lifecycle_state='ARCHIVED',authority_state='SUPERSEDED',source_visibility_state='ARCHIVED_NOT_DISTRIBUTED',updated_at=now()
   where pi.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
     and exists(select 1 from portal_private.publications p where p.id=pi.publication_key and p.source_system='RONA_MARKET_INTELLIGENCE_AUTO_V1' and p.lifecycle_state='ARCHIVED');

  v_pub_id:='RONA-MARKET-ANALYTICS-AUTO-'||to_char(clock_timestamp(),'YYYYMMDD-HH24MISS')||'-'||upper(substr(v_sig,1,8));
  insert into portal_private.publications(publication_id,publication_type,title,status,audience,prepared_at,prepared_by,approved_at,approved_by,published_at,published_by,source_system,source_version,source_timestamp,authority_state,lifecycle_state,metadata)
  values(v_pub_id,'ANALYTICS','Рыночная аналитика RONA Trade — текущие данные и прогнозные входы','PUBLISHED','ALL_CLIENTS',now(),v_actor,now(),v_actor,now(),v_actor,'RONA_MARKET_INTELLIGENCE_AUTO_V1','AUTO_V2:'||v_sig,now(),'VERIFIED','ACTIVE',
         jsonb_build_object('publication_layer','DERIVED_ANALYTICS','automatic',true,'owner_authorization_ref',v_ctl.owner_authorization_ref,'raw_platts_private',true,'price_mutation_allowed',false,'input_signature',v_sig,'run_id',v_run,'news_signal_count',v_news_count,'public_display_semantics','FACT_MTD_FORWARD','last_platts_date',v_last_platts,'expected_platts_date',v_expected_platts,'source_freshness_state',case when v_source_gap then 'SOURCE_GAP' else 'CURRENT' end,'primary_telegram_ok',v_primary_telegram_ok))
  returning id into v_pub;

  for v_m in select * from portal_private.market_intelligence_daily_metrics_v2 order by case product when 'АИ-92' then 1 when 'АИ-95' then 2 when 'ДТ' then 3 when 'НАФТА' then 4 else 9 end
  loop
    v_grade_diff:=case when v_m.product='АИ-95' then 40 else 0 end;
    v_latest_display:=v_m.latest_value_usd_t+v_grade_diff;
    v_mtd_display:=v_m.mtd_avg_usd_t+v_grade_diff;
    v_forward_display:=case when v_m.forward_usd_t is null then null else v_m.forward_usd_t+v_grade_diff end;
    v_dir:=case when v_m.d1_change_usd_t>0 then 'вырос' when v_m.d1_change_usd_t<0 then 'снизился' else 'не изменился' end;
    v_basis:=case when v_m.product in ('АИ-92','АИ-95','ДТ') then 'RONA: Озинки / Сарыагаш / Турксиб / Наушки' else 'RONA: коммерческие базисы' end;
    v_item_freshness:=case when v_m.latest_date is null then 'TO_VERIFY_FRESHNESS' when v_m.latest_date<v_expected_platts then 'STALE_SOURCE' else 'CURRENT' end;
    v_mtd_label:='MTD '||to_char(v_m.latest_date,'MM.YYYY');
    v_forward_label:='FORWARD '||to_char(v_m.target_month,'MM.YYYY');

    if v_m.product='АИ-92' then
      v_headline:='АИ-92: текущий ориентир '||to_char(v_latest_display,'FM999999990D00')||'; MTD '||to_char(v_mtd_display,'FM999999990D00')||'; forward '||to_char(v_m.target_month,'MM.YYYY')||' '||coalesce(to_char(v_forward_display,'FM999999990D00'),'нет данных')||' USD/т';
      v_content:='По последнему подтвержденному торговому дню '||to_char(v_m.latest_date,'DD.MM.YYYY')||' базовый бензиновый ориентир '||v_dir||' относительно предыдущего наблюдения и составляет '||to_char(v_latest_display,'FM999999990D00')||' USD/т. Среднее MTD '||to_char(v_m.latest_date,'MM.YYYY')||' — '||to_char(v_mtd_display,'FM999999990D00')||' USD/т; forward '||to_char(v_m.target_month,'MM.YYYY')||' — '||coalesce(to_char(v_forward_display,'FM999999990D00'),'нет данных')||' USD/т. Старый LOW/BASE/HIGH больше не показывается как текущий прогноз: он сохранен только в историческом сценарном архиве. '||v_freshness_note||' '||v_telegram_note||' Финальный клиентский прайс автоматически не изменяется.';
    elsif v_m.product='АИ-95' then
      v_headline:='АИ-95: расчетный слой '||to_char(v_latest_display,'FM999999990D00')||'; MTD '||to_char(v_mtd_display,'FM999999990D00')||'; forward '||to_char(v_m.target_month,'MM.YYYY')||' '||coalesce(to_char(v_forward_display,'FM999999990D00'),'нет данных')||' USD/т';
      v_content:='Для АИ-95 текущий расчетный слой формируется отдельно от исходных данных Platts: к базовому бензиновому индексу применяется действующая расчетная разница марки +40 USD/т. На '||to_char(v_m.latest_date,'DD.MM.YYYY')||' расчетный ориентир — '||to_char(v_latest_display,'FM999999990D00')||' USD/т, MTD '||to_char(v_m.latest_date,'MM.YYYY')||' — '||to_char(v_mtd_display,'FM999999990D00')||' USD/т, forward '||to_char(v_m.target_month,'MM.YYYY')||' — '||coalesce(to_char(v_forward_display,'FM999999990D00'),'нет данных')||' USD/т. Это расчетный слой RONA, а не отдельная исходная котировка Platts. Старый LOW/BASE/HIGH сохранен только как исторический сценарий. '||v_freshness_note||' '||v_telegram_note||' Финальный клиентский прайс остается под отдельным шлюзом обновления цен Руководителя.';
    elsif v_m.product='ДТ' then
      v_headline:='ДТ: текущий композит '||to_char(v_latest_display,'FM999999990D00')||'; MTD '||to_char(v_mtd_display,'FM999999990D00')||'; forward '||to_char(v_m.target_month,'MM.YYYY')||' '||coalesce(to_char(v_forward_display,'FM999999990D00'),'нет данных')||' USD/т';
      v_content:='По состоянию на '||to_char(v_m.latest_date,'DD.MM.YYYY')||' композитная база БНК, рассчитанная как среднее применимых ULSD/Diesel индексов, '||case when v_m.d1_change_usd_t>0 then 'выросла' when v_m.d1_change_usd_t<0 then 'снизилась' else 'не изменилась' end||' и составляет '||to_char(v_latest_display,'FM999999990D00')||' USD/т. MTD '||to_char(v_m.latest_date,'MM.YYYY')||' — '||to_char(v_mtd_display,'FM999999990D00')||' USD/т; forward '||to_char(v_m.target_month,'MM.YYYY')||' — '||coalesce(to_char(v_forward_display,'FM999999990D00'),'нет данных')||' USD/т. Старый LOW/BASE/HIGH не используется как текущая рыночная оценка. '||v_freshness_note||' '||v_telegram_note||' Финальный прайс не изменяется автоматически.';
    else
      v_headline:='Нафта: текущий ориентир '||to_char(v_latest_display,'FM999999990D00')||'; MTD '||to_char(v_mtd_display,'FM999999990D00')||'; forward '||to_char(v_m.target_month,'MM.YYYY')||' '||coalesce(to_char(v_forward_display,'FM999999990D00'),'нет данных')||' USD/т';
      v_content:='По состоянию на '||to_char(v_m.latest_date,'DD.MM.YYYY')||' подтвержденный индикатор нафты составляет '||to_char(v_latest_display,'FM999999990D00')||' USD/т, MTD '||to_char(v_m.latest_date,'MM.YYYY')||' — '||to_char(v_mtd_display,'FM999999990D00')||' USD/т, forward '||to_char(v_m.target_month,'MM.YYYY')||' — '||coalesce(to_char(v_forward_display,'FM999999990D00'),'нет данных')||' USD/т. В процедуре БНК отдельная формула закупочной цены для нафты не определена, поэтому это только рыночная аналитика. Старый LOW/BASE/HIGH оставлен исключительно в историческом сценарном архиве. '||v_freshness_note||' '||v_telegram_note;
    end if;

    v_chart:=jsonb_build_object('type','FORECAST_RANGE','target_month',to_char(v_m.target_month,'YYYY-MM'),'labels',jsonb_build_array('ФАКТ',v_mtd_label,v_forward_label),'values',jsonb_build_array(v_latest_display,v_mtd_display,v_forward_display),'unit','USD/т','raw_benchmark_private',true,'chart_semantics','CURRENT_FACT_MTD_FORWARD','latest_source_date',v_m.latest_date,'source_freshness_state',v_item_freshness,'expected_source_date',v_expected_platts);
    v_sources:=jsonb_build_array(v_m.latest_fact_id,v_m.forward_fact_id,v_m.snapshot_id,'BNK-PRICING-PROCEDURE-2026-08');

    insert into portal_private.publication_items(publication_key,item_type,item_order,product,basis,audience,distribution_allowed,headline,content_text,analytics_as_of,analytics_period_from,analytics_period_to,forecast_scenario,actual_value,forecast_value,analytics_unit,metadata,source_system,source_version,source_timestamp,authority_state,lifecycle_state,source_item_subtype,source_visibility_state)
    values(v_pub,'ANALYTICS',case v_m.product when 'АИ-92' then 1 when 'АИ-95' then 2 when 'ДТ' then 3 else 4 end,v_m.product,v_basis,'ALL_CLIENTS',true,v_headline,v_content,v_m.latest_date::timestamptz,date_trunc('month',v_m.latest_date)::timestamptz,v_m.latest_date::timestamptz,null,v_latest_display,v_forward_display,'USD/т',
           jsonb_build_object('publication_layer','DERIVED_ANALYTICS','public_chart_ready',true,'public_chart',v_chart,'source_refs',v_sources,'data_state','CALCULATED-DERIVED','raw_source_values_exposed',false,'public_display_semantics','FACT_MTD_FORWARD','mtd_value_usd_t',v_mtd_display,'mtd_observation_count',v_m.obs_count,'current_forward_as_of',v_m.forward_as_of,'forecast_snapshot_date',v_m.snapshot_date,'historical_scenario',jsonb_build_object('low',v_m.low_usd_t,'base',v_m.base_usd_t,'high',v_m.high_usd_t,'current',false),'source_freshness_state',v_item_freshness,'last_platts_date',v_last_platts,'expected_platts_date',v_expected_platts,'primary_telegram_ok',v_primary_telegram_ok,'ai95_grade_diff_usd_t',v_grade_diff),
           'RONA_MARKET_INTELLIGENCE_AUTO_V1','AUTO_V2:'||v_sig,now(),'VERIFIED','ACTIVE','MARKET_INTELLIGENCE','ALL_LK_AUTO_PUBLISHED');
  end loop;

  select * into v_lpg
  from portal_private.market_intelligence_facts
  where market_family='CENTRAL_ASIA_LPG' and upper(coalesce(basis,'')) like '%ГАЛАБ%'
  order by as_of_date desc,publication_date desc nulls last,created_at desc limit 1;

  if found then
    select assessment_value,(metadata->>'weekly_change')::numeric into v_lpg_turksib,v_lpg_turksib_change from portal_private.market_intelligence_facts where market_family='CENTRAL_ASIA_LPG' and as_of_date=v_lpg.as_of_date and upper(coalesce(basis,'')) like '%ТУРКСИБ%' order by created_at desc limit 1;
    select assessment_value,(metadata->>'weekly_change')::numeric into v_lpg_bekabad,v_lpg_bekabad_change from portal_private.market_intelligence_facts where market_family='CENTRAL_ASIA_LPG' and as_of_date=v_lpg.as_of_date and upper(coalesce(basis,'')) like '%БЕКАБАД%' order by created_at desc limit 1;
    select assessment_value,(metadata->>'weekly_change')::numeric into v_lpg_saryagash,v_lpg_saryagash_change from portal_private.market_intelligence_facts where market_family='CENTRAL_ASIA_LPG' and as_of_date=v_lpg.as_of_date and upper(coalesce(basis,'')) like '%САРЫАГАШ%' order by created_at desc limit 1;
    v_chart:=jsonb_build_object('type','REGIONAL_RANGE','basis','CPT Галаба','labels',jsonb_build_array('MIN','AVG','MAX'),'values',jsonb_build_array((v_lpg.metadata->>'min')::numeric,v_lpg.assessment_value,(v_lpg.metadata->>'max')::numeric),'unit','USD/т','source_date',v_lpg.as_of_date,'chart_semantics','LATEST_REGIONAL_SOURCE','source_freshness_state','TO_VERIFY_FRESHNESS','expected_source_date',null);
    v_content:='Последний доступный региональный выпуск по СУГ: дата рынка '||to_char(v_lpg.as_of_date,'DD.MM.YYYY')||', публикация '||coalesce(to_char(v_lpg.publication_date,'DD.MM.YYYY'),'не указана')||'. CPT Галаба — '||to_char(v_lpg.assessment_value,'FM999999990D00')||' USD/т, недельное изменение '||coalesce(to_char((v_lpg.metadata->>'weekly_change')::numeric,'FM999999990D00'),'нет данных')||'; CPT Турксиб — '||coalesce(to_char(v_lpg_turksib,'FM999999990D00'),'нет данных')||' ('||coalesce(to_char(v_lpg_turksib_change,'FM999999990D00'),'нет данных')||'); DAP Бекабад — '||coalesce(to_char(v_lpg_bekabad,'FM999999990D00'),'нет данных')||' ('||coalesce(to_char(v_lpg_bekabad_change,'FM999999990D00'),'нет данных')||'); DAP Сарыагаш — '||coalesce(to_char(v_lpg_saryagash,'FM999999990D00'),'нет данных')||' ('||coalesce(to_char(v_lpg_saryagash_change,'FM999999990D00'),'нет данных')||') USD/т. Актуальность регионального источника к текущей дате требует проверки; данные не достраиваются и не подменяются. Это индикативная региональная аналитика; финальный клиентский прайс автоматически не изменяется.';
    insert into portal_private.publication_items(publication_key,item_type,item_order,product,basis,audience,distribution_allowed,headline,content_text,analytics_as_of,analytics_period_from,analytics_period_to,forecast_scenario,actual_value,forecast_value,analytics_unit,metadata,source_system,source_version,source_timestamp,authority_state,lifecycle_state,source_item_subtype,source_visibility_state)
    values(v_pub,'ANALYTICS',5,'СУГ / СПБТ','RONA: Галаба / Турксиб / Сарыагаш','ALL_CLIENTS',true,'СУГ: актуальный региональный срез по последнему доступному выпуску',v_content,v_lpg.as_of_date::timestamptz,v_lpg.as_of_date::timestamptz,v_lpg.as_of_date::timestamptz,'REGIONAL_INDICATIVE',v_lpg.assessment_value,null,'USD/т',
           jsonb_build_object('publication_layer','DERIVED_ANALYTICS','public_chart_ready',true,'public_chart',v_chart,'source_refs',jsonb_build_array(v_lpg.fact_id,coalesce(v_lpg.source_ref,'PETROMARKET')),'data_state','INDICATIVE-FORECAST','raw_source_values_exposed',true,'price_mutation_allowed',false,'public_display_semantics','LATEST_REGIONAL_SOURCE','source_freshness_state','TO_VERIFY_FRESHNESS','expected_source_date',null),
           'RONA_MARKET_INTELLIGENCE_AUTO_V1','AUTO_V2:'||v_sig,now(),'VERIFIED','ACTIVE','REGIONAL_LPG_ANALYTICS','ALL_LK_AUTO_PUBLISHED');
  end if;

  update portal_private.market_intelligence_control
     set dirty=false,last_input_signature=v_sig,last_run_at=now(),last_success_at=now(),last_status='SUCCESS',last_error_code=null,last_publication_id=v_pub_id,updated_at=now()
   where singleton=true;
  update portal_private.market_intelligence_runs set status='SUCCESS',publication_id=v_pub_id,finished_at=now(),metadata=metadata||jsonb_build_object('item_count',(select count(*) from portal_private.publication_items where publication_key=v_pub),'price_auto_publish',false,'public_display_semantics','FACT_MTD_FORWARD') where run_id=v_run;
  insert into portal_private.audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata,result)
  values(v_actor,'ADMIN','ANALYTICS_AUTO_REFRESHED','PUBLICATION',v_pub_id,jsonb_build_object('gate','OWNER_AUTHORIZED_DERIVED_ANALYTICS_AUTO','owner_authorization_ref',v_ctl.owner_authorization_ref,'run_id',v_run,'input_signature',v_sig,'price_mutation_allowed',false,'public_display_semantics','FACT_MTD_FORWARD','source_gap',v_source_gap),'SUCCESS');
  return jsonb_build_object('ok',true,'status','SUCCESS','run_id',v_run,'publication_id',v_pub_id,'signature',v_sig,'fact_count',v_fact_count,'forecast_count',v_fc_count,'source_doc_count',v_src_count,'news_count',v_news_count,'last_platts_date',v_last_platts,'expected_platts_date',v_expected_platts,'source_gap',v_source_gap,'primary_telegram_ok',v_primary_telegram_ok);
exception when others then
  update portal_private.market_intelligence_control set last_run_at=now(),last_status='FAILED',last_error_code=sqlstate||':'||left(sqlerrm,180),updated_at=now() where singleton=true;
  if v_run is not null then update portal_private.market_intelligence_runs set status='FAILED',error_code=sqlstate,error_text=left(sqlerrm,1000),finished_at=now() where run_id=v_run; end if;
  raise;
end;
$function$


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
),
target as (
  select
    latest_trade_date,
    date_trunc('month',latest_trade_date)::date as source_month,
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


comment on function portal_private.snapshot_market_intelligence_forecast_inputs_v1() is
'Current-target fail-closed snapshotting; no legacy September reuse.';
comment on function portal_private.refresh_market_intelligence_analytics_core_v1(text) is
'Dynamic period labels and per-item freshness; stale/missing forward fails closed; visual layer unchanged.';
comment on function portal_private.market_intelligence_admin_canonical_payload_v1() is
'Canonical Admin payload with dynamic target-period LPG wording; underlying authorities unchanged.';
