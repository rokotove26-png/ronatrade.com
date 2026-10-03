-- Owner-approved Admin -> Online Rail manual monitoring completion.
-- Completion is offered only when every current deal wagon is TRUSTED at the route destination.
-- No automatic completion: only an authenticated ADMIN can persist COMPLETED.

create table if not exists portal_private.rail_deal_monitoring_control_v1 (
  deal_key uuid primary key references portal_private.deals(id) on delete cascade,
  monitoring_state text not null default 'ACTIVE'
    check (monitoring_state in ('ACTIVE','COMPLETED')),
  completed_at timestamptz,
  completed_by uuid references portal_private.portal_users(id),
  completion_destination_esr_code text,
  completion_wagon_count integer,
  source_authority text not null default 'OWNER_INSTRUCTION:2026-10-03:ONLINE_RAIL_COMPLETE_MONITORING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (monitoring_state='ACTIVE' and completed_at is null)
    or
    (monitoring_state='COMPLETED' and completed_at is not null)
  )
);

revoke all on portal_private.rail_deal_monitoring_control_v1 from public, anon, authenticated;

create or replace function public.rona_admin_rail_monitoring_lifecycle_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, portal_private, auth
as $$
declare
  v_actor record;
  v_result jsonb;
begin
  select * into v_actor from portal_private.application_owner_admin_actor_v2();

  with current_wagons as (
    select
      a.effective_deal_key as deal_key,
      count(*) filter (where nullif(trim(a.wagon_number),'') is not null)::int as wagon_count,
      count(*) filter (
        where a.current_position_status='TRUSTED'
      )::int as trusted_count,
      count(*) filter (
        where a.current_position_status='TRUSTED'
          and nullif(trim(a.station_code),'') is not null
      )::int as trusted_with_station_count
    from portal_private.rail_xlsx_dislocation_current_audit_v1 a
    where a.effective_deal_key is not null
    group by a.effective_deal_key
  ),
  projected as (
    select
      d.id as deal_key,
      d.deal_id,
      r.destination_esr_code,
      coalesce(w.wagon_count,0) as wagon_count,
      coalesce(w.trusted_count,0) as trusted_count,
      coalesce((
        select count(*)::int
        from portal_private.rail_xlsx_dislocation_current_audit_v1 a2
        where a2.effective_deal_key=d.id
          and a2.current_position_status='TRUSTED'
          and nullif(trim(a2.station_code),'')=nullif(trim(r.destination_esr_code),'')
      ),0) as at_destination_count,
      coalesce(w.wagon_count,0)-coalesce(w.trusted_count,0) as unresolved_count,
      coalesce(c.monitoring_state,'ACTIVE') as monitoring_state,
      c.completed_at,
      c.completed_by,
      (
        c.monitoring_state is distinct from 'COMPLETED'
        and nullif(trim(r.destination_esr_code),'') is not null
        and coalesce(w.wagon_count,0)>0
        and coalesce(w.wagon_count,0)=coalesce(w.trusted_count,0)
        and coalesce(w.wagon_count,0)=coalesce((
          select count(*)::int
          from portal_private.rail_xlsx_dislocation_current_audit_v1 a3
          where a3.effective_deal_key=d.id
            and a3.current_position_status='TRUSTED'
            and nullif(trim(a3.station_code),'')=nullif(trim(r.destination_esr_code),'')
        ),0)
      ) as completion_ready
    from portal_private.rail_deal_route_assignments_v1 r
    join portal_private.deals d on d.id=r.deal_key
    left join current_wagons w on w.deal_key=d.id
    left join portal_private.rail_deal_monitoring_control_v1 c on c.deal_key=d.id
  )
  select jsonb_build_object(
    'contract','RONA_ADMIN_RAIL_MONITORING_LIFECYCLE_V1',
    'generatedAt',now(),
    'deals',coalesce(jsonb_agg(jsonb_build_object(
      'dealKey',deal_key,
      'dealId',deal_id,
      'destinationEsrCode',destination_esr_code,
      'wagonCount',wagon_count,
      'trustedCount',trusted_count,
      'atDestinationCount',at_destination_count,
      'unresolvedCount',unresolved_count,
      'monitoringState',monitoring_state,
      'completionReady',completion_ready,
      'completedAt',completed_at,
      'completedBy',completed_by
    ) order by deal_id),'[]'::jsonb)
  )
  into v_result
  from projected;

  return v_result;
