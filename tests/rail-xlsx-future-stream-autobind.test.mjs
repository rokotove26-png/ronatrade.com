import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration=fs.readFileSync(
  'supabase/migrations/20260922122000_rail_xlsx_future_stream_autobind_v1.sql',
  'utf8'
);

test('future Rail XLSX snapshots inherit a stream only after an exact full-match scope',()=>{
  for(const marker of [
    'rail_xlsx_source_stream_autobind_v1',
    "v_matched_count<>v_event_count",
    'v_deal_count<>1',
    'v_doc_count<>1',
    "rd.lifecycle_state::text='ACTIVE'",
    "d.lifecycle_state::text='ACTIVE'",
    "count(distinct ss.stream_key)",
    "if v_stream_count<>1",
    "FULL_SOURCE_MATCHED_SINGLE_DEAL_DOCUMENT_SINGLE_PRIOR_BOUND_STREAM",
  ]) assert.ok(migration.includes(marker), marker);
});

test('source-stream inheritance does not use contextual similarity as authority',()=>{
  assert.ok(migration.includes("'filenameUsed',false"));
  assert.ok(migration.includes("'stationSimilarityUsed',false"));
  assert.ok(migration.includes("'routeSimilarityUsed',false"));
  assert.ok(migration.includes("'cargoSimilarityUsed',false"));
  assert.doesNotMatch(migration,/original_filename\s*=|original_filename\s+like|station_name\s*=|route_text\s*=/i);
});

test('resolution insert automatically retries fail-closed stream inheritance and refreshes projection',()=>{
  assert.ok(migration.includes('after insert on portal_private.rail_xlsx_resolution_decisions_v1'));
  assert.ok(migration.includes('rail_xlsx_resolution_stream_autobind_trigger_v1'));
  assert.ok(migration.includes('portal_private.rail_xlsx_refresh_wagon_projection_v1(v_deal_key)'));
  assert.ok(migration.includes('Backfill every existing canonical source'));
});

test('file SHA remains provenance rather than comparison-stream identity',()=>{
  assert.ok(migration.includes("'sourceChecksumSha256',lower(v_source.checksum_sha256)"));
  assert.ok(migration.includes("'comparisonPolicy','STABLE_SOURCE_STREAM_NOT_FILE_SHA'"));
  assert.doesNotMatch(migration,/stream_key\s*:?=\s*.*checksum_sha256/i);
});
