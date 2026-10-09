import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync('supabase/migrations/20261010003000_lpg_verified_full_platts_backfill_v14.sql','utf8');
const scheduler = readFileSync('supabase/migrations/20261010003100_lpg_full_source_cron_v14.sql','utf8');

test('LPG backfill requires confirmed full European Marketscan sources',()=>{
  for(const token of ["source_family='PLATTS'","data_status='CONFIRMED'","processing_state='INGESTED'","checksum_sha256","mi_curve_code_value_v1","ABWFX00","AAHIK00","AAHIM00"]) {
    assert.ok(migration.includes(token), token);
  }
});
test('No interpolation, no overwrite, one date and maturity at a time',()=>{
  assert.match(migration,/DISTINCT ON \(s.source_date\)/i);
  assert.match(migration,/ON CONFLICT \(fact_id\) DO NOTHING/i);
  assert.match(migration,/raw_quotes_private/);
  assert.ok(!/UPDATE portal_private.market_intelligence_facts/i.test(migration));
});
test('Cron source-contract guarded and unchanged forecast stack retained',()=>{
  assert.match(scheduler,/LPG_V14_SOURCE_DRIFT/);
  assert.match(scheduler,/mi_backfill_lpg_observations_v14/);
  assert.match(scheduler,/lpg_history/);
  assert.match(scheduler,/EXECUTE src/);
});
