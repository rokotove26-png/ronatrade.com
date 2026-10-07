import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sql=await readFile('supabase/migrations/20261007223500_analytics_publication_semantics_v2.sql','utf8');

test('Analytics publication semantics are dynamic and fail closed',()=>{
  for(const token of [
    'market_intelligence_daily_metrics_v2',
    "f.delivery_month=(select target_month from target)",
    "s.target_month=(select target_month from target)",
    "v_item_freshness:=case when v_m.latest_date is null then 'TO_VERIFY_FRESHNESS' when v_m.latest_date<v_expected_platts then 'STALE_SOURCE' else 'CURRENT' end",
    "v_mtd_label:='MTD '||to_char(v_m.latest_date,'MM.YYYY')",
    "v_forward_label:='FORWARD '||to_char(v_m.target_month,'MM.YYYY')",
    "'target_month',to_char(v_m.target_month,'YYYY-MM')",
    "'source_freshness_state','TO_VERIFY_FRESHNESS'"
  ]) assert.ok(sql.includes(token), 'missing semantic guard: '+token);

  for(const stale of [
    "target_month=date '2026-09-01'",
    "delivery_month=date '2026-08-01'",
    'MTD АВГУСТ',
    'FORWARD СЕНТЯБРЬ',
    'сентябрьский forward',
    'September forward',
    "'target_month','2026-09'",
    'Platts Sep/Oct',
    'Platts Propane Sep'
  ]) assert.equal(sql.includes(stale),false,'stale period semantic returned: '+stale);
});

test('Forecast auto-snapshot does not manufacture a new target',()=>{
  assert.ok(sql.includes("where product=r.product and target_month=r.target_month"));
  assert.ok(sql.includes("if prev.snapshot_id is null or r.forward_usd_t is null then continue; end if;"));
  assert.ok(sql.includes("values(snap_id,current_date,r.target_month,r.product"));
  assert.ok(sql.includes('scenario_corridor_changed'));
});

test('Visual freeze and authority boundaries are explicit',()=>{
  assert.ok(sql.includes('No raw market-fact, price, DOM, CSS or visual-asset mutation.'));
  assert.ok(sql.includes('6ce870c7-3d04-4f18-a588-aabc44b1ff90'));
  assert.ok(sql.includes('9fbd8563-bf93-47f1-8083-bc8155dcfdcc'));
  assert.equal(/update\s+portal_private\.market_intelligence_facts/i.test(sql),false);
  assert.equal(/delete\s+from\s+portal_private\.market_intelligence_facts/i.test(sql),false);
  assert.equal(/update\s+portal_private\.owner_price_snapshots/i.test(sql),false);
});
