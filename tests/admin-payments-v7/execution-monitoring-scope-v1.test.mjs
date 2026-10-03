import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN_PAYMENTS_EXECUTION_ACTIVE_ONLY_V1,
  applyAdminPaymentsExecutionMonitoringScope,
  dealExitedExecutionMonitoring,
} from '../../supabase/functions/rona-owner-ai-sync/execution-monitoring-scope-v1.mjs';

const money=(amount,currency='USD',status='AUTHORITATIVE')=>({amount:String(amount),currency,status,reason:null,authority_refs:[]});
const deal=({id,key,total='100',received='100',remaining='0',status='PAID',moneyStatus='AUTHORITATIVE'})=>({
  deal_id:id,
  deal_key:key,
  accounting_currency:{currency:'USD',status:'AUTHORITATIVE',reason:null,authority_refs:[]},
  total_to_receive:money(total,'USD',moneyStatus),
  verified_received:money(received,'USD',moneyStatus),
  remaining_to_receive:money(remaining,'USD',moneyStatus),
  due_now:money('0'),
  expected_not_due:money('0'),
  future_conditional:money('0'),
  actual_spend:money('0'),
  actual_spend_status:'AUTHORITATIVE',
  remaining_execution:money(received),
  financial_status:status,
  payment_passport:{deal_id:id,status:'AUTHORITATIVE'},
});

test('closing-stage deal exits active Payments only with candidate gate plus authoritative full settlement',()=>{
  const candidate=deal({id:'D-EXIT',key:'k-exit'});
  const notCandidate=deal({id:'D-NOT-CANDIDATE',key:'k-other'});
  const partial=deal({id:'D-PARTIAL',key:'k-partial',received:'70',remaining:'30',status:'PARTIAL'});
  const toVerify=deal({id:'D-VERIFY',key:'k-verify',moneyStatus:'TO_VERIFY'});

  assert.equal(dealExitedExecutionMonitoring(candidate,['k-exit']),true);
  assert.equal(dealExitedExecutionMonitoring(notCandidate,['k-exit']),false);
  assert.equal(dealExitedExecutionMonitoring(partial,['k-partial']),false);
  assert.equal(dealExitedExecutionMonitoring(toVerify,['k-verify']),false);
});

test('Payments projection excludes closing-stage deal, preserves other deals and recomputes aggregates',()=>{
  const exited=deal({id:'D-EXIT',key:'k-exit',total:'100',received:'100',remaining:'0'});
  const active=deal({id:'D-ACTIVE',key:'k-active',total:'200',received:'50',remaining:'150',status:'PARTIAL'});
  const source={
    contract:'ADMIN_PAYMENTS_V7',
    deals:[exited,active],
    payment_passports:[exited.payment_passport,active.payment_passport],
    owner_exception_queue:[{exception_id:'Q-1'}],
  };
  const before=structuredClone(source);
  const projected=applyAdminPaymentsExecutionMonitoringScope(source,['k-exit']);

  assert.deepEqual(source,before);
  assert.deepEqual(projected.deals.map((d)=>d.deal_id),['D-ACTIVE']);
  assert.deepEqual(projected.payment_passports.map((p)=>p.deal_id),['D-ACTIVE']);
  assert.deepEqual(projected.owner_exception_queue,[{exception_id:'Q-1'}]);
  assert.equal(projected.execution_monitoring_scope,ADMIN_PAYMENTS_EXECUTION_ACTIVE_ONLY_V1);
  assert.equal(projected.execution_monitoring_excluded_count,1);
  assert.deepEqual(projected.execution_monitoring_excluded_deal_ids,['D-EXIT']);
  assert.deepEqual(projected.currency_aggregates.total_to_receive.groups.map((g)=>({currency:g.currency,amount:g.amount})),[{currency:'USD',amount:'200'}]);
});

test('non-candidate fully-paid deal remains visible to fail closed',()=>{
  const paid=deal({id:'D-PAID',key:'k-paid'});
  const projected=applyAdminPaymentsExecutionMonitoringScope({contract:'ADMIN_PAYMENTS_V7',deals:[paid]},[]);
  assert.deepEqual(projected.deals.map((d)=>d.deal_id),['D-PAID']);
  assert.equal(projected.execution_monitoring_excluded_count,0);
});
