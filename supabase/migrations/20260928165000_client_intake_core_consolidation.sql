-- RONA Trade Client Intake reconciliation cron consolidation.
-- Candidate write #10, 2026-09-28.
-- Preserves five-minute reconciliation cadence by running the exact existing
-- client_intake_reconciliation_tick_v1() inside the already-active core minute
-- worker at minute mod 5 = 1, then disables only the standalone reconciliation
-- pg_cron job. Event-driven client intake triggers remain unchanged.

CREATE OR REPLACE FUNCTION portal_private.run_core_runtime_minute_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'portal_private'
AS $function$
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
    if mod(extract(minute from clock_timestamp())::integer,5)=0 then
      v_result := v_result || jsonb_build_object(
        'sla_escalation_queue_id', portal_private.ai_runtime_enqueue_sla_escalation_db(),
        'sla_escalation_skipped', false,
        'sla_escalation_gate_minutes', 5
      );
    else
      v_result := v_result || jsonb_build_object(
        'sla_escalation_queue_id', null,
        'sla_escalation_skipped', true,
        'sla_escalation_skip_reason', 'FIVE_MINUTE_GATE',
        'sla_escalation_gate_minutes', 5
      );
    end if;
  exception when others then
    v_error_count := v_error_count + 1;
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'step','sla_escalation','error',left(sqlerrm,500)
    ));
  end;

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
    if exists(
      select 1
      from portal_private.ai_runtime_queue q
      cross join portal_private.ai_model_executor_control c
      cross join portal_private.ai_runtime_control r
      where c.singleton=true
        and r.singleton=true
        and c.enabled=true
        and c.state='ENABLED'
        and r.enabled=true
        and r.scheduler_state='ENABLED'
        and r.model_execution_state='ENABLED'
        and q.state='DELIVERED'
        and q.qa_only=false
        and q.target_role::text<>'SYSTEM_ADMIN'
        and q.created_at>=c.execute_after
        and q.available_at<=now()
        and q.attempts<c.max_attempts
        and (q.lease_until is null or q.lease_until<now())
      limit 1
    ) then
      v_result := v_result || jsonb_build_object(
        'model_executor_request_id', portal_private.invoke_ai_model_executor('run'),
        'model_executor_skipped', false
      );
    else
      v_result := v_result || jsonb_build_object(
        'model_executor_request_id', null,
        'model_executor_skipped', true,
        'model_executor_skip_reason', 'NO_ELIGIBLE_WORK'
      );
    end if;
  exception when others then
    v_error_count := v_error_count + 1;
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'step','model_executor','error',left(sqlerrm,500)
    ));
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

  begin
    if mod(extract(minute from clock_timestamp())::integer,5)=3 then
      v_result := v_result || jsonb_build_object(
        'market_intelligence_watchdog',
        portal_private.market_intelligence_watchdog_v1(),
        'market_intelligence_watchdog_skipped',false,
        'market_intelligence_watchdog_gate_minutes',5,
        'market_intelligence_watchdog_phase_minute_mod5',3
      );
    else
      v_result := v_result || jsonb_build_object(
        'market_intelligence_watchdog',null,
        'market_intelligence_watchdog_skipped',true,
        'market_intelligence_watchdog_skip_reason','FIVE_MINUTE_CORE_GATE',
        'market_intelligence_watchdog_gate_minutes',5,
        'market_intelligence_watchdog_phase_minute_mod5',3
      );
    end if;
  exception when others then
    v_error_count := v_error_count + 1;
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'step','market_intelligence_watchdog','error',left(sqlerrm,500)
    ));
  end;

  begin
    if mod(extract(minute from clock_timestamp())::integer,10)=0 then
      v_result := v_result || jsonb_build_object(
        'finance_materialization',
        portal_private.run_finance_materialization_maintenance_v7(50,50,'PG_CRON'),
        'finance_materialization_mode','FULL_RECONCILIATION',
        'finance_materialization_gate_minutes',10,
        'finance_materialization_skipped',false
      );
    elsif exists(
      select 1
      from portal_private.finance_materialization_jobs_v7 j
      where j.status in ('QUEUED','RETRY')
        and coalesce(j.next_attempt_at,now())<=now()
      limit 1
    ) then
      v_result := v_result || jsonb_build_object(
        'finance_materialization',
        jsonb_build_object(
          'ok',true,
          'mode','RECOVERY_ONLY',
          'recovery',portal_private.recover_finance_materialization_jobs_v7(50)
        ),
        'finance_materialization_mode','RECOVERY_ONLY',
        'finance_materialization_gate_minutes',10,
        'finance_materialization_skipped',false
      );
    else
      v_result := v_result || jsonb_build_object(
        'finance_materialization',
        jsonb_build_object(
          'ok',true,
          'mode','SKIPPED_NO_DUE_WORK'
        ),
        'finance_materialization_mode','SKIPPED_NO_DUE_WORK',
        'finance_materialization_gate_minutes',10,
        'finance_materialization_skipped',true
      );
    end if;
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

do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid
  from cron.job
  where jobname='rona-client-intake-reconcile-v1';

  if v_jobid is null then
    raise exception 'CLIENT_INTAKE_RECONCILE_CRON_NOT_FOUND';
  end if;

  perform cron.alter_job(
    job_id := v_jobid,
    active := false
  );
end
$$;

comment on function portal_private.run_core_runtime_minute_v1()
is 'Core runtime minute worker. Client Intake reconciliation runs every five minutes at minute mod 5 = 1; Market Intelligence watchdog remains at mod 5 = 3; redundant standalone reconciliation/watchdog cron sessions are disabled.';
