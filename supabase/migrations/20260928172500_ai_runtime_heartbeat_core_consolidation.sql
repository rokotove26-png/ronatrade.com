-- RONA Trade AI Runtime heartbeat core consolidation.
-- Candidate write #12, 2026-09-28.
-- Preserves the 15-minute heartbeat cadence and exact quarter-hour bucket.
-- Removes duplicate standalone SLA/dispatch calls by reusing the existing Core Runtime.

create or replace function portal_private.run_core_runtime_minute_v4()
returns jsonb
language plpgsql
set search_path to 'pg_catalog','portal_private'
as $$
declare
  v_result jsonb:='{}'::jsonb;
  v_errors jsonb:='[]'::jsonb;
  v_error_count integer:=0;
begin
  begin
    v_result:=portal_private.run_core_runtime_minute_v3();
  exception when others then
    v_error_count:=v_error_count+1;
    v_errors:=v_errors||jsonb_build_array(jsonb_build_object(
      'step','core_v3','error',left(sqlerrm,500)
    ));
    v_result:=jsonb_build_object(
      'ok',false,
      'error_count',1,
      'errors',v_errors
    );
  end;

  begin
    if mod(extract(minute from clock_timestamp())::integer,15)=0 then
      v_result:=v_result||jsonb_build_object(
        'ai_runtime_heartbeat_id',
        portal_private.enqueue_ai_runtime_heartbeat(),
        'ai_runtime_heartbeat_skipped',false,
        'ai_runtime_heartbeat_gate_minutes',15,
        'ai_runtime_heartbeat_phase_minute_mod15',0
      );
    else
      v_result:=v_result||jsonb_build_object(
        'ai_runtime_heartbeat_id',null,
        'ai_runtime_heartbeat_skipped',true,
        'ai_runtime_heartbeat_skip_reason','FIFTEEN_MINUTE_CORE_GATE',
        'ai_runtime_heartbeat_gate_minutes',15,
        'ai_runtime_heartbeat_phase_minute_mod15',0
      );
    end if;
  exception when others then
    v_error_count:=v_error_count+1;
    v_errors:=v_errors||jsonb_build_array(jsonb_build_object(
      'step','ai_runtime_heartbeat','error',left(sqlerrm,500)
    ));
  end;

  return v_result||jsonb_build_object(
    'v4_wrapper_ok',v_error_count=0,
    'v4_wrapper_error_count',v_error_count,
    'v4_wrapper_errors',v_errors,
    'worker_wrapper_version','CORE_RUNTIME_MINUTE_V4'
  );
end
$$;

revoke all on function portal_private.run_core_runtime_minute_v4() from public;
revoke all on function portal_private.run_core_runtime_minute_v4() from anon;
revoke all on function portal_private.run_core_runtime_minute_v4() from authenticated;
grant execute on function portal_private.run_core_runtime_minute_v4() to postgres;

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
    command:='select portal_private.run_core_runtime_minute_v4();'
  );

  perform cron.alter_job(
    job_id:=v_heartbeat_jobid,
    active:=false
  );
end
$$;

comment on function portal_private.run_core_runtime_minute_v4()
is 'Core runtime wrapper V4. Preserves the OPERATIONS_DIRECTOR AI runtime heartbeat every 15 minutes while eliminating the redundant standalone heartbeat cron and its duplicate SLA/dispatch calls.';
