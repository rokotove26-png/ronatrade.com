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

test('B1 creates a separate append-only XLSX history layer',()=>{
  assert.match(migration,/create table if not exists portal_private\.rail_xlsx_dislocation_events_v1/i);
  assert.match(migration,/before update or delete on portal_private\.rail_xlsx_dislocation_events_v1/i);
  assert.match(migration,/RAIL_XLSX_DISLOCATION_APPEND_ONLY/);
  assert.doesNotMatch(migration,/insert\s+into\s+portal_private\.rail_movement_events/i);
  assert.doesNotMatch(migration,/alter\s+table\s+portal_private\.rail_movement_events/i);
});

test('source-lock contains batch file checksum raw row and fingerprints',()=>{
  for(const marker of [
    'import_batch_id uuid not null',
    'source_object_id uuid not null',
    'source_checksum_sha256 text not null',
    'source_row_number integer not null',
    'source_row_fingerprint text not null',
    'source_row jsonb not null',
    'semantic_fingerprint text not null',
    'event_identity_fingerprint text not null',
    'provenance jsonb not null'
  ]) assert.match(migration,new RegExp(marker.replace(/[.*+?^$\{\}()|[\]\\]/g,'\\$&'),'i'));
});

test('resolution and timezone states are fail closed',()=>{
  for(const state of ['MATCHED','TO_VERIFY','UNRESOLVED','CONFLICT']){
    assert.match(migration,new RegExp("'"+state+"'"));
  }
  for(const state of ['EXPLICIT_OFFSET','SOURCE_DECLARED','UNKNOWN','INVALID']){
    assert.match(migration,new RegExp("'"+state+"'"));
  }
  assert.match(migration,/RAIL_XLSX_PARSED_TIME_WITHOUT_SOURCE_TIMEZONE/);
  assert.match(migration,/semantic_variant_count > 1 then 'CONFLICT'/);
});

test('replay is idempotent and row reinterpretation is rejected',()=>{
  assert.match(migration,/IDEMPOTENT_REPLAY/);
  assert.match(migration,/RAIL_XLSX_SOURCE_ROW_REINTERPRETATION_CONFLICT/);
  assert.match(migration,/unique index if not exists rail_xlsx_event_source_row_unique_v1/i);
  assert.match(migration,/source_object_id, source_row_number/);
});

test('canonical Deal and GU-12/document scope is reused, never recreated',()=>{
  assert.match(migration,/foreign key \(deal_key\)\s+references portal_private\.deals\(id\)/i);
  assert.match(migration,/foreign key \(rail_document_key\)\s+references portal_private\.rail_documents\(id\)/i);
  assert.match(migration,/RAIL_XLSX_DEAL_DOCUMENT_SCOPE_CONFLICT/);
  assert.doesNotMatch(migration,/create table[^;]+deal_registry/is);
});

test('rail_wagons is only refreshed from latest trusted XLSX state',()=>{
  assert.match(migration,/rail_xlsx_dislocation_latest_trusted_v1/);
  assert.match(migration,/from portal_private\.rail_xlsx_dislocation_latest_trusted_v1 s/i);
  assert.match(migration,/position_source_event_id/);
  assert.match(migration,/position_semantic_fingerprint/);
  assert.match(migration,/rw\.position_source_system is null\s+or rw\.position_source_system='EXPEDITOR_XLSX_VIA_RAIL_AI'/);
  assert.doesNotMatch(migration,/current_station_name\s*=\s*case when s\.latest_position_status/);
});

test('newest untrusted observation remains fail closed without erasing older trusted projection',()=>{
  assert.match(migration,/rail_xlsx_dislocation_latest_state_v1/);
  assert.match(migration,/rail_xlsx_dislocation_latest_trusted_v1/);
  assert.match(migration,/failClosedLatestStates/);
  assert.match(migration,/'station',case when dw\.latest_observation_status='TRUSTED' then dw\.current_station_name else null end/);
  assert.match(migration,/'positionStatus',coalesce\(dw\.latest_observation_status,dw\.position_resolution_status,'UNRESOLVED'\)/);
});

test('Admin read model is Deal-owned and keeps planned route separate from actual position',()=>{
  assert.match(migration,/public\.rona_admin_rail_deal_read_model_v1/);
  assert.match(migration,/'selectionOwner','DEAL'/);
  assert.match(migration,/'selectionKey','deal_key'/);
  assert.match(migration,/'plannedRoute'/);
  assert.match(migration,/'wagonPositions'/);
  assert.match(migration,/'sourcePolicy','EXPEDITOR_XLSX_VIA_RAIL_AI'/);
  assert.match(migration,/owner_r1_actor\('ADMIN'\)/);
});

test('coordinates are never fabricated in B1',()=>{
  assert.match(migration,/'trustedCoordinates',null/);
  assert.match(migration,/'coordinateProvenance',null/);
  assert.doesNotMatch(migration,/latitude\s+(numeric|double|real)/i);
  assert.doesNotMatch(migration,/longitude\s+(numeric|double|real)/i);
  assert.match(design,/future station directory must have independent source-lock/i);
});

test('station grouping supports one cluster with expanded wagon list',()=>{
  assert.match(migration,/'positionGroups'/);
  assert.match(migration,/'clusterKey'/);
  assert.match(migration,/'wagonCount',count\(\*\)/);
  assert.match(migration,/'wagonNumbers',jsonb_agg\(dw\.wagon_number order by dw\.wagon_number\)/);
  assert.match(migration,/ESR:/);
  assert.match(migration,/STATION:/);
});

test('B1 remains architecture-only and does not activate provider or client publication',()=>{
  assert.match(design,/NOT DEPLOYED \/ NOT MERGED/);
  assert.match(design,/does \*\*not\*\*.*enable MOVIZOR, provider polling or Client publication/is);
  assert.doesNotMatch(migration,/cron\.schedule/i);
  assert.doesNotMatch(migration,/rail_monitoring_targets\s*\(/i);
  assert.doesNotMatch(migration,/publication_client_targets\s*\(/i);
});
