begin;

insert into portal_private.rail_station_aliases_v1
(alias_key,alias_text,esr_code,authority_state,source_system,source_ref)
values
('киргили','Киргили','742705','CONFIRMED','UZ_RAILWAYS','https://railway.uz/en/uslugi/gruzovye_perevozki/355/')
on conflict (alias_key) do update set
  esr_code=excluded.esr_code,
  authority_state='CONFIRMED',
  source_system=excluded.source_system,
  source_ref=excluded.source_ref;

select portal_private.rail_route_refresh_assignments_v1();

commit;
