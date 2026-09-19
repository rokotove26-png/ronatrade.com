begin;

-- #670: shared server-only Rail read-model core.
-- Admin V4 keeps its ADMIN gate. Client code may reach this core only after
-- explicit server-side client/contract/deal authorization.
create or replace function portal_private.rona_rail_deal_map_read_model_core_v1(
  p_deal_key uuid default null,
  p_deal_id text default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path=pg_catalog,portal_private
as $fn$
declare
  v_result jsonb;
  v_deals jsonb:='[]'::jsonb;
  v_deal jsonb;
  v_assignment record;
  v_progress jsonb;
  v_planned jsonb;
begin
  with scoped_deals as (
    select d.id as deal_key,d.deal_id
    from portal_private.deals d
    where d.lifecycle_state::text='ACTIVE'
      and (p_deal_key is null or d.id=p_deal_key)
      and (p_deal_id is null or d.deal_id=p_deal_id)
  ),
  deal_docs as (
    select
      sd.deal_key,sd.deal_id,
      rd.id as rail_document_key,
      rd.rail_document_id,
      rd.gu12_number,
      rd.document_number,
      rd.document_date,
      rd.route_text,
      rd.source_system,
      rd.source_version,
      rd.source_timestamp,
      rd.import_batch_id
    from scoped_deals sd
    join portal_private.rail_documents rd
      on rd.deal_key=sd.deal_key
     and rd.lifecycle_state::text='ACTIVE'
  ),
  current_positions as (
    select cp.*
    from portal_private.rail_xlsx_dislocation_current_position_v1 cp
    join scoped_deals sd on sd.deal_key=cp.effective_deal_key
  )
  select jsonb_build_object(
    'modelVersion','RONA_ADMIN_RAIL_DEAL_MAP_READ_MODEL_V2',
    'selectionOwner','DEAL',
    'selectionKey','deal_key',
    'sourcePolicy','EXPEDITOR_XLSX_WITH_TRUSTED_STATION_GEO',
    'generatedAt',now(),
    'deals',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'dealKey',sd.deal_key,
          'dealId',sd.deal_id,
          'railDocuments',coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'railDocumentKey',dd.rail_document_key,
                'railDocumentId',dd.rail_document_id,
                'gu12Number',dd.gu12_number,
                'documentNumber',dd.document_number,
                'documentDate',dd.document_date,
                'routeText',dd.route_text
              )
              order by dd.document_date nulls last,dd.rail_document_id
            )
            from deal_docs dd
            where dd.deal_key=sd.deal_key
          ),'[]'::jsonb),
          'plannedRoute',coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'railDocumentKey',dd.rail_document_key,
                'railDocumentId',dd.rail_document_id,
                'gu12Number',dd.gu12_number,
                'routeText',dd.route_text,
                'points',coalesce((
                  select jsonb_agg(
                    jsonb_build_object(
                      'lat',g.latitude,
                      'lng',g.longitude,
                      'station',g.canonical_station_name,
                      'stationCode',g.esr_code,
                      'trusted',true,
                      'trust','CONFIRMED',
                      'provenance',jsonb_build_object(
                        'sourceSystem',g.source_system,
                        'sourceUrl',g.source_url,
                        'corroborationRefs',g.corroboration_refs,
                        'identityBasis','ESR_CODE'
                      )
                    )
                    order by m.ord
                  )
                  from regexp_matches(coalesce(dd.route_text,''),'([0-9]{6})','g')
                       with ordinality as m(captures,ord)
                  join portal_private.rail_station_geo_directory_v1 g
                    on g.esr_code=m.captures[1]
                   and g.authority_state='CONFIRMED'
                ),'[]'::jsonb),
                'geometry',null,
                'status',case
                  when dd.route_text is null then 'SOURCE_NOT_AVAILABLE'
                  when (
                    select count(*)
                    from regexp_matches(coalesce(dd.route_text,''),'([0-9]{6})','g')
                         with ordinality as m(captures,ord)
                    join portal_private.rail_station_geo_directory_v1 g
                      on g.esr_code=m.captures[1]
                     and g.authority_state='CONFIRMED'
                  ) >= 2 then 'TRUSTED_STATION_POINTS'
                  when (
                    select count(*)
                    from regexp_matches(coalesce(dd.route_text,''),'([0-9]{6})','g')
                         with ordinality as m(captures,ord)
                    join portal_private.rail_station_geo_directory_v1 g
                      on g.esr_code=m.captures[1]
                     and g.authority_state='CONFIRMED'
                  ) = 1 then 'TRUSTED_STATION_POINT_PARTIAL'
                  else 'TEXT_ONLY_GEO_UNRESOLVED'
                end,
                'provenance',jsonb_build_object(
                  'routeSource','RAIL_DOCUMENT_ROUTE_TEXT',
                  'coordinateSource','RAIL_STATION_GEO_DIRECTORY_V1',
                  'geometryPolicy','NO_SYNTHETIC_RAIL_GEOMETRY'
                )
              )
              order by dd.document_date nulls last,dd.rail_document_id
            )
            from deal_docs dd
            where dd.deal_key=sd.deal_key
          ),'[]'::jsonb),
          'wagonPositions',coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'wagonNumber',cp.wagon_number,
                'railDocumentKey',cp.current_rail_document_key,
                'railDocumentId',rd.rail_document_id,
                'gu12Number',rd.gu12_number,
                'station',cp.current_station_name,
                'stationCode',cp.current_station_code,
                'operation',cp.current_operation,
                'eventTimestamp',cp.current_event_at,
                'eventAtLocal',cp.current_event_at_local,
                'rawTimestamp',cp.current_raw_timestamp,
                'sourceTimezone',cp.current_source_timezone,
                'sourceTimezoneStatus',cp.current_source_timezone_status,
                'sourceTimeDomain',cp.current_source_time_domain,
                'comparisonDomain',cp.current_comparison_domain,
                'positionStatus',cp.position_status,
                'comparisonDomainCount',cp.comparison_domain_count,
                'candidateObservationCount',cp.candidate_observation_count,
                'effectiveResolutionStatus',cp.effective_resolution_status,
                'resolutionDecisionId',cp.resolution_decision_id,
                'trustedCoordinates',case
                  when cp.position_status='TRUSTED' and g.id is not null then
                    jsonb_build_object(
                      'lat',g.latitude,
                      'lng',g.longitude,
                      'trusted',true,
                      'trust','CONFIRMED',
                      'stationCode',g.esr_code,
                      'canonicalStationName',g.canonical_station_name,
                      'provenance',jsonb_build_object(
                        'sourceSystem',g.source_system,
                        'sourceUrl',g.source_url,
                        'corroborationRefs',g.corroboration_refs,
                        'identityBasis','ESR_CODE'
                      )
                    )
                  else null
                end,
                'coordinateProvenance',case
                  when g.id is not null then jsonb_build_object(
                    'directory','RAIL_STATION_GEO_DIRECTORY_V1',
                    'stationCode',g.esr_code,
                    'sourceSystem',g.source_system,
                    'sourceUrl',g.source_url,
                    'corroborationRefs',g.corroboration_refs
                  )
                  else null
                end,
                'provenance',case
                  when cp.current_event_id is null then null
                  else jsonb_build_object(
                    'sourcePolicy',cp.source_policy,
                    'sourceContractVersion',cp.source_contract_version,
                    'sourceSystem',cp.source_system_snapshot,
                    'sourceObjectType',cp.source_object_type_snapshot,
                    'sourceVersion',cp.source_version_snapshot,
                    'eventId',cp.current_event_id,
                    'sourceObjectId',cp.source_object_id,
                    'importBatchId',cp.import_batch_id,
                    'sourceChecksumSha256',cp.source_checksum_sha256,
                    'sourceSheetName',cp.source_sheet_name,
                    'sourceRowNumber',cp.source_row_number,
                    'sourceRowLocator',cp.source_row_locator,
                    'sourceRowFingerprint',cp.source_row_fingerprint,
                    'semanticFingerprint',cp.semantic_fingerprint,
                    'sourceReceivedAt',cp.source_received_at,
                    'resolutionAuthorityType',cp.resolution_authority_type,
                    'resolutionActorRef',cp.resolution_actor_ref,
                    'sourceProvenance',cp.source_provenance
                  )
                end
              )
              order by cp.wagon_number
            )
            from current_positions cp
            left join portal_private.rail_documents rd
              on rd.id=cp.current_rail_document_key
            left join portal_private.rail_station_geo_directory_v1 g
              on g.esr_code=cp.current_station_code
             and g.authority_state='CONFIRMED'
            where cp.effective_deal_key=sd.deal_key
          ),'[]'::jsonb),
          'positionGroups',coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'clusterKey',q.cluster_key,
                'station',q.station_name,
                'stationCode',q.station_code,
                'wagonCount',q.wagon_count,
                'wagonNumbers',q.wagon_numbers,
                'eventTimestamp',q.event_timestamp,
                'eventAtLocal',q.event_at_local,
                'trustedCoordinates',case
                  when g.id is not null then jsonb_build_object(
                    'lat',g.latitude,
                    'lng',g.longitude,
                    'trusted',true,
                    'trust','CONFIRMED',
                    'stationCode',g.esr_code,
                    'canonicalStationName',g.canonical_station_name
                  )
                  else null
                end,
                'coordinateProvenance',case
                  when g.id is not null then jsonb_build_object(
                    'directory','RAIL_STATION_GEO_DIRECTORY_V1',
                    'sourceSystem',g.source_system,
                    'sourceUrl',g.source_url,
                    'corroborationRefs',g.corroboration_refs
                  )
                  else null
                end
              )
              order by q.station_code nulls last,q.station_name
            )
            from (
              select
                case
                  when cp.current_station_code is not null
                    then 'ESR:'||upper(btrim(cp.current_station_code))
                  else 'STATION:'||lower(regexp_replace(btrim(cp.current_station_name),'\s+',' ','g'))
                end as cluster_key,
                max(cp.current_station_name) as station_name,
                max(cp.current_station_code) as station_code,
                count(*) as wagon_count,
                jsonb_agg(cp.wagon_number order by cp.wagon_number) as wagon_numbers,
                max(cp.current_event_at) as event_timestamp,
                max(cp.current_event_at_local) as event_at_local
              from current_positions cp
              where cp.effective_deal_key=sd.deal_key
                and cp.position_status='TRUSTED'
                and cp.current_station_name is not null
              group by case
                when cp.current_station_code is not null
                  then 'ESR:'||upper(btrim(cp.current_station_code))
                else 'STATION:'||lower(regexp_replace(btrim(cp.current_station_name),'\s+',' ','g'))
              end
            ) q
            left join portal_private.rail_station_geo_directory_v1 g
              on g.esr_code=q.station_code
             and g.authority_state='CONFIRMED'
          ),'[]'::jsonb),
          'unresolvedOrConflictCount',(
            select count(*)
            from current_positions cp
            where cp.effective_deal_key=sd.deal_key
              and cp.position_status<>'TRUSTED'
          )
        )
        order by sd.deal_id
      )
      from scoped_deals sd
    ),'[]'::jsonb)
  )
  into v_result;

  for v_deal in
    select value from jsonb_array_elements(coalesce(v_result->'deals','[]'::jsonb))
  loop
    v_assignment:=null;
    select a.* into v_assignment
    from portal_private.rail_deal_route_assignments_v1 a
    where a.deal_key=nullif(v_deal->>'dealKey','')::uuid;

    if v_assignment.deal_key is not null and v_assignment.resolution_state='RESOLVED' then
      v_progress:=portal_private.rail_deal_route_progress_v1(v_assignment.deal_key);
      v_planned:=jsonb_build_array(jsonb_build_object(
        'railDocumentKey',null,
        'railDocumentId',null,
        'gu12Number',null,
        'routeMode','PUBLIC_SOURCE_RESOLVED',
        'points',coalesce((
          select jsonb_agg(p order by (p->>'sequence')::int)
          from jsonb_array_elements(v_assignment.route_nodes) p
          where p->>'lat' is not null and p->>'lng' is not null
        ),'[]'::jsonb),
        'geometry',null,
        'status','PUBLIC_SOURCE_ROUTE_RESOLVED',
        'provenance',jsonb_build_object(
          'routeSource','PUBLIC_SOURCE_GRAPH_V1',
          'geometryPolicy','STATION_SEQUENCE_POLYLINE',
          'sourceRefs',v_assignment.route_source_refs
        )
      ));
      v_deal:=jsonb_set(v_deal,'{plannedRoute}',v_planned,true);
      v_deal:=jsonb_set(v_deal,'{actualRoute}',jsonb_build_object(
        'status','OBSERVED_HISTORY',
        'points',coalesce(v_progress->'actualPoints','[]'::jsonb)
      ),true);
      v_deal:=jsonb_set(v_deal,'{remainingRoute}',jsonb_build_object(
        'status','ROUTE_REMAINDER',
        'points',coalesce(v_progress->'remainingPoints','[]'::jsonb)
      ),true);
      v_deal:=jsonb_set(v_deal,'{routeProgress}',v_progress,true);
      v_deal:=jsonb_set(v_deal,'{routeStations}',v_assignment.route_nodes,true);
      v_deal:=jsonb_set(v_deal,'{routeAssignment}',jsonb_build_object(
        'resolutionState',v_assignment.resolution_state,
        'originEsr',v_assignment.origin_esr_code,
        'destinationEsr',v_assignment.destination_esr_code,
        'originAuthority',v_assignment.origin_authority,
        'destinationAuthority',v_assignment.destination_authority,
        'routeHopCount',v_assignment.route_hop_count,
        'resolvedAt',v_assignment.resolved_at,
        'refreshedAt',v_assignment.refreshed_at
      ),true);
    elsif v_assignment.deal_key is not null then
      v_deal:=jsonb_set(v_deal,'{routeAssignment}',jsonb_build_object(
        'resolutionState',v_assignment.resolution_state,
        'originEsr',v_assignment.origin_esr_code,
        'destinationEsr',v_assignment.destination_esr_code,
        'originAuthority',v_assignment.origin_authority,
        'destinationAuthority',v_assignment.destination_authority,
        'refreshedAt',v_assignment.refreshed_at
      ),true);
    end if;
    v_deals:=v_deals||jsonb_build_array(v_deal);
  end loop;

  v_result:=jsonb_set(v_result,'{deals}',v_deals,true);
  v_result:=jsonb_set(v_result,'{modelVersion}',to_jsonb('RONA_ADMIN_RAIL_DEAL_MAP_READ_MODEL_V4'::text),true);
  v_result:=jsonb_set(v_result,'{sourcePolicy}',to_jsonb('PUBLIC_SOURCE_ROUTE_GRAPH_PLUS_TRUSTED_DISLOCATION_HISTORY_V1'::text),true);
  return v_result;
