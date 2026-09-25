begin;
insert into portal_private.rail_station_geo_directory_v1 (
  esr_code, canonical_station_name, aliases, country_code,
  latitude, longitude, authority_state,
  source_system, source_url, corroboration_refs,
  source_retrieved_at, provenance
)
values (
  '699900', 'Жылга', array['Жылга','Жылға','Жилга','Джилга','Jılğa'], 'KZ',
  41.7213716, 69.0175050, 'CONFIRMED',
  'OPENSTREETMAP', 'https://www.openstreetmap.org/node/2094286214',
  jsonb_build_array(
    jsonb_build_object(
      'sourceSystem','RAILWAYZ_INFO',
      'url','https://railwayz.info/photolines/station/21551',
      'esrCode','699900',
      'latitude',41.721370697021,
      'longitude',69.0175050
    ),
    jsonb_build_object(
      'sourceSystem','KAZAKHSTAN_STATE_REVENUE_STATION_CLASSIFIER',
      'url','https://kst.kgd.gov.kz/ru/nsi/gdstan/10/306',
      'esrCode','699900',
      'stationName','ДЖИЛГА'
    )
  ),
  now(),
  jsonb_build_object(
    'identityBasis','ESR_CODE',
    'coordinateMethod','SOURCE_STATION_NODE',
    'manualGeocoding',false,
    'stationNameAuthority','DISPLAY_ONLY',
    'locationPrecision','STATION_MARKER_NOT_WAGON_POSITION',
    'repairReason','Four TRUSTED DEAL-2026-004 wagon positions resolved to ESR 699900 with no confirmed station GEO.'
  )
)
on conflict (esr_code) do nothing;

do $$
begin
  if not exists (
    select 1 from portal_private.rail_station_geo_directory_v1
    where esr_code='699900'
      and authority_state='CONFIRMED'
      and latitude=41.7213716
      and longitude=69.0175050
      and source_system='OPENSTREETMAP'
      and source_url='https://www.openstreetmap.org/node/2094286214'
  ) then
    raise exception 'RAIL_ZHYLGA_GEO_SOURCE_CONFLICT' using errcode='23514';
  end if;
end
$$;
commit;
