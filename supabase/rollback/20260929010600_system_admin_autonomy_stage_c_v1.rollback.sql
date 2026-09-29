-- RONA Trade / Stage C System Admin autonomy — non-destructive rollback
-- Restores pre-Stage-C scheduler and pre-System-Admin executor scope.
-- V2 helper functions are retained for audit but become unreachable from the restored runtime.

create or replace function portal_private.ai_executor_role_scope(
  p_role portal_private.ai_business_role_enum,
  p_type text
)
returns boolean
language sql
immutable
set search_path='pg_catalog','portal_private'
as $function$
  select case p_role::text
    when 'OPERATIONS_DIRECTOR' then upper(p_type)=any(array['CLIENT','CONTRACT','APPLICATION','DEAL','DOCUMENT','PAYMENT','SHIPMENT','RAIL_DOCUMENT','PUBLICATION','TASK','SYSTEM'])
    when 'FINANCE' then upper(p_type)=any(array['CONTRACT','APPLICATION','DEAL','PAYMENT','TASK'])
    when 'LEGAL' then upper(p_type)=any(array['CONTRACT','DEAL','DOCUMENT','TASK'])
    when 'MARKET_ANALYST' then upper(p_type)=any(array['DEAL','PUBLICATION','TASK'])
    when 'COMMERCIAL_DIRECTOR' then upper(p_type)=any(array['DEAL','PUBLICATION','TASK'])
    when 'RAIL_LOGISTICS' then upper(p_type)=any(array['DEAL','SHIPMENT','RAIL_DOCUMENT','TASK'])
    else false
  end
$function$;

do $do$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid
  from cron.job
  where jobname='rona-core-runtime-minute-v1'
  limit 1;

  if v_jobid is not null then
    perform cron.alter_job(
      v_jobid,
      schedule=>'* * * * *',
      command=>'select portal_private.run_core_runtime_minute_v5();',
      active=>true
    );
  end if;
end
$do$;

comment on function portal_private.run_core_runtime_minute_v6() is
'Retained after rollback for audit only. Production cron restored to V5.';
