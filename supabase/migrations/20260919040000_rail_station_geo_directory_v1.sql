begin;

create table if not exists portal_private.rail_station_geo_directory_v1 (
  id uuid primary key default gen_random_uuid(),
  esr_code text not null unique,
  canonical_station_name text not null,
  aliases text[] not null default '{}'::text[],
  country_code text,
  latitude double precision not null,
  longitude double precision not null,
  authority_state text not null default 'CONFIRMED',
  source_system text not null,
  source_url text not null,
  corroboration_refs jsonb not null default '[]'::jsonb,
  source_retrieved_at timestamptz not null default now(),
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rail_station_geo_esr_ck check (esr_code ~ '^[0-9]{6}$'),
  constraint rail_station_geo_lat_ck check (latitude between -90 and 90),
  constraint rail_station_geo_lng_ck check (longitude between -180 and 180),
  constraint rail_station_geo_authority_ck check (authority_state in ('CONFIRMED','SUPERSEDED'))
);

alter table portal_private.rail_station_geo_directory_v1 enable row level security;

revoke all on table portal_private.rail_station_geo_directory_v1 from public, anon, authenticated;
grant select on table portal_private.rail_station_geo_directory_v1 to service_role;

insert into portal_private.rail_station_geo_directory_v1 (
  esr_code, canonical_station_name, aliases, country_code,
  latitude, longitude, authority_state, source_system, source_url,
  corroboration_refs, source_retrieved_at, provenance
)
values
(
  '625501','Анисовка',array['Анисовка'],'RU',
  51.409244537354,46.0820729,'CONFIRMED','RAILWAYZ_INFO',
  'https://railwayz.info/photolines/station/13666',
  jsonb_build_array(
    jsonb_build_object('sourceSystem','RAILLOGISTIC','url','https://www.raillogistic.ru/stations.php?page=5','latitude',51.4092,'longitude',46.0821)
  ),
  '2026-09-19T00:00:00Z'::timestamptz,
  jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','SOURCE_DIRECTORY','manualGeocoding',false)
),
(
  '156505','Могилев II',array['Могилев I','Могилев II','Могилев 1-на-Днепре'],'BY',
  53.912292480469,30.3077113,'CONFIRMED','RAILWAYZ_INFO',
  'https://railwayz.info/photolines/station/218',
  jsonb_build_array(
    jsonb_build_object('sourceSystem','FREICON','url','https://online.freicon.ru/info/stations/156505','latitude',53.91228485,'longitude',30.30767441)
  ),
  '2026-09-19T00:00:00Z'::timestamptz,
  jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','SOURCE_DIRECTORY','manualGeocoding',false,'note','ESR code is authoritative over source-name aliases')
),
(
  '151408','Барбаров',array['Барбаров','Барбароў'],'BY',
  51.900985717773,29.2730469,'CONFIRMED','RAILWAYZ_INFO',
  'https://railwayz.info/photolines/station/689',
  jsonb_build_array(
    jsonb_build_object('sourceSystem','OPENSTREETMAP_DERIVED_MAPCARTA','url','https://mapcarta.com/N306064714','latitude',51.90099,'longitude',29.27305)
  ),
  '2026-09-19T00:00:00Z'::timestamptz,
  jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','SOURCE_DIRECTORY','manualGeocoding',false)
),
(
  '742705','Киргили',array['Киргили','Qirguli'],'UZ',
  40.437599182129,71.8068342,'CONFIRMED','RAILWAYZ_INFO',
  'https://railwayz.info/photolines/station/20666',
  jsonb_build_array(
    jsonb_build_object('sourceSystem','OPENSTREETMAP_DERIVED_MAPCARTA','url','https://mapcarta.com/N1588631059','latitude',40.43799,'longitude',71.80706)
  ),
  '2026-09-19T00:00:00Z'::timestamptz,
  jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','SOURCE_DIRECTORY','manualGeocoding',false)
)
on conflict (esr_code) do update set
  canonical_station_name=excluded.canonical_station_name,
  aliases=excluded.aliases,
  country_code=excluded.country_code,
  latitude=excluded.latitude,
  longitude=excluded.longitude,
  authority_state=excluded.authority_state,
  source_system=excluded.source_system,
  source_url=excluded.source_url,
  corroboration_refs=excluded.corroboration_refs,
  source_retrieved_at=excluded.source_retrieved_at,
  provenance=excluded.provenance,
  updated_at=now();

create or replace function public.rona_admin_rail_deal_map_read_model_v2(
  p_deal_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, portal_private
as $$
declare
  v_actor uuid;
  v_result jsonb;
begin
  v_actor:=portal_private.owner_r1_actor('ADMIN');

  with scoped_deals as (
    select d.id as deal_key,d.deal_id
    from portal_private.deals d
    where d.lifecycle_state::text='ACTIVE'
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

  return v_result;
end
$$;

comment on function public.rona_admin_rail_deal_map_read_model_v2(text) is
'Admin-only Online Rail map read model. Resolves wagon/station coordinates by trusted ESR-keyed station GEO directory with source provenance. Route endpoint points are source-locked by ESR codes from rail_document.route_text. No synthetic rail geometry.';

revoke all on function public.rona_admin_rail_deal_map_read_model_v2(text)
  from public, anon;
grant execute on function public.rona_admin_rail_deal_map_read_model_v2(text)
  to authenticated, service_role;

commit;
