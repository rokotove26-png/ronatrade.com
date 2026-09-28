-- RONA Trade Payments V8 watchdog smart gate + core consolidation.
-- Candidate write #11, 2026-09-28.
-- Keeps five-minute supervision via core runtime, preserves the existing watchdog,
-- and performs a full watchdog sweep hourly or immediately when concrete work exists.
-- Existing payments-v8-stale-executor-recovery remains unchanged and active.

create or replace function portal_private.finance_signed_schedule_watchdog_smart_tick_v8()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','portal_private'
as $$
declare
  v_minute integer:=extract(minute from clock_timestamp())::integer;
  v_full_verification boolean:=false;
  v_has_work boolean:=false;
  v_max_attempts integer:=3;
  v_result jsonb;
begin
  v_full_verification:=(v_minute=2);

  select coalesce(max_attempts,3) into v_max_attempts
  from portal_private.ai_model_executor_control
  where singleton=true;

  select
    exists(
      select 1
      from portal_private.documents d
      join portal_private.owner_deal_documents odd on odd.document_key=d.id
      join portal_private.deals x on x.id=odd.deal_key
      join portal_private.document_versions dv
        on dv.id=d.current_version_id and dv.document_key=d.id
      left join portal_private.finance_signed_schedule_jobs_v8 j
        on j.source_document_key=d.id
       and j.source_document_version_key=dv.id
      where upper(d.document_type) in ('SIGNED_ADDENDUM','SIGNED_SPECIFICATION','SIGNED_CONTRACT')
        and upper(d.authority_state::text)='CONFIRMED'
        and upper(d.lifecycle_state::text)='ACTIVE'
        and dv.is_current=true
        and dv.is_effective=true
        and upper(dv.authority_state::text)='CONFIRMED'
        and upper(dv.lifecycle_state::text)='ACTIVE'
        and upper(x.lifecycle_state::text)='ACTIVE'
        and (j.job_id is null or j.status<>'MATERIALIZED')
      limit 1
    )
    or exists(
      select 1
      from portal_private.finance_signed_schedule_jobs_v8 j
      where j.status<>'SUPERSEDED'
        and not exists(
          select 1
          from portal_private.documents d
          join portal_private.document_versions dv
            on dv.id=d.current_version_id and dv.document_key=d.id
          where d.id=j.source_document_key
            and dv.id=j.source_document_version_key
            and upper(d.authority_state::text)='CONFIRMED'
            and upper(d.lifecycle_state::text)='ACTIVE'
            and dv.is_current=true
            and dv.is_effective=true
            and upper(dv.authority_state::text)='CONFIRMED'
            and upper(dv.lifecycle_state::text)='ACTIVE'
        )
      limit 1
    )
    or exists(
      select 1
      from portal_private.ai_runtime_queue q
      join portal_private.finance_signed_schedule_jobs_v8 j
        on j.staff_task_id=q.source_id
      where q.source_type='STAFF_TASK'
        and q.target_role::text='FINANCE'
        and q.source_id like 'TASK-FIN-SCHEDULE-V8-%'
        and j.status in ('PENDING_FINANCE','RETRY')
        and (
          (q.state='DELIVERED'
           and (q.lease_until is null or q.lease_until<clock_timestamp())
           and q.attempts>=v_max_attempts)
          or
          (q.state='DELIVERED'
           and q.claimed_by is not null
           and q.lease_until<clock_timestamp())
          or
          (q.state='PROCESSED' and j.proposal_record_id is null)
        )
        and coalesce(nullif(q.payload->>'v8_stale_recovery_count','')::int,0)<12
      limit 1
    )
    or exists(
      select 1
      from portal_private.finance_schedule_integrity_alerts_v8 a
      where a.status='OPEN'
      limit 1
    )
  into v_has_work;

  if v_full_verification or v_has_work then
    v_result:=portal_private.run_finance_signed_schedule_watchdog_v8();
    return jsonb_build_object(
      'ok',true,
      'mode',case when v_full_verification then 'HOURLY_FULL_VERIFICATION' else 'WORK_DETECTED' end,
      'full_verification',v_full_verification,
      'work_detected',v_has_work,
      'watchdog',v_result
    );
  end if;

  return jsonb_build_object(
    'ok',true,
    'mode','SKIPPED_NO_WORK',
    'full_verification',false,
    'work_detected',false
  );
end
$$;

revoke all on function portal_private.finance_signed_schedule_watchdog_smart_tick_v8() from public;
revoke all on function portal_private.finance_signed_schedule_watchdog_smart_tick_v8() from anon;
revoke all on function portal_private.finance_signed_schedule_watchdog_smart_tick_v8() from authenticated;
grant execute on function portal_private.finance_signed_schedule_watchdog_smart_tick_v8() to postgres;

create or replace function portal_private.run_core_runtime_minute_v3()
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
    v_result:=portal_private.run_core_runtime_minute_v2();
  exception when others then
    v_error_count:=v_error_count+1;
    v_errors:=v_errors||jsonb_build_array(jsonb_build_object(
      'step','core_v2','error',left(sqlerrm,500)
    ));
    v_result:=jsonb_build_object('ok',false,'error_count',1,'errors',v_errors);
  end;

  begin
    if mod(extract(minute from clock_timestamp())::integer,5)=2 then
      v_result:=v_result||jsonb_build_object(
        'payments_v8_watchdog',
        portal_private.finance_signed_schedule_watchdog_smart_tick_v8(),
        'payments_v8_watchdog_skipped',false,
        'payments_v8_watchdog_gate_minutes',5,
        'payments_v8_watchdog_phase_minute_mod5',2
      );
    else
      v_result:=v_result||jsonb_build_object(
        'payments_v8_watchdog',null,
        'payments_v8_watchdog_skipped',true,
        'payments_v8_watchdog_skip_reason','FIVE_MINUTE_CORE_GATE',
        'payments_v8_watchdog_gate_minutes',5,
        'payments_v8_watchdog_phase_minute_mod5',2
      );
    end if;
  exception when others then
    v_error_count:=v_error_count+1;
    v_errors:=v_errors||jsonb_build_array(jsonb_build_object(
      'step','payments_v8_watchdog','error',left(sqlerrm,500)
    ));
  end;

  return v_result||jsonb_build_object(
    'v3_wrapper_ok',v_error_count=0,
    'v3_wrapper_error_count',v_error_count,
    'v3_wrapper_errors',v_errors,
    'worker_wrapper_version','CORE_RUNTIME_MINUTE_V3'
  );
end
$$;

revoke all on function portal_private.run_core_runtime_minute_v3() from public;
revoke all on function portal_private.run_core_runtime_minute_v3() from anon;
revoke all on function portal_private.run_core_runtime_minute_v3() from authenticated;
grant execute on function portal_private.run_core_runtime_minute_v3() to postgres;

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
    command:='select portal_private.run_core_runtime_minute_v3();'
  );

  perform cron.alter_job(
    job_id:=v_watchdog_jobid,
    active:=false
  );
end
$$;

comment on function portal_private.finance_signed_schedule_watchdog_smart_tick_v8()
is 'Payments V8 watchdog smart gate: full verification hourly at minute 02, immediate full watchdog when concrete work exists, otherwise no-op.';
