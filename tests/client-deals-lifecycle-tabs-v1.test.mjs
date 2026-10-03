import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const backend=readFileSync('supabase/functions/rona-portal-api/index.ts','utf8');
const gateway=readFileSync('functions/portal/api/[[path]].js','utf8');
const renderer=readFileSync('assets/portal-runtime/client-deals-authoritative-v1.js','utf8');
const nav=readFileSync('assets/portal-runtime/client-sidebar-command-nav-v1.js','utf8');

test('Client deal lifecycle projection is functional and canonical, not deal-specific',()=>{
  assert.match(backend,/function clientDealStage\(row:any,lifecycle:any\)/);
  assert.match(backend,/CANONICAL_DEAL_EXECUTION_LIFECYCLE_V1/);
  assert.match(backend,/rail_deal_monitoring_control_v1/);
  assert.match(backend,/deal_finance_authority_payments_v8_read_v1/);
  assert.match(backend,/owner_deal_finance_summary/);
  assert.match(backend,/upper\(coalesce\(c\.monitoring_state,''\)\)='COMPLETED'/);
  assert.match(backend,/upper\(coalesce\(f\.finance_status,''\)\)='PAID'/);
  assert.match(backend,/upper\(coalesce\(f\.authority_state,''\)\)='AUTHORITATIVE'/);
  assert.match(backend,/upper\(coalesce\(f\.lifecycle_state,''\)\)='CURRENT'/);
  assert.match(backend,/coalesce\(f\.source_locked,false\)=true/);
  assert.match(backend,/coalesce\(f\.is_terminal,false\)=true/);
  assert.match(backend,/client_remaining_amount/);
  assert.match(backend,/received_amount/);
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
