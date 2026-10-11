import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {onRequest} from '../functions/portal/analytics-v2-ui.js';

const read=(p)=>readFileSync(p,'utf8');
const blob=(x)=>createHash('sha1').update('blob '+Buffer.byteLength(x)+'\0'+x).digest('hex');
const g=JSON.parse(read('governance/analytics-v12-lpg-cpt-spread-20261011.json'));
const v11=JSON.parse(read('governance/analytics-v11-five-cpt-oct-rail-20261011.json'));
const sql=read('supabase/migrations/20261011163500_analytics_lpg_v12_price_spread_no_double_rail.sql');

test('V12 Owner correction is a source-locked successor to the immutable V11 and frozen Client V20',()=>{
 assert.equal(g.actor,'AI-SYSTEM-ADMIN');
 assert.equal(g.scope,'ADMIN_ANALYTICS_LPG_ONLY_NO_BUSINESS_FACT_MUTATION');
 assert.equal(g.source_locks.admin_delivery_before,v11.source_locks.admin_delivery_after);
 assert.equal(blob(read('functions/portal/analytics-v2-ui.js')),g.source_locks.admin_delivery_after);
 assert.equal(blob(sql),g.source_locks.migration_blob);
 assert.equal(blob(read('supabase/rollbacks/20261011163500_analytics_lpg_v12_price_spread_no_double_rail_rollback.sql')),g.source_locks.rollback_blob);
 assert.equal(blob(read('assets/portal-runtime/client-market-intelligence-v1.js')),g.source_locks.client_runtime_frozen_blob);
});

test('V12 source-locked forward delta + R12 reference, no double rail, exact source and fail-closed checks',()=>{
 const published=g.evidence.published_reference_usd_t,expected=g.evidence.indicative_usd_t;
 const delta=g.evidence.forecast_platts_nov_m2_usd_t-g.evidence.current_observed_platts_m1_usd_t;
 assert.equal(delta,-50);
 assert.deepEqual(Object.keys(published).sort(),Object.keys(expected).sort());
 for(const basis of Object.keys(published))assert.equal(published[basis]+delta,expected[basis]);
 for(const token of ['V12_OWNER_BOOTSTRAP_SOURCE_DRIFT','V12_PREDECESSOR_V11_MISSING',
   'RONA_LPG_PUBLISHED_CPT_PLUS_SAME_PLATTS_FORWARD_DELTA_V12',
   'V12_REAL_SOURCE_FIVE_CPT_NO_DOUBLE_RAIL_SMOKE_FAILED',
   'V12_SAME_INSTRUMENT_SOURCE_MISMATCH_FAIL_CLOSED',
   'portal_private.market_intelligence_admin_lpg_relative_price_v12',
   'portal_private.market_intelligence_admin_lpg_tariff_bridge_v1(v)',
   'market_intelligence_daily_monitor_v1',
   'owner_price_snapshots',
   'sourceRefs','publishedReferenceUsdT',
   'tariffsReaddedUsdT',
   'LPG_PLATTS_PROPANE_CIF_NWE_FINANCIAL_FIXED_DELIVERY',
   'REVOKE ALL ON FUNCTION',
   'v_latest_source',
   'v_published_price+v_delta',
   "'CPT Озинки','CPT Сарыагаш','CPT Турксиб','CPT Уртааул','CPT Маргилан'",
   '560','695','740','730','745',
   g.source_locks.admin_bootstrap_pg_md5])
   assert.ok(sql.includes(token),'V12 source protection absent: '+token);
 assert.ok(!/\b(?:INSERT|UPDATE|DELETE)\s+(?:INTO\s+|FROM\s+)?portal_private\.(?:owner_price_snapshots|owner_rail_tariff_matrix)\b/i.test(sql));
 assert.ok(!/\b(?:UPDATE|INSERT|DELETE)\s+(?:INTO\s+|FROM\s+)?portal_private\.market_intelligence_(?:facts|forecast_snapshots)\b/i.test(sql));
 assert.ok(!sql.includes('GRANT EXECUTE'));
 assert.ok(!sql.includes('12531.3'));
 assert.ok(!sql.includes('84.9048'));
 assert.ok(sql.includes('END\n$function$;\n\n-- Transactional'));
 const rollback=read('supabase/rollbacks/20261011163500_analytics_lpg_v12_price_spread_no_double_rail_rollback.sql');
 assert.ok(rollback.includes('END\n$function$;\nDROP FUNCTION'),'rollback must restore V11 source exactly and end statement');
});

test('V12 Admin UI prints only five source-backed CPT values; suppresses explanatory subtext and no-source old V11 rail',async()=>{
 const r=await onRequest({});
 assert.equal(r.status,200);
 const js=await r.text();
 new Function(js);
 for(const token of [
  'referenceSpreadV12',
  'PUBLISHED_R12_PLUS_PLATTS_DELTA_V12',
  'V12_SOURCE_UNVERIFIED',
  'VERIFIED_SAME_PLATTS_DELTA_V12',
  'rinaV12Hidden_NOT_EXPECTED'
 ])if(token!=='rinaV12Hidden_NOT_EXPECTED')
   assert.ok(js.includes(token),'UI V12 guard missing '+token);
 assert.ok(js.includes("underPriceV12.style.setProperty('display','none','important')"));
 assert.ok(js.includes("noteV12.style.setProperty('display','none','important')"));
 assert.ok(js.includes("renderedV12===5"));
 assert.ok(js.includes("v12ReferencePrice")||js.includes("rawReferenceV12"));
 assert.ok(!js.includes('source-observation-gaps-v13'));
 assert.equal((js.match(/function adminCompactChart\(root,product,key\)/g)||[]).length,1);
});
