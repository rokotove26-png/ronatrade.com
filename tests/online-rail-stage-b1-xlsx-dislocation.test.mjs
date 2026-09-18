import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration=fs.readFileSync(
  new URL('../supabase/migrations/20260919010000_rail_xlsx_dislocation_history_b1.sql',import.meta.url),
  'utf8'
);
const design=fs.readFileSync(
  new URL('../docs/online-rail-stage-b1-xlsx-dislocation.md',import.meta.url),
  'utf8'
);

test('B1.3 keeps XLSX evidence separate and append-only',()=>{
  assert.match(migration,/create table if not exists portal_private\.rail_xlsx_dislocation_events_v1/i);
  assert.match(migration,/before update or delete on portal_private\.rail_xlsx_dislocation_events_v1/i);
  assert.doesNotMatch(migration,/insert\s+into\s+portal_private\.rail_movement_events/i);
  assert.doesNotMatch(migration,/alter\s+table\s+portal_private\.rail_movement_events/i);
});

test('unresolved timezone preserves local wall clock and forbids fabricated UTC',()=>{
  assert.match(migration,/event_at_local timestamp without time zone not null/i);
  assert.match(migration,/raw_timestamp text not null/i);
  assert.match(migration,/source_time_domain text not null/i);
  assert.match(migration,/RAIL_XLSX_UTC_FORBIDDEN_WITH_UNRESOLVED_TIMEZONE/);
  assert.match(migration,/source_timezone_status in \([\s\S]*'UNRESOLVED'/i);
  assert.match(migration,/parsed_event_at is null/i);
  assert.match(migration,/LOCAL_DOMAIN:'\|\|v_source_time_domain/i);
});

test('canonical source locator includes source object sheet and row',()=>{
  assert.match(migration,/source_sheet_name text not null/i);
  assert.match(migration,/source_row_locator text generated always as/i);
  assert.match(migration,/source_object_id::text \|\| '\|' \|\| source_sheet_name \|\| '\|' \|\| source_row_number::text/i);
  assert.match(migration,/source_object_id, source_sheet_name, source_row_number/i);
  assert.match(migration,/p_source_sheet_name text/i);
});

test('source_row canonical shape is table-validated and preserves raw cell semantics',()=>{
  assert.match(migration,/rail_xlsx_source_row_is_canonical_v1/);
  assert.match(migration,/RAIL_XLSX_SOURCE_ROW_V1/);
  assert.match(migration,/rawType/);
  assert.match(migration,/rawValue/);
  assert.match(migration,/source_row_canonical/i);
  assert.match(design,/rawValue.*0/is);
  assert.match(design,/leading zeros/is);
});

test('wagon number is exactly eight digits at schema and ingest levels',()=>{
  assert.match(migration,/wagon_number ~ '\^\[0-9\]\{8\}\$'/);
  assert.match(migration,/v_wagon !~ '\^\[0-9\]\{8\}\$'/);
  assert.match(migration,/RAIL_XLSX_WAGON_NUMBER_MUST_BE_8_DIGITS/);
  assert.match(migration,/RAIL_XLSX_WAGON_NORMALIZED_RAW_MISMATCH/);
});

test('TO_VERIFY can become MATCHED only through append-only decision overlay',()=>{
  assert.match(migration,/create table if not exists portal_private\.rail_xlsx_resolution_decisions_v1/i);
  assert.match(migration,/rail_xlsx_resolution_decide_v1/);
  assert.match(migration,/resulting_status text not null/i);
  assert.match(migration,/authority_type text not null/i);
  assert.match(migration,/actor_ref uuid not null/i);
  assert.match(migration,/before update or delete on portal_private\.rail_xlsx_resolution_decisions_v1/i);
  assert.match(migration,/coalesce\(lr\.resulting_status,e\.resolution_status\)/i);
});

test('business authority is constrained and resolved through existing immutable substrate',()=>{
  assert.match(migration,/'OWNER_EXPLICIT_INSTRUCTION'/);
  assert.match(migration,/'RAIL_LOGISTICS_VERIFIED_DECISION'/);
  assert.match(migration,/'OWNER_EXPLICIT_CORRECTION'/);
  assert.match(migration,/'RAIL_LOGISTICS_VERIFIED_EXPEDITOR_CORRECTION'/);
  assert.doesNotMatch(migration,/actor_source text/i);
  assert.match(migration,/from portal_private\.audit_events/i);
  assert.match(migration,/from portal_private\.ai_coordination_records/i);
  assert.match(migration,/functional_role::text <> 'RAIL_LOGISTICS'/);
  assert.match(migration,/identity_id <> 'AI-RAIL-LOGISTICS'/);
  assert.match(migration,/record_type <> 'FUNCTIONAL_CONCLUSION'/);
  assert.match(migration,/status <> 'APPROVED'/);
  assert.match(design,/service_role.*executor/is);
  assert.match(design,/SYSTEM_ADMIN.*executor/is);
});

test('correction scope validates same wagon deal document and blocks incompatible supersession fork',()=>{
  assert.match(migration,/RAIL_XLSX_CORRECTION_WAGON_MISMATCH/);
  assert.match(migration,/RAIL_XLSX_CORRECTION_DEAL_SCOPE_MISMATCH/);
  assert.match(migration,/RAIL_XLSX_CORRECTION_DOCUMENT_SCOPE_MISMATCH/);
  assert.match(migration,/RAIL_XLSX_CORRECTION_TARGET_ALREADY_SUPERSEDED_INCOMPATIBLY/);
  assert.match(migration,/RAIL_XLSX_CORRECTION_NEW_EVIDENCE_PROVENANCE_REQUIRED/);
  assert.match(migration,/rail_xlsx_validate_correction_authority_v1/);
  assert.match(migration,/No equality requirement for event_identity_fingerprint or source_time_domain/i);
});

test('direct evidence INSERT is blocked',()=>{
  assert.match(migration,/revoke all on table portal_private\.rail_xlsx_dislocation_events_v1[\s\S]*service_role/i);
  assert.match(migration,/grant select on table portal_private\.rail_xlsx_dislocation_events_v1[\s\S]*to service_role/i);
  assert.doesNotMatch(migration,/grant\s+insert\s+on\s+table\s+portal_private\.rail_xlsx_dislocation_events_v1/i);
  assert.match(migration,/grant execute on function portal_private\.rail_xlsx_dislocation_ingest_v1/i);
});

test('ingest verifies exact source policy contract and receipt timestamp',()=>{
  assert.match(migration,/v_source\.source_system <> 'RAIL_AI'/);
  assert.match(migration,/v_source\.source_object_type <> 'XLSX_WAGON_DISLOCATION'/);
  assert.match(migration,/v_source\.source_version[\s\S]*'RAIL_XLSX_DISLOCATION_V1'/);
  assert.match(migration,/v_source_policy <> 'EXPEDITOR_XLSX_VIA_RAIL_AI'/);
  assert.match(migration,/v_source_contract_version <> 'RAIL_XLSX_DISLOCATION_CONTRACT_V1'/);
  assert.match(migration,/v_source_received_at:=coalesce\(v_source\.source_timestamp,v_batch\.source_timestamp\)/);
  assert.match(migration,/source_timestamp=cp\.source_received_at/);
  assert.doesNotMatch(migration,/source_timestamp\s*=\s*cp\.current_event_at/);
});

test('B1.5 current eligibility is built only from TRUSTED latest observations',()=>{
  assert.match(migration,/rail_xlsx_dislocation_current_position_v1/);
  assert.match(migration,/from portal_private\.rail_xlsx_dislocation_latest_trusted_v1 l/i);
  assert.match(migration,/group by c\.effective_deal_key,c\.wagon_number/i);
  assert.match(migration,/count\(distinct c\.comparison_domain\) as comparison_domain_count/i);
  assert.match(migration,/when s\.comparison_domain_count>1 then 'CROSS_DOMAIN_AMBIGUOUS'/);
  assert.match(migration,/else 'TRUSTED'/);
  assert.match(migration,/0 TRUSTED observations => no row in the business-current view/i);
});

test('B1.5 audit retains pending and non-current candidates even when trusted current exists',()=>{
  assert.match(migration,/rail_xlsx_dislocation_current_audit_v1/);
  assert.match(migration,/from portal_private\.rail_xlsx_dislocation_latest_state_v1 l/i);
  assert.match(migration,/left join portal_private\.rail_xlsx_dislocation_current_position_v1 cp/i);
  assert.match(migration,/where cp\.current_event_id is null[\s\S]*or l\.id<>cp\.current_event_id/i);
  assert.match(migration,/coalesce\(cp\.position_status,'NO_TRUSTED_CURRENT'\)/i);
  assert.match(migration,/'positionAuditDetails'/);
  assert.match(migration,/candidate_position_status in \('TO_VERIFY','UNRESOLVED','CONFLICT'\)/i);
  assert.match(migration,/where cp\.position_status='TRUSTED'[\s\S]*comparison_domain_count=1/i);
  assert.match(migration,/position_status='TRUSTED'[\s\S]*current_station_name is not null/i);
});

test('rail_wagons is not auto-created and source system/policy are separated',()=>{
  const refresh=migration.slice(migration.indexOf('create or replace function portal_private.rail_xlsx_refresh_wagon_projection_v1'));
  assert.doesNotMatch(refresh,/insert\s+into\s+portal_private\.rail_wagons/i);
  assert.match(refresh,/crossDomainAmbiguousBlocked/);
  assert.match(migration,/position_source_system text/);
  assert.match(migration,/position_source_policy text/);
  assert.match(migration,/position_source_system=cp\.source_system_snapshot/);
  assert.match(migration,/position_source_policy=cp\.source_policy/);
});

test('Deal ownership, planned route separation, GEO safety, MOVIZOR isolation remain intact',()=>{
  assert.match(migration,/'selectionOwner','DEAL'/);
  assert.match(migration,/'selectionKey','deal_key'/);
  assert.match(migration,/'plannedRoute'/);
  assert.match(migration,/'wagonPositions'/);
  assert.match(migration,/'trustedCoordinates',null/);
  assert.match(migration,/'coordinateProvenance',null/);
  assert.doesNotMatch(migration,/cron\.schedule/i);
  assert.doesNotMatch(migration,/insert\s+into\s+portal_private\.rail_movement_events/i);
});