end
$fn$;

revoke all on function portal_private.rona_rail_deal_map_read_model_core_v1(uuid,text)
from public,anon,authenticated;
grant execute on function portal_private.rona_rail_deal_map_read_model_core_v1(uuid,text)
to service_role;

comment on function portal_private.rona_rail_deal_map_read_model_core_v1(uuid,text)
is 'Server-only canonical Rail V4 generation core. Contains no browser/client authority decision. Callers must authorize scope first.';

-- Preserve Admin authority: both canonical Admin V4 entry points retain the
-- existing owner_r1_actor('ADMIN') gate and only delegate generation.
create or replace function portal_private.rona_admin_rail_deal_map_read_model_v4(p_deal_id text default null)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,portal_private
as $fn$
declare v_actor uuid;
begin
  v_actor:=portal_private.owner_r1_actor('ADMIN');
  return portal_private.rona_rail_deal_map_read_model_core_v1(null::uuid,p_deal_id);
end
$fn$;

create or replace function public.rona_admin_rail_deal_map_read_model_v4(p_deal_id text default null)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,portal_private
as $fn$
declare v_actor uuid;
begin
  v_actor:=portal_private.owner_r1_actor('ADMIN');
  return portal_private.rona_rail_deal_map_read_model_core_v1(null::uuid,p_deal_id);
end
$fn$;

revoke all on function portal_private.rona_admin_rail_deal_map_read_model_v4(text)
from public,anon;
grant execute on function portal_private.rona_admin_rail_deal_map_read_model_v4(text)
to authenticated,service_role;

revoke all on function public.rona_admin_rail_deal_map_read_model_v4(text)
from public,anon;
grant execute on function public.rona_admin_rail_deal_map_read_model_v4(text)
to authenticated,service_role;

commit;
