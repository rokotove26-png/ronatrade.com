-- RONA Analytics: full European Marketscan forward curve.
-- Owner instruction: 2026-10-08.
-- Business semantics proposal: 5697e762-4cdc-47a8-972c-eeb4a2a67c8f
-- Operations approval: b295fe31-92ca-4702-8e5c-4a199699fb30
-- Scope: source-locked Analytics only. Official RONA price list is not mutated.

create or replace function portal_private.mi_curve_code_value_v1(p_text text,p_code text)
returns numeric
language plpgsql immutable
as $$
declare v text[];
begin
  v:=regexp_match(p_text,p_code||'[[:space:]]+(NA|[0-9]+[.][0-9]+|[0-9]+)');
  if v is null or upper(v[1])='NA' then return null; end if;
  return v[1]::numeric;
end
$$;

create or replace function portal_private.market_intelligence_materialize_full_curve_v1()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','portal_private'
as $$
declare
  v_id uuid; v_file text; v_sha text; v_url text; v_text text;
  v_doc text; v_date date; v_ref text;
  v_m1 date; v_m2 date; v_m3 date;
  g1 numeric; g2 numeric; g3 numeric;
  n1 numeric; n2 numeric; n3 numeric;
  l1 numeric; l2 numeric; l3 numeric;
  df1 numeric; df2 numeric; df3 numeric;
  dc1 numeric; dc2 numeric; dc3 numeric;
  v_count int:=0;
