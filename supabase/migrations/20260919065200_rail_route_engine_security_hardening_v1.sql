begin;

create or replace function portal_private.rona_admin_rail_deal_map_read_model_v4(p_deal_id text default null)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,portal_private
as $fn$
declare v_actor uuid; v_base jsonb; v_deals jsonb:='[]'::jsonb; v_deal jsonb; v_assignment record; v_progress jsonb; v_planned jsonb;
begin
  v_actor:=portal_private.owner_r1_actor('ADMIN');
  v_base:=public.rona_admin_rail_deal_map_read_model_v2(p_deal_id);

  for v_deal in select value from jsonb_array_elements(coalesce(v_base->'deals','[]'::jsonb)) loop
    select a.* into v_assignment from portal_private.rail_deal_route_assignments_v1 a
    where a.deal_key=nullif(v_deal->>'dealKey','')::uuid;

    if v_assignment.deal_key is not null and v_assignment.resolution_state='RESOLVED' then
      v_progress:=portal_private.rail_deal_route_progress_v1(v_assignment.deal_key);
      v_planned:=jsonb_build_array(jsonb_build_object(
        'railDocumentKey',null,'railDocumentId',null,'gu12Number',null,
        'routeMode','PUBLIC_SOURCE_RESOLVED',
        'points',coalesce((select jsonb_agg(p order by (p->>'sequence')::int) from jsonb_array_elements(v_assignment.route_nodes) p where p->>'lat' is not null and p->>'lng' is not null),'[]'::jsonb),
        'geometry',null,'status','PUBLIC_SOURCE_ROUTE_RESOLVED',
        'provenance',jsonb_build_object('routeSource','PUBLIC_SOURCE_GRAPH_V1','geometryPolicy','STATION_SEQUENCE_POLYLINE','sourceRefs',v_assignment.route_source_refs)
      ));
      v_deal:=jsonb_set(v_deal,'{plannedRoute}',v_planned,true);
      v_deal:=jsonb_set(v_deal,'{actualRoute}',jsonb_build_object('status','OBSERVED_HISTORY','points',coalesce(v_progress->'actualPoints','[]'::jsonb)),true);
      v_deal:=jsonb_set(v_deal,'{remainingRoute}',jsonb_build_object('status','ROUTE_REMAINDER','points',coalesce(v_progress->'remainingPoints','[]'::jsonb)),true);
      v_deal:=jsonb_set(v_deal,'{routeProgress}',v_progress,true);
      v_deal:=jsonb_set(v_deal,'{routeStations}',v_assignment.route_nodes,true);
      v_deal:=jsonb_set(v_deal,'{routeAssignment}',jsonb_build_object(
        'resolutionState',v_assignment.resolution_state,'originEsr',v_assignment.origin_esr_code,'destinationEsr',v_assignment.destination_esr_code,
        'originAuthority',v_assignment.origin_authority,'destinationAuthority',v_assignment.destination_authority,
        'routeHopCount',v_assignment.route_hop_count,'resolvedAt',v_assignment.resolved_at,'refreshedAt',v_assignment.refreshed_at
      ),true);
    elsif v_assignment.deal_key is not null then
      v_deal:=jsonb_set(v_deal,'{routeAssignment}',jsonb_build_object(
        'resolutionState',v_assignment.resolution_state,'originEsr',v_assignment.origin_esr_code,'destinationEsr',v_assignment.destination_esr_code,
        'originAuthority',v_assignment.origin_authority,'destinationAuthority',v_assignment.destination_authority,'refreshedAt',v_assignment.refreshed_at
      ),true);
    end if;
    v_deals:=v_deals||jsonb_build_array(v_deal);
  end loop;

  v_base:=jsonb_set(v_base,'{deals}',v_deals,true);
  v_base:=jsonb_set(v_base,'{modelVersion}',to_jsonb('RONA_ADMIN_RAIL_DEAL_MAP_READ_MODEL_V4'::text),true);
  v_base:=jsonb_set(v_base,'{sourcePolicy}',to_jsonb('PUBLIC_SOURCE_ROUTE_GRAPH_PLUS_TRUSTED_DISLOCATION_HISTORY_V1'::text),true);
  return v_base;
end
$fn$;


revoke all on function portal_private.rona_admin_rail_deal_map_read_model_v4(text)
from public,anon;
grant execute on function portal_private.rona_admin_rail_deal_map_read_model_v4(text)
to authenticated,service_role;

create or replace function public.rona_admin_rail_deal_map_read_model_v4(p_deal_id text default null)
returns jsonb
language plpgsql
security invoker
set search_path=pg_catalog,public,portal_private
as $wrapper$
declare
  v_actor uuid;
begin
  v_actor:=portal_private.owner_r1_actor('ADMIN');
  return portal_private.rona_admin_rail_deal_map_read_model_v4(p_deal_id);
end
$wrapper$;

revoke all on function public.rona_admin_rail_deal_map_read_model_v4(text)
from public,anon;
grant execute on function public.rona_admin_rail_deal_map_read_model_v4(text)
to authenticated,service_role;

create index if not exists rail_route_edges_v1_to_esr_idx
  on portal_private.rail_route_edges_v1(to_esr_code)
  where authority_state='CONFIRMED';

create index if not exists rail_station_aliases_v1_esr_idx
  on portal_private.rail_station_aliases_v1(esr_code)
  where authority_state='CONFIRMED';

create index if not exists rail_deal_route_assignments_v1_origin_idx
  on portal_private.rail_deal_route_assignments_v1(origin_esr_code);

create index if not exists rail_deal_route_assignments_v1_destination_idx
  on portal_private.rail_deal_route_assignments_v1(destination_esr_code);

commit;
