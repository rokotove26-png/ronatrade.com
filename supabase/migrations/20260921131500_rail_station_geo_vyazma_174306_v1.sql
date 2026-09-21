-- ONLINE RAIL — add missing trusted geo for ESR 174306 (Vyazma)
-- Root cause of map showing 4/9 wagons: four wagons at Aktobe I had trusted
-- coordinates, while five wagons at Vyazma ESR 174306 did not.

begin;

insert into portal_private.rail_station_geo_directory_v1 (
  esr_code, canonical_station_name, aliases, country_code,
  latitude, longitude, authority_state, source_system, source_url,
  corroboration_refs, source_retrieved_at, provenance
)
values (
  '174306',
  'Вязьма',
  array['Вязьма'],
  'RU',
  55.197513580322,
  34.3176239,
  'CONFIRMED',
  'RAILWAYZ_INFO',
  'https://railwayz.info/photolines/station/6393',
  jsonb_build_array(
    jsonb_build_object(
      'sourceSystem','WIKIPEDIA_RU',
      'url','https://ru.wikipedia.org/wiki/%D0%92%D1%8F%D0%B7%D1%8C%D0%BC%D0%B0_(%D1%81%D1%82%D0%B0%D0%BD%D1%86%D0%B8%D1%8F)',
      'esrCode','174306',
      'latitudeApprox',55.1975,
      'longitudeApprox',34.317222
    ),
    jsonb_build_object(
      'sourceSystem','CONSULTANT_PLUS_TARIFF_GUIDE',
      'url','https://www.consultant.ru/document/cons_doc_LAW_63243/7032f74fbda3ebdf2c6ec1442586a01e8d29f98b/',
      'esrCode','174306',
      'stationName','Вязьма'
    )
  ),
  '2026-09-21T10:10:00Z'::timestamptz,
  jsonb_build_object(
    'identityBasis','ESR_CODE',
    'coordinateMethod','SOURCE_DIRECTORY',
    'manualGeocoding',false,
    'repairReason','DEAL-2026-004 five TRUSTED wagons at ESR 174306 had no geo-directory row, so map rendered only the four Aktobe I wagons',
    'ownerObservedAt','2026-09-21T13:08:00+03:00',
    'sourceValidation','ESR 174306 and station identity independently corroborated'
  )
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

do $$
declare
  v_total integer;
  v_geocoded integer;
  v_vyazma integer;
  v_aktobe integer;
  v_group_count integer;
begin
  with scoped as (
    select cp.*
    from portal_private.rail_xlsx_dislocation_current_position_v1 cp
    join portal_private.deals d on d.id=cp.effective_deal_key
    where d.deal_id='DEAL-2026-004'
      and cp.position_status='TRUSTED'
  )
  select
    count(*),
    count(*) filter (where g.id is not null),
    count(*) filter (where cp.current_station_code='174306' and g.id is not null),
    count(*) filter (where cp.current_station_code='689503' and g.id is not null),
    count(distinct cp.current_station_code) filter (where g.id is not null)
  into v_total,v_geocoded,v_vyazma,v_aktobe,v_group_count
  from scoped cp
  left join portal_private.rail_station_geo_directory_v1 g
    on g.esr_code=cp.current_station_code
   and g.authority_state='CONFIRMED';

  if v_total<>9
     or v_geocoded<>9
     or v_vyazma<>5
     or v_aktobe<>4
     or v_group_count<>2 then
    raise exception using
      errcode='23514',
      message=format(
        'RAIL_VYAZMA_GEO_QA_FAILED total=%s geocoded=%s vyazma=%s aktobe=%s groups=%s',
        v_total,v_geocoded,v_vyazma,v_aktobe,v_group_count
      );
  end if;
end
$$;

commit;
