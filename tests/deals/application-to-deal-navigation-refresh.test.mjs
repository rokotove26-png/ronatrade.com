import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequest as serveDeals} from '../../functions/portal/deals-current-state-ui.js';

test('Deals navigation invalidates stale source snapshot and re-reads V4', async()=>{
  const res=await serveDeals();
  const source=await res.text();
  assert.equal(res.status,200);
  assert.equal(res.headers.get('x-rona-deals-refresh'),'navigation-invalidation-v2');
  assert.match(source,/api\('\/admin\/deals-current-v4'\)/);
  assert.match(source,/queueMicrotask\(function\(\)\{window\.__RONA_DEALS_CURRENT_NAV_REFRESH_AT__=Date\.now\(\);refresh\(true\)\}\)/);
  assert.doesNotMatch(source,/if\(state\)\{if\(!requested\|\|!openRequestedDeal\(requested\)\)render\(\)\}/);
});

test('Deal deep-link refreshes before selecting deal registered after previous snapshot', async()=>{
  const source=await(await serveDeals()).text();
  assert.match(source,/window\.__RONA_DEALS_REQUESTED_ID__=String\(id\);window\.__RONA_DEALS_CURRENT_NAV_REFRESH_AT__=Date\.now\(\);refresh\(true\)/);
  assert.match(source,/if\(requested\)\{var found=deals\(\)\.find/);
  assert.match(source,/window\.__RONA_DEALS_CURRENT_STATE_REFRESH__/);
  assert.doesNotMatch(source,/if\(state\)openRequestedDeal\(id\);else refresh\(true\)/);
});

test('Generated runtime compiles and retains owner source locks, without an interval', async()=>{
  const source=await(await serveDeals()).text();
  new Function(source);
  assert.match(source,/isExecutionMonitoringActive/);
  assert.match(source,/post_rail_completion_attention/);
  assert.match(source,/function visibleDeals\(ds\)/);
  assert.match(source,/window\.__RONA_DEALS_CURRENT_REFRESH_MODE__='NAVIGATION_INVALIDATED_NO_INTERVAL_V2'/);
  assert.doesNotMatch(source,/setInterval\(function\(\)\{refresh\(false\)\},15000\)/);
  assert.doesNotMatch(source,/DEAL-2026-01[2-6]/);
});