-- ROLLBACK ONLY — do not run automatically.
do $$
declare
  v_core_jobid bigint;
  v_client_jobid bigint;
begin
  select jobid into v_core_jobid
  from cron.job
  where jobname='rona-core-runtime-minute-v1';

  select jobid into v_client_jobid
  from cron.job
  where jobname='rona-client-intake-reconcile-v1';

  if v_core_jobid is null then
    raise exception 'CORE_RUNTIME_CRON_NOT_FOUND';
  end if;
  if v_client_jobid is null then
    raise exception 'CLIENT_INTAKE_RECONCILE_CRON_NOT_FOUND';
  end if;

  perform cron.alter_job(
    job_id := v_core_jobid,
    command := 'select portal_private.run_core_runtime_minute_v1();'
  );

  perform cron.alter_job(
    job_id := v_client_jobid,
    active := true
  );
end
$$;

drop function if exists portal_private.run_core_runtime_minute_v2();
