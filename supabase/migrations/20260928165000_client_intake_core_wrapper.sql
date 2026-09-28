-- RONA Trade Client Intake reconciliation consolidation.
-- Candidate write #10, 2026-09-28.
-- Preserve 5-minute reconciliation cadence while removing the standalone cron session.

create or replace function portal_private.run_core_runtime_minute_v2()
returns jsonb
language plpgsql
set search_path to 'pg_catalog','portal_private'
as $$
declare
  v_result jsonb := '{}'::jsonb;
  v_errors jsonb := '[]'::jsonb;
  v_error_count integer := 0;
begin
  begin
    v_result := portal_private.run_core_runtime_minute_v1();
  exception when others then
    v_error_count := v_error_count + 1;
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'step','core_v1','error',left(sqlerrm,500)
    ));
    v_result := jsonb_build_object(
      'ok',false,
      'error_count',1,
      'errors',v_errors
    );
  end;

  begin
    if mod(extract(minute from clock_timestamp())::integer,5)=1 then
      v_result := v_result || jsonb_build_object(
        'client_intake_reconciliation',
        portal_private.client_intake_reconciliation_tick_v1(),
        'client_intake_reconciliation_skipped',false,
        'client_intake_reconciliation_gate_minutes',5,
        'client_intake_reconciliation_phase_minute_mod5',1
      );
    else
      v_result := v_result || jsonb_build_object(
        'client_intake_reconciliation',null,
        'client_intake_reconciliation_skipped',true,
        'client_intake_reconciliation_skip_reason','FIVE_MINUTE_CORE_GATE',
        'client_intake_reconciliation_gate_minutes',5,
        'client_intake_reconciliation_phase_minute_mod5',1
      );
    end if;
  exception when others then
    v_error_count := v_error_count + 1;
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'step','client_intake_reconciliation','error',left(sqlerrm,500)
    ));
  end;

  return v_result || jsonb_build_object(
    'wrapper_ok',v_error_count=0,
    'wrapper_error_count',v_error_count,
    'wrapper_errors',v_errors,
    'worker_wrapper_version','CORE_RUNTIME_MINUTE_V2'
  );
end
$$;

revoke all on function portal_private.run_core_runtime_minute_v2() from public;
revoke all on function portal_private.run_core_runtime_minute_v2() from anon;
revoke all on function portal_private.run_core_runtime_minute_v2() from authenticated;
grant execute on function portal_private.run_core_runtime_minute_v2() to postgres;

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
    command := 'select portal_private.run_core_runtime_minute_v2();'
  );

  perform cron.alter_job(
    job_id := v_client_jobid,
    active := false
  );
end
$$;

comment on function portal_private.run_core_runtime_minute_v2()
is 'Core runtime wrapper: existing V1 executes every minute; Client Intake reconciliation executes every 5 minutes at minute mod 5 = 1; standalone Client Intake cron is disabled.';
