begin;

insert into portal_private.rail_station_geo_directory_v1 (
  esr_code,canonical_station_name,aliases,country_code,latitude,longitude,
  authority_state,source_system,source_url,corroboration_refs,source_retrieved_at,provenance
)
values (
  '216392','Семинарская',array['Семинарская']::text[],'RU',52.9571,36.1107,
  'CONFIRMED','MAPCARTA_GEONAMES','https://mapcarta.com/13340078',
  jsonb_build_array(
    jsonb_build_object(
      'sourceSystem','RAILWAYZ',
      'url','https://railwayz.info/photolines/line/698',
      'identityOnly',true,
      'esrCode','216392'
    ),
    jsonb_build_object(
      'sourceSystem','ALTA_SOFT',
      'url','https://www.alta.ru/railway/station/21639/',
      'identityOnly',true,
      'ecp5','21639'
    )
  ),
  now(),
  jsonb_build_object(
    'identityBasis','ESR_CODE',
    'coordinateMethod','PUBLIC_DIRECTORY',
    'routeEngineSeed','V1',
    'coordinateCrossCheck','GEONAMES_MAPCARTA'
  )
)
on conflict (esr_code) do update set
  canonical_station_name=excluded.canonical_station_name,
  aliases=excluded.aliases,
  country_code=excluded.country_code,
  latitude=excluded.latitude,
  longitude=excluded.longitude,
  authority_state='CONFIRMED',
  source_system=excluded.source_system,
  source_url=excluded.source_url,
  corroboration_refs=excluded.corroboration_refs,
  source_retrieved_at=excluded.source_retrieved_at,
  provenance=excluded.provenance,
  updated_at=now();

select portal_private.rail_route_refresh_assignments_v1();

commit;
