import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const backend=readFileSync('supabase/functions/rona-portal-api/index.ts','utf8');
const gateway=readFileSync('functions/portal/api/[[path]].js','utf8');
const renderer=readFileSync('assets/portal-runtime/client-deals-authoritative-v1.js','utf8');
const nav=readFileSync('assets/portal-runtime/client-sidebar-command-nav-v1.js','utf8');
const buttonVisual=readFileSync('assets/portal-runtime/portal-canonical-button-hover-v1.js','utf8');

test('Client deal lifecycle UI remains generic while the heavy backend lifecycle query is held',()=>{
  assert.match(renderer,/client_deal_stage/);
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

test('Client Deals stage controls are explicit buttons aligned to the title frame',()=>{
  assert.match(buttonVisual,/#page-deals \[data-rona-deal-stage-tabs\]/);
  assert.match(buttonVisual,/DEALS_ALIGN_MARK='20261004-client-deals-outer-title-frame-align-v15'/);
  assert.match(buttonVisual,/--rona-client-deals-frame-width/);
  assert.match(buttonVisual,/--rona-client-deals-frame-left/);
  assert.match(buttonVisual,/data-rona-deals-frame-alignment/);
  assert.match(buttonVisual,/return directDealsChild\(root,heading\)/);
  assert.doesNotMatch(buttonVisual,/hasFrame=.*backgroundImage/s);
  assert.match(buttonVisual,/min-height:54px!important/);
  assert.match(buttonVisual,/border:1px solid rgba\(96,187,226,\.42\)!important/);
  assert.match(buttonVisual,/\[aria-selected="true"\]/);
});

test('standalone Closing Documents and Deal Archive are removed but Claims remains',()=>{
  assert.match(nav,/function removeRetiredStandaloneSections\(n\)/);
  assert.match(nav,/button\[data-page="closing"\]/);
  assert.match(nav,/page-closing/);
  assert.match(nav,/button\[data-page="archive"\]/);
  assert.match(nav,/page-archive/);
  assert.match(nav,/archiveRemoved/);
  assert.match(nav,/claimsPresent/);
  assert.doesNotMatch(nav,/button\[data-page="claims"\].*remove\(\)/s);
  assert.doesNotMatch(nav,/Архив сделок/);
});
