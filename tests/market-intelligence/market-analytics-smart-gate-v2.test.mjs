import fs from 'node:fs';
import assert from 'node:assert/strict';

const migration=fs.readFileSync(
  'supabase/migrations/20260928152000_market_analytics_smart_gate_v2.sql',
  'utf8'
);
const rollback=fs.readFileSync(
  'supabase/rollback/20260928152000_market_analytics_smart_gate_v2.rollback.sql',
  'utf8'
);

assert.match(migration,/market_intelligence_analytics_cron_tick_v2/);
assert.match(migration,/coalesce\(v_ctl\.dirty,false\)=false/);
assert.match(migration,/v_minute<>0/);
assert.match(migration,/last_status='NO_CHANGE'/);
assert.match(migration,/refresh_market_intelligence_analytics_v1\('CRON_5MIN'\)/);
assert.match(migration,/cron\.alter_job/);
assert.match(migration,/market_intelligence_analytics_cron_tick_v2\(\)/);
assert.doesNotMatch(migration,/delete\s+from/i);
assert.doesNotMatch(migration,/drop\s+table/i);
assert.match(rollback,/refresh_market_intelligence_analytics_v1\(''CRON_5MIN''\)/);
assert.match(rollback,/drop function if exists portal_private\.market_intelligence_analytics_cron_tick_v2/);

console.log('MARKET ANALYTICS SMART GATE V2 CONTRACT PASS');
