-- RONA Trade client intake reconciliation schedule correction.
-- Event-driven triggers remain the primary processing path.
-- pg_cron remains a self-healing/reconciliation fallback aligned to the 5 minute stuck threshold.

do $$
declare
  v_jobid bigint;
begin
  select jobid
    into v_jobid
    from cron.job
   where jobname='rona-client-intake-reconcile-v1';

  if v_jobid is null then
    raise exception 'CLIENT_INTAKE_RECONCILIATION_CRON_NOT_FOUND';
  end if;

  perform cron.alter_job(
    job_id := v_jobid,
    schedule := '*/5 * * * *'
  );
end
$$;
