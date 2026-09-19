-- ONLINE RAIL #644 / C1
-- QA rollback rehearsal for B1.5 objects only.
-- Never run in production without an explicit approved rollback plan.

\set ON_ERROR_STOP on

begin;

drop function if exists public.rona_admin_rail_deal_read_model_v1(text);

drop view if exists portal_private.rail_xlsx_dislocation_current_audit_v1;
drop view if exists portal_private.rail_xlsx_dislocation_current_position_v1;
drop view if exists portal_private.rail_xlsx_dislocation_latest_trusted_v1;
drop view if exists portal_private.rail_xlsx_dislocation_latest_state_v1;
drop view if exists portal_private.rail_xlsx_dislocation_effective_v1;
drop view if exists portal_private.rail_xlsx_resolution_effective_v1;

drop function if exists portal_private.rail_xlsx_refresh_wagon_projection_v1(uuid);
drop function if exists portal_private.rail_xlsx_correction_decide_v1(
  uuid,uuid,text,text,uuid,timestamptz,jsonb,jsonb
);
drop function if exists portal_private.rail_xlsx_resolution_decide_v1(
  uuid,text,uuid,uuid,text,uuid,timestamptz,jsonb,jsonb
);
drop function if exists portal_private.rail_xlsx_dislocation_ingest_v1(
  uuid,uuid,text,integer,jsonb,text,timestamp without time zone,text,text,
  uuid,uuid,text,text,text,timestamptz,text,text,jsonb,jsonb
);
drop function if exists portal_private.rail_xlsx_validate_correction_authority_v1(
  text,uuid,uuid,uuid,text,uuid,uuid
);
drop function if exists portal_private.rail_xlsx_validate_resolution_authority_v1(
  text,uuid,uuid,text,uuid,uuid
);

alter table portal_private.rail_wagons
  drop constraint if exists rail_wagons_position_source_event_fk,
  drop constraint if exists rail_wagons_position_source_object_fk;

alter table portal_private.rail_wagons
  drop column if exists position_source_system,
  drop column if exists position_source_policy,
  drop column if exists position_source_event_id,
  drop column if exists position_source_object_id,
  drop column if exists position_semantic_fingerprint,
  drop column if exists position_resolution_status,
  drop column if exists position_event_at_local,
  drop column if exists position_source_time_domain,
  drop column if exists position_source_timezone_status;

drop table if exists portal_private.rail_xlsx_correction_decisions_v1;
drop table if exists portal_private.rail_xlsx_resolution_decisions_v1;
drop table if exists portal_private.rail_xlsx_dislocation_events_v1;

drop function if exists portal_private.rail_xlsx_append_only_guard_v1();
drop function if exists portal_private.rail_xlsx_source_row_is_canonical_v1(
  jsonb,text,integer
);

drop index if exists portal_private.source_objects_id_import_batch_v1;

commit;

do $$
begin
  if to_regclass('portal_private.rail_xlsx_dislocation_events_v1') is not null
     or to_regclass('portal_private.rail_xlsx_resolution_decisions_v1') is not null
     or to_regclass('portal_private.rail_xlsx_correction_decisions_v1') is not null
     or to_regprocedure('public.rona_admin_rail_deal_read_model_v1(text)') is not null then
    raise exception 'C1_ROLLBACK_INCOMPLETE';
  end if;

  if to_regclass('portal_private.deals') is null
     or to_regclass('portal_private.rail_documents') is null
     or to_regclass('portal_private.rail_wagons') is null
     or to_regclass('portal_private.source_objects') is null then
    raise exception 'C1_ROLLBACK_DAMAGED_BASE_SUBSTRATE';
  end if;
end
$$;

select 'C1_ROLLBACK_REHEARSAL=PASS' as result;