begin
  select d.id,d.file_name,d.sha256,d.source_url,d.extracted_text,
         s.source_doc_id,s.source_date,coalesce(s.source_ref,d.source_url)
    into v_id,v_file,v_sha,v_url,v_text,v_doc,v_date,v_ref
  from portal_private.telegram_market_documents d
  join portal_private.market_intelligence_source_documents s
    on s.checksum_sha256=d.sha256 and s.source_family='PLATTS'
  where d.extraction_state in ('TEXT_EXTRACTED','TEXT_AND_TABLES_EXTRACTED')
    and d.extracted_text like '%Platts European Marketscan%'
    and d.extracted_text like '%ABWFT00%'
    and d.extracted_text like '%AAEBW00%'
    and d.extracted_text like '%ABWFV00%'
    and d.extracted_text like '%PAAAJ00%'
    and d.extracted_text like '%ABWEA00%'
    and d.extracted_text like '%ABWEB00%'
    and d.extracted_text like '%ABWDM00%'
    and d.extracted_text like '%ABWDN00%'
  order by s.source_date desc,d.message_timestamp desc
  limit 1;

  if not found then
    return jsonb_build_object('ok',false,'status','NO_FULL_CURVE_SOURCE');
  end if;

  g1:=portal_private.mi_curve_code_value_v1(v_text,'ABWFT00');
  g2:=portal_private.mi_curve_code_value_v1(v_text,'AAEBW00');
  g3:=portal_private.mi_curve_code_value_v1(v_text,'AAEBY00');
  n1:=portal_private.mi_curve_code_value_v1(v_text,'ABWFV00');
  n2:=portal_private.mi_curve_code_value_v1(v_text,'PAAAJ00');
  n3:=portal_private.mi_curve_code_value_v1(v_text,'AAECO00');
  l1:=portal_private.mi_curve_code_value_v1(v_text,'ABWFX00');
  l2:=portal_private.mi_curve_code_value_v1(v_text,'AAHIK00');
  l3:=portal_private.mi_curve_code_value_v1(v_text,'AAHIM00');
  df1:=portal_private.mi_curve_code_value_v1(v_text,'ABWEA00');
  df2:=portal_private.mi_curve_code_value_v1(v_text,'ABWEB00');
  df3:=portal_private.mi_curve_code_value_v1(v_text,'ABWEC00');
  dc1:=portal_private.mi_curve_code_value_v1(v_text,'ABWDM00');
  dc2:=portal_private.mi_curve_code_value_v1(v_text,'ABWDN00');
  dc3:=portal_private.mi_curve_code_value_v1(v_text,'ABWDO00');

  v_m1:=date_trunc('month',v_date)::date;
  v_m2:=(v_m1+interval '1 month')::date;
  v_m3:=(v_m1+interval '2 month')::date;

  with c(product,code,index_name,basis,dm,val,calc,quality,meta) as (
    values
    ('АИ-92','AI92','Gasoline Prem Unleaded 10 ppm FOB ARA Barge Financial','FOB ARA Barge Financial',v_m1,g1,null::numeric,'CONFIRMED',jsonb_build_object('curve_position','M1','curve_code','ABWFT00')),
    ('АИ-92','AI92','Gasoline Prem Unleaded 10 ppm FOB ARA Barge Financial','FOB ARA Barge Financial',v_m2,g2,null::numeric,'CONFIRMED',jsonb_build_object('curve_position','M2','curve_code','AAEBW00')),
    ('АИ-92','AI92','Gasoline Prem Unleaded 10 ppm FOB ARA Barge Financial','FOB ARA Barge Financial',v_m3,g3,null::numeric,'CONFIRMED',jsonb_build_object('curve_position','M3','curve_code','AAEBY00')),
    ('АИ-95','AI95','Gasoline Prem Unleaded 10 ppm FOB ARA Barge Financial','FOB ARA Barge Financial',v_m1,g1,null::numeric,'CONFIRMED',jsonb_build_object('curve_position','M1','curve_code','ABWFT00','grade_uplift_embedded',false)),
    ('АИ-95','AI95','Gasoline Prem Unleaded 10 ppm FOB ARA Barge Financial','FOB ARA Barge Financial',v_m2,g2,null::numeric,'CONFIRMED',jsonb_build_object('curve_position','M2','curve_code','AAEBW00','grade_uplift_embedded',false)),
    ('АИ-95','AI95','Gasoline Prem Unleaded 10 ppm FOB ARA Barge Financial','FOB ARA Barge Financial',v_m3,g3,null::numeric,'CONFIRMED',jsonb_build_object('curve_position','M3','curve_code','AAEBY00','grade_uplift_embedded',false)),
    ('НАФТА','NAFTA','Naphtha CIF NWE Cargo Financial','CIF NWE Cargo Financial',v_m1,n1,null::numeric,'CONFIRMED',jsonb_build_object('curve_position','M1','curve_code','ABWFV00')),
    ('НАФТА','NAFTA','Naphtha CIF NWE Cargo Financial','CIF NWE Cargo Financial',v_m2,n2,null::numeric,'CONFIRMED',jsonb_build_object('curve_position','M2','curve_code','PAAAJ00')),
    ('НАФТА','NAFTA','Naphtha CIF NWE Cargo Financial','CIF NWE Cargo Financial',v_m3,n3,null::numeric,'CONFIRMED',jsonb_build_object('curve_position','M3','curve_code','AAECO00')),
    ('СУГ','SUG','Propane CIF NWE Large Cargo Financial','CIF NWE Large Cargo Financial',v_m1,l1,null::numeric,'CONFIRMED',jsonb_build_object('curve_position','M1','curve_code','ABWFX00')),
    ('СУГ','SUG','Propane CIF NWE Large Cargo Financial','CIF NWE Large Cargo Financial',v_m2,l2,null::numeric,'CONFIRMED',jsonb_build_object('curve_position','M2','curve_code','AAHIK00')),
    ('СУГ','SUG','Propane CIF NWE Large Cargo Financial','CIF NWE Large Cargo Financial',v_m3,l3,null::numeric,'CONFIRMED',jsonb_build_object('curve_position','M3','curve_code','AAHIM00')),
    ('ДТ','DT','Composite ULSD 10 ppmS FOB ARA + CIF NWE Cargo Financial','Composite FOB ARA + CIF NWE',v_m1,null::numeric,case when df1 is not null and dc1 is not null then (df1+dc1)/2 end,'CALCULATED',jsonb_build_object('curve_position','M1','component_a_code','ABWEA00','component_b_code','ABWDM00','component_a',df1,'component_b',dc1)),
    ('ДТ','DT','Composite ULSD 10 ppmS FOB ARA + CIF NWE Cargo Financial','Composite FOB ARA + CIF NWE',v_m2,null::numeric,case when df2 is not null and dc2 is not null then (df2+dc2)/2 end,'CALCULATED',jsonb_build_object('curve_position','M2','component_a_code','ABWEB00','component_b_code','ABWDN00','component_a',df2,'component_b',dc2)),
    ('ДТ','DT','Composite ULSD 10 ppmS FOB ARA + CIF NWE Cargo Financial','Composite FOB ARA + CIF NWE',v_m3,null::numeric,case when df3 is not null and dc3 is not null then (df3+dc3)/2 end,'CALCULATED',jsonb_build_object('curve_position','M3','component_a_code','ABWEC00','component_b_code','ABWDO00','component_a',df3,'component_b',dc3))
  ),
  ins as (
    insert into portal_private.market_intelligence_facts(
      fact_id,source_doc_id,as_of_date,publication_date,product,market_family,index_name,basis,
      value_type,delivery_month,assessment_value,calc_value,currency,unit,data_status,quality_status,
      source_ref,source_page,source_note,metadata
    )
    select
      'FWD-'||to_char(v_date,'YYYYMMDD')||'-'||code||'-'||to_char(dm,'YYYYMM'),
      v_doc,v_date,v_date,product,'FINANCIAL_FORWARD',index_name,basis,
      'FORWARD',dm,val,calc,'USD','USD/т',quality,quality,
      v_ref,'4',
      'Deterministic extraction from the licensed full European Marketscan financial-derivatives table.',
      meta||jsonb_build_object(
        'raw_quotes_private',true,
        'parser','FULL_PLATTS_CURVE_V1',
        'source_message_id',v_id,
        'source_file',v_file,
        'commercial_proposal_id','5697e762-4cdc-47a8-972c-eeb4a2a67c8f',
        'operations_approval_id','b295fe31-92ca-4702-8e5c-4a199699fb30'
      )
    from c
    where coalesce(val,calc) is not null
    on conflict(fact_id) do update
      set source_doc_id=excluded.source_doc_id,
          assessment_value=excluded.assessment_value,
          calc_value=excluded.calc_value,
          source_ref=excluded.source_ref,
          source_page=excluded.source_page,
          source_note=excluded.source_note,
          metadata=excluded.metadata
    returning 1
  )
  select count(*)::int into v_count from ins;

  return jsonb_build_object(
    'ok',true,'status','MATERIALIZED','source_date',v_date,'source_doc_id',v_doc,
    'm1',v_m1,'m2',v_m2,'m3',v_m3,'facts',v_count
  );
