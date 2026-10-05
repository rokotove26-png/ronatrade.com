import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const hardening=readFileSync('supabase/functions/rona-portal-api/payments-v8-production-hardening.ts','utf8');
const proxy=readFileSync('functions/portal/api/[[path]].js','utf8');
const paymentsRuntime=readFileSync('assets/portal-runtime/client-payments-authoritative-v1.js','utf8');
const dealsRuntime=readFileSync('assets/portal-runtime/client-deals-authoritative-v1.js','utf8');

test('Client deal moves to ATTENTION only after authoritative Rail completion and 100 percent payment',()=>{
  assert.match(hardening,/rail_deal_monitoring_control_v1/);
  assert.match(hardening,/rail_monitoring_state/);
  assert.match(hardening,/COMPLETED/);
  assert.match(hardening,/const closeout=railCompleted&&fullyPaid&&!terminal/);
  assert.match(hardening,/deal\.post_rail_completion_attention=closeout/);
  assert.match(hardening,/deal\.client_deal_stage='ATTENTION'/);
  assert.match(hardening,/deal\.client_deal_stage_label='Требует внимания'/);
  assert.match(hardening,/RAIL_COMPLETED_AND_100_PERCENT_PAID_OWNER_RULE_V2/);
  assert.match(dealsRuntime,/if\(\['ACTIVE','ATTENTION','COMPLETED','ARCHIVED'\]\.includes\(explicit\)\)return explicit/);
  assert.match(dealsRuntime,/stage==='ATTENTION'\?'Требует внимания':'Завершена'/);
});

test('Client Payments exits a deal only after Rail completion and source-locked 100 percent payment',()=>{
  assert.match(hardening,/function clientFullyPaidAuthoritative\(deal:any\)/);
  assert.match(hardening,/source==='FINANCE_V7_AUTHORITATIVE'/);
  assert.match(hardening,/authority==='AUTHORITATIVE'/);
  assert.match(hardening,/remaining!==null&&Math\.abs\(remaining\)<=0\.01/);
  assert.match(hardening,/source==='OWNER_DEAL_FINANCE_SUMMARY'/);
  assert.match(hardening,/percent!==null&&percent>=100/);
  assert.match(hardening,/status!=='PAID'/);
  assert.match(hardening,/received\+0\.01<total/);
  assert.match(hardening,/const paymentsExit=railCompleted&&fullyPaid/);
  assert.match(hardening,/client_payments_monitoring_active=!paymentsExit/);
  assert.match(hardening,/RAIL_COMPLETED_AND_100_PERCENT_PAID/);
});

test('Client boundary preserves monitoring decision and Payments UI filters only active monitoring deals',()=>{
  for(const marker of [
    'client_payments_monitoring_active',
    'client_payments_monitoring_exclusion_reason',
    'client_payments_monitoring_source',
    'closeout_stage',
    'closeout_actual_quantity_tonnes',
    'closeout_actual_amount',
    'closeout_balance_amount',
    'closeout_balance_direction'
  ]) assert.ok(proxy.includes(marker),`proxy missing ${marker}`);
  assert.match(paymentsRuntime,/function monitoringDeal\(deal\)\{return deal\?\.client_payments_monitoring_active!==false\}/);
  assert.match(paymentsRuntime,/const deals=allDeals\.filter\(monitoringDeal\)/);
  assert.match(paymentsRuntime,/const payments=\(Array\.isArray\(detail\?\.payments\)\?detail\.payments:\[\]\)\.filter\(confirmedPayment\)/);
});

test('Client execution exit remains projection-only',()=>{
  assert.doesNotMatch(hardening,/update\s+portal_private\.(deals|payments|payment_allocations|rail_deal_monitoring_control_v1)/i);
  assert.doesNotMatch(hardening,/delete\s+from\s+portal_private\.(deals|payments|payment_allocations|rail_deal_monitoring_control_v1)/i);
  assert.doesNotMatch(hardening,/truncate\s+table|drop\s+table/i);
});


test('Cloudflare Client context composes authoritative Rail completion for execution exit',()=>{
  assert.match(proxy,/CLIENT_DEAL_RAIL_COMPLETION_ATTENTION_AND_PAYMENTS_EXIT_EDGE_V2/);
  assert.match(proxy,/function enrichClientExecutionExitAtEdge\(/);
  assert.match(proxy,/CANDIDATE_API}\/v1\/client\/rail-canonical\?clientId=/);
  assert.match(proxy,/clientRailAuthority/);
  assert.match(proxy,/authority\?\.serverDerived!==true/);
  assert.match(proxy,/String\(authority\?\.clientId\|\|''\)!==clientId/);
  assert.match(proxy,/String\(authority\?\.contractId\|\|''\)!==contractId/);
  assert.match(proxy,/closeout=railCompleted&&fullyPaid&&!terminal/);
  assert.match(proxy,/deal\.post_rail_completion_attention=closeout/);
  assert.match(proxy,/deal\.client_deal_stage='ATTENTION'/);
  assert.match(proxy,/RAIL_COMPLETED_AND_100_PERCENT_PAID_OWNER_RULE_EDGE_V2/);
  assert.match(proxy,/deal\.client_deal_stage_label='Требует внимания'/);
  assert.match(proxy,/function clientDealFullyPaidForExit\(deal\)/);
  assert.match(proxy,/FINANCE_V7_AUTHORITATIVE/);
  assert.match(proxy,/OWNER_DEAL_FINANCE_SUMMARY/);
  assert.match(proxy,/percent!==null&&percent>=100/);
  assert.match(proxy,/const paymentsExit=railCompleted&&fullyPaid/);
  assert.match(proxy,/deal\.client_payments_monitoring_active=!paymentsExit/);
  assert.match(proxy,/RAIL_COMPLETED_AND_100_PERCENT_PAID/);
  assert.match(proxy,/if\(path==='\/v1\/client\/context'\)response=await enrichClientExecutionExitAtEdge/);
  assert.match(proxy,/catch\{return response\}/);
});


test('Cloudflare payments exit supports current production authoritative finance summary without weakening source lock',()=>{
  const block=proxy.slice(proxy.indexOf('function clientDealFullyPaidForExit'),proxy.indexOf('async function enrichClientExecutionExitAtEdge'));
  assert.match(block,/source==='FINANCE_V7_AUTHORITATIVE'/);
  assert.match(block,/authority==='AUTHORITATIVE'/);
  assert.match(block,/remaining!==null&&Math\.abs\(remaining\)<=0\.01/);
  assert.match(block,/source==='OWNER_DEAL_FINANCE_SUMMARY'/);
  assert.match(block,/percent!==null&&percent>=100/);
  assert.match(block,/status!=='PAID'/);
  assert.match(block,/received\+0\.01<total/);
  assert.doesNotMatch(block,/return true/);
});
