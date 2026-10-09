import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync('supabase/migrations/20261010003000_lpg_verified_full_platts_backfill_v14.sql','utf8');

test('LPG backfill accepts only verified full source documents',()=>{
  for (const required of ["source_family='PLATTS'","data_status='CONFIRMED'","processing_state='INGESTED'","source_date","checksum_sha256","mi_curve_code_value_v1"]) {
    assert.ok(migration.includes(required),required);
  }
});

test('LPG backfill is idempotent and only preserves source-proven facts',()=>{
  assert.match(migration,/ON CONFLICT \(fact_id\) DO NOTHING/i);
  assert.match(migration,/raw_quotes_private/);
  assert.match(migration,/lpg_history/);
});