end
$$;

create or replace function portal_private.snapshot_market_intelligence_forecast_inputs_v2()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','portal_private'
as $$
declare
  r record;
  v_source_date date;
  v_m1 date; v_m2 date; v_m3 date;
  c1 numeric; c2 numeric; c3 numeric;
  v_low numeric; v_base numeric; v_high numeric; v_mtd numeric; v_ref numeric;
  v_direction text; v_curve text; v_id text; v_source_ref text;
  v_count int:=0;
begin
  select max(as_of_date) into v_source_date
  from portal_private.market_intelligence_facts
  where market_family='FINANCIAL_FORWARD'
    and value_type='FORWARD'
    and metadata->>'parser'='FULL_PLATTS_CURVE_V1';

  if v_source_date is null then
    return jsonb_build_object('ok',false,'status','NO_FULL_CURVE_FACTS');
  end if;

  v_m1:=date_trunc('month',v_source_date)::date;
  v_m2:=(v_m1+interval '1 month')::date;
  v_m3:=(v_m1+interval '2 month')::date;

  select source_ref into v_source_ref
  from portal_private.market_intelligence_facts
  where market_family='FINANCIAL_FORWARD'
    and value_type='FORWARD'
    and as_of_date=v_source_date
    and metadata->>'parser'='FULL_PLATTS_CURVE_V1'
  order by created_at desc limit 1;

  for r in
    select * from (values
      ('АИ-92'::text,'AI92'::text,0::numeric),
      ('АИ-95'::text,'AI95'::text,40::numeric),
      ('ДТ'::text,'DT'::text,0::numeric),
      ('НАФТА'::text,'NAFTA'::text,0::numeric)
    ) x(product,code,grade_diff)
  loop
    select coalesce(assessment_value,calc_value) into c1
    from portal_private.market_intelligence_facts
    where product=r.product and market_family='FINANCIAL_FORWARD' and value_type='FORWARD'
      and as_of_date=v_source_date and delivery_month=v_m1
      and metadata->>'parser'='FULL_PLATTS_CURVE_V1'
    order by created_at desc limit 1;

    select coalesce(assessment_value,calc_value) into c2
    from portal_private.market_intelligence_facts
    where product=r.product and market_family='FINANCIAL_FORWARD' and value_type='FORWARD'
      and as_of_date=v_source_date and delivery_month=v_m2
      and metadata->>'parser'='FULL_PLATTS_CURVE_V1'
    order by created_at desc limit 1;

    select coalesce(assessment_value,calc_value) into c3
    from portal_private.market_intelligence_facts
    where product=r.product and market_family='FINANCIAL_FORWARD' and value_type='FORWARD'
      and as_of_date=v_source_date and delivery_month=v_m3
      and metadata->>'parser'='FULL_PLATTS_CURVE_V1'
    order by created_at desc limit 1;

    if c1 is null or c2 is null or c3 is null then continue; end if;

    c1:=c1+r.grade_diff; c2:=c2+r.grade_diff; c3:=c3+r.grade_diff;
    v_low:=least(c1,c2,c3); v_base:=c2; v_high:=greatest(c1,c2,c3);

    select mtd_avg_usd_t,latest_value_usd_t into v_mtd,v_ref
    from portal_private.market_intelligence_daily_metrics_v2
    where product=r.product
    limit 1;

    if r.product='АИ-95' then
      if v_mtd is not null then v_mtd:=v_mtd+r.grade_diff; end if;
      if v_ref is not null then v_ref:=v_ref+r.grade_diff; end if;
    end if;

    v_direction:=case
      when v_mtd is null then 'TO_VERIFY'
      when v_base>v_mtd then 'РОСТ'
      when v_base<v_mtd then 'СНИЖЕНИЕ'
      else 'БЕЗ ИЗМЕНЕНИЙ' end;
    v_curve:=case
      when c1>c2 and c2>c3 then 'БЭКВОРДАЦИЯ'
      when c1<c2 and c2<c3 then 'КОНТАНГО'
      else 'СМЕШАННАЯ' end;
    v_id:='FCS-'||to_char(v_source_date,'YYYYMMDD')||'-'||r.code||'-'||to_char(v_m2,'YYYYMM');

    insert into portal_private.market_intelligence_forecast_snapshots(
      snapshot_id,snapshot_date,target_month,product,forward_implied_usd_t,mtd_at_snapshot_usd_t,
      low_usd_t,base_usd_t,high_usd_t,direction,confidence,forward_spread_1m_usd_t,curve_type,
      physical_trend,news_signal,supply_demand_signal,driver_summary,risk_summary,model_version,data_status,
      rona_margin_usd_t,commercial_low_usd_t,commercial_base_usd_t,commercial_high_usd_t,margin_policy_version,
      source_ref,metadata,created_at
    )
    values(
      v_id,v_source_date,v_m2,r.product,v_base,v_mtd,
      v_low,v_base,v_high,v_direction,'СРЕДНЯЯ',c2-c1,v_curve,
      v_direction,null,null,
      'Source-locked three-month European financial curve; BASE is target-month M2.',
      'Indicative analytics only; official RONA price list is unchanged.',
      'RONA_FULL_PLATTS_CURVE_V1','INDICATIVE',
      null,null,null,null,null,
      v_source_ref,
      jsonb_build_object(
        'contract','RONA_ANALYTICS_FULL_PLATTS_CURVE_V1',
        'curve_m1',c1,'curve_m2',c2,'curve_m3',c3,
        'market_reference_usd_t',v_ref,
        'grade_diff_usd_t',r.grade_diff,
        'confidence_basis','THREE_MONTH_SOURCE_CURVE',
        'official_price_list_unchanged',true,
        'commercial_proposal_id','5697e762-4cdc-47a8-972c-eeb4a2a67c8f',
        'operations_approval_id','b295fe31-92ca-4702-8e5c-4a199699fb30'
      ),
      now()
    )
    on conflict(snapshot_id) do update
      set snapshot_date=excluded.snapshot_date,target_month=excluded.target_month,
          forward_implied_usd_t=excluded.forward_implied_usd_t,mtd_at_snapshot_usd_t=excluded.mtd_at_snapshot_usd_t,
          low_usd_t=excluded.low_usd_t,base_usd_t=excluded.base_usd_t,high_usd_t=excluded.high_usd_t,
          direction=excluded.direction,confidence=excluded.confidence,forward_spread_1m_usd_t=excluded.forward_spread_1m_usd_t,
          curve_type=excluded.curve_type,physical_trend=excluded.physical_trend,
          driver_summary=excluded.driver_summary,risk_summary=excluded.risk_summary,
          model_version=excluded.model_version,data_status=excluded.data_status,source_ref=excluded.source_ref,
          metadata=excluded.metadata,created_at=excluded.created_at;
    v_count:=v_count+1;
  end loop;

  return jsonb_build_object('ok',true,'status','SNAPSHOTTED','source_date',v_source_date,'target_month',v_m2,'products',v_count);
