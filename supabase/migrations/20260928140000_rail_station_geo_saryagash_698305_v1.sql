begin;

insert into portal_private.rail_station_geo_directory_v1 (
  esr_code, canonical_station_name, aliases, country_code,
  latitude, longitude, authority_state,
  source_system, source_url, corroboration_refs,
  source_retrieved_at, provenance
)
values (
  '698305', 'Сарыагаш', array['Сарыагаш','Сары-Агаш','Saryagash'], 'KZ',
  41.466347, 69.147477, 'CONFIRMED',
  'ALTA_SOFT', 'https://www.alta.ru/railway/station/69830/',
  jsonb_build_array(
    jsonb_build_object(
      'sourceSystem','RAILWAYZ_INFO',
      'url','https://railwayz.info/photolines/station/21583',
      'esrCode','698305',
      'latitude',41.466457366943,
      'longitude',69.1480458
    )
  ),
  now(),
  jsonb_build_object(
    'identityBasis','ESR_CODE',
    'coordinateMethod','SOURCE_STATION_DIRECTORY',
    'manualGeocoding',false,
    'stationNameAuthority','DISPLAY_ONLY',
    'locationPrecision','STATION_MARKER_NOT_WAGON_POSITION',
    'repairReason','Current TRUSTED DEAL-2026-004 wagon positions resolved to ESR 698305 while the confirmed station GEO directory had no 698305 row.'
  )
)
on conflict (esr_code) do nothing;

do $$
begin
  if not exists (
    select 1
    from portal_private.rail_station_geo_directory_v1
    where esr_code='698305'
      and canonical_station_name='Сарыагаш'
      and authority_state='CONFIRMED'
      and latitude=41.466347
      and longitude=69.147477
      and source_system='ALTA_SOFT'
      and source_url='https://www.alta.ru/railway/station/69830/'
  ) then
    raise exception 'RAIL_SARYAGASH_698305_GEO_SOURCE_CONFLICT' using errcode='23514';
  end if;
end
$$;

commit;
