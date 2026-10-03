-- Operational Rail current-position overlay.
-- Confirmed RAIL_LOGISTICS position supersedes stale XLSX only for current reads.
-- Historical XLSX evidence is retained and remains queryable in its source views.

create or replace view portal_private.rail_operational_current_position_v1
with (security_invoker=true)
as
select
  cp.effective_deal_key,
  cp.wagon_number,
  cp.candidate_observation_count,
  case when c.coordination_record_id is not null then 1::bigint else cp.comparison_domain_count end as comparison_domain_count,
  case when c.coordination_record_id is not null then 'TRUSTED'::text else cp.position_status end as position_status,
  coalesce(c.coordination_record_id,cp.current_event_id) as current_event_id,
  cp.current_rail_document_key,
  cp.current_rail_document_id,
  cp.current_gu12_number,
  case when c.coordination_record_id is not null then 'RAIL_LOGISTICS_CONFIRMATION'::text else cp.current_comparison_domain end as current_comparison_domain,
  coalesce(c.station_name,cp.current_station_name) as current_station_name,
  coalesce(c.station_code,cp.current_station_code) as current_station_code,
  case when c.coordination_record_id is not null then c.operation else cp.current_operation end as current_operation,
  case when c.coordination_record_id is not null then c.confirmed_at else cp.current_event_at end as current_event_at,
  case when c.coordination_record_id is not null then c.confirmed_at at time zone 'UTC' else cp.current_event_at_local end as current_event_at_local,
  case when c.coordination_record_id is not null then 'NOT_ASSERTED'::text else cp.current_raw_timestamp end as current_raw_timestamp,
  case when c.coordination_record_id is not null then 'UTC'::text else cp.current_source_timezone end as current_source_timezone,
  case when c.coordination_record_id is not null then 'CONFIRMATION_TIMESTAMP_NOT_MOVEMENT_EVENT'::text else cp.current_source_timezone_status end as current_source_timezone_status,
  case when c.coordination_record_id is not null then 'RAIL_LOGISTICS_CONFIRMATION'::text else cp.current_source_time_domain end as current_source_time_domain,
  case when c.coordination_record_id is not null then 'RAIL_LOGISTICS_AUTHORITY_CURRENT_POSITION_V1'::text else cp.source_policy end as source_policy,
  case when c.coordination_record_id is not null then 'RONA_RAIL_LOGISTICS_POSITION_AUTHORITY_V1'::text else cp.source_contract_version end as source_contract_version,
  case when c.coordination_record_id is not null then 'RAIL_LOGISTICS'::text else cp.source_system_snapshot end as source_system_snapshot,
  case when c.coordination_record_id is not null then 'AI_COORDINATION_RECORD'::text else cp.source_object_type_snapshot end as source_object_type_snapshot,
  case when c.coordination_record_id is not null then '1'::text else cp.source_version_snapshot end as source_version_snapshot,
  case when c.coordination_record_id is not null then c.confirmed_at else cp.source_received_at end as source_received_at,
  coalesce(c.coordination_record_id,cp.source_object_id) as source_object_id,
  case when c.coordination_record_id is not null then null::uuid else cp.import_batch_id end as import_batch_id,
  case when c.coordination_record_id is not null then c.payload_hash else cp.source_checksum_sha256 end as source_checksum_sha256,
  case when c.coordination_record_id is not null then 'RAIL_LOGISTICS_CONFIRMATION'::text else cp.source_sheet_name end as source_sheet_name,
  case when c.coordination_record_id is not null then c.wagon_ordinal else cp.source_row_number end as source_row_number,
  case when c.coordination_record_id is not null then 'coordination:'||c.coordination_record_id::text||':wagon:'||c.wagon_number else cp.source_row_locator end as source_row_locator,
  case when c.coordination_record_id is not null then md5(c.coordination_record_id::text||'|'||c.wagon_number||'|'||c.station_code||'|'||c.station_name) else cp.source_row_fingerprint end as source_row_fingerprint,
  case when c.coordination_record_id is not null then md5(c.deal_id||'|'||c.wagon_number||'|'||c.station_code||'|'||c.station_name) else cp.semantic_fingerprint end as semantic_fingerprint,
  case when c.coordination_record_id is not null then 'MATCHED'::text else cp.effective_resolution_status end as effective_resolution_status,
  case when c.coordination_record_id is not null then null::uuid else cp.resolution_decision_id end as resolution_decision_id,
  case when c.coordination_record_id is not null then 'RAIL_LOGISTICS'::text else cp.resolution_authority_type end as resolution_authority_type,
  case when c.coordination_record_id is not null then null::uuid else cp.resolution_actor_ref end as resolution_actor_ref,
  case when c.coordination_record_id is not null then jsonb_build_object(
    'authorityRole','RAIL_LOGISTICS',
    'authorityIdentityId','AI-RAIL-LOGISTICS',
    'coordinationRecordId',c.coordination_record_id,
    'authorityBasis',c.authority_basis,
    'businessFact','CURRENT_POSITION',
    'arrivalTimestampAsserted',false,
    'sourceRefs',c.source_refs,
    'evidenceRefs',c.evidence_refs
  ) else cp.source_provenance end as source_provenance
from portal_private.rail_xlsx_dislocation_current_position_v1 cp
left join portal_private.rail_logistics_confirmed_position_v1 c
  on c.deal_key=cp.effective_deal_key
 and c.wagon_number=cp.wagon_number;

revoke all on portal_private.rail_operational_current_position_v1 from public, anon, authenticated;
grant select on portal_private.rail_operational_current_position_v1 to service_role;

comment on view portal_private.rail_operational_current_position_v1 is
'Canonical current-position overlay for Rail-owned workflows: RAIL_LOGISTICS confirmation overrides stale XLSX for current display/lifecycle reads while historical XLSX remains intact.';
