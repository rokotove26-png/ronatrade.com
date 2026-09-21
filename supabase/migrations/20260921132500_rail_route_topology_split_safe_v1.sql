-- ONLINE RAIL — route topology split-safe progress v1
-- Fixes visual self-intersection/triangle when one Deal has wagons at multiple
-- simultaneous current stations. Current wagon positions remain marker overlays;
-- route geometry is built only from the resolved canonical route graph.
--
-- Prior behavior appended all observed stations in global first-seen order to
-- actualPoints. With split wagons this created a false segment from a farther
-- route station back to another simultaneous current station (e.g. Aktobe I ->
-- Vyazma) and, together with remainingRoute, rendered a triangle.
--
-- Invariants:
--   * no business/source rows are mutated;
--   * observedStations remains audit evidence;
--   * actualPoints becomes the canonical route prefix through the furthest
--     observed route node, not a synthetic connection between wagon clusters;
--   * remainingPoints remains the canonical route suffix from that same node;
--   * off-route/current split stations are markers only.

begin;

create or replace function portal_private.rail_deal_route_progress_v1(p_deal_key uuid)
returns jsonb
language plpgsql
stable
set search_path=pg_catalog,portal_private
as $fn$
declare
  v_route jsonb;
  v_count int:=0;
  v_furthest int;
  v_observed jsonb:='[]'::jsonb;
  v_actual jsonb:='[]'::jsonb;
  v_remaining jsonb:='[]'::jsonb;
begin
  select a.route_nodes
    into v_route
  from portal_private.rail_deal_route_assignments_v1 a
  where a.deal_key=p_deal_key
    and a.resolution_state='RESOLVED';

  if v_route is null then
    return jsonb_build_object(
      'state','ROUTE_NOT_RESOLVED',
      'observedStations','[]'::jsonb,
      'actualPoints','[]'::jsonb,
      'remainingPoints','[]'::jsonb,
      'geometryPolicy','CANONICAL_ROUTE_GRAPH_ONLY_CURRENT_POSITIONS_ARE_MARKERS'
    );
  end if;

  v_count:=jsonb_array_length(v_route);

  with ev as (
    select
      e.station_code,
      max(e.station_name) as station_name,
      min(coalesce(e.parsed_event_at,e.event_at_local at time zone 'UTC',e.source_received_at)) as first_seen_at,
      max(coalesce(e.parsed_event_at,e.event_at_local at time zone 'UTC',e.source_received_at)) as last_seen_at
    from portal_private.rail_xlsx_dislocation_effective_v1 e
    where e.effective_deal_key=p_deal_key
      and e.position_status='TRUSTED'
      and coalesce(e.is_superseded,false)=false
      and e.station_code is not null
    group by e.station_code
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'stationCode',ev.station_code,
        'station',ev.station_name,
        'firstSeenAt',ev.first_seen_at,
        'lastSeenAt',ev.last_seen_at,
        'lat',g.latitude,
        'lng',g.longitude,
        'trusted',g.id is not null,
        'sourceKind','OBSERVED_HISTORY'
      )
      order by ev.first_seen_at,ev.station_code
    ),
    '[]'::jsonb
  )
  into v_observed
  from ev
  left join portal_private.rail_station_geo_directory_v1 g
    on g.esr_code=ev.station_code
   and g.authority_state='CONFIRMED';

  -- Progress is anchored only to stations that are actually nodes of the
  -- resolved canonical route. Off-route simultaneous positions do not alter
  -- route topology.
  select max((p->>'sequence')::int)
    into v_furthest
  from jsonb_array_elements(v_route) p
  where exists (
    select 1
    from jsonb_array_elements(v_observed) o
    where o->>'stationCode'=p->>'stationCode'
  );

  -- Actual/progress line = canonical route prefix up to the furthest matched
  -- node. This intentionally does NOT connect observed/current station points
  -- in timestamp order.
  if v_furthest is not null then
    select coalesce(
      jsonb_agg(
        p || jsonb_build_object('sourceKind','ROUTE_PROGRESS_PREFIX')
        order by (p->>'sequence')::int
      ),
      '[]'::jsonb
    )
    into v_actual
    from jsonb_array_elements(v_route) p
    where (p->>'sequence')::int<=v_furthest
      and p->>'lat' is not null
      and p->>'lng' is not null;
  end if;

  -- Remaining line = canonical route suffix beginning at the same progress
  -- anchor so the two overlays meet at one node without a synthetic chord.
  select coalesce(
    jsonb_agg(
      p || jsonb_build_object('sourceKind','ROUTE_REMAINDER')
      order by (p->>'sequence')::int
    ),
    '[]'::jsonb
  )
  into v_remaining
  from jsonb_array_elements(v_route) p
  where (p->>'sequence')::int>=coalesce(v_furthest,1)
    and p->>'lat' is not null
    and p->>'lng' is not null;

  return jsonb_build_object(
    'state',
      case
        when jsonb_array_length(v_observed)=0 then 'NO_OBSERVATIONS'
        when v_furthest is null then 'OBSERVED_OFF_ROUTE'
        else 'OBSERVED_AND_MATCHED'
      end,
    'routeNodeCount',v_count,
    'furthestMatchedSequence',v_furthest,
    'historyStationCount',jsonb_array_length(v_observed),
    'observedStations',v_observed,
    'actualPoints',v_actual,
    'remainingPoints',v_remaining,
    'geometryPolicy','CANONICAL_ROUTE_PREFIX_AND_SUFFIX_CURRENT_POSITIONS_ARE_MARKERS'
  );
