import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {onRequest} from '../functions/portal/analytics-v2-ui.js';
const read=p=>readFileSync(p,'utf8');
const hash=s=>createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0'+s).digest('hex');
const v10=JSON.parse(read('governance/analytics-v10-lpg-five-cpt-source-coverage-20261011.json'));
const v9=JSON.parse(read('governance/analytics-v9-lpg-netback-approved-rail-20261011.json'));

test('V10 authorized successor preserves V9 and frozen client with exact source bytes',()=>{
  assert.equal(v10.approval,'OWNER_IN_CHAT');
  assert.equal(v10.source_locks.admin_delivery_before,v9.source_locks.admin_delivery_after);
  assert.equal(hash(read('functions/portal/analytics-v2-ui.js')),v10.source_locks.admin_delivery_after);
  assert.equal(hash(read('supabase/migrations/20261011074000_analytics_lpg_v10_all_cpt_source_coverage.sql')),v10.source_locks.v10_migration_blob);
  assert.equal(hash(read('supabase/rollbacks/20261011074000_analytics_lpg_v10_all_cpt_source_coverage_rollback.sql')),v10.source_locks.v10_rollback_blob);
  assert.equal(hash(read('assets/portal-runtime/client-market-intelligence-v1.js')),v10.source_locks.client_v20_unchanged);
  assert.deepEqual(Object.keys(v10.known_status_as_of_2026_10_11),[
    'CPT Озинки','CPT Сарыагаш','CPT Турксиб','CPT Уртааул','CPT Маргилан'
  ]);
});

test('V10 source-locked SQL covers direct incoming and outgoing CPT routes, does not promote historical',()=>{
  const sql=read('supabase/migrations/20261011074000_analytics_lpg_v10_all_cpt_source_coverage.sql');
  for(const x of ['V10_LPG_BRIDGE_PREDECESSOR_SOURCE_DRIFT',
    '70f34dee304fdb71ca58e245ccb6330b',
    "t.route_text ~ '^[^→]+→[^→]+$'",
    "t.status='WORKING_CONFIRMED'",
    'netbackTariffCoverage',
    "'hasEligibleCurrentSegment'",
    "'MATCHING_RAIL_SEGMENTS_ONLY'",
    "'priceAuthority','NOT_A_COMMERCIAL_OFFER'",
    "'commercialComponent','NOT_INCLUDED'",
    'jsonb_agg(jsonb_build_object'])
    assert.ok(sql.includes(x),x);
  // SQL alias b(item) in the original V9 query must never be shadowed by PLpgSQL record b.
  assert.ok(sql.includes('v_basis_row record;'));
  assert.ok(sql.includes('FOR v_basis_row IN'));
  assert.ok(sql.includes('ARRAY[v_basis_row.basis]'));
  assert.ok(!sql.includes('  b record;'));
  assert.ok(!sql.includes("t.route_text LIKE 'Озинки → %'"));
  assert.ok(!/\b(?:INSERT|UPDATE|DELETE)\s+(?:INTO\s+|FROM\s+)?portal_private\./i.test(sql));
  assert.ok(!sql.includes('GRANT EXECUTE'));
  assert.ok(sql.includes('REVOKE ALL ON FUNCTION'));
  assert.ok(!sql.includes("v_bridges:=jsonb_set(v_bridges,ARRAY[r.basis]")||sql.includes("'tariffStatus','WORKING_CONFIRMED'"));
});

test('V10 output is syntax-valid, one chart owner, all matching/source-missing cards always show status',async()=>{
  const res=await onRequest({});
  assert.equal(res.status,200);
  const script=await res.text();
  new Function(script);
  for(const token of ['MISSING_CONFIRMED_ROUTE_TARIFF','netbackTariffCoverage',
    'Не рассчитана','matchedCptV10.has(basisV10)',
    'PLATTS_NETBACK_PLUS_CONFIRMED_RAIL_V1',
    'Индикативно, не коммерческая оферта.'])
    assert.ok(script.includes(token),token);
  assert.ok(!script.includes('if(priceCardV10.dataset.pricingMode==='),'Never preserve stale V9 price upon missing source');
  assert.equal((script.match(/function adminCompactChart\(root,product,key\)/g)||[]).length,1);
  assert.ok(!script.includes('source-observation-gaps-v13'));
  assert.ok(!script.includes('function renderAnalytics(){'));
});
