-- Consolidate high-frequency runtime maintenance jobs into a single serialized pg_cron worker.
-- Goal: preserve functional cadence while preventing connection-start storms from five simultaneous minute jobs.
-- No business rows are deleted or rewritten by this migration.

create or replace function portal_private.run_core_runtime_minute_v1()
returns jsonb
language plpgsql
set search_path to 'pg_catalog','portal_private'
as $function$
declare
  v_result jsonb := '{}'::jsonb;
  v_errors jsonb := '[]'::jsonb;
  v_error_count integer := 0;
begin
  begin
    v_result := v_result || jsonb_build_object(
      'sla_breaches', portal_private.ai_runtime_mark_sla_breaches()
    );
  exception when others then
    v_error_count := v_error_count + 1;
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'step','sla_breaches','error',left(sqlerrm,500)
    ));
  end;

  begin
    v_result := v_result || jsonb_build_object(
      'sla_escalation_queue_id', portal_private.ai_runtime_enqueue_sla_escalation_db()
    );
  exception when others then
    v_error_count := v_error_count + 1;
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'step','sla_escalation','error',left(sqlerrm,500)
    ));
  end;

  -- First dispatch preserves the watchdog path.
  begin
    v_result := v_result || jsonb_build_object(
      'dispatch_primary', portal_private.ai_runtime_dispatch_db(100)
    );
  exception when others then
    v_error_count := v_error_count + 1;
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'step','dispatch_primary','error',left(sqlerrm,500)
    ));
  end;

  begin
    v_result := v_result || jsonb_build_object(
      'model_executor_request_id', portal_private.invoke_ai_model_executor('run')
    );
  exception when others then
    v_error_count := v_error_count + 1;
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'step','model_executor','error',left(sqlerrm,500)
    ));
  end;

  begin
    v_result := v_result || jsonb_build_object(
      'finance_materialization',
      portal_private.run_finance_materialization_maintenance_v7(50,50,'PG_CRON')
    );
  exception when others then
    v_error_count := v_error_count + 1;
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'step','finance_materialization','error',left(sqlerrm,500)
    ));
  end;

  begin
    v_result := v_result || jsonb_build_object(
      'cash_projection',
      portal_private.refresh_finance_cash_projection_cache_v1(false)
    );
  exception when others then
    v_error_count := v_error_count + 1;
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'step','cash_projection','error',left(sqlerrm,500)
    ));
  end;

  -- Second dispatch preserves the previous effective capacity of two dispatch calls per minute.
  begin
    v_result := v_result || jsonb_build_object(
      'dispatch_secondary', portal_private.ai_runtime_dispatch_db(100)
    );
  exception when others then
    v_error_count := v_error_count + 1;
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'step','dispatch_secondary','error',left(sqlerrm,500)
    ));
  end;

  return v_result || jsonb_build_object(
    'ok', v_error_count = 0,
    'error_count', v_error_count,
    'errors', v_errors,
    'worker_version', 'CORE_RUNTIME_MINUTE_V1'
  );
end
$function$;

do $migration$
declare
  r record;
  v_coordinator_id bigint;
begin
  -- Remove only the five minute-level jobs superseded by the serialized coordinator.
  for r in
    select jobid
    from cron.job
    where jobname in (
      'rona-ai-runtime-dispatch',
      'rona-ai-runtime-watchdog',
      'rona-ai-model-executor',
      'payments-v7-finance-materialization-maintenance-v7',
      'rona-finance-cash-projection-cache-v1'
    )
  loop
    perform cron.unschedule(r.jobid);
  end loop;

  select jobid into v_coordinator_id
  from cron.job
  where jobname='rona-core-runtime-minute-v1'
  order by jobid desc
  limit 1;

  if v_coordinator_id is null then
    perform cron.schedule(
      'rona-core-runtime-minute-v1',
      '* * * * *',
      'select portal_private.run_core_runtime_minute_v1();'
    );
  else
    perform cron.alter_job(
      v_coordinator_id,
      schedule => '* * * * *',
      command => 'select portal_private.run_core_runtime_minute_v1();',
      active => true
    );
  end if;
end
$migration$;
