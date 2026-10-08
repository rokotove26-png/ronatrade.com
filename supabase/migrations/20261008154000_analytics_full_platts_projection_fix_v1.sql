-- Projection follow-up for full Platts curve.
-- Makes calculated DT forwards visible to the existing metrics view and adds the LPG forecast to the canonical Admin payload.
-- Official published price data remains unchanged.

create or replace function portal_private.snapshot_market_intelligence_lpg_curve_v1()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','portal_private'
as $$
declare
  v_source_date date;
  v_m1 date; v_m2 date; v_m3 date;
  c1 numeric; c2 numeric; c3 numeric;
  v_low numeric; v_base numeric; v_high numeric;
  v_curve text; v_id text; v_source_ref text;
begin
  select max(as_of_date) into v_source_date
  from portal_private.market_intelligence_facts
  where product='СУГ'
    and market_family='FINANCIAL_FORWARD'
    and value_type='FORWARD'
    and metadata->>'parser'='FULL_PLATTS_CURVE_V1';

  if v_source_date is null then
    return jsonb_build_object('ok',false,'status','NO_LPG_FULL_CURVE_FACTS');
  end if;

  v_m1:=date_trunc('month',v_source_date)::date;
  v_m2:=(v_m1+interval '1 month')::date;
  v_m3:=(v_m1+interval '2 month')::date;

  select coalesce(assessment_value,calc_value),source_ref into c1,v_source_ref
  from portal_private.market_intelligence_facts
  where product='СУГ' and market_family='FINANCIAL_FORWARD' and value_type='FORWARD'
    and as_of_date=v_source_date and delivery_month=v_m1
    and metadata->>'parser'='FULL_PLATTS_CURVE_V1'
  order by created_at desc limit 1;

  select coalesce(assessment_value,calc_value) into c2
  from portal_private.market_intelligence_facts
  where product='СУГ' and market_family='FINANCIAL_FORWARD' and value_type='FORWARD'
    and as_of_date=v_source_date and delivery_month=v_m2
    and metadata->>'parser'='FULL_PLATTS_CURVE_V1'
  order by created_at desc limit 1;

  select coalesce(assessment_value,calc_value) into c3
  from portal_private.market_intelligence_facts
  where product='СУГ' and market_family='FINANCIAL_FORWARD' and value_type='FORWARD'
    and as_of_date=v_source_date and delivery_month=v_m3
    and metadata->>'parser'='FULL_PLATTS_CURVE_V1'
  order by created_at desc limit 1;

  if c1 is null or c2 is null or c3 is null then
    return jsonb_build_object('ok',false,'status','LPG_CURVE_INCOMPLETE');
  end if;

  v_low:=least(c1,c2,c3);
  v_base:=c2;
  v_high:=greatest(c1,c2,c3);
  v_curve:=case
    when c1>c2 and c2>c3 then 'БЭКВОРДАЦИЯ'
    when c1<c2 and c2<c3 then 'КОНТАНГО'
    else 'СМЕШАННАЯ' end;
  v_id:='FCS-'||to_char(v_source_date,'YYYYMMDD')||'-LPG-'||to_char(v_m2,'YYYYMM');

  insert into portal_private.market_intelligence_forecast_snapshots(
    snapshot_id,snapshot_date,target_month,product,forward_implied_usd_t,mtd_at_snapshot_usd_t,
    low_usd_t,base_usd_t,high_usd_t,direction,confidence,forward_spread_1m_usd_t,curve_type,
    physical_trend,news_signal,supply_demand_signal,driver_summary,risk_summary,model_version,data_status,
    rona_margin_usd_t,commercial_low_usd_t,commercial_base_usd_t,commercial_high_usd_t,margin_policy_version,
    source_ref,metadata,created_at
  )
  values(
    v_id,v_source_date,v_m2,'СУГ',v_base,null,
    v_low,v_base,v_high,'TO_VERIFY','СРЕДНЯЯ',c2-c1,v_curve,
    null,null,null,
    'Source-locked three-month propane financial curve; BASE is target-month M2.',
    'Indicative analytics only; current-MTD comparison is unavailable for this source family.',
    'RONA_FULL_PLATTS_CURVE_V1','INDICATIVE',
    null,null,null,null,null,
    v_source_ref,
    jsonb_build_object(
      'contract','RONA_ANALYTICS_FULL_PLATTS_CURVE_V1',
      'curve_m1',c1,'curve_m2',c2,'curve_m3',c3,
      'confidence_basis','THREE_MONTH_SOURCE_CURVE',
      'official_price_list_unchanged',true,
      'commercial_proposal_id','5697e762-4cdc-47a8-972c-eeb4a2a67c8f',
      'operations_approval_id','b295fe31-92ca-4702-8e5c-4a199699fb30'
    ),
    now()
  )
  on conflict(snapshot_id) do update
    set snapshot_date=excluded.snapshot_date,target_month=excluded.target_month,
        forward_implied_usd_t=excluded.forward_implied_usd_t,
        low_usd_t=excluded.low_usd_t,base_usd_t=excluded.base_usd_t,high_usd_t=excluded.high_usd_t,
        direction=excluded.direction,confidence=excluded.confidence,
        forward_spread_1m_usd_t=excluded.forward_spread_1m_usd_t,curve_type=excluded.curve_type,
        driver_summary=excluded.driver_summary,risk_summary=excluded.risk_summary,
        model_version=excluded.model_version,data_status=excluded.data_status,
        source_ref=excluded.source_ref,metadata=excluded.metadata,created_at=excluded.created_at;

  return jsonb_build_object('ok',true,'status','SNAPSHOTTED','source_date',v_source_date,'target_month',v_m2,'product','СУГ');
