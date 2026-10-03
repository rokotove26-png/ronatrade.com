import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const backend=readFileSync('supabase/functions/rona-portal-api/index.ts','utf8');
const gateway=readFileSync('functions/portal/api/[[path]].js','utf8');
const renderer=readFileSync('assets/portal-runtime/client-deals-authoritative-v1.js','utf8');
const nav=readFileSync('assets/portal-runtime/client-sidebar-command-nav-v1.js','utf8');

test('Client deal lifecycle UI remains generic while the heavy backend lifecycle query is held',()=>{
  assert.match(renderer,/client_deal_stage/);
  assert.match(renderer,/CANONICAL_DEAL_EXECUTION_LIFECYCLE_V1/);
  assert.match(renderer,/function dealStage\(d\)/);
  assert.match(renderer,/function stageCounts\(data\)/);
  assert.doesNotMatch(renderer,/DEAL-2026-004/);
  assert.doesNotMatch(backend,/DEAL-2026-004/);
});

test('Client API gateway preserves canonical lifecycle stage fields',()=>{
  for(const field of [
    'client_deal_stage','client_deal_stage_label','client_deal_stage_source',
    'post_rail_completion_attention','rail_monitoring_completed_at','lifecycle_state','accounting_closure_status'
  ]) assert.ok(gateway.includes(field),field+' missing from sanitized Client context');
});

test('Client Deals renderer has three exclusive lifecycle tabs',()=>{
  assert.match(renderer,/data-rona-deal-stage-tabs/);
  assert.match(renderer,/data-rona-deal-stage-tab/);
  assert.match(renderer,/\['ACTIVE','Активные'\]/);
  assert.match(renderer,/\['ATTENTION','Требуют внимания'\]/);
  assert.match(renderer,/\['COMPLETED','Завершенные'\]/);
  assert.match(renderer,/function dealStage\(d\)/);
  assert.match(renderer,/function dealRows\(data\)/);
  assert.match(renderer,/bucketOk=upper\(c\.dataset\.ronaClientDealStage\)===state\.bucket/);
  assert.match(renderer,/function authorizedDealFor\(data,id\)/);
  assert.doesNotMatch(renderer,/function activeDeals\(data\)/);
  assert.doesNotMatch(renderer,/DEAL-2026-004/);
});

test('standalone Closing Documents is removed but Claims remains',()=>{
  assert.match(nav,/function removeStandaloneClosingSection\(n\)/);
  assert.match(nav,/button\[data-page="closing"\]/);
  assert.match(nav,/page-closing/);
  assert.match(nav,/claimsPresent/);
  assert.doesNotMatch(nav,/button\[data-page="claims"\].*remove\(\)/s);
});
