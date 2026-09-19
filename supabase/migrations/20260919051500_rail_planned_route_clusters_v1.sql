begin;

-- #644 owner-approved display route for DEAL-2026-004.
-- Route sequence is source-locked to the forwarding instruction:
-- "Поручение на экспедирование груза № 1 от 30.07.2026",
-- DEAL-2026-004 / GU-12 1308903120.
-- The line is a PLANNED CORRIDOR through confirmed control stations and border pairs,
-- not a claim of exact rail geometry.

insert into portal_private.rail_station_geo_directory_v1 (
  esr_code, canonical_station_name, aliases, country_code,
  latitude, longitude, authority_state, source_system, source_url,
  corroboration_refs, source_retrieved_at, provenance
)
values
(
  '150405','Закопытье (эксп.)',array['Закопытье (эксп.)','Закопытье'],'BY',
  52.433698,31.485358,'CONFIRMED','YTM',
  'https://ytm.kz/railways/start3091-end10575.html',
  jsonb_build_array(
    jsonb_build_object('sourceSystem','ALTA_SOFT','url','https://www.alta.ru/railway/station/15040/','latitude',52.433918,'longitude',31.48512)
  ),
  '2026-09-19T02:10:00Z'::timestamptz,
  jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','SOURCE_DIRECTORY','manualGeocoding',false)
),
(
  '201202','Злынка (эксп.)',array['Злынка (эксп.)','Злынка'],'RU',
  52.475379,31.667132,'CONFIRMED','YTM',
  'https://ytm.kz/railways/country1.html',
  jsonb_build_array(
    jsonb_build_object('sourceSystem','ALTA_SOFT','url','https://www.alta.ru/railway/station/20120/','latitude',52.475127,'longitude',31.665759)
  ),
  '2026-09-19T02:10:00Z'::timestamptz,
  jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','SOURCE_DIRECTORY','manualGeocoding',false)
),
(
  '628508','Озинки (эксп.)',array['Озинки (эксп.)','Озинки'],'RU',
  51.195051,49.738217,'CONFIRMED','YTM',
  'https://ytm.kz/railways/start6776-end10060.html',
  jsonb_build_array(
    jsonb_build_object('sourceSystem','ALTA_SOFT','url','https://www.alta.ru/railway/station/62850/','latitude',51.195126,'longitude',49.738134),
    jsonb_build_object('sourceSystem','FREICON','url','https://online.freicon.ru/info/stations/628508','latitude',51.20586,'longitude',49.91735,'note','alternate directory coordinate retained as corroboration, not averaged')
  ),
  '2026-09-19T02:10:00Z'::timestamptz,
  jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','SOURCE_DIRECTORY','manualGeocoding',false,'coordinateConflictHandled','PRIMARY_SOURCE_NO_AVERAGING')
),
(
  '664900','Семиглавый Мар (эксп.)',array['Семиглавый Мар (эксп.)','Семиглавый Мар'],'KZ',
  51.20034941,50.01450777,'CONFIRMED','YTM',
  'https://ytm.kz/railways/start6775-end9681.html',
  jsonb_build_array(
    jsonb_build_object('sourceSystem','ALTA_SOFT','url','https://www.alta.ru/railway/station/66490/','latitude',51.194994,'longitude',50.052155)
  ),
  '2026-09-19T02:10:00Z'::timestamptz,
  jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','SOURCE_DIRECTORY','manualGeocoding',false)
),
(
  '704101','Сарыагаш (эксп.)',array['Сарыагаш (эксп.)','Сары-Агач (эксп.)','Сарыагаш'],'KZ',
  41.47112636,69.14792776,'CONFIRMED','YTM',
  'https://ytm.kz/railways/station9521.html',
  jsonb_build_array(
    jsonb_build_object('sourceSystem','ALTA_SOFT','url','https://www.alta.ru/railway/station/70410/','latitude',41.466334,'longitude',69.147492),
    jsonb_build_object('sourceSystem','FREICON','url','https://online.freicon.ru/info/stations/704101','latitude',41.44110531,'longitude',69.17936717,'note','alternate directory coordinate retained as corroboration, not averaged')
  ),
  '2026-09-19T02:10:00Z'::timestamptz,
  jsonb_build_object('identityBasis','ESR_CODE','coordinateMethod','SOURCE_DIRECTORY','manualGeocoding',false,'coordinateConflictHandled','PRIMARY_SOURCE_NO_AVERAGING')
),
(
  '720602','Келес (эксп.)',array['Келес (эксп.)','Келес'],'UZ',
  41.407083,69.205111,'CONFIRMED','ALTA_SOFT',
  'https://www.alta.ru/railway/station/72060/',
  jsonb_build_array(
    jsonb_build_object('sourceSystem','YTM','url','https://ytm.kz/railways/station4061.html','identityOnly',true,'esrCode','720602')
  ),
  '2026-09-19T02:10:00Z'::timestamptz,
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

create table if not exists portal_private.rail_planned_route_waypoints_v1 (
  id uuid primary key default gen_random_uuid(),
  rail_document_key uuid not null references portal_private.rail_documents(id) on delete restrict,
  sequence_no integer not null,
  esr_code text not null,
  station_name text not null,
  waypoint_role text not null,
  authority_state text not null default 'OWNER_CONFIRMED',
  source_system text not null,
  source_ref text not null,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rail_planned_route_waypoints_v1_seq_ck check (sequence_no > 0),
  constraint rail_planned_route_waypoints_v1_esr_ck check (esr_code ~ '^[0-9]{6}$'),
  constraint rail_planned_route_waypoints_v1_role_ck check (waypoint_role in ('ORIGIN','BORDER_EXIT','BORDER_ENTRY','DESTINATION','TRANSIT')),
  constraint rail_planned_route_waypoints_v1_authority_ck check (authority_state in ('OWNER_CONFIRMED','SUPERSEDED')),
  constraint rail_planned_route_waypoints_v1_seq_uk unique (rail_document_key,sequence_no)
);

create index if not exists rail_planned_route_waypoints_v1_doc_idx
  on portal_private.rail_planned_route_waypoints_v1(rail_document_key,sequence_no);

alter table portal_private.rail_planned_route_waypoints_v1 enable row level security;
revoke all on table portal_private.rail_planned_route_waypoints_v1 from public, anon, authenticated;
grant select on table portal_private.rail_planned_route_waypoints_v1 to service_role;

with target_doc as (
  select rd.id as rail_document_key
  from portal_private.deals d
  join portal_private.rail_documents rd
    on rd.deal_key=d.id
   and rd.lifecycle_state::text='ACTIVE'
  where d.deal_id='DEAL-2026-004'
    and d.lifecycle_state::text='ACTIVE'
    and rd.rail_document_id='RONA-S002-IN-2026-002'
    and rd.gu12_number='1308903120'
),
route_points(sequence_no,esr_code,station_name,waypoint_role,source_ref) as (
  values
    (1,'151408','Барбаров','ORIGIN','Поручение на экспедирование груза № 1 от 30.07.2026; ст. отправления Барбаров 151408'),
    (2,'150405','Закопытье (эксп.)','BORDER_EXIT','Поручение на экспедирование груза № 1 от 30.07.2026; Закопытье (эксп.) 150405 / Злынка (эксп.) 201202'),
    (3,'201202','Злынка (эксп.)','BORDER_ENTRY','Поручение на экспедирование груза № 1 от 30.07.2026; Закопытье (эксп.) 150405 / Злынка (эксп.) 201202'),
    (4,'628508','Озинки (эксп.)','BORDER_EXIT','Поручение на экспедирование груза № 1 от 30.07.2026; Озинки (эксп.) 628508 / Семиглавый Мар (эксп.) 664900'),
    (5,'664900','Семиглавый Мар (эксп.)','BORDER_ENTRY','Поручение на экспедирование груза № 1 от 30.07.2026; Озинки (эксп.) 628508 / Семиглавый Мар (эксп.) 664900'),
    (6,'704101','Сарыагаш (эксп.)','BORDER_EXIT','Поручение на экспедирование груза № 1 от 30.07.2026; Сарыагаш (эксп.) 704101 / Келес (эксп.) 720602'),
    (7,'720602','Келес (эксп.)','BORDER_ENTRY','Поручение на экспедирование груза № 1 от 30.07.2026; Сарыагаш (эксп.) 704101 / Келес (эксп.) 720602'),
    (8,'742705','Киргили','DESTINATION','Поручение на экспедирование груза № 1 от 30.07.2026; станция назначения Киргили 742705')
)
insert into portal_private.rail_planned_route_waypoints_v1 (
  rail_document_key,sequence_no,esr_code,station_name,waypoint_role,
  authority_state,source_system,source_ref,provenance
)
select
  td.rail_document_key,rp.sequence_no,rp.esr_code,rp.station_name,rp.waypoint_role,
  'OWNER_CONFIRMED','OWNER_SOURCE_DOCUMENT',rp.source_ref,
  jsonb_build_object(
    'dealId','DEAL-2026-004',
    'railDocumentId','RONA-S002-IN-2026-002',
    'gu12Number','1308903120',
    'sourceDocument','Поручение на экспедирование груза № 1 от 30.07.2026',
    'routeSemantics','PLANNED_CORRIDOR_WAYPOINT',
    'geometrySemantics','STRAIGHT_SEGMENT_BETWEEN_WAYPOINTS_NOT_EXACT_RAIL_TRACK',
    'ownerApproval','CURRENT_CHAT_2026-09-19'
  )
from target_doc td
cross join route_points rp
on conflict (rail_document_key,sequence_no) do update set
  esr_code=excluded.esr_code,
  station_name=excluded.station_name,
  waypoint_role=excluded.waypoint_role,
  authority_state=excluded.authority_state,
  source_system=excluded.source_system,
  source_ref=excluded.source_ref,
  provenance=excluded.provenance,
  updated_at=now();

do $$
begin
  if (
    select count(*)
    from portal_private.rail_planned_route_waypoints_v1 w
    join portal_private.rail_documents rd on rd.id=w.rail_document_key
    join portal_private.deals d on d.id=rd.deal_key
    where d.deal_id='DEAL-2026-004'
      and rd.rail_document_id='RONA-S002-IN-2026-002'
      and w.authority_state='OWNER_CONFIRMED'
  ) <> 8 then
    raise exception 'RAIL_PLANNED_ROUTE_WAYPOINT_COUNT_MISMATCH';
  end if;
end
$$;

create or replace function public.rona_admin_rail_deal_map_read_model_v3(
  p_deal_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, portal_private
as $$
declare
  v_actor uuid;
  v_base jsonb;
  v_deals jsonb := '[]'::jsonb;
  v_deal jsonb;
  v_routes jsonb;
begin
  v_actor:=portal_private.owner_r1_actor('ADMIN');
  v_base:=public.rona_admin_rail_deal_map_read_model_v2(p_deal_id);

  for v_deal in
    select value
    from jsonb_array_elements(coalesce(v_base->'deals','[]'::jsonb))
  loop
    select jsonb_agg(
      jsonb_build_object(
        'railDocumentKey',rd.id,
        'railDocumentId',rd.rail_document_id,
        'gu12Number',rd.gu12_number,
        'routeText',rd.route_text,
        'label','Плановый маршрут',
        'routeMode','PLANNED',
        'points',(
          select jsonb_agg(
            jsonb_build_object(
              'lat',g.latitude,
              'lng',g.longitude,
              'station',w.station_name,
              'stationCode',w.esr_code,
              'waypointRole',w.waypoint_role,
              'sequence',w.sequence_no,
              'trusted',true,
              'trust','CONFIRMED',
              'provenance',jsonb_build_object(
                'routeAuthority',w.authority_state,
                'routeSourceSystem',w.source_system,
                'routeSourceRef',w.source_ref,
                'coordinateSourceSystem',g.source_system,
                'coordinateSourceUrl',g.source_url,
                'identityBasis','ESR_CODE'
              )
            )
            order by w.sequence_no
          )
          from portal_private.rail_planned_route_waypoints_v1 w
          join portal_private.rail_station_geo_directory_v1 g
            on g.esr_code=w.esr_code
           and g.authority_state='CONFIRMED'
          where w.rail_document_key=rd.id
            and w.authority_state='OWNER_CONFIRMED'
        ),
        'geometry',null,
        'status','OWNER_CONFIRMED_PLANNED_CORRIDOR',
        'provenance',jsonb_build_object(
          'routeSource','OWNER_SOURCE_DOCUMENT',
          'coordinateSource','RAIL_STATION_GEO_DIRECTORY_V1',
          'routeTable','RAIL_PLANNED_ROUTE_WAYPOINTS_V1',
          'geometryPolicy','STRAIGHT_SEGMENTS_BETWEEN_CONFIRMED_WAYPOINTS_NOT_EXACT_RAIL_TRACK',
          'displayLabel','Плановый маршрут'
        )
      )
      order by rd.document_date nulls last,rd.rail_document_id
    )
    into v_routes
    from portal_private.rail_documents rd
    where rd.deal_key=nullif(v_deal->>'dealKey','')::uuid
      and rd.lifecycle_state::text='ACTIVE'
      and exists (
        select 1
        from portal_private.rail_planned_route_waypoints_v1 w
        where w.rail_document_key=rd.id
          and w.authority_state='OWNER_CONFIRMED'
      );

    if v_routes is not null then
      v_deal:=jsonb_set(v_deal,'{plannedRoute}',v_routes,true);
    end if;
    v_deals:=v_deals||jsonb_build_array(v_deal);
  end loop;

  v_base:=jsonb_set(v_base,'{deals}',v_deals,true);
  v_base:=jsonb_set(v_base,'{modelVersion}',to_jsonb('RONA_ADMIN_RAIL_DEAL_MAP_READ_MODEL_V3'::text),true);
  v_base:=jsonb_set(v_base,'{sourcePolicy}',to_jsonb('EXPEDITOR_XLSX_WITH_TRUSTED_STATION_GEO_AND_OWNER_PLANNED_CORRIDOR'::text),true);
  return v_base;
end
$$;

comment on function public.rona_admin_rail_deal_map_read_model_v3(text) is
'Admin-only Online Rail map read model. Extends V2 with owner-confirmed planned route waypoints. Planned corridor uses straight display segments between source-backed ESR stations and is explicitly not exact rail geometry.';

revoke all on function public.rona_admin_rail_deal_map_read_model_v3(text)
  from public, anon;
grant execute on function public.rona_admin_rail_deal_map_read_model_v3(text)
  to authenticated, service_role;

commit;
