-- Event-driven automation health for the Admin Operational Center.
-- No periodic read-model polling is introduced.
-- Critical pg_cron jobs signal OPERATIONS only when health changes
-- (success<->failure) or when execution recovers after an excessive gap.

create or replace function portal_private.rona_admin_automation_health_v1()
returns jsonb
language sql
stable
security definer
set search_path to 'pg_catalog','public','portal_private','cron'
as $function$
with wanted(jobname,max_age_seconds) as (
  values
    ('rona-core-runtime-minute-v1'::text,180::int),
    ('rona-client-intake-reconcile-v1',300),
    ('payments-v8-stale-executor-recovery',300),
    ('payments-v8-signed-schedule-watchdog',600),
    ('rail-route-assignments-v1',1200),
    ('rona-ai-runtime-heartbeat',1200)
),
rows as (
  select
    w.jobname,
    w.max_age_seconds,
    j.jobid,
    j.schedule,
    coalesce(j.active,false) as active,
    r.runid,
    r.status,
    r.start_time,
    r.end_time,
    left(coalesce(r.return_message,''),240) as return_message,
    case
      when j.jobid is null then 'MISSING'
      when j.active is not true then 'DISABLED'
      when r.runid is null then 'NO_RUN'
      when lower(coalesce(r.status,'')) <> 'succeeded' then 'FAILED'
      when r.start_time < now() - make_interval(secs=>w.max_age_seconds) then 'STALE'
      else 'HEALTHY'
    end as health_state
  from wanted w
  left join cron.job j on j.jobname=w.jobname
  left join lateral (
    select d.runid,d.status,d.start_time,d.end_time,d.return_message
    from cron.job_run_details d
    where d.jobid=j.jobid
    order by d.start_time desc
    limit 1
  ) r on true
)
select coalesce(jsonb_agg(jsonb_build_object(
  'jobname',jobname,
  'jobid',jobid,
  'schedule',schedule,
  'active',active,
  'health_state',health_state,
  'last_status',status,
  'last_run_id',runid,
  'last_start_time',start_time,
  'last_end_time',end_time,
  'max_age_seconds',max_age_seconds,
  'return_message',return_message
) order by jobname),'[]'::jsonb)
from rows
$function$;

revoke all on function portal_private.rona_admin_automation_health_v1()
from public,anon,authenticated;

create or replace function portal_private.rona_admin_cron_health_transition_v1()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog','public','portal_private','cron'
as $function$
declare
  v_jobname text;
  v_max_age int;
  v_prev cron.job_run_details%rowtype;
  v_new_ok boolean;
  v_prev_ok boolean;
  v_should_signal boolean := false;
begin
  if TG_OP <> 'UPDATE' or new.status is not distinct from old.status then
    return new;
  end if;

  select j.jobname,
         case j.jobname
           when 'rona-core-runtime-minute-v1' then 180
           when 'rona-client-intake-reconcile-v1' then 300
           when 'payments-v8-stale-executor-recovery' then 300
           when 'payments-v8-signed-schedule-watchdog' then 600
           when 'rail-route-assignments-v1' then 1200
           when 'rona-ai-runtime-heartbeat' then 1200
           else null
         end
    into v_jobname,v_max_age
  from cron.job j
  where j.jobid=new.jobid;

  if v_max_age is null or lower(coalesce(new.status,'')) not in ('succeeded','failed') then
    return new;
  end if;

  select d.*
    into v_prev
  from cron.job_run_details d
  where d.jobid=new.jobid
    and d.runid<>new.runid
    and lower(coalesce(d.status,'')) in ('succeeded','failed')
  order by d.start_time desc
  limit 1;

  v_new_ok := lower(new.status)='succeeded';

  if v_prev.runid is null then
    v_should_signal := not v_new_ok;
  else
    v_prev_ok := lower(v_prev.status)='succeeded';
    v_should_signal := (v_new_ok is distinct from v_prev_ok)
      or (v_new_ok and v_prev_ok and new.start_time-v_prev.start_time > make_interval(secs=>v_max_age));
  end if;

  if v_should_signal then
    update public.rona_admin_operations_invalidation_v1
       set version=version+1,
           updated_at=clock_timestamp()
     where domain='OPERATIONS';
  end if;

  return new;
end
$function$;

revoke all on function portal_private.rona_admin_cron_health_transition_v1()
from public,anon,authenticated;

drop trigger if exists rona_admin_cron_health_transition_v1
on cron.job_run_details;

create trigger rona_admin_cron_health_transition_v1
after update of status on cron.job_run_details
for each row
when (old.status is distinct from new.status)
execute function portal_private.rona_admin_cron_health_transition_v1();

do $$
declare
  v_def text;
begin
  select pg_get_functiondef('public.rona_admin_operations_current_v1()'::regprocedure)
    into v_def;

  if position('portal_private.rona_admin_automation_health_v1()' in v_def)=0 then
    if position(E'  return v_result;' in v_def)=0 then
      raise exception 'OPERATIONS_CURRENT_V1_RETURN_ANCHOR_MISSING';
    end if;

    v_def := replace(
      v_def,
      E'  return v_result;',
      E'  v_result := v_result || jsonb_build_object(''automationHealth'',portal_private.rona_admin_automation_health_v1());\n\n  return v_result;'
    );
    execute v_def;
  end if;
end
$$;

revoke all on function public.rona_admin_operations_current_v1()
from public,anon;
grant execute on function public.rona_admin_operations_current_v1()
to authenticated,service_role;
