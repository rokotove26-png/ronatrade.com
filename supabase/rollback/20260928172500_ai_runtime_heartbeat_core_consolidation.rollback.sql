-- ROLLBACK ONLY — do not run automatically.
do $$
declare
  v_core_jobid bigint;
  v_heartbeat_jobid bigint;
begin
  select jobid into v_core_jobid
  from cron.job
  where jobname='rona-core-runtime-minute-v1';

  select jobid into v_heartbeat_jobid
  from cron.job
  where jobname='rona-ai-runtime-heartbeat';

  if v_core_jobid is null then
    raise exception 'CORE_RUNTIME_CRON_NOT_FOUND';
  end if;

  if v_heartbeat_jobid is null then
    raise exception 'AI_RUNTIME_HEARTBEAT_CRON_NOT_FOUND';
  end if;

  perform cron.alter_job(
    job_id:=v_core_jobid,
    command:='select portal_private.run_core_runtime_minute_v3();'
  );

  perform cron.alter_job(
    job_id:=v_heartbeat_jobid,
    active:=true
  );
end
$$;

drop function if exists portal_private.run_core_runtime_minute_v4();
