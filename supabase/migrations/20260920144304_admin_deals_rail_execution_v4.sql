-- Admin Deals Rail Execution V4.
-- Read-only shadow projection over canonical Rail current-position evidence.
-- Stable Deals V3 commercial, Finance, document and readiness semantics are preserved by owner_deals_current_v4().
-- No business, Finance, payment, document or Rail mutation.

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

  with scoped_deals as (
    select d.id as deal_key,d.deal_id,d.updated_at
    from portal_private.deals d
    where p_deal_id is null or d.deal_id=p_deal_id
  ),
  doc_stats as (
    select
      sd.deal_key,
      count(rd.*)::int as gu12_count,
      max(rd.updated_at) as gu12_updated_at,
      coalesce(jsonb_agg(
        jsonb_build_object(
          'railDocumentKey',rd.id,
          'railDocumentId',rd.rail_document_id,
          'gu12Number',rd.gu12_number,
          'documentNumber',rd.document_number,
          'documentDate',rd.document_date,
          'routeText',rd.route_text,
          'updatedAt',rd.updated_at,
          'provenance',jsonb_build_object(
            'sourceSystem',rd.source_system,
            'sourceVersion',rd.source_version,
            'sourceTimestamp',rd.source_timestamp,
            'importBatchId',rd.import_batch_id
          ),
          'trustedWagonCount',(
            select count(*)::int
            from portal_private.rail_xlsx_dislocation_current_position_v1 cp
            where cp.effective_deal_key=sd.deal_key
              and cp.current_rail_document_key=rd.id
              and cp.position_status='TRUSTED'
          ),
          'wagons',coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'wagonNumber',cp.wagon_number,
                'station',cp.current_station_name,
                'stationCode',cp.current_station_code,
                'operation',cp.current_operation,
                'eventTimestamp',cp.current_event_at,
                'eventAtLocal',cp.current_event_at_local,
                'rawTimestamp',cp.current_raw_timestamp,
                'sourceTimezone',cp.current_source_timezone,
                'sourceTimezoneStatus',cp.current_source_timezone_status,
                'sourceTimeDomain',cp.current_source_time_domain,
                'positionStatus',cp.position_status,
                'effectiveResolutionStatus',cp.effective_resolution_status,
                'sourcePolicy',cp.source_policy,
                'sourceVersion',cp.source_version_snapshot,
                'sourceReceivedAt',cp.source_received_at
              )
              order by cp.wagon_number
            )
            from portal_private.rail_xlsx_dislocation_current_position_v1 cp
            where cp.effective_deal_key=sd.deal_key
              and cp.current_rail_document_key=rd.id
              and cp.position_status='TRUSTED'
          ),'[]'::jsonb)
        )
        order by rd.updated_at desc,rd.rail_document_id
      ) filter (where rd.id is not null),'[]'::jsonb) as gu12_documents
    from scoped_deals sd
    left join portal_private.rail_documents rd
      on rd.deal_key=sd.deal_key
     and upper(rd.document_type)='GU-12'
     and rd.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
    group by sd.deal_key
  ),
  pos_stats as (
    select
      sd.deal_key,
      count(cp.*) filter (where cp.position_status='TRUSTED')::int as trusted_wagon_count,
      max(cp.source_received_at) filter (where cp.position_status='TRUSTED') as position_source_received_at,
      coalesce(array_agg(distinct cp.source_policy) filter (
        where cp.position_status='TRUSTED' and cp.source_policy is not null
      ),array[]::text[]) as position_source_policies,
      coalesce(array_agg(distinct cp.source_version_snapshot) filter (
        where cp.position_status='TRUSTED' and cp.source_version_snapshot is not null
      ),array[]::text[]) as position_source_versions,
      coalesce(array_agg(distinct cp.current_source_timezone_status) filter (
        where cp.position_status='TRUSTED' and cp.current_source_timezone_status is not null
      ),array[]::text[]) as source_timezone_statuses
    from scoped_deals sd
    left join portal_private.rail_xlsx_dislocation_current_position_v1 cp
      on cp.effective_deal_key=sd.deal_key
    group by sd.deal_key
  ),
  audit_stats as (
    select
      sd.deal_key,
      (
        select count(distinct q.wagon_number)::int
        from (
          select cp.wagon_number
          from portal_private.rail_xlsx_dislocation_current_position_v1 cp
          where cp.effective_deal_key=sd.deal_key
            and cp.position_status='CROSS_DOMAIN_AMBIGUOUS'
          union all
          select a.wagon_number
          from portal_private.rail_xlsx_dislocation_current_audit_v1 a
          where a.effective_deal_key=sd.deal_key
            and a.candidate_position_status in ('TO_VERIFY','UNRESOLVED','CONFLICT')
        ) q
      ) as unresolved_or_conflict_count,
      coalesce((
        select jsonb_agg(v.wagon_number order by v.wagon_number)
        from (
          select distinct q.wagon_number
          from (
            select cp.wagon_number
            from portal_private.rail_xlsx_dislocation_current_position_v1 cp
            where cp.effective_deal_key=sd.deal_key
              and cp.position_status='CROSS_DOMAIN_AMBIGUOUS'
            union all
            select a.wagon_number
            from portal_private.rail_xlsx_dislocation_current_audit_v1 a
            where a.effective_deal_key=sd.deal_key
              and a.candidate_position_status in ('TO_VERIFY','UNRESOLVED','CONFLICT')
          ) q
        ) v
      ),'[]'::jsonb) as verification_wagons
    from scoped_deals sd
  ),
  rail_rows as (
    select
      sd.deal_id,
      case
        when coalesce(ps.trusted_wagon_count,0)>0 then 'WAGONS_ACTIVE'
        when coalesce(au.unresolved_or_conflict_count,0)>0 then 'POSITION_VERIFICATION_REQUIRED'
        when coalesce(ds.gu12_count,0)>0 then 'GU12_REGISTERED'
        when upper(coalesce(ra.resolution_state,''))='RESOLVED' then 'ROUTE_RESOLVED'
        when ra.deal_key is not null then 'ROUTE_PENDING'
        else 'NOT_STARTED'
      end as rail_state,
      case
        when coalesce(ps.trusted_wagon_count,0)>0
         and coalesce(au.unresolved_or_conflict_count,0)>0 then 'TRUSTED_WITH_VERIFICATION'
        when coalesce(ps.trusted_wagon_count,0)>0 then 'TRUSTED_CURRENT_POSITIONS'
        when coalesce(au.unresolved_or_conflict_count,0)>0 then 'VERIFICATION_REQUIRED'
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
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'wagonNumber',cp.wagon_number,
            'railDocumentKey',cp.current_rail_document_key,
            'railDocumentId',coalesce(cp.current_rail_document_id,rd.rail_document_id),
            'gu12Number',coalesce(cp.current_gu12_number,rd.gu12_number),
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
            'effectiveResolutionStatus',cp.effective_resolution_status,
            'sourcePolicy',cp.source_policy,
            'sourceVersion',cp.source_version_snapshot,
            'sourceReceivedAt',cp.source_received_at,
            'provenance',jsonb_build_object(
              'sourceObjectId',cp.source_object_id,
              'importBatchId',cp.import_batch_id,
              'sourceChecksumSha256',cp.source_checksum_sha256,
              'sourceSheetName',cp.source_sheet_name,
              'sourceRowNumber',cp.source_row_number,
              'sourceRowLocator',cp.source_row_locator,
              'sourceRowFingerprint',cp.source_row_fingerprint,
              'semanticFingerprint',cp.semantic_fingerprint,
              'resolutionDecisionId',cp.resolution_decision_id,
              'resolutionAuthorityType',cp.resolution_authority_type,
              'resolutionActorRef',cp.resolution_actor_ref
            )
          )
          order by cp.wagon_number
        )
        from portal_private.rail_xlsx_dislocation_current_position_v1 cp
        left join portal_private.rail_documents rd on rd.id=cp.current_rail_document_key
        where cp.effective_deal_key=sd.deal_key
          and cp.position_status='TRUSTED'
      ),'[]'::jsonb) as wagon_positions,
      coalesce((
        select jsonb_agg(g.payload order by g.station_code nulls last,g.station_name)
        from (
          select
            max(cp.current_station_code) as station_code,
            max(cp.current_station_name) as station_name,
            jsonb_build_object(
              'clusterKey',case
                when cp.current_station_code is not null
                  then 'ESR:'||upper(btrim(cp.current_station_code))
                else 'STATION:'||lower(regexp_replace(btrim(cp.current_station_name),'\s+',' ','g'))
              end,
              'station',max(cp.current_station_name),
              'stationCode',max(cp.current_station_code),
              'wagonCount',count(*)::int,
              'wagonNumbers',jsonb_agg(cp.wagon_number order by cp.wagon_number),
              'operationCodes',to_jsonb(coalesce(
                array_agg(distinct cp.current_operation) filter (where cp.current_operation is not null),
                array[]::text[]
              )),
              'eventTimestamp',max(cp.current_event_at),
              'eventAtLocal',max(cp.current_event_at_local),
              'sourceTimezoneStatuses',to_jsonb(coalesce(
                array_agg(distinct cp.current_source_timezone_status)
                  filter (where cp.current_source_timezone_status is not null),
                array[]::text[]
              )),
              'sourceReceivedAt',max(cp.source_received_at)
            ) as payload
          from portal_private.rail_xlsx_dislocation_current_position_v1 cp
          where cp.effective_deal_key=sd.deal_key
            and cp.position_status='TRUSTED'
            and cp.current_station_name is not null
          group by case
            when cp.current_station_code is not null
              then 'ESR:'||upper(btrim(cp.current_station_code))
            else 'STATION:'||lower(regexp_replace(btrim(cp.current_station_name),'\s+',' ','g'))
          end
        ) g
      ),'[]'::jsonb) as position_groups,
      coalesce(au.unresolved_or_conflict_count,0) as unresolved_or_conflict_count,
      coalesce(au.verification_wagons,'[]'::jsonb) as verification_wagons,
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
    left join pos_stats ps on ps.deal_key=sd.deal_key
    left join audit_stats au on au.deal_key=sd.deal_key
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
;

