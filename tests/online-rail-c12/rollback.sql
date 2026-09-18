\set ON_ERROR_STOP on

begin;

drop function if exists portal_private.rail_xlsx_owner_resolution_bridge_v1(
  uuid,uuid,uuid,uuid,uuid,text,uuid,uuid,text,text,jsonb,jsonb,jsonb
);
drop function if exists portal_private.rail_xlsx_rail_resolution_bridge_v1(
  uuid,uuid,uuid,uuid,text,uuid,uuid,text,jsonb,jsonb,jsonb
);

commit;

do $$
begin
  if to_regprocedure('portal_private.rail_xlsx_owner_resolution_bridge_v1(uuid,uuid,uuid,uuid,uuid,text,uuid,uuid,text,text,jsonb,jsonb,jsonb)') is not null
     or to_regprocedure('portal_private.rail_xlsx_rail_resolution_bridge_v1(uuid,uuid,uuid,uuid,text,uuid,uuid,text,jsonb,jsonb,jsonb)') is not null then
    raise exception 'C12_ROLLBACK_INCOMPLETE';
  end if;
  if to_regclass('portal_private.rail_xlsx_dislocation_events_v1') is null
     or to_regclass('portal_private.rail_xlsx_source_receipts_v1') is null then
    raise exception 'C12_ROLLBACK_DAMAGED_ACCEPTED_BASE';
  end if;
end
$$;

select 'C12_ROLLBACK=PASS' as result;