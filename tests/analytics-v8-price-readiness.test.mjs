import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {onRequest} from '../functions/portal/analytics-v2-ui.js';

const read=p=>readFileSync(p,'utf8');
const hash=s=>createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0'+s).digest('hex');
const governance=JSON.parse(read('governance/analytics-v8-pricing-source-readiness-20261011.json'));

test('owner-approved V8 pricing change contains no new formula, market data, CSS, chart writer or auth alteration',()=>{
  assert.equal(governance.approval,'OWNER_IN_CHAT');
  const v9=JSON.parse(read('governance/analytics-v9-lpg-netback-approved-rail-20261011.json'));
  assert.equal(v9.source_locks.admin_delivery_before,governance.source_locks.after_delivery_sha,'V8 historical source preserved');
  assert.equal(hash(read('functions/portal/analytics-v2-ui.js')),v9.source_locks.admin_delivery_after);
  assert.equal(hash(read('functions/portal/analytics-canonical-live-hydration.js')),governance.source_locks.admin_r4_hydration_unchanged);
  assert.equal(hash(read('functions/portal/analytics-v2-approved-base.js')),governance.source_locks.admin_compressed_r4_unchanged);
  assert.equal(hash(read('assets/portal-runtime/client-market-intelligence-v1.js')),governance.source_locks.client_v20_runtime_unchanged);
  assert.equal(governance.live_evidence.market_snapshot.commercial_base_present,false);
  assert.equal(governance.live_evidence.LPG.rona_reference,null);
});

test('actual emitted V8 script has one R4 painter, fail-closed references, exact pricing diagnostic statuses',async()=>{
  const res=await onRequest({});
  assert.equal(res.status,200);
  const script=await res.text();
  new Function(script);
  assert.equal((script.match(/function adminCompactChart\(root,product,key\)/g)||[]).length,1);
  for(const v of ['MARKET_REFERENCE_NOT_CONFIRMED','SOURCE_FORECAST_UNVERIFIED','RONA_CPT_QUOTATIONS_MISSING','INCOMPLETE_PRICE_BASIS','CALCULATED','Котировки CPT имеются','отсутствует подтверждённый сопоставимый рыночный референс'])
    assert.ok(script.includes(v),v);
  assert.ok(script.includes("if(!forecast||!hasPriceBase(product)){"),"Original missing-price guard intact");
  assert.ok(script.includes("for(const selector of ['.an2-price-base','.an2-price-range','.an2-price-current'])"),"All stale RONA cards wiped");
  assert.ok(script.includes("if(el)el.textContent='—'"),"Never produce fabricated prices");
  assert.ok(script.indexOf("window.__RONA_ANALYTICS_CURRENT_SOURCE_PREPAINT_V7__") <
    script.indexOf("const DATES=['03.08'"),"August fixture not visible before verification");
  assert.ok(!script.includes("source-observation-gaps-v13"),"Retired V13 painter cannot reappear");
  assert.ok(!script.includes("function renderAnalytics(){"),"Retired Admin table writer cannot reappear");
});

test('missing LPG market reference is not silently substituted with a daily quote or regional DAP',()=>{
  const source=read('functions/portal/analytics-v2-ui.js');
  assert.ok(!source.includes('raw.rail||0'));
  assert.ok(!source.includes('forecast.reference=0'));
  assert.ok(!source.includes('product.rona.reference='));
  assert.ok(!source.includes('Petromarket'));
  assert.ok(source.includes('calculateRonaScenario({forecast,rona:model},basis,current);'),"Preserve original protected R4 calculation, do not invent new formula");
});
