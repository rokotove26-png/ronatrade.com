create or replace function portal_private.snapshot_market_intelligence_forecast_inputs_v1()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'portal_private'
as $function$
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

  for r in select * from portal_private.market_intelligence_daily_metrics_v1 order by product
  loop
    select * into prev from portal_private.market_intelligence_forecast_snapshots
      where product=r.product and target_month=date '2026-09-01'
      order by snapshot_date desc,created_at desc limit 1;
    if prev.snapshot_id is null then continue; end if;

    grade_diff:=case when r.product='АИ-95' then 40 else 0 end;
    adjusted_forward:=r.september_forward_usd_t+grade_diff;
    adjusted_mtd:=r.mtd_avg_usd_t+grade_diff;

    select coalesce(assessment_value,calc_value) into current_month_forward
    from portal_private.market_intelligence_facts
    where product=r.product and value_type='FORWARD' and delivery_month=date '2026-08-01'
    order by as_of_date desc,created_at desc limit 1;
    if r.product='АИ-95' and current_month_forward is not null then current_month_forward:=current_month_forward+40; end if;

    marker:=md5(concat_ws('|',r.product,r.latest_date::text,coalesce(r.latest_value_usd_t,0)::text,coalesce(r.mtd_avg_usd_t,0)::text,coalesce(r.september_forward_usd_t,0)::text,coalesce(r.forward_as_of::text,''),coalesce(current_month_forward,0)::text,prev.low_usd_t::text,prev.base_usd_t::text,prev.high_usd_t::text));
    if exists(select 1 from portal_private.market_intelligence_forecast_snapshots f where f.product=r.product and f.target_month=date '2026-09-01' and f.metadata->>'market_input_marker'=marker) then continue; end if;

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
      when adjusted_forward>prev.high_usd_t then format('September forward %s USD/т выше действующего HIGH %s USD/т: MODEL REVIEW REQUIRED; сценарный коридор не изменен без отдельного управленческого решения.',to_char(adjusted_forward,'FM999999990D00'),to_char(prev.high_usd_t,'FM999999990D00'))
      when adjusted_forward<prev.low_usd_t then format('September forward %s USD/т ниже действующего LOW %s USD/т: MODEL REVIEW REQUIRED; сценарный коридор не изменен без отдельного управленческого решения.',to_char(adjusted_forward,'FM999999990D00'),to_char(prev.low_usd_t,'FM999999990D00'))
      else coalesce(prev.risk_summary,'Сценарный коридор сохраняется; отслеживать forward, физический рынок, supply/demand и логистику.') end;
    snap_id:='FC-AUTO-'||to_char(clock_timestamp(),'YYYYMMDD-HH24MISSMS')||'-SEP-'||case r.product when 'АИ-92' then 'AI92' when 'АИ-95' then 'AI95' when 'ДТ' then 'DT' else 'NAFTA' end;
    insert into portal_private.market_intelligence_forecast_snapshots(snapshot_id,snapshot_date,target_month,product,forward_implied_usd_t,mtd_at_snapshot_usd_t,low_usd_t,base_usd_t,high_usd_t,direction,confidence,forward_spread_1m_usd_t,curve_type,physical_trend,news_signal,supply_demand_signal,driver_summary,risk_summary,model_version,data_status,rona_margin_usd_t,commercial_low_usd_t,commercial_base_usd_t,commercial_high_usd_t,margin_policy_version,source_ref,metadata)
    values(snap_id,current_date,date '2026-09-01',r.product,adjusted_forward,adjusted_mtd,prev.low_usd_t,prev.base_usd_t,prev.high_usd_t,v_direction,coalesce(prev.confidence,'СРЕДНЯЯ'),v_spread,v_curve,v_physical,v_news,coalesce(prev.supply_demand_signal,'СМЕШАННЫЙ'),'Автоматически обновлены MTD/forward/market inputs; LOW/BASE/HIGH сохранены из последнего утвержденного сценарного коридора. Изменение коридора требует отдельного управленческого решения.',v_risk,'RONA_FORECAST_v1.2_AUTO_INPUT','INDICATIVE',40,prev.low_usd_t+40,prev.base_usd_t+40,prev.high_usd_t+40,'RONA_FORECAST_MARGIN_40_V1',concat_ws(';',r.latest_fact_id,r.forward_fact_id,prev.snapshot_id),jsonb_build_object('market_input_marker',marker,'auto_input_refresh',true,'scenario_corridor_changed',false,'latest_fact_id',r.latest_fact_id,'forward_fact_id',r.forward_fact_id,'previous_snapshot_id',prev.snapshot_id,'ai95_grade_diff_usd_t',grade_diff,'news_upside_7d',upside_count,'news_downside_7d',downside_count));
    inserted_count:=inserted_count+1;
  end loop;
  return jsonb_build_object('ok',true,'inserted',inserted_count);
end;
$function$;
