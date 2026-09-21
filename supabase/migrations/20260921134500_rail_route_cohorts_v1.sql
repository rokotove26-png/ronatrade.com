-- ONLINE RAIL — split-route cohort model v1
begin;

create or replace function portal_private.rail_deal_route_cohorts_v1(p_deal_key uuid)
returns jsonb
language plpgsql
stable
set search_path=pg_catalog,portal_private
as $fn$
declare
  v_route jsonb:='[]'::jsonb;
  v_result jsonb:='[]'::jsonb;
begin
  select coalesce(a.route_nodes,'[]'::jsonb) into v_route
  from portal_private.rail_deal_route_assignments_v1 a
  where a.deal_key=p_deal_key and a.resolution_state='RESOLVED';

  with raw_events as (
    select e.wagon_number,e.station_code,e.station_name,e.event_at_local,
           e.source_received_at,e.source_checksum_sha256,
           g.latitude,g.longitude,g.country_code,
           lag(e.station_code) over (
             partition by e.wagon_number
             order by e.source_received_at,e.event_at_local,e.id
           ) prev_station_code
    from portal_private.rail_xlsx_dislocation_effective_v1 e
    left join portal_private.rail_station_geo_directory_v1 g
      on g.esr_code=e.station_code and g.authority_state='CONFIRMED'
    where e.effective_deal_key=p_deal_key
      and e.position_status='TRUSTED'
      and coalesce(e.is_superseded,false)=false
      and e.station_code is not null
  ),
  dedup as (
    select r.*,
           row_number() over (
             partition by r.wagon_number
             order by r.source_received_at,r.event_at_local,r.station_code
           ) obs_seq
    from raw_events r
    where r.prev_station_code is null or r.prev_station_code<>r.station_code
  ),
  wagon_paths as (
    select wagon_number,array_agg(station_code order by obs_seq) path_codes
    from dedup group by wagon_number
  ),
  cohorts as (
    select path_codes,array_agg(wagon_number order by wagon_number) wagon_numbers,
           count(*)::int wagon_count
    from wagon_paths
    where cardinality(path_codes)>0
    group by path_codes
  ),
  obs as (
    select c.path_codes,c.wagon_numbers,c.wagon_count,d.obs_seq,d.station_code,
           max(d.station_name) station_name,max(d.latitude) latitude,
           max(d.longitude) longitude,max(d.country_code) country_code,
           min(d.event_at_local) first_event_at_local,
           max(d.event_at_local) last_event_at_local,
           min(d.source_received_at) first_source_received_at,
           max(d.source_received_at) last_source_received_at,
           jsonb_agg(distinct d.source_checksum_sha256) source_checksums
    from cohorts c
    join wagon_paths w on w.path_codes=c.path_codes
    join dedup d on d.wagon_number=w.wagon_number
    group by c.path_codes,c.wagon_numbers,c.wagon_count,d.obs_seq,d.station_code
  ),
  route_nodes as (
    select (p->>'sequence')::int route_seq,p->>'stationCode' station_code,
           p->>'station' station_name,nullif(p->>'lat','')::double precision latitude,
           nullif(p->>'lng','')::double precision longitude,p->>'countryCode' country_code,
           p->>'borderRole' border_role
    from jsonb_array_elements(v_route) p
    where nullif(p->>'stationCode','') is not null
  ),
  pairs as (
    select a.path_codes,a.obs_seq segment_seq,
           a.station_code from_station_code,a.station_name from_station_name,
           a.latitude from_latitude,a.longitude from_longitude,a.country_code from_country_code,
           b.station_code to_station_code,b.station_name to_station_name,
           b.latitude to_latitude,b.longitude to_longitude,b.country_code to_country_code,
           ra.route_seq from_route_seq,rb.route_seq to_route_seq
    from obs a
    join obs b on b.path_codes=a.path_codes and b.obs_seq=a.obs_seq+1
    left join route_nodes ra on ra.station_code=a.station_code
    left join route_nodes rb on rb.station_code=b.station_code
  ),
  segments as (
    select p.*,
      case when p.from_route_seq is not null and p.to_route_seq is not null
                  and p.to_route_seq>=p.from_route_seq
           then 'ROUTE_GRAPH_CORRIDOR_BETWEEN_OBSERVED_ENDPOINTS'
           else 'OBSERVED_ENDPOINTS_PATH_UNRESOLVED' end geometry_status,
      case when p.from_route_seq is not null and p.to_route_seq is not null
                  and p.to_route_seq>=p.from_route_seq
           then coalesce((
             select jsonb_agg(jsonb_build_object(
               'sequence',r.route_seq,'stationCode',r.station_code,'station',r.station_name,
               'lat',r.latitude,'lng',r.longitude,'countryCode',r.country_code,
               'borderRole',r.border_role,'sourceKind','ROUTE_GRAPH_CORRIDOR'
             ) order by r.route_seq)
             from route_nodes r
             where r.route_seq between p.from_route_seq and p.to_route_seq
               and r.latitude is not null and r.longitude is not null
           ),'[]'::jsonb)
           else jsonb_build_array(
             jsonb_build_object('stationCode',p.from_station_code,'station',p.from_station_name,
               'lat',p.from_latitude,'lng',p.from_longitude,'countryCode',p.from_country_code,
               'sourceKind','OBSERVED_ENDPOINT'),
             jsonb_build_object('stationCode',p.to_station_code,'station',p.to_station_name,
               'lat',p.to_latitude,'lng',p.to_longitude,'countryCode',p.to_country_code,
               'sourceKind','OBSERVED_ENDPOINT')
           ) end points,
      case when p.from_route_seq is not null and p.to_route_seq is not null
                  and p.to_route_seq>=p.from_route_seq
           then coalesce((
             select jsonb_agg(jsonb_build_object(
               'sequence',r.route_seq,'stationCode',r.station_code,'station',r.station_name,
               'countryCode',r.country_code,'borderRole',r.border_role,
               'lat',r.latitude,'lng',r.longitude,'authority','ROUTE_GRAPH_NOT_DIRECT_EVENT'
             ) order by r.route_seq)
             from route_nodes r
             where r.route_seq between p.from_route_seq and p.to_route_seq
               and r.border_role is not null
           ),'[]'::jsonb)
           else '[]'::jsonb end crossing_points
    from pairs p
  ),
  payload as (
    select c.path_codes,c.wagon_numbers,c.wagon_count,
      jsonb_agg(jsonb_build_object(
        'sequence',o.obs_seq,'stationCode',o.station_code,'station',o.station_name,
        'countryCode',o.country_code,'lat',o.latitude,'lng',o.longitude,
        'firstEventAtLocal',o.first_event_at_local,'lastEventAtLocal',o.last_event_at_local,
        'firstSourceReceivedAt',o.first_source_received_at,
        'lastSourceReceivedAt',o.last_source_received_at,
        'sourceChecksums',o.source_checksums,'sourceKind','TRUSTED_OBSERVATION'
      ) order by o.obs_seq) observations,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'sequence',s.segment_seq,
          'fromStationCode',s.from_station_code,'fromStation',s.from_station_name,
          'toStationCode',s.to_station_code,'toStation',s.to_station_name,
          'fromCountryCode',s.from_country_code,'toCountryCode',s.to_country_code,
          'geometryStatus',s.geometry_status,
          'geometryAuthority',case when s.geometry_status='ROUTE_GRAPH_CORRIDOR_BETWEEN_OBSERVED_ENDPOINTS'
            then 'INFERRED_FROM_RESOLVED_ROUTE_GRAPH_NOT_DIRECT_TRACK'
            else 'OBSERVED_ENDPOINTS_ONLY' end,
          'points',s.points,
          'borderTransition',case when coalesce(s.from_country_code,'')<>'' and
                                      coalesce(s.to_country_code,'')<>'' and
                                      s.from_country_code<>s.to_country_code
            then jsonb_build_object(
              'fromCountry',s.from_country_code,'toCountry',s.to_country_code,
              'status',case when jsonb_array_length(s.crossing_points)>0
                then 'ROUTE_GRAPH_CROSSING_CORRIDOR'
                else 'EXACT_CROSSING_UNRESOLVED' end,
              'crossingPoints',s.crossing_points
            ) else null end
        ) order by s.segment_seq)
        from segments s where s.path_codes=c.path_codes
      ),'[]'::jsonb) segments
    from cohorts c
    join obs o on o.path_codes=c.path_codes
    group by c.path_codes,c.wagon_numbers,c.wagon_count
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'cohortKey','COHORT:'||substr(md5(array_to_string(p.path_codes,'>')),1,12),
    'wagonCount',p.wagon_count,'wagonNumbers',to_jsonb(p.wagon_numbers),
    'observationSignature',array_to_string(p.path_codes,'>'),
    'observations',p.observations,'segments',p.segments,
    'currentObservation',p.observations->(jsonb_array_length(p.observations)-1),
    'displayPolicy','INDEPENDENT_ROUTE_BRANCH_BY_TRUSTED_WAGON_HISTORY',
    'geometryPolicy','NO_SYNTHETIC_CROSS_COHORT_CONNECTIONS'
  ) order by p.wagon_count desc,array_to_string(p.path_codes,'>')),'[]'::jsonb)
  into v_result
  from payload p;

  return v_result;
end
$fn$;

revoke all on function portal_private.rail_deal_route_cohorts_v1(uuid) from public,anon,authenticated;
grant execute on function portal_private.rail_deal_route_cohorts_v1(uuid) to service_role;

commit;