end
$$;

create or replace function public.owner_analytics_admin_bootstrap()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','portal_private','auth'
as $$
declare
  v jsonb;
  r record;
  vals jsonb;
  n int;
  ref numeric;
  fc jsonb;
begin
  v:=public.owner_analytics_admin_bootstrap_base_v1();

  for r in
    select * from (values
      ('AI92'::text,'АИ-92'::text),
      ('AI95'::text,'АИ-95'::text),
      ('DT'::text,'ДТ'::text),
      ('LPG'::text,'СУГ'::text)
    ) x(k,product)
  loop
    vals:=v #> array['canonicalAnalytics','products',r.k,'values'];
    ref:=null;
    if jsonb_typeof(vals)='array' then
      n:=jsonb_array_length(vals);
      if n>0 and (vals->>(n-1)) ~ '^-?[0-9]+([.][0-9]+)?$' then
        ref:=(vals->>(n-1))::numeric;
      end if;
    end if;

    select jsonb_build_object(
      'month',to_char(s.target_month,'YYYY-MM'),
      'low',s.low_usd_t,'base',s.base_usd_t,'high',s.high_usd_t,
      'forward',s.forward_implied_usd_t,'direction',s.direction,
      'confidence',s.confidence,'curveType',s.curve_type,
      'reference',ref,'sourceRef',s.source_ref
    )
    into fc
    from portal_private.market_intelligence_forecast_snapshots s
    where s.product=r.product and s.model_version='RONA_FULL_PLATTS_CURVE_V1'
    order by s.target_month desc,s.created_at desc
    limit 1;

    if fc is not null then
      v:=jsonb_set(v,array['canonicalAnalytics','products',r.k,'forecast'],
          coalesce(v #> array['canonicalAnalytics','products',r.k,'forecast'],'{}'::jsonb)||fc,true);
    end if;
    if ref is not null then
      v:=jsonb_set(v,array['canonicalAnalytics','products',r.k,'rona','reference'],to_jsonb(ref),true);
    end if;
  end loop;
  return v;
end
$$;

revoke all on function public.owner_analytics_admin_bootstrap() from public,anon;
grant execute on function public.owner_analytics_admin_bootstrap() to authenticated;

create or replace function portal_private.market_intelligence_source_processor_cron_tick_v5()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','portal_private'
as $$
declare
  base jsonb; curve jsonb; fc jsonb; lpg jsonb; pub jsonb;
begin
  base:=portal_private.market_intelligence_source_processor_cron_tick_v3();
  curve:=portal_private.market_intelligence_materialize_full_curve_v1();

  update portal_private.market_intelligence_facts
     set assessment_value=calc_value
   where product='ДТ'
     and market_family='FINANCIAL_FORWARD'
     and value_type='FORWARD'
     and metadata->>'parser'='FULL_PLATTS_CURVE_V1'
     and calc_value is not null
     and assessment_value is distinct from calc_value;

  fc:=portal_private.snapshot_market_intelligence_forecast_inputs_v2();
  lpg:=portal_private.snapshot_market_intelligence_lpg_curve_v1();

  if coalesce((curve->>'ok')::boolean,false)
     or coalesce((fc->>'ok')::boolean,false)
     or coalesce((lpg->>'ok')::boolean,false) then
    pub:=portal_private.refresh_market_intelligence_analytics_v1('FULL_PLATTS_CURVE_V1');
  end if;

  return jsonb_build_object('ok',true,'base',base,'curve',curve,'forecast',fc,'lpg',lpg,'publication',pub);
end
$$;

revoke all on function portal_private.market_intelligence_source_processor_cron_tick_v5() from public,anon,authenticated,service_role;
grant execute on function portal_private.market_intelligence_source_processor_cron_tick_v5() to postgres;

do $$
declare j bigint;
begin
  select jobid into j from cron.job where jobname='rona-market-intelligence-source-processor-v1';
  if j is null then raise exception 'MARKET_INTELLIGENCE_SOURCE_PROCESSOR_CRON_NOT_FOUND'; end if;
  perform cron.alter_job(job_id:=j,command:='select portal_private.market_intelligence_source_processor_cron_tick_v5();');
end
$$;

do $$
declare
  v_lpg jsonb;
  v_pub jsonb;
begin
  update portal_private.market_intelligence_facts
     set assessment_value=calc_value
   where product='ДТ'
     and market_family='FINANCIAL_FORWARD'
     and value_type='FORWARD'
     and metadata->>'parser'='FULL_PLATTS_CURVE_V1'
     and calc_value is not null
     and assessment_value is distinct from calc_value;

  v_lpg:=portal_private.snapshot_market_intelligence_lpg_curve_v1();
  if coalesce((v_lpg->>'ok')::boolean,false) is not true then
    raise exception 'LPG_FULL_CURVE_BACKFILL_FAILED: %',v_lpg::text;
  end if;

  v_pub:=portal_private.refresh_market_intelligence_analytics_v1('FULL_PLATTS_CURVE_V1_PROJECTION_FIX');
  if v_pub is null then raise exception 'FULL_PLATTS_PROJECTION_REFRESH_FAILED'; end if;
end
$$;
