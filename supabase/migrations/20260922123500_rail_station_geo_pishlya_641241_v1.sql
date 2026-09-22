-- ONLINE RAIL — trusted geo for ESR 641241 (Пишля)
-- Root cause of the 5/9 map rendering after the 2026-09-22 XLSX update:
-- current-position authority correctly resolved five wagons to ESR 641241,
-- but the geo directory had no confirmed coordinate for that ESR code.
-- Station-name text is metadata/display only; ESR remains the identity authority.

begin;

insert into portal_private.rail_station_geo_directory_v1 (
  esr_code,
  canonical_station_name,
  aliases,
  country_code,
  latitude,
  longitude,
  authority_state,
  source_system,
  source_url,
  corroboration_refs,
  source_retrieved_at,
  provenance
)
values (
  '641241',
  'Пишля',
  array['Пишля','Пишля (об','Пишля (обп)','обгонный пункт Пишля'],
  'RU',
  54.0624061111111,
  44.8374311111111,
  'CONFIRMED',
  'WIKIDATA',
  'https://www.wikidata.org/wiki/Q65163304',
  jsonb_build_array(
    jsonb_build_object(
      'sourceSystem','RAILWAYZ_INFO',
      'url','https://railwayz.info/photolines/line/1129/short',
      'stationName','обгонный пункт Пишля',
      'esrCode','641241',
      'express3Code','2024513'
    ),
    jsonb_build_object(
      'sourceSystem','TARIFF_GUIDE_4',
      'url','https://sudact.ru/law/tarifnoe-rukovodstvo-n-4-s-izm-ot_1/razdel-i/pio/',
      'stationName','Пишля (обп)',
      'esrCode','641241'
    )
  ),
  now(),
  jsonb_build_object(
    'identityBasis','ESR_CODE',
    'coordinateMethod','PUBLIC_SOURCE_DIRECTORY',
    'manualGeocoding',false,
    'repairReason','Five TRUSTED DEAL-2026-004 wagons were resolved to ESR 641241 but the map could not plot them because the geo directory had no confirmed ESR 641241 row.',
    'stationNameAuthority','DISPLAY_ONLY',
    'sourceValidation','Wikidata coordinates with exact ESR 641241; station identity independently corroborated by Railwayz and Tariff Guide No. 4.'
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
  v_pishlya integer;
  v_kazaly integer;
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
    count(*) filter (where cp.current_station_code='641241' and g.id is not null),
    count(*) filter (where cp.current_station_code='670507' and g.id is not null),
    count(distinct cp.current_station_code) filter (where g.id is not null)
  into v_total,v_geocoded,v_pishlya,v_kazaly,v_group_count
  from scoped cp
  left join portal_private.rail_station_geo_directory_v1 g
    on g.esr_code=cp.current_station_code
   and g.authority_state='CONFIRMED';

  if v_total<>9
     or v_geocoded<>9
     or v_pishlya<>5
     or v_kazaly<>4
     or v_group_count<>2 then
    raise exception using
      errcode='23514',
      message=format(
        'RAIL_PISHLYA_GEO_QA_FAILED total=%s geocoded=%s pishlya=%s kazaly=%s groups=%s',
        v_total,v_geocoded,v_pishlya,v_kazaly,v_group_count
      );
  end if;
end
$$;

commit;
