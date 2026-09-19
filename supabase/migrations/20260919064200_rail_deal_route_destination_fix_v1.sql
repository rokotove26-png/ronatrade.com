begin;

create or replace function portal_private.rail_detect_deal_destination_v1(p_deal_key uuid)
returns jsonb language plpgsql stable
set search_path=pg_catalog,portal_private
as $fn$
declare v_code text; v_dest text; v_match text[];
begin
  select lpad(c->>'rawValue',6,'0') into v_code
  from portal_private.rail_xlsx_dislocation_effective_v1 e
  cross join lateral jsonb_array_elements(coalesce(e.source_row->'cells','[]'::jsonb)) c
  where e.effective_deal_key=p_deal_key and e.position_status='TRUSTED' and coalesce(e.is_superseded,false)=false
    and lower(c->>'header')='код станции назначения вагона'
    and (c->>'rawValue') ~ '^[0-9]+$'
  order by coalesce(e.parsed_event_at,e.event_at_local at time zone 'UTC',e.source_received_at) desc
  limit 1;

  if v_code is not null and exists(
    select 1 from portal_private.rail_route_nodes_v1
    where esr_code=v_code and authority_state='CONFIRMED'
  ) then
    return jsonb_build_object('esrCode',v_code,'authority','TRUSTED_XLSX_SOURCE_ROW');
  end if;

  select ca.destination into v_dest
  from portal_private.client_applications ca
  where ca.linked_deal_key=p_deal_key
     or exists(
       select 1 from portal_private.deal_registrations dr
       where dr.deal_key=p_deal_key and dr.application_key=ca.id
     )
  order by (ca.linked_deal_key=p_deal_key) desc,ca.updated_at desc nulls last,ca.created_at desc
  limit 1;

  if v_dest is not null then
    v_match:=regexp_match(v_dest,'([0-9]{6})');
    if v_match is not null and exists(
      select 1 from portal_private.rail_route_nodes_v1
      where esr_code=v_match[1] and authority_state='CONFIRMED'
    ) then
      return jsonb_build_object(
        'esrCode',v_match[1],
        'authority','CLIENT_APPLICATION_EXPLICIT_ESR',
        'destinationText',v_dest
      );
    end if;

    select a.esr_code into v_code
    from portal_private.rail_station_aliases_v1 a
    where a.authority_state='CONFIRMED'
      and portal_private.rail_normalize_station_text_v1(v_dest) like '%'||a.alias_key||'%'
    order by length(a.alias_key) desc
    limit 1;

    if v_code is not null then
      return jsonb_build_object(
        'esrCode',v_code,
        'authority','CLIENT_APPLICATION_STATION_ALIAS',
        'destinationText',v_dest
      );
    end if;
  end if;

  select m.code into v_code
  from portal_private.rail_documents rd
  cross join lateral (
    select captures[1] as code
    from regexp_matches(coalesce(rd.route_text,''),'([0-9]{6})','g') with ordinality r(captures,ord)
    order by ord desc limit 1
  ) m
  where rd.deal_key=p_deal_key and rd.lifecycle_state::text='ACTIVE'
    and exists(
      select 1 from portal_private.rail_route_nodes_v1
      where esr_code=m.code and authority_state='CONFIRMED'
    )
  order by rd.document_date desc nulls last
  limit 1;

  if v_code is not null then
    return jsonb_build_object('esrCode',v_code,'authority','RAIL_DOCUMENT_ROUTE_TEXT');
  end if;

  return null;
end
$fn$;

revoke all on function portal_private.rail_detect_deal_destination_v1(uuid)
from public,anon,authenticated;

select portal_private.rail_route_refresh_assignments_v1();

commit;
