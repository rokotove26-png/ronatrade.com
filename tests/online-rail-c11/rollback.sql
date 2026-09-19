-- ONLINE RAIL #644 / C1.1 rollback rehearsal only.
\set ON_ERROR_STOP on
begin;

drop function if exists portal_private.rail_xlsx_source_capture_register_v1(
  text,text,bigint,text,timestamptz,text,text,text,text,text,uuid,uuid,text
);
drop table if exists portal_private.rail_xlsx_source_receipts_v1;
drop index if exists portal_private.rail_xlsx_source_sha_identity_unique_v1;

commit;

do $$
begin
  if to_regclass('portal_private.rail_xlsx_source_receipts_v1') is not null then
    raise exception 'C11_ROLLBACK_RECEIPT_TABLE_REMAINS';
  end if;
  if to_regprocedure('portal_private.rail_xlsx_source_capture_register_v1(text,text,bigint,text,timestamp with time zone,text,text,text,text,text,uuid,uuid,text)') is not null then
    raise exception 'C11_ROLLBACK_CAPTURE_FUNCTION_REMAINS';
  end if;
  if to_regclass('portal_private.rail_xlsx_dislocation_events_v1') is null then
    raise exception 'C11_ROLLBACK_DAMAGED_B15';
  end if;
end $$;

select 'C11_ROLLBACK=PASS' as result;