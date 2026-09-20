-- Admin Deals Rail Execution V4 timeout hardening.
-- Root cause: the first V4 implementation re-expanded the canonical XLSX current-position
-- and audit views multiple times per deal. Under concurrent production load the authenticated
-- PostgREST 8s statement timeout could be exceeded.
-- Fix: materialize canonical position/audit sets once per request and aggregate from them.
-- Read-only; no business, Finance, payment, document, Rail fact, shell or Client LK mutation.

CREATE OR REPLACE FUNCTION public.owner_deals_rail_execution_v4(p_deal_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'portal_private', 'auth'
AS $function$
declare
  v_actor uuid;
  v_out jsonb;
begin
  v_actor := portal_private.owner_r1_actor('ADMIN');

  with
  scoped_deals as materialized (
    select d.id as deal_key,d.deal_id,d.updated_at
    from portal_private.deals d
    where p_deal_id is null or d.deal_id=p_deal_id
  ),
  current_positions as materialized (
    select cp.*
    from portal_private.rail_xlsx_dislocation_current_position_v1 cp
    join scoped_deals sd on sd.deal_key=cp.effective_deal_key
  ),
  current_audit as materialized (
    select a.*
    from portal_private.rail_xlsx_dislocation_current_audit_v1 a
    join scoped_deals sd on sd.deal_key=a.effective_deal_key
  ),
  trusted_positions as materialized (
    select cp.*
    from current_positions cp
    where cp.position_status='TRUSTED'
  ),
  wagons_by_document as (
    select
      tp.effective_deal_key as deal_key,
      tp.current_rail_document_key as rail_document_key,
      count(*)::int as trusted_wagon_count,
      jsonb_agg(
        jsonb_build_object(
          'wagonNumber',tp.wagon_number,
          'station',tp.current_station_name,
          'stationCode',tp.current_station_code,
          'operation',tp.current_operation,
          'eventTimestamp',tp.current_event_at,
          'eventAtLocal',tp.current_event_at_local,
          'rawTimestamp',tp.current_raw_timestamp,
          'sourceTimezone',tp.current_source_timezone,
          'sourceTimezoneStatus',tp.current_source_timezone_status,
          'sourceTimeDomain',tp.current_source_time_domain,
          'positionStatus',tp.position_status,
          'effectiveResolutionStatus',tp.effective_resolution_status,
          'sourcePolicy',tp.source_policy,
          'sourceVersion',tp.source_version_snapshot,
          'sourceReceivedAt',tp.source_received_at
        )
        order by tp.wagon_number
      ) as wagons
    from trusted_positions tp
    group by tp.effective_deal_key,tp.current_rail_document_key
  ),
  deal_docs as (
    select
      sd.deal_key,
      rd.id as rail_document_key,
      rd.rail_document_id,
      rd.gu12_number,
      rd.document_number,
      rd.document_date,
      rd.route_text,
      rd.updated_at,
      rd.source_system,
      rd.source_version,
      rd.source_timestamp,
      rd.import_batch_id,
      coalesce(wbd.trusted_wagon_count,0) as trusted_wagon_count,
      coalesce(wbd.wagons,'[]'::jsonb) as wagons
    from scoped_deals sd
    join portal_private.rail_documents rd
      on rd.deal_key=sd.deal_key
     and upper(rd.document_type)='GU-12'
     and rd.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
    left join wagons_by_document wbd
      on wbd.deal_key=sd.deal_key
     and wbd.rail_document_key=rd.id
  ),
  doc_stats as (
    select
      sd.deal_key,
      count(dd.rail_document_key)::int as gu12_count,
      max(dd.updated_at) as gu12_updated_at,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'railDocumentKey',dd.rail_document_key,
            'railDocumentId',dd.rail_document_id,
            'gu12Number',dd.gu12_number,
            'documentNumber',dd.document_number,
            'documentDate',dd.document_date,
            'routeText',dd.route_text,
            'updatedAt',dd.updated_at,
            'provenance',jsonb_build_object(
              'sourceSystem',dd.source_system,
              'sourceVersion',dd.source_version,
              'sourceTimestamp',dd.source_timestamp,
              'importBatchId',dd.import_batch_id
            ),
            'trustedWagonCount',dd.trusted_wagon_count,
            'wagons',dd.wagons
          )
          order by dd.updated_at desc,dd.rail_document_id
        ) filter (where dd.rail_document_key is not null),
        '[]'::jsonb
      ) as gu12_documents
    from scoped_deals sd
    left join deal_docs dd on dd.deal_key=sd.deal_key
    group by sd.deal_key
  ),
  position_stats as (
    select
      sd.deal_key,
      count(tp.*)::int as trusted_wagon_count,
      max(tp.source_received_at) as position_source_received_at,
      coalesce(array_agg(distinct tp.source_policy) filter (where tp.source_policy is not null),array[]::text[]) as position_source_policies,
      coalesce(array_agg(distinct tp.source_version_snapshot) filter (where tp.source_version_snapshot is not null),array[]::text[]) as position_source_versions,
      coalesce(array_agg(distinct tp.current_source_timezone_status) filter (where tp.current_source_timezone_status is not null),array[]::text[]) as source_timezone_statuses
    from scoped_deals sd
    left join trusted_positions tp on tp.effective_deal_key=sd.deal_key
    group by sd.deal_key
  ),
  wagon_payload as (
    select
      sd.deal_key,
      coalesce(jsonb_agg(
        jsonb_build_object(
          'wagonNumber',tp.wagon_number,
          'railDocumentKey',tp.current_rail_document_key,
          'railDocumentId',coalesce(tp.current_rail_document_id,rd.rail_document_id),
          'gu12Number',coalesce(tp.current_gu12_number,rd.gu12_number),
          'station',tp.current_station_name,
          'stationCode',tp.current_station_code,
          'operation',tp.current_operation,
          'eventTimestamp',tp.current_event_at,
          'eventAtLocal',tp.current_event_at_local,
          'rawTimestamp',tp.current_raw_timestamp,
          'sourceTimezone',tp.current_source_timezone,
          'sourceTimezoneStatus',tp.current_source_timezone_status,
          'sourceTimeDomain',tp.current_source_time_domain,
          'comparisonDomain',tp.current_comparison_domain,
          'positionStatus',tp.position_status,
          'effectiveResolutionStatus',tp.effective_resolution_status,
          'sourcePolicy',tp.source_policy,
          'sourceVersion',tp.source_version_snapshot,
          'sourceReceivedAt',tp.source_received_at,
          'provenance',jsonb_build_object(
            'sourceObjectId',tp.source_object_id,
            'importBatchId',tp.import_batch_id,
            'sourceChecksumSha256',tp.source_checksum_sha256,
            'sourceSheetName',tp.source_sheet_name,
            'sourceRowNumber',tp.source_row_number,
            'sourceRowLocator',tp.source_row_locator,
            'sourceRowFingerprint',tp.source_row_fingerprint,
            'semanticFingerprint',tp.semantic_fingerprint,
            'resolutionDecisionId',tp.resolution_decision_id,
            'resolutionAuthorityType',tp.resolution_authority_type,
            'resolutionActorRef',tp.resolution_actor_ref
          )
        )
        order by tp.wagon_number
      ) filter (where tp.wagon_number is not null),'[]'::jsonb) as wagon_positions
    from scoped_deals sd
    left join trusted_positions tp on tp.effective_deal_key=sd.deal_key
    left join portal_private.rail_documents rd on rd.id=tp.current_rail_document_key
    group by sd.deal_key
  ),
  position_group_rows as (
    select
      tp.effective_deal_key as deal_key,
      case
        when tp.current_station_code is not null
          then 'ESR:'||upper(btrim(tp.current_station_code))
        else 'STATION:'||lower(regexp_replace(btrim(tp.current_station_name),'\s+',' ','g'))
      end as cluster_key,
      max(tp.current_station_name) as station_name,
      max(tp.current_station_code) as station_code,
      count(*)::int as wagon_count,
      jsonb_agg(tp.wagon_number order by tp.wagon_number) as wagon_numbers,
      to_jsonb(coalesce(array_agg(distinct tp.current_operation) filter (where tp.current_operation is not null),array[]::text[])) as operation_codes,
      max(tp.current_event_at) as event_timestamp,
      max(tp.current_event_at_local) as event_at_local,
      to_jsonb(coalesce(array_agg(distinct tp.current_source_timezone_status) filter (where tp.current_source_timezone_status is not null),array[]::text[])) as source_timezone_statuses,
      max(tp.source_received_at) as source_received_at
    from trusted_positions tp
    where tp.current_station_name is not null
    group by tp.effective_deal_key,
      case
        when tp.current_station_code is not null
          then 'ESR:'||upper(btrim(tp.current_station_code))
        else 'STATION:'||lower(regexp_replace(btrim(tp.current_station_name),'\s+',' ','g'))
      end
  ),
  position_groups as (
    select
      sd.deal_key,
      coalesce(jsonb_agg(
        jsonb_build_object(
          'clusterKey',pgr.cluster_key,
          'station',pgr.station_name,
          'stationCode',pgr.station_code,
          'wagonCount',pgr.wagon_count,
          'wagonNumbers',pgr.wagon_numbers,
          'operationCodes',pgr.operation_codes,
          'eventTimestamp',pgr.event_timestamp,
          'eventAtLocal',pgr.event_at_local,
          'sourceTimezoneStatuses',pgr.source_timezone_statuses,
          'sourceReceivedAt',pgr.source_received_at
        )
        order by pgr.station_code nulls last,pgr.station_name
      ) filter (where pgr.cluster_key is not null),'[]'::jsonb) as position_groups
    from scoped_deals sd
    left join position_group_rows pgr on pgr.deal_key=sd.deal_key
    group by sd.deal_key
  ),
  verification_rows as (
    select cp.effective_deal_key as deal_key,cp.wagon_number
    from current_positions cp
    where cp.position_status='CROSS_DOMAIN_AMBIGUOUS'
    union
    select a.effective_deal_key as deal_key,a.wagon_number
    from current_audit a
    where a.candidate_position_status in ('TO_VERIFY','UNRESOLVED','CONFLICT')
  ),
  audit_stats as (
    select
      sd.deal_key,
      count(vr.wagon_number)::int as unresolved_or_conflict_count,
      coalesce(jsonb_agg(vr.wagon_number order by vr.wagon_number) filter (where vr.wagon_number is not null),'[]'::jsonb) as verification_wagons
    from scoped_deals sd
    left join verification_rows vr on vr.deal_key=sd.deal_key
    group by sd.deal_key
  ),
  rail_rows as (
    select
      sd.deal_id,
      case
        when coalesce(ps.trusted_wagon_count,0)>0 then 'WAGONS_ACTIVE'
        when coalesce(ast.unresolved_or_conflict_count,0)>0 then 'POSITION_VERIFICATION_REQUIRED'
        when coalesce(ds.gu12_count,0)>0 then 'GU12_REGISTERED'
        when upper(coalesce(ra.resolution_state,''))='RESOLVED' then 'ROUTE_RESOLVED'
        when ra.deal_key is not null then 'ROUTE_PENDING'
        else 'NOT_STARTED'
      end as rail_state,
      case
        when coalesce(ps.trusted_wagon_count,0)>0 and coalesce(ast.unresolved_or_conflict_count,0)>0 then 'TRUSTED_WITH_VERIFICATION'
        when coalesce(ps.trusted_wagon_count,0)>0 then 'TRUSTED_CURRENT_POSITIONS'
        when coalesce(ast.unresolved_or_conflict_count,0)>0 then 'VERIFICATION_REQUIRED'
        when coalesce(ds.gu12_count,0)>0 then 'NO_CONFIRMED_POSITION_SOURCE'
        when upper(coalesce(ra.resolution_state,''))='RESOLVED' then 'ROUTE_ONLY'
        when ra.deal_key is not null then 'ROUTE_PENDING'
        else 'NOT_STARTED'
      end as execution_data_state,
      ra.resolution_state as route_resolution_state,
      ra.origin_esr_code,
      ra.destination_esr_code,
      ra.route_hop_count,
      ra.resolved_at as route_resolved_at,
      ra.refreshed_at as route_refreshed_at,
      coalesce(ds.gu12_count,0) as gu12_count,
      coalesce(ps.trusted_wagon_count,0) as trusted_wagon_count,
      coalesce(ps.trusted_wagon_count,0) as wagon_count,
      coalesce(ds.gu12_documents,'[]'::jsonb) as gu12_documents,
      coalesce(wp.wagon_positions,'[]'::jsonb) as wagon_positions,
      coalesce(pg.position_groups,'[]'::jsonb) as position_groups,
      coalesce(ast.unresolved_or_conflict_count,0) as unresolved_or_conflict_count,
      coalesce(ast.verification_wagons,'[]'::jsonb) as verification_wagons,
      ps.position_source_received_at,
      to_jsonb(coalesce(ps.position_source_policies,array[]::text[])) as position_source_policies,
      to_jsonb(coalesce(ps.position_source_versions,array[]::text[])) as position_source_versions,
      to_jsonb(coalesce(ps.source_timezone_statuses,array[]::text[])) as source_timezone_statuses,
      greatest(
        sd.updated_at,
        coalesce(ra.refreshed_at,sd.updated_at),
        coalesce(ds.gu12_updated_at,sd.updated_at),
        coalesce(ps.position_source_received_at,sd.updated_at)
      ) as updated_at
    from scoped_deals sd
    left join portal_private.rail_deal_route_assignments_v1 ra on ra.deal_key=sd.deal_key
    left join doc_stats ds on ds.deal_key=sd.deal_key
    left join position_stats ps on ps.deal_key=sd.deal_key
    left join wagon_payload wp on wp.deal_key=sd.deal_key
    left join position_groups pg on pg.deal_key=sd.deal_key
    left join audit_stats ast on ast.deal_key=sd.deal_key
  )
  select jsonb_build_object(
    'readModelVersion','ADMIN_DEALS_RAIL_EXECUTION_V4',
    'generatedAt',now(),
    'rail',coalesce((
      select jsonb_agg(to_jsonb(r) order by r.updated_at desc,r.deal_id desc)
      from rail_rows r
    ),'[]'::jsonb)
  ) into v_out;

  return v_out;
end
$function$


revoke all on function public.owner_deals_rail_execution_v4(text) from public;
revoke all on function public.owner_deals_rail_execution_v4(text) from anon;
grant execute on function public.owner_deals_rail_execution_v4(text) to authenticated;
grant execute on function public.owner_deals_rail_execution_v4(text) to service_role;

comment on function public.owner_deals_rail_execution_v4(text) is
  'Read-only Admin Deals Rail Execution V4, optimized to materialize canonical XLSX current-position and audit sets once per request before aggregation.';