revoke all on function public.owner_deals_rail_execution_v4(text) from public;
revoke all on function public.owner_deals_rail_execution_v4(text) from anon;
grant execute on function public.owner_deals_rail_execution_v4(text) to authenticated;
grant execute on function public.owner_deals_rail_execution_v4(text) to service_role;

comment on function public.owner_deals_rail_execution_v4(text) is
  'Read-only Admin Deals Rail Execution V4. Route/GU-12 authority stays canonical; current wagon execution is sourced from trusted XLSX current-position/audit views. Missing source is not treated as factual zero wagons.';

CREATE OR REPLACE FUNCTION public.owner_deals_current_v4()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'portal_private', 'auth'
AS $function$
declare
  v_base jsonb;
  v_rail jsonb;
begin
  v_base := public.owner_deals_current_v3();
  v_rail := public.owner_deals_rail_execution_v4(null);

  return
    (v_base - 'rail' - 'readModelVersion' - 'generatedAt')
    || jsonb_build_object(
      'readModelVersion','ADMIN_DEALS_CURRENT_V4',
      'railExecutionVersion',v_rail->>'readModelVersion',
      'generatedAt',now(),
      'rail',coalesce(v_rail->'rail','[]'::jsonb)
    );
end
$function$
;

revoke all on function public.owner_deals_current_v4() from public;
revoke all on function public.owner_deals_current_v4() from anon;
grant execute on function public.owner_deals_current_v4() to authenticated;
grant execute on function public.owner_deals_current_v4() to service_role;

comment on function public.owner_deals_current_v4() is
  'Read-only Admin Deals V4 compatibility projection: V3 commercial/Finance/document/readiness payload preserved verbatim, Rail replaced by Deals Rail Execution V4.';
