-- RONA Trade Market Intelligence cron smart gate.
-- Candidate write #5: NOT a business-data mutation.
-- Keeps the 5-minute cron heartbeat, but avoids expensive full analytics refresh
-- when all tracked inputs are clean. A full verification still runs every hour.

create or replace function portal_private.market_intelligence_analytics_cron_tick_v2()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','portal_private'
as $$
declare
  v_ctl portal_private.market_intelligence_control%rowtype;
  v_minute integer := extract(minute from clock_timestamp())::integer;
begin
  select * into v_ctl
  from portal_private.market_intelligence_control
  where singleton=true;

  if found
     and v_ctl.enabled
     and coalesce(v_ctl.dirty,false)=false
     and v_minute<>0 then
    update portal_private.market_intelligence_control
       set last_run_at=now(),
           last_status='NO_CHANGE',
           last_error_code=null,
           updated_at=now()
     where singleton=true;

    return jsonb_build_object(
      'ok',true,
      'status','NO_CHANGE',
      'fast_gate',true,
      'reason','NOT_DIRTY',
      'hourly_full_verification',true,
      'publication_id',v_ctl.last_publication_id,
      'signature',v_ctl.last_input_signature
    );
  end if;

  return portal_private.refresh_market_intelligence_analytics_v1('CRON_5MIN');
end
$$;

revoke all on function portal_private.market_intelligence_analytics_cron_tick_v2() from public;
revoke all on function portal_private.market_intelligence_analytics_cron_tick_v2() from anon;
revoke all on function portal_private.market_intelligence_analytics_cron_tick_v2() from authenticated;
grant execute on function portal_private.market_intelligence_analytics_cron_tick_v2() to postgres;

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
    command := 'select portal_private.market_intelligence_analytics_cron_tick_v2();'
  );
end
$$;

comment on function portal_private.market_intelligence_analytics_cron_tick_v2()
is '5-minute Market Intelligence cron gate: fast NO_CHANGE heartbeat when dirty=false, full refresh when dirty=true, plus hourly full verification fallback.';
