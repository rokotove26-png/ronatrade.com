-- RONA Trade AI Office / exception-first diagnostics and reverse-event reconciliation candidates.
-- Read-only governance surface: no task/event/business mutation.

create or replace function portal_private.ai_reverse_event_reconciliation_candidates_v1(
  p_role portal_private.ai_business_role_enum default 'OPERATIONS_DIRECTOR'::portal_private.ai_business_role_enum
)
returns jsonb
language sql
stable
security definer
set search_path = portal_private, pg_catalog
as $$
  select coalesce(jsonb_agg(x.obj order by x.task_updated_at desc),'[]'::jsonb)
  from (
    select t.updated_at as task_updated_at,
      jsonb_build_object(
        'task_id',t.task_id,
        'task_status',t.status::text,
        'event_id',e.event_id,
        'event_type',e.event_type,
        'event_state',e.processing_state,
        'event_as_of',e.updated_at,
        'source_ref','PORTAL_REVERSE_EVENT:'||e.event_id,
        'entity_ref',
          case
            when e.event_type='DEAL_CANCELLED' and d.deal_id is not null then 'DEAL:'||d.deal_id
            when e.event_type='APPLICATION_RESOURCE_CONFIRMED' then 'APPLICATION:'||coalesce(a.application_id,e.payload->>'entityId','UNKNOWN')
            else coalesce(e.authority_target_type,'ENTITY')||':'||coalesce(e.authority_target_id,e.payload->>'entityId','UNKNOWN')
          end,
        'classification',
          case
            when e.event_type='DEAL_CANCELLED'
              and d.id is not null
              and upper(coalesce(d.business_status,''))='CANCELLED'
              then 'ALREADY_MATERIALIZED'
            when e.event_type='APPLICATION_RESOURCE_CONFIRMED'
              and a.id is not null
              and (a.linked_deal_key is not null or upper(coalesce(a.status::text,'')) not in ('SUBMITTED','UNDER_REVIEW'))
              then 'SUPERSEDED_BY_ADVANCED_APPLICATION'
            when e.event_type='APPLICATION_RESOURCE_CONFIRMED'
              and a.id is null
              then 'HOLD_SOURCE_ENTITY_ABSENT'
            when e.processing_state in ('APPLIED','ACKNOWLEDGED')
              and t.status::text not in ('COMPLETED','CLOSED','REJECTED')
              then 'STATE_DIVERGENCE'
            else 'REVIEW_REQUIRED'
          end,
        'safe_to_auto_resolve',
          case
            when e.event_type='DEAL_CANCELLED'
              and d.id is not null
              and upper(coalesce(d.business_status,''))='CANCELLED'
              then true
            when e.event_type='APPLICATION_RESOURCE_CONFIRMED'
              and a.id is not null
              and (a.linked_deal_key is not null or upper(coalesce(a.status::text,'')) not in ('SUBMITTED','UNDER_REVIEW'))
              then true
            else false
          end,
        'recommended_action',
          case
            when e.event_type='DEAL_CANCELLED'
              and d.id is not null
              and upper(coalesce(d.business_status,''))='CANCELLED'
              then 'RESOLVE_TECHNICAL_EVENT_AND_CLOSE_TASK_WITH_AUDIT'
            when e.event_type='APPLICATION_RESOURCE_CONFIRMED'
              and a.id is not null
              and (a.linked_deal_key is not null or upper(coalesce(a.status::text,'')) not in ('SUBMITTED','UNDER_REVIEW'))
              then 'SUPERSEDE_TECHNICAL_EVENT_AND_CLOSE_TASK_WITH_AUDIT'
            when e.event_type='APPLICATION_RESOURCE_CONFIRMED'
              and a.id is null
              then 'HOLD_AND_RECONCILE_SOURCE_ENTITY'
            else 'REVIEW'
          end
      ) obj
    from portal_private.staff_tasks t
    join portal_private.portal_reverse_events e on e.id=t.source_reverse_event_key
    left join portal_private.deals d on d.id=t.deal_key
    left join portal_private.client_applications a
      on a.application_id=coalesce(nullif(e.authority_target_id,''),nullif(e.payload->>'entityId',''))
     and (e.client_key is null or a.client_key=e.client_key)
     and (e.contract_key is null or a.contract_key=e.contract_key)
    where t.qa_only=false
      and t.assigned_functional_role::text=p_role::text
      and t.source_type='PORTAL_REVERSE_EVENT'
      and t.status::text not in ('COMPLETED','CLOSED','REJECTED')
  ) x
$$;

