import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { onRequest as dealsUi } from '../functions/portal/deals-current-state-ui.js';

const hardening=readFileSync('supabase/functions/rona-portal-api/payments-v8-production-hardening.ts','utf8');

test('post-rail paid attention is exclusive from Active and Waiting execution buckets',async()=>{
  const response=await dealsUi();
  assert.equal(response.status,200);
  const js=await response.text();
  assert.match(js,/function isPostExecutionAttention\(d\)\{return !!\(d&&d\.post_rail_completion_attention===true\)\}/);
  assert.match(js,/function isExecutionMonitoringActive\(d\)\{return isActive\(d\)&&!isPostExecutionAttention\(d\)\}/);
  assert.match(js,/function waitsPayment\(d\)\{if\(!isExecutionMonitoringActive\(d\)\)return false;/);
  assert.match(js,/var active=ds\.filter\(isExecutionMonitoringActive\)\.length/);
  assert.match(js,/return ds\.filter\(isExecutionMonitoringActive\)\}/);
  assert.match(js,/function needsAttention\(d\)\{if\(isPostExecutionAttention\(d\)\)return true;/);
  assert.doesNotMatch(js,/var active=ds\.filter\(isActive\)\.length/);
});

test('Admin Payments excludes only Rail-completed and authoritative fully-paid deals from active monitoring',()=>{
  assert.match(hardening,/ADMIN_PAYMENTS_EXECUTION_ACTIVE_ONLY_V1/);
  assert.match(hardening,/rail_deal_monitoring_control_v1/);
  assert.match(hardening,/upper\(c\.monitoring_state\)='COMPLETED'/);
  assert.match(hardening,/financial_status\|\|''\)\.trim\(\)\.toUpperCase\(\)==='PAID'/);
  assert.match(hardening,/total_to_receive/);
  assert.match(hardening,/verified_received/);
  assert.match(hardening,/remaining_to_receive/);
  assert.match(hardening,/paymentMoneyAuthority\(deal\?\.total_to_receive\)==='AUTHORITATIVE'/);
  assert.match(hardening,/paymentMoneyAuthority\(deal\?\.verified_received\)==='AUTHORITATIVE'/);
  assert.match(hardening,/paymentMoneyAuthority\(deal\?\.remaining_to_receive\)==='AUTHORITATIVE'/);
  assert.match(hardening,/Math\.abs\(remaining\)<=0\.01/);
  assert.match(hardening,/received\+0\.01>=total/);
  assert.match(hardening,/execution_monitoring_excluded_deal_ids/);
  assert.match(hardening,/await excludeDealsExitedExecutionMonitoring\(projection\)/);
  assert.ok(hardening.indexOf('await excludeDealsExitedExecutionMonitoring(projection)')<hardening.indexOf('projection.currency_aggregates=buildPaymentsCurrencyAggregates(projection.deals)'));
});

test('execution exit is projection-only and preserves payment and deal facts',()=>{
  assert.doesNotMatch(hardening,/delete\s+from\s+portal_private\.(payments|deals|payment_allocations)/i);
  assert.doesNotMatch(hardening,/update\s+portal_private\.(payments|deals|payment_allocations)/i);
  assert.doesNotMatch(hardening,/truncate\s+table|drop\s+table/i);
});
