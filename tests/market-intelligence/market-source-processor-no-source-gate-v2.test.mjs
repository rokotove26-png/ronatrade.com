import fs from 'node:fs';
import assert from 'node:assert/strict';

const migration=fs.readFileSync(
  'supabase/migrations/20260928155000_market_source_processor_no_source_gate_v2.sql',
  'utf8'
);
const rollback=fs.readFileSync(
  'supabase/rollback/20260928155000_market_source_processor_no_source_gate_v2.rollback.sql',
  'utf8'
);

assert.match(migration,/market_intelligence_source_processor_cron_tick_v2/);
assert.match(migration,/market_intelligence_source_processor_control/);
assert.match(migration,/processing_status in \('INGESTED','NO_RELEVANT_DATA','UNVERIFIED'\)/);
assert.match(migration,/last_status='NO_SOURCE'/);
assert.match(migration,/'edge_invoked',false/);
assert.match(migration,/invoke_market_intelligence_source_processor_v1\('run'\)/);
assert.match(migration,/cron\.alter_job/);
assert.doesNotMatch(migration,/delete\s+from/i);
assert.doesNotMatch(migration,/drop\s+table/i);
assert.match(rollback,/invoke_market_intelligence_source_processor_v1\(''run''\)/);
assert.match(rollback,/drop function if exists portal_private\.market_intelligence_source_processor_cron_tick_v2/);

console.log('MARKET SOURCE PROCESSOR NO-SOURCE GATE V2 CONTRACT PASS');