end
$$;

do $$
begin
  if to_regprocedure('public.owner_analytics_admin_bootstrap_base_v1()') is null then
    execute 'alter function public.owner_analytics_admin_bootstrap() rename to owner_analytics_admin_bootstrap_base_v1';
  end if;
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
      ('DT'::text,'ДТ'::text)
    ) x(k,product)
  loop
    vals:=v #> array['canonicalAnalytics','products',r.k,'values'];
    ref:=null;
    if jsonb_typeof(vals)='array' then
      n:=jsonb_array_length(vals);
      if n>0 and (vals->>(n-1)) ~ '^-?[0-9]+([.][0-9]+)?$' then ref:=(vals->>(n-1))::numeric; end if;
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

create or replace function portal_private.market_intelligence_source_processor_cron_tick_v4()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','portal_private'
as $$
declare
  base jsonb; curve jsonb; fc jsonb; pub jsonb;
begin
  base:=portal_private.market_intelligence_source_processor_cron_tick_v3();
  curve:=portal_private.market_intelligence_materialize_full_curve_v1();
  fc:=portal_private.snapshot_market_intelligence_forecast_inputs_v2();
  if coalesce((curve->>'ok')::boolean,false) or coalesce((fc->>'ok')::boolean,false) then
    pub:=portal_private.refresh_market_intelligence_analytics_v1('FULL_PLATTS_CURVE_V1');
  end if;
  return jsonb_build_object('ok',true,'base',base,'curve',curve,'forecast',fc,'publication',pub);
end
$$;

revoke all on function portal_private.market_intelligence_source_processor_cron_tick_v4() from public,anon,authenticated,service_role;
grant execute on function portal_private.market_intelligence_source_processor_cron_tick_v4() to postgres;

do $$
declare j bigint;
begin
  select jobid into j from cron.job where jobname='rona-market-intelligence-source-processor-v1';
  if j is null then raise exception 'MARKET_INTELLIGENCE_SOURCE_PROCESSOR_CRON_NOT_FOUND'; end if;
  perform cron.alter_job(job_id:=j,command:='select portal_private.market_intelligence_source_processor_cron_tick_v4();');
end
$$;
