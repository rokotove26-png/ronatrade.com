-- ROLLBACK ONLY — runtime rollback for Owner/AI Office Control V4.
-- The owner-issued human topology (OWNER + TREASURY only) is canonical and is not reverted here.

do $do$
declare v_jobid bigint;
begin
  select jobid into v_jobid from cron.job
  where jobname='rona-core-runtime-minute-v1'
  order by jobid desc limit 1;
  if v_jobid is not null then
    perform cron.alter_job(
      v_jobid,
      command => 'select portal_private.run_core_runtime_minute_v4();',
      active => true
    );
  end if;
end
$do$;

drop function if exists portal_private.run_core_runtime_minute_v5();

-- Keep ai_role_routing_contract_v3, ai_role_state_current_v4 and
-- ai_task_dependencies_materialize_v2 because they are already production-canonical
-- and predate this repository reconciliation.
