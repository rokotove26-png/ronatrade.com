import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {onRequest} from '../functions/portal/analytics-v2-ui.js';

test('V10 preserves all CPT cards with explicit missing-source status and no fabricated prices',async()=>{
  const res=await onRequest({});
  assert.equal(res.status,200);
  const runtime=await res.text();
  new Function(runtime);
  for(const token of [
    'MISSING_CONFIRMED_ROUTE_TARIFF',
    'Нет допущенного к расчёту полного ЖД тарифа',
    'Не рассчитана',
    'ronaPricingCardsReviewed',
    'PLATTS_NETBACK_PLUS_CONFIRMED_RAIL_V1',
    'Индикативно, не коммерческая оферта.'
  ])assert.ok(runtime.includes(token),'Missing V10 source status: '+token);
  assert.equal((runtime.match(/function adminCompactChart\\(root,product,key\\)/g)||[]).length,1);
  assert.ok(!runtime.includes('source-observation-gaps-v13'));
});

test('V10 leaves original V9 SQL and canonical published price records untouched',()=>{
  const source=readFileSync('functions/portal/analytics-v2-ui.js','utf8');
  assert.ok(source.includes("priceCardV10.dataset.pricingMode='MISSING_CONFIRMED_ROUTE_TARIFF'"));
  assert.ok(source.includes("priceCardV10.dataset.pricingMode==='PLATTS_NETBACK_PLUS_CONFIRMED_RAIL_V1'"));
  assert.ok(!source.includes('141.11'));
  const sql=readFileSync('supabase/migrations/20261011011500_analytics_lpg_platts_netback_owner_tariff_v9.sql','utf8');
  assert.ok(sql.includes("t.status='WORKING_CONFIRMED'"));
  assert.ok(sql.includes("t.route_text LIKE 'Озинки → %'"));
});