end
$$;

revoke all on function public.rona_admin_rail_monitoring_lifecycle_v1() from public;
grant execute on function public.rona_admin_rail_monitoring_lifecycle_v1() to authenticated;

create or replace function public.rona_admin_rail_monitoring_complete_v1(p_deal_id text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, portal_private, auth
as $$
declare
  v_actor record;
  v_deal_key uuid;
  v_destination text;
  v_total int;
  v_trusted int;
  v_at_destination int;
  v_state text;
begin
  select * into v_actor from portal_private.application_owner_admin_actor_v2();

  select d.id, nullif(trim(r.destination_esr_code),'')
  into v_deal_key, v_destination
  from portal_private.deals d
  join portal_private.rail_deal_route_assignments_v1 r on r.deal_key=d.id
  where d.deal_id=p_deal_id
  limit 1
  for update of d;

  if v_deal_key is null then
    raise exception 'RAIL_MONITORING_DEAL_NOT_FOUND';
  end if;
  if v_destination is null then
    raise exception 'RAIL_MONITORING_DESTINATION_NOT_CONFIRMED';
  end if;

  select
    count(*) filter (where nullif(trim(a.wagon_number),'') is not null)::int,
    count(*) filter (where a.current_position_status='TRUSTED')::int,
    count(*) filter (
      where a.current_position_status='TRUSTED'
        and nullif(trim(a.station_code),'')=v_destination
    )::int
  into v_total, v_trusted, v_at_destination
  from portal_private.rail_xlsx_dislocation_current_audit_v1 a
  where a.effective_deal_key=v_deal_key;

  if coalesce(v_total,0)=0 then
    raise exception 'RAIL_MONITORING_NO_CURRENT_WAGONS';
  end if;
  if v_total<>v_trusted then
    raise exception 'RAIL_MONITORING_WAGONS_NOT_ALL_TRUSTED';
  end if;
  if v_total<>v_at_destination then
    raise exception 'RAIL_MONITORING_WAGONS_NOT_ALL_AT_DESTINATION';
  end if;

  select monitoring_state into v_state
  from portal_private.rail_deal_monitoring_control_v1
  where deal_key=v_deal_key
  for update;

  if v_state='COMPLETED' then
    return jsonb_build_object(
      'contract','RONA_ADMIN_RAIL_MONITORING_COMPLETE_V1',
      'dealId',p_deal_id,
      'dealKey',v_deal_key,
      'monitoringState','COMPLETED',
      'completionReady',false,
      'idempotent',true
    );
  end if;

  insert into portal_private.rail_deal_monitoring_control_v1(
    deal_key, monitoring_state, completed_at, completed_by,
    completion_destination_esr_code, completion_wagon_count, updated_at
  )
  values(
    v_deal_key,'COMPLETED',now(),v_actor.portal_user_id,
    v_destination,v_total,now()
  )
  on conflict(deal_key) do update set
    monitoring_state='COMPLETED',
    completed_at=excluded.completed_at,
    completed_by=excluded.completed_by,
    completion_destination_esr_code=excluded.completion_destination_esr_code,
    completion_wagon_count=excluded.completion_wagon_count,
    updated_at=excluded.updated_at;

  insert into portal_private.audit_events(
    actor_user_id,actor_role,action,entity_type,entity_id,request_id,metadata
  )
  values(
    v_actor.portal_user_id,
    'ADMIN',
    'RAIL_MONITORING_COMPLETE',
    'DEAL',
    p_deal_id,
    gen_random_uuid(),
    jsonb_build_object(
      'destination_esr_code',v_destination,
      'wagon_count',v_total,
      'owner_instruction_ref','OWNER_INSTRUCTION:2026-10-03:ONLINE_RAIL_COMPLETE_MONITORING'
    )
  );

  return jsonb_build_object(
    'contract','RONA_ADMIN_RAIL_MONITORING_COMPLETE_V1',
    'dealId',p_deal_id,
    'dealKey',v_deal_key,
    'monitoringState','COMPLETED',
    'completionReady',false,
    'completedAt',now(),
    'wagonCount',v_total,
    'destinationEsrCode',v_destination,
    'idempotent',false
  );
end
$$;

revoke all on function public.rona_admin_rail_monitoring_complete_v1(text) from public;
grant execute on function public.rona_admin_rail_monitoring_complete_v1(text) to authenticated;
