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

test('B1.1 keeps a separate append-only XLSX evidence layer',()=>{
  assert.match(migration,/create table if not exists portal_private\.rail_xlsx_dislocation_events_v1/i);
  assert.match(migration,/before update or delete on portal_private\.rail_xlsx_dislocation_events_v1/i);
  assert.doesNotMatch(migration,/insert\s+into\s+portal_private\.rail_movement_events/i);
  assert.doesNotMatch(migration,/alter\s+table\s+portal_private\.rail_movement_events/i);
});

test('timezone-unresolved evidence preserves local wall clock and forbids fabricated UTC',()=>{
  assert.match(migration,/event_at_local timestamp without time zone not null/i);
  assert.match(migration,/raw_timestamp text not null/i);
  assert.match(migration,/source_time_domain text not null/i);
  assert.match(migration,/source_timezone_status in \([\s\S]*'UNRESOLVED'/i);
  assert.match(migration,/RAIL_XLSX_UTC_FORBIDDEN_WITH_UNRESOLVED_TIMEZONE/);
  assert.match(migration,/parsed_event_at is null/i);
  assert.match(migration,/LOCAL_DOMAIN:'\|\|v_source_time_domain/i);
});

test('TO_VERIFY can become MATCHED only through append-only resolution overlay',()=>{
  assert.match(migration,/create table if not exists portal_private\.rail_xlsx_resolution_decisions_v1/i);
  assert.match(migration,/rail_xlsx_resolution_decide_v1/);
  assert.match(migration,/resulting_status text not null/i);
  assert.match(migration,/actor_source text not null/i);
  assert.match(migration,/decided_at timestamptz not null/i);
  assert.match(migration,/reason_evidence jsonb not null/i);
  assert.match(migration,/coalesce\(lr\.resulting_status,e\.resolution_status\)/i);
  assert.match(migration,/before update or delete on portal_private\.rail_xlsx_resolution_decisions_v1/i);
});

test('explicit correction and supersession are append-only and never inferred from a new file',()=>{
  assert.match(migration,/create table if not exists portal_private\.rail_xlsx_correction_decisions_v1/i);
  assert.match(migration,/correction_event_id uuid not null/i);
  assert.match(migration,/correction_of_event_id uuid not null/i);
  assert.match(migration,/relation_type in \('CORRECTION_OF','SUPERSEDES'\)/i);
  assert.match(migration,/rail_xlsx_correction_decide_v1/);
  assert.match(migration,/before update or delete on portal_private\.rail_xlsx_correction_decisions_v1/i);
  assert.match(design,/new file.*never.*correction/i);
});

test('direct evidence INSERT is blocked and service_role writes only through ingest function',()=>{
  assert.match(migration,/revoke all on table portal_private\.rail_xlsx_dislocation_events_v1[\s\S]*service_role/i);
  assert.match(migration,/grant select on table portal_private\.rail_xlsx_dislocation_events_v1[\s\S]*to service_role/i);
  assert.doesNotMatch(migration,/grant\s+insert\s+on\s+table\s+portal_private\.rail_xlsx_dislocation_events_v1/i);
  assert.match(migration,/grant execute on function portal_private\.rail_xlsx_dislocation_ingest_v1/i);
});

test('ingest verifies exact XLSX source policy system type contract version and time domain',()=>{
  assert.match(migration,/v_source\.source_system <> 'RAIL_AI'/);
  assert.match(migration,/v_source\.source_object_type <> 'XLSX_WAGON_DISLOCATION'/);
  assert.match(migration,/v_source\.source_version.*'RAIL_XLSX_DISLOCATION_V1'/s);
  assert.match(migration,/v_source_policy <> 'EXPEDITOR_XLSX_VIA_RAIL_AI'/);
  assert.match(migration,/v_source_contract_version <> 'RAIL_XLSX_DISLOCATION_CONTRACT_V1'/);
  assert.match(migration,/v_source_time_domain is null/);
  assert.match(migration,/RAIL_XLSX_SOURCE_POLICY_CONTRACT_MISMATCH/);
});

test('source_timestamp on rail_wagons is source receipt timestamp, not railway event time',()=>{
  assert.match(migration,/v_source_received_at := coalesce\(v_source\.source_timestamp, v_batch\.source_timestamp\)/);
  assert.match(migration,/source_timestamp=s\.source_received_at/);
  assert.doesNotMatch(migration,/source_timestamp\s*=\s*s\.parsed_event_at/);
});

test('B1.1 does not auto-create rail_wagons until status semantics are separated',()=>{
  const refresh=migration.slice(migration.indexOf('create or replace function portal_private.rail_xlsx_refresh_wagon_projection_v1'));
  assert.doesNotMatch(refresh,/insert\s+into\s+portal_private\.rail_wagons/i);
  assert.match(refresh,/NO_AUTO_CREATE_UNTIL_REGISTRATION_VS_OPERATIONAL_STATUS_IS_SEPARATED/);
  assert.match(design,/REGISTERED.*not.*operational/i);
});

test('latest-state compares unresolved local timestamps only within exact source time-domain',()=>{
  assert.match(migration,/else 'LOCAL:'\|\|e\.source_time_domain/i);
  assert.match(migration,/case when e\.parsed_event_at is null then e\.event_at_local end desc/i);
  assert.match(migration,/There is deliberately no cross-domain ordering for unresolved local time/i);
});

test('Admin read model exposes unresolved timezone evidence before UTC resolution',()=>{
  assert.match(migration,/wagonPositions/);
  assert.match(migration,/'eventAtLocal',o\.event_at_local/);
  assert.match(migration,/'eventTimestamp',o\.parsed_event_at/);
  assert.match(migration,/'sourceTimezoneStatus',o\.source_timezone_status/);
  assert.match(migration,/'sourceTimeDomain',o\.source_time_domain/);
  assert.match(migration,/'comparisonDomain',o\.comparison_domain/);
  assert.match(migration,/latest_state compares[\s\S]*local wall-clock only inside the exact source_time_domain/i);
});

test('Deal ownership, planned route separation, no fabricated GEO, MOVIZOR isolation remain intact',()=>{
  assert.match(migration,/'selectionOwner','DEAL'/);
  assert.match(migration,/'selectionKey','deal_key'/);
  assert.match(migration,/'plannedRoute'/);
  assert.match(migration,/'wagonPositions'/);
  assert.match(migration,/'trustedCoordinates',null/);
  assert.match(migration,/'coordinateProvenance',null/);
  assert.doesNotMatch(migration,/cron\.schedule/i);
  assert.doesNotMatch(migration,/insert\s+into\s+portal_private\.rail_movement_events/i);
});