end
$fn$;

comment on function portal_private.rail_deal_route_progress_v1(uuid) is
'Split-safe route progress. observedStations preserves trusted evidence, while actualPoints/remainingPoints are canonical route graph prefix/suffix anchored at the furthest matched route node. Simultaneous current wagon clusters are never connected into route geometry.';

-- Targeted production regression gate for the owner-reported DEAL-2026-004
-- defect. The five Vyazma wagons and four Aktobe wagons must remain distinct
-- marker groups, while route progress must end at Aktobe and must not contain
-- Vyazma as a synthetic route segment.
do $$
declare
  v_deal_key uuid;
  v_progress jsonb;
  v_actual_count integer;
  v_remaining_count integer;
  v_actual_last_code text;
  v_remaining_first_code text;
  v_actual_has_vyazma boolean;
  v_marker_groups integer;
  v_marker_wagons integer;
begin
  select d.id
    into v_deal_key
  from portal_private.deals d
  where d.deal_id='DEAL-2026-004'
    and d.lifecycle_state::text='ACTIVE';

  if v_deal_key is null then
    raise exception using
      errcode='23503',
      message='RAIL_ROUTE_TOPOLOGY_QA_DEAL_NOT_FOUND';
  end if;

  v_progress:=portal_private.rail_deal_route_progress_v1(v_deal_key);
  v_actual_count:=jsonb_array_length(coalesce(v_progress->'actualPoints','[]'::jsonb));
  v_remaining_count:=jsonb_array_length(coalesce(v_progress->'remainingPoints','[]'::jsonb));

  select p->>'stationCode'
    into v_actual_last_code
  from jsonb_array_elements(coalesce(v_progress->'actualPoints','[]'::jsonb))
       with ordinality as x(p,ord)
  order by ord desc
  limit 1;

  select p->>'stationCode'
    into v_remaining_first_code
  from jsonb_array_elements(coalesce(v_progress->'remainingPoints','[]'::jsonb))
       with ordinality as x(p,ord)
  order by ord
  limit 1;

  select exists (
    select 1
    from jsonb_array_elements(coalesce(v_progress->'actualPoints','[]'::jsonb)) p
    where p->>'stationCode'='174306'
  )
  into v_actual_has_vyazma;

  select count(*),coalesce(sum(q.wagon_count),0)
    into v_marker_groups,v_marker_wagons
  from (
    select cp.current_station_code,count(*) as wagon_count
    from portal_private.rail_xlsx_dislocation_current_position_v1 cp
    where cp.effective_deal_key=v_deal_key
      and cp.position_status='TRUSTED'
      and cp.current_station_code in ('174306','689503')
    group by cp.current_station_code
  ) q;

  if coalesce(v_progress->>'geometryPolicy','')<>
       'CANONICAL_ROUTE_PREFIX_AND_SUFFIX_CURRENT_POSITIONS_ARE_MARKERS'
     or nullif(v_progress->>'furthestMatchedSequence','')::int<>61
     or v_actual_count<2
     or v_remaining_count<2
     or v_actual_last_code<>'689503'
     or v_remaining_first_code<>'689503'
     or coalesce(v_actual_has_vyazma,false)
     or v_marker_groups<>2
     or v_marker_wagons<>9 then
    raise exception using
      errcode='23514',
      message=format(
        'RAIL_ROUTE_TOPOLOGY_QA_FAILED furthest=%s actual_count=%s remaining_count=%s actual_last=%s remaining_first=%s actual_has_vyazma=%s marker_groups=%s marker_wagons=%s',
        v_progress->>'furthestMatchedSequence',
        v_actual_count,
        v_remaining_count,
        v_actual_last_code,
        v_remaining_first_code,
        v_actual_has_vyazma,
        v_marker_groups,
        v_marker_wagons
      );
  end if;
end
$$;

commit;
