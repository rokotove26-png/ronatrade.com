-- ROLLBACK ONLY — do not run automatically.
do $$
declare
  v_core_jobid bigint;
  v_watchdog_jobid bigint;
begin
  select jobid into v_core_jobid
  from cron.job
  where jobname='rona-core-runtime-minute-v1';

  select jobid into v_watchdog_jobid
  from cron.job
  where jobname='payments-v8-signed-schedule-watchdog';

  if v_core_jobid is null then
    raise exception 'CORE_RUNTIME_CRON_NOT_FOUND';
  end if;
  if v_watchdog_jobid is null then
    raise exception 'PAYMENTS_V8_WATCHDOG_CRON_NOT_FOUND';
  end if;

  perform cron.alter_job(
    job_id:=v_core_jobid,
    command:='select portal_private.run_core_runtime_minute_v2();'
  );

  perform cron.alter_job(
    job_id:=v_watchdog_jobid,
    active:=true
  );
end
$$;

drop function if exists portal_private.run_core_runtime_minute_v3();
drop function if exists portal_private.finance_signed_schedule_watchdog_smart_tick_v8();
