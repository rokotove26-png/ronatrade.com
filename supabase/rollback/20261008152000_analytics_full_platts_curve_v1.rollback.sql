-- Rollback for 20261008152000_analytics_full_platts_curve_v1.sql

do $$
declare j bigint;
begin
  select jobid into j from cron.job where jobname='rona-market-intelligence-source-processor-v1';
  if j is not null then
    perform cron.alter_job(job_id:=j,command:='select portal_private.market_intelligence_source_processor_cron_tick_v3();');
  end if;
end
$$;

drop function if exists portal_private.market_intelligence_source_processor_cron_tick_v4();
drop function if exists portal_private.snapshot_market_intelligence_forecast_inputs_v2();
drop function if exists portal_private.market_intelligence_materialize_full_curve_v1();
drop function if exists portal_private.mi_curve_code_value_v1(text,text);

delete from portal_private.market_intelligence_forecast_snapshots
where model_version='RONA_FULL_PLATTS_CURVE_V1';

delete from portal_private.market_intelligence_facts
where metadata->>'parser'='FULL_PLATTS_CURVE_V1';

drop function if exists public.owner_analytics_admin_bootstrap();
do $$
begin
  if to_regprocedure('public.owner_analytics_admin_bootstrap_base_v1()') is not null then
    execute 'alter function public.owner_analytics_admin_bootstrap_base_v1() rename to owner_analytics_admin_bootstrap';
  end if;
end
$$;
