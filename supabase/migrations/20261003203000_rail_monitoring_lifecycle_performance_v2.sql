-- Admin Online Rail monitoring lifecycle performance hardening.
-- Root cause: the lifecycle RPC expanded rail_operational_current_position_v1 three times
-- (one aggregate plus two correlated destination subqueries), causing PostgREST statement timeouts.
-- This replacement materializes the authoritative current-position projection once per request.
-- Business semantics and Rail facts are unchanged.

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

  with route_scope as materialized (
    select
      d.id as deal_key,
      d.deal_id,
      nullif(trim(r.destination_esr_code),'') as destination_esr_code,
      coalesce(c.monitoring_state,'ACTIVE') as monitoring_state,
      c.completed_at,
      c.completed_by
    from portal_private.rail_deal_route_assignments_v1 r
    join portal_private.deals d on d.id=r.deal_key
    left join portal_private.rail_deal_monitoring_control_v1 c on c.deal_key=d.id
  ),
  current_positions as materialized (
    select
      a.effective_deal_key as deal_key,
      a.wagon_number,
      a.position_status,
      nullif(trim(a.current_station_code),'') as current_station_code
    from portal_private.rail_operational_current_position_v1 a
    join route_scope rs on rs.deal_key=a.effective_deal_key
  ),
  aggregated as (
    select
      rs.deal_key,
      rs.deal_id,
      rs.destination_esr_code,
      count(cp.wagon_number) filter (
        where nullif(trim(cp.wagon_number),'') is not null
      )::int as wagon_count,
      count(cp.wagon_number) filter (
        where cp.position_status='TRUSTED'
      )::int as trusted_count,
      count(cp.wagon_number) filter (
        where cp.position_status='TRUSTED'
          and cp.current_station_code=rs.destination_esr_code
      )::int as at_destination_count,
      rs.monitoring_state,
      rs.completed_at,
      rs.completed_by
    from route_scope rs
    left join current_positions cp on cp.deal_key=rs.deal_key
    group by
      rs.deal_key,
      rs.deal_id,
      rs.destination_esr_code,
      rs.monitoring_state,
      rs.completed_at,
      rs.completed_by
  ),
  projected as (
    select
      deal_key,
      deal_id,
      destination_esr_code,
      wagon_count,
      trusted_count,
      at_destination_count,
      wagon_count-trusted_count as unresolved_count,
      monitoring_state,
      completed_at,
      completed_by,
      (
        monitoring_state<>'COMPLETED'
        and destination_esr_code is not null
        and wagon_count>0
        and wagon_count=trusted_count
        and wagon_count=at_destination_count
      ) as completion_ready
    from aggregated
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

comment on function public.rona_admin_rail_monitoring_lifecycle_v1() is
  'Admin Online Rail monitoring lifecycle V1. Performance-hardened to materialize the Rail authoritative current-position projection once per request.';
