-- RONA Trade Admin Operational Center: event-driven current read model.
-- No periodic polling. Business tables are read-only from this contour;
-- writes below are limited to the small invalidation signal table.

create table if not exists public.rona_admin_operations_invalidation_v1 (
  domain text primary key check (domain in ('OPERATIONS','DEALS','DOCUMENTS','FINANCE','RAIL','REGISTRY')),
  version bigint not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.rona_admin_operations_invalidation_v1(domain)
values ('OPERATIONS'),('DEALS'),('DOCUMENTS'),('FINANCE'),('RAIL'),('REGISTRY')
on conflict(domain) do nothing;

alter table public.rona_admin_operations_invalidation_v1 enable row level security;
revoke all on table public.rona_admin_operations_invalidation_v1 from public, anon, authenticated;
grant select on table public.rona_admin_operations_invalidation_v1 to anon, authenticated;

drop policy if exists rona_admin_operations_invalidation_read_v1
on public.rona_admin_operations_invalidation_v1;

create policy rona_admin_operations_invalidation_read_v1
on public.rona_admin_operations_invalidation_v1
for select
to anon, authenticated
using (true);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='rona_admin_operations_invalidation_v1'
  ) then
    alter publication supabase_realtime
      add table public.rona_admin_operations_invalidation_v1;
  end if;
end
$$;

CREATE OR REPLACE FUNCTION portal_private.rona_admin_operations_touch_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'portal_private'
AS $function$
declare
  v_domain text := coalesce(nullif(TG_ARGV[0],''),'OPERATIONS');
  v_old_status text;
  v_new_status text;
begin
  if TG_TABLE_NAME='staff_tasks' then
    if TG_OP='INSERT' then
      v_new_status := upper(coalesce(new.status::text,''));
      if v_new_status in ('COMPLETED','CLOSED','REJECTED','CANCELLED','CANCELED','DONE') then
        return new;
      end if;
    elsif TG_OP='DELETE' then
      v_old_status := upper(coalesce(old.status::text,''));
      if v_old_status in ('COMPLETED','CLOSED','REJECTED','CANCELLED','CANCELED','DONE') then
        return old;
      end if;
    elsif TG_OP='UPDATE' then
      v_old_status := upper(coalesce(old.status::text,''));
      v_new_status := upper(coalesce(new.status::text,''));
      if v_old_status in ('COMPLETED','CLOSED','REJECTED','CANCELLED','CANCELED','DONE')
         and v_new_status in ('COMPLETED','CLOSED','REJECTED','CANCELLED','CANCELED','DONE') then
        return new;
      end if;
      if (to_jsonb(new) - array['updated_at','source_timestamp']::text[])
         is not distinct from
         (to_jsonb(old) - array['updated_at','source_timestamp']::text[]) then
        return new;
      end if;
    end if;
  elsif TG_TABLE_NAME='rail_deal_route_assignments_v1' and TG_OP='UPDATE' then
    if (to_jsonb(new) - array['resolved_at','refreshed_at']::text[])
       is not distinct from
       (to_jsonb(old) - array['resolved_at','refreshed_at']::text[]) then
      return new;
    end if;
  elsif TG_OP='UPDATE' and new is not distinct from old then
    return new;
  end if;

  if current_setting('rona.operations_signal_'||lower(v_domain),true)='1' then
    return case when TG_OP='DELETE' then old else new end;
  end if;

  perform set_config('rona.operations_signal_'||lower(v_domain),'1',true);

  update public.rona_admin_operations_invalidation_v1
     set version=version+1,
         updated_at=clock_timestamp()
   where domain=v_domain;

  return case when TG_OP='DELETE' then old else new end;
end
$function$
;

revoke all on function portal_private.rona_admin_operations_touch_v1()
from public, anon, authenticated;

do $$
declare
  r record;
begin
  for r in
    select *
    from (values
      ('staff_tasks','OPERATIONS'),
      ('portal_reverse_events','OPERATIONS'),
      ('deals','DEALS'),
      ('client_applications','DEALS'),
      ('owner_application_workflow','DEALS'),
      ('owner_deal_workflow','DEALS'),
      ('contracts','DEALS'),
      ('shipments','DEALS'),
      ('owner_deal_documents','DOCUMENTS'),
      ('documents','DOCUMENTS'),
      ('owner_deal_finance_summary','FINANCE'),
      ('finance_materialization_jobs_v7','FINANCE'),
      ('rail_provider_runtime_control','RAIL'),
      ('rail_xlsx_dislocation_events_v1','RAIL'),
      ('rail_xlsx_resolution_decisions_v1','RAIL'),
      ('rail_xlsx_correction_decisions_v1','RAIL'),
      ('rail_deal_route_assignments_v1','RAIL'),
      ('clients','REGISTRY'),
      ('agent_persons','REGISTRY')
    ) as x(table_name,domain)
  loop
    if exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='portal_private'
        and c.relname=r.table_name
        and c.relkind in ('r','p')
    ) then
      execute format(
        'drop trigger if exists rona_admin_operations_signal_v1 on portal_private.%I',
        r.table_name
      );
      execute format(
        'create trigger rona_admin_operations_signal_v1 after insert or update or delete on portal_private.%I for each row execute function portal_private.rona_admin_operations_touch_v1(%L)',
        r.table_name,
        r.domain
      );
    end if;
  end loop;
