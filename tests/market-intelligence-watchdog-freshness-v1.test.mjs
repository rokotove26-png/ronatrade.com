import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const sql=readFileSync(new URL('../supabase/migrations/20260920044800_market_intelligence_watchdog_no_change_freshness_v1.sql',import.meta.url),'utf8');

test('watchdog uses last_run_at and accepts SUCCESS or NO_CHANGE',()=>{
  assert.match(sql,/c\.last_run_at[\s\S]*c\.last_success_at[\s\S]*c\.last_status[\s\S]*c\.last_error_code/i);
  assert.match(sql,/v_analytics_run\s+is\s+not\s+null[\s\S]*v_analytics_run>=now\(\)-interval '15 minutes'/i);
  assert.match(sql,/v_analytics_status\s+in\s*\('SUCCESS','NO_CHANGE'\)/i);
  assert.match(sql,/v_analytics_error\s+is\s+null/i);
});

test('watchdog preserves real source and safety degradations',()=>{
  for(const marker of [
    'PLATTS_SOURCE_STALE',
    'PRIMARY_TELEGRAM_UPSTREAM_DEGRADED',
    'MARKET_SOURCE_PROCESSOR_DEGRADED',
    'CURRENT_ANALYTICS_PUBLICATION_NOT_LIVE',
    'PRICE_AUTO_MUTATION_GUARD_BROKEN'
  ]) assert.ok(sql.includes(marker),marker);
  assert.match(sql,/auto_publish_price=false/i);
});

test('migration is monitoring-only',()=>{
  assert.doesNotMatch(sql,/\b(delete\s+from|truncate\s+|drop\s+table|drop\s+schema)\b/i);
  assert.doesNotMatch(sql,/update\s+portal_private\.publications\b/i);
  assert.doesNotMatch(sql,/update\s+portal_private\.owner_price_snapshots\b/i);
});
