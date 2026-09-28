-- ROLLBACK ONLY — do not run automatically.
do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid
  from cron.job
  where jobname='rona-market-intelligence-source-processor-v1';

  if v_jobid is null then
    raise exception 'MARKET_INTELLIGENCE_SOURCE_PROCESSOR_CRON_NOT_FOUND';
  end if;

  perform cron.alter_job(
    job_id := v_jobid,
    command := 'select portal_private.invoke_market_intelligence_source_processor_v1(''run'');'
  );
end
$$;

drop function if exists portal_private.market_intelligence_source_processor_cron_tick_v2();