end
$$;

CREATE OR REPLACE FUNCTION public.rona_admin_operations_current_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'portal_private', 'auth'
AS $function$
declare
  v_actor uuid;
  v_result jsonb;
begin
  v_actor := portal_private.owner_r1_actor('ADMIN');

  with
  tasks as (
    select
      st.id::text as id,
      st.task_id,
      st.title,
      st.description,
      st.status::text as status,
      st.priority::text as priority,
      st.authority_domain,
      st.assigned_functional_role::text as assigned_functional_role,
      st.assigned_user_id::text as assigned_user_id,
      st.due_at,
      st.source_type,
      st.source_object_id,
      st.created_at,
      st.updated_at,
      d.deal_id,
      a.application_id,
      s.shipment_id
    from portal_private.staff_tasks st
    left join portal_private.deals d on d.id=st.deal_key
    left join portal_private.client_applications a on a.id=st.application_key
    left join portal_private.shipments s on s.id=st.shipment_key
    where coalesce(st.qa_only,false)=false
      and upper(st.status::text) not in ('COMPLETED','CLOSED','REJECTED','CANCELLED','CANCELED','DONE')
    order by
      case upper(st.priority::text)
        when 'CRITICAL' then 0
        when 'URGENT' then 1
        when 'HIGH' then 2
        else 3
      end,
      st.due_at nulls last,
      st.updated_at desc
    limit 200
  ),
  reverse_events as (
    select
      r.id::text as id,
      r.event_id,
      r.event_type,
      r.authority_domain,
      r.authority_target_type,
      r.authority_target_id,
      r.processing_state,
      r.acknowledgement_state,
      r.retry_count,
      r.next_retry_at,
      r.last_error_code,
      r.created_at,
      r.updated_at,
      d.deal_id
    from portal_private.portal_reverse_events r
    left join portal_private.deals d on d.id=r.deal_key
    where r.lifecycle_state::text='ACTIVE'
      and (
        upper(r.processing_state) in ('QUEUED','PENDING','FAILED','ERROR','RETRY','RETRYING')
        or upper(r.acknowledgement_state) in ('PENDING','WAITING','REQUIRED')
      )
    order by r.updated_at desc
    limit 200
  ),
  ai_health as (
    select
      state::text as state,
      count(*)::bigint as item_count,
      count(*) filter(where sla_breached_at is not null)::bigint as sla_breached,
      max(updated_at) as last_updated_at
    from portal_private.ai_runtime_queue
    group by state
    order by state
  ),
  materializer as (
    select
      status::text as status,
      count(*)::bigint as job_count,
      max(updated_at) as last_updated_at
    from portal_private.finance_materialization_jobs_v7
    group by status
    order by status
  ),
  rail_runtime as (
    select
      provider,
      mode,
      credentials_state,
      api_contract_state,
      one_wagon_test_passed,
      production_polling_enabled,
      client_publication_enabled,
      default_poll_interval_minutes,
      changed_at,
      note
    from portal_private.rail_provider_runtime_control
    order by provider
  ),
  task_metrics as (
    select
      count(*)::int as open_tasks,
      count(*) filter (
        where upper(priority) in ('CRITICAL','URGENT')
           or (due_at is not null and due_at < now())
      )::int as critical_tasks,
      count(*) filter (where assigned_user_id is null)::int as unassigned_tasks
    from tasks
  ),
  reverse_metrics as (
    select
      count(*)::int as actionable_reverse,
      count(*) filter (
        where last_error_code is not null
           or upper(processing_state) in ('FAILED','ERROR')
      )::int as critical_reverse
    from reverse_events
  ),
  materializer_metrics as (
    select
      coalesce(sum(job_count) filter (where upper(status) in ('FAILED','ERROR','DEAD_LETTER')),0)::int as action_issues,
      coalesce(sum(job_count) filter (where upper(status) in ('DENIED','FAILED','ERROR','DEAD_LETTER')),0)::int as diagnostic_issues
    from materializer
  ),
  rail_metrics as (
    select
      count(*) filter (
        where upper(mode) <> 'DISABLED'
          and (
            production_polling_enabled = false
            or upper(credentials_state) <> 'READY'
            or upper(api_contract_state) <> 'READY'
          )
      )::int as action_issues
    from rail_runtime
  ),
  registry_metrics as (
    select
      (select count(distinct id)::int
         from portal_private.clients
        where lifecycle_state::text='ACTIVE') as clients_registered,
      (select count(distinct id)::int
         from portal_private.agent_persons
        where lifecycle_state::text='ACTIVE'
          and authority_state::text not in ('REJECTED','SUPERSEDED')) as agents_registered
  ),
  business_metrics as (
    select
      (select count(*)::int
         from portal_private.deals
        where lifecycle_state::text='ACTIVE'
          and upper(business_status) not in ('CLOSED','ARCHIVED','CANCELLED','CANCELED','TERMINATED','VOID')) as active_deals,
      (select count(*)::int
         from portal_private.deals
        where lifecycle_state::text='ACTIVE'
          and upper(business_status) in ('EXECUTING','IN_PROGRESS','EXECUTION','CONTRACT_EXECUTION','CONTRACT_AND_EXECUTION')) as execution_deals,
      (select count(*)::int
         from portal_private.client_applications
        where lifecycle_state::text='ACTIVE'
          and upper(status::text) in ('NEW','COUNTER_OFFERED','SUPPLIER_PENDING','UNDER_REVIEW','ACCEPTED_AWAITING_DEAL_REGISTRATION')) as applications_requiring_action,
      (select count(*)::int
         from portal_private.owner_deal_documents
        where checked_by_admin=false) as unchecked_documents,
      (select count(*)::int
         from portal_private.owner_deal_finance_summary
        where authority_state::text in ('CONFIRMED','VERIFIED')
          and lifecycle_state::text='ACTIVE'
          and coalesce(client_remaining_amount,0)>0
          and upper(finance_status::text) in ('DUE','OVERDUE','PAYMENT_DUE','AWAITING_PAYMENT','DISPUTED')) as payments_on_control,
      (select count(*)::int
         from portal_private.rail_xlsx_dislocation_current_position_v1
        where position_status='TRUSTED') as trusted_wagons
  ),
  technical_history as (
    select
      coalesce(sum(item_count) filter (where upper(state) in ('DEAD_LETTER','FAILED','ERROR')),0)::int as ai_runtime_issue_count,
      coalesce(sum(sla_breached),0)::int as ai_sla_breached_count
    from ai_health
  ),
  freshness_rows as (
    select 'deals'::text source,max(updated_at) source_as_of from portal_private.deals
    union all select 'applications',max(updated_at) from portal_private.client_applications
    union all select 'documents',max(updated_at) from portal_private.owner_deal_documents
    union all select 'shipments',max(updated_at) from portal_private.shipments
    union all select 'tasks',max(updated_at) from portal_private.staff_tasks
    union all select 'reverse_events',max(updated_at) from portal_private.portal_reverse_events
    union all select 'ai_queue',max(updated_at) from portal_private.ai_runtime_queue
    union all select 'finance_materializer',max(updated_at) from portal_private.finance_materialization_jobs_v7
    union all select 'rail_events',max(source_received_at) from portal_private.rail_xlsx_dislocation_events_v1
    union all select 'clients',max(updated_at) from portal_private.clients
    union all select 'agents',max(updated_at) from portal_private.agent_persons
  ),
  freshness as (
    select
      coalesce(jsonb_object_agg(source,source_as_of), '{}'::jsonb)
      || jsonb_build_object('source_as_of',max(source_as_of)) as payload
    from freshness_rows
  ),
  task_alerts as (
    select jsonb_build_object(
      'severity',
        case
          when upper(priority) in ('CRITICAL','URGENT') or (due_at is not null and due_at<now()) then 'CRITICAL'
          when upper(priority)='HIGH' then 'WARNING'
          else 'INFO'
        end,
      'title','Задача · '||coalesce(task_id,title,'без номера'),
      'meta',concat_ws(' · ',nullif(title,''),status,case when assigned_user_id is null then 'не назначена' end,case when due_at is not null then 'срок '||due_at::text end),
      'target',case when deal_id is not null then 'deals' else 'home' end,
      'deal_id',deal_id,
      'entity_type','STAFF_TASK',
      'entity_id',id
    ) as alert
    from tasks
  ),
  reverse_alerts as (
    select jsonb_build_object(
      'severity',case when last_error_code is not null or upper(processing_state) in ('FAILED','ERROR') then 'ERROR' else 'WARNING' end,
      'title','Обратное событие · '||coalesce(event_type,event_id,'без типа'),
      'meta',concat_ws(' · ',processing_state,acknowledgement_state,last_error_code),
      'target',case when deal_id is not null then 'deals' else 'home' end,
      'deal_id',deal_id,
      'entity_type','REVERSE_EVENT',
      'entity_id',id
    ) as alert
    from reverse_events
  ),
  finance_alerts as (
    select jsonb_build_object(
      'severity','ERROR',
      'title','Finance materializer · '||upper(status),
      'meta',job_count::text||' технических заданий',
      'target','payments',
      'deal_id',null,
      'entity_type','FINANCE_MATERIALIZER',
      'entity_id',null
    ) as alert
    from materializer
    where upper(status) in ('FAILED','ERROR','DEAD_LETTER')
  ),
  rail_alerts as (
    select jsonb_build_object(
      'severity','WARNING',
      'title','ЖД-провайдер · '||provider,
      'meta',concat_ws(' · ',mode,credentials_state,api_contract_state,'production polling требует внимания'),
      'target','monitoring',
      'deal_id',null,
      'entity_type','RAIL_PROVIDER',
      'entity_id',provider
    ) as alert
    from rail_runtime
    where upper(mode) <> 'DISABLED'
      and (
        production_polling_enabled=false
        or upper(credentials_state)<>'READY'
        or upper(api_contract_state)<>'READY'
      )
  ),
  alerts as (
    select coalesce(jsonb_agg(alert),'[]'::jsonb) payload
    from (
      select alert from task_alerts
      union all
      select alert from reverse_alerts
      union all
      select alert from finance_alerts
      union all
      select alert from rail_alerts
    ) x
  )
  select jsonb_build_object(
    'version','OPERATIONS_CURRENT_V1',
    'action_scope','CURRENT_ACTIONABLE_V1',
    'generated_at',now(),
    'signal_version',(select coalesce(max(version),0) from public.rona_admin_operations_invalidation_v1),'signal_versions',(select coalesce(jsonb_object_agg(domain,version),'{}'::jsonb) from public.rona_admin_operations_invalidation_v1),
    'tasks',(select coalesce(jsonb_agg(to_jsonb(tasks)),'[]'::jsonb) from tasks),
    'reverseEvents',(select coalesce(jsonb_agg(to_jsonb(reverse_events)),'[]'::jsonb) from reverse_events),
    'aiHealth',(select coalesce(jsonb_agg(to_jsonb(ai_health)),'[]'::jsonb) from ai_health),
    'financeMaterializerHealth',(select coalesce(jsonb_agg(to_jsonb(materializer)),'[]'::jsonb) from materializer),
    'railRuntime',(select coalesce(jsonb_agg(to_jsonb(rail_runtime)),'[]'::jsonb) from rail_runtime),
    'freshness',(select payload from freshness),
    'alerts',(select payload from alerts),
    'technical_history',jsonb_build_object(
      'ai_runtime_issue_count',(select ai_runtime_issue_count from technical_history),
      'ai_sla_breached_count',(select ai_sla_breached_count from technical_history),
      'finance_materializer_diagnostic_count',(select diagnostic_issues from materializer_metrics)
    ),
    'metrics',jsonb_build_object(
      'open_tasks',(select open_tasks from task_metrics),
      'unassigned_tasks',(select unassigned_tasks from task_metrics),
      'pending_reverse_events',(select actionable_reverse from reverse_metrics),
      'finance_materializer_action_issues',(select action_issues from materializer_metrics),
      'rail_issues',(select action_issues from rail_metrics),
      'automation_issues',
        (select actionable_reverse from reverse_metrics)
        +(select action_issues from materializer_metrics)
        +(select action_issues from rail_metrics),
      'attention_total',
        (select open_tasks from task_metrics)
        +(select actionable_reverse from reverse_metrics)
        +(select action_issues from materializer_metrics)
        +(select action_issues from rail_metrics),
      'critical_total',
        (select critical_tasks from task_metrics)
        +(select critical_reverse from reverse_metrics)
        +(select action_issues from materializer_metrics),
      'clients_registered',(select clients_registered from registry_metrics),
      'agents_registered',(select agents_registered from registry_metrics),
      'active_deals',(select active_deals from business_metrics),
      'execution_deals',(select execution_deals from business_metrics),
      'applications_requiring_action',(select applications_requiring_action from business_metrics),
      'unchecked_documents',(select unchecked_documents from business_metrics),
      'payments_on_control',(select payments_on_control from business_metrics),
      'trusted_wagons',(select trusted_wagons from business_metrics),
      'action_scope','CURRENT_ACTIONABLE_V1',
      'ai_history_excluded_from_action_kpi',true,
      'terminal_denials_excluded_from_action_kpi',true,
      'intentional_disabled_providers_excluded_from_action_kpi',true
    )
  )
  into v_result;

  return v_result;
end
$function$
;

revoke all on function public.rona_admin_operations_current_v1()
from public, anon;
grant execute on function public.rona_admin_operations_current_v1()
to authenticated, service_role;