create or replace function portal_private.ai_role_exception_cockpit_v1(
  p_role portal_private.ai_business_role_enum
)
returns jsonb
language plpgsql
stable
security definer
set search_path = portal_private, pg_catalog
as $$
declare
  v_conflicts jsonb;
  v_candidates jsonb;
  v_action_now jsonb;
  v_waiting jsonb;
  v_stale jsonb;
  v_blocked jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
      'task_id',t.task_id,
      'task_status',t.status::text,
      'conclusion_record_id',r.record_id,
      'conclusion_status',r.status,
      'code','TASK_OPEN_WITH_TERMINAL_CONCLUSION'
    ) order by t.updated_at desc),'[]'::jsonb)
  into v_conflicts
  from portal_private.staff_tasks t
  join lateral (
    select c.record_id,c.status
    from portal_private.ai_coordination_records c
    where c.qa_only=false
      and c.record_type='FUNCTIONAL_CONCLUSION'
      and c.target_type='TASK'
      and c.target_id=t.task_id
      and c.functional_role=p_role
      and not exists (
        select 1 from portal_private.ai_coordination_records n
        where n.qa_only=false and n.supersedes_id=c.record_id
      )
    order by c.version desc,c.created_at desc
    limit 1
  ) r on true
  where t.qa_only=false
    and t.assigned_functional_role::text=p_role::text
    and t.status::text not in ('COMPLETED','CLOSED','REJECTED')
    and r.status in ('APPROVED','APPROVED_WITH_CONDITIONS','REJECTED');

  v_candidates := portal_private.ai_reverse_event_reconciliation_candidates_v1(p_role);

  select coalesce(jsonb_agg(jsonb_build_object(
      'task_id',t.task_id,'priority',t.priority::text,'status',t.status::text,
      'age_minutes',greatest(0,floor(extract(epoch from (now()-t.created_at))/60)::int),
      'source_ref',t.source_type||':'||coalesce(t.source_object_id,'UNKNOWN')
    ) order by
      case t.priority::text when 'CRITICAL' then 0 when 'HIGH' then 1 when 'NORMAL' then 2 else 3 end,
      t.created_at asc
    ),'[]'::jsonb)
  into v_action_now
  from portal_private.staff_tasks t
  where t.qa_only=false
    and t.assigned_functional_role::text=p_role::text
    and t.status::text='NEW'
    and now() > t.created_at + make_interval(mins =>
      case t.priority::text when 'CRITICAL' then 0 when 'HIGH' then 5 when 'NORMAL' then 15 when 'LOW' then 60 else 15 end
    );

  select coalesce(jsonb_agg(jsonb_build_object(
    'task_id',t.task_id,'status',t.status::text,'updated_at',t.updated_at
  ) order by t.updated_at asc),'[]'::jsonb)
  into v_waiting
  from portal_private.staff_tasks t
  where t.qa_only=false
    and t.assigned_functional_role::text=p_role::text
    and t.status::text='WAITING';

  select coalesce(jsonb_agg(jsonb_build_object(
    'task_id',t.task_id,'status',t.status::text,'updated_at',t.updated_at,
    'stale_hours',floor(extract(epoch from (now()-t.updated_at))/3600)::int
  ) order by t.updated_at asc),'[]'::jsonb)
  into v_stale
  from portal_private.staff_tasks t
  where t.qa_only=false
    and t.assigned_functional_role::text=p_role::text
    and t.status::text in ('NEW','ACKNOWLEDGED','IN_PROGRESS')
    and (
      (t.status::text='NEW' and t.updated_at < now()-interval '4 hours') or
      (t.status::text in ('ACKNOWLEDGED','IN_PROGRESS') and t.updated_at < now()-interval '24 hours')
    );

  select coalesce(jsonb_agg(jsonb_build_object(
    'task_id',t.task_id,'progress_record_id',p.record_id,'created_at',p.created_at
  ) order by p.created_at desc),'[]'::jsonb)
  into v_blocked
  from portal_private.staff_tasks t
  join lateral (
    select c.record_id,c.created_at,c.status
    from portal_private.ai_coordination_records c
    where c.qa_only=false
      and c.record_type='TASK_PROGRESS'
      and c.target_type='TASK'
      and c.target_id=t.task_id
      and c.functional_role=p_role
    order by c.created_at desc
    limit 1
  ) p on true
  where t.qa_only=false
    and t.assigned_functional_role::text=p_role::text
    and t.status::text not in ('COMPLETED','CLOSED','REJECTED')
    and p.status='BLOCKED';

  return jsonb_build_object(
    'contract','RONA_EXCEPTION_FIRST_COCKPIT_V1',
    'generated_at',now(),
    'role',p_role::text,
    'ACTION_NOW',v_action_now,
    'WAITING_EXTERNAL',v_waiting,
    'BLOCKED',v_blocked,
    'STALE',v_stale,
    'STATE_CONFLICTS',v_conflicts,
    'RECONCILIATION_CANDIDATES',v_candidates,
    'counts',jsonb_build_object(
      'action_now',jsonb_array_length(v_action_now),
      'waiting_external',jsonb_array_length(v_waiting),
      'blocked',jsonb_array_length(v_blocked),
      'stale',jsonb_array_length(v_stale),
      'state_conflicts',jsonb_array_length(v_conflicts),
      'reconciliation_candidates',jsonb_array_length(v_candidates),
      'safe_reconciliation_candidates',(
        select count(*) from jsonb_array_elements(v_candidates) j
        where coalesce((j->>'safe_to_auto_resolve')::boolean,false)=true
      )
    ),
    'mutation_mode','READ_ONLY_DIAGNOSTIC'
  );
end
$$;

revoke execute on function portal_private.ai_reverse_event_reconciliation_candidates_v1(
  portal_private.ai_business_role_enum
) from public, anon, authenticated, service_role;

revoke execute on function portal_private.ai_role_exception_cockpit_v1(
  portal_private.ai_business_role_enum
) from public, anon, authenticated, service_role;

comment on function portal_private.ai_reverse_event_reconciliation_candidates_v1(
  portal_private.ai_business_role_enum
) is 'Read-only reverse-event reconciliation candidates. Never mutates task/event/business state.';

comment on function portal_private.ai_role_exception_cockpit_v1(
  portal_private.ai_business_role_enum
) is 'Exception-first role cockpit: action-now, waiting, blocked, stale, conflicts, and safe reconciliation candidates. Read-only.';
