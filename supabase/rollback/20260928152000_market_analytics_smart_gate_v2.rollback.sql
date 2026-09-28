-- ROLLBACK ONLY — do not run automatically.
do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid
  from cron.job
  where jobname='rona-market-intelligence-analytics-auto-refresh-v1';

  if v_jobid is null then
    raise exception 'MARKET_INTELLIGENCE_ANALYTICS_CRON_NOT_FOUND';
  end if;

  perform cron.alter_job(
    job_id := v_jobid,
    command := 'select portal_private.refresh_market_intelligence_analytics_v1(''CRON_5MIN'');'
  );
end
$$;

drop function if exists portal_private.market_intelligence_analytics_cron_tick_v2();
