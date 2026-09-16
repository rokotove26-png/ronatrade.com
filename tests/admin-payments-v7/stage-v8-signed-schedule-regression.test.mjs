import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdminPaymentsV7NativeView,renderAdminPaymentsV7NativeHtml} from '../../supabase/functions/_shared/admin-payments-v7/native-renderer.mjs';

const money=(amount,currency,status='AUTHORITATIVE')=>({amount:String(amount),currency,status,reason:null,authority_refs:[{source_type:'SIGNED_DOCUMENT',source_id:`${currency}:${amount}`,source_version:'FINANCE_SIGNED_SCHEDULE_V8'}]});
const deal=({id,total,received,remaining,conditional,due='0',status='PARTIAL',spend='0',execution='0',currency})=>({
  deal_id:id,deal_key:`key-${id}`,client_display:id,payment_handoff_state:'READY',
  accounting_currency:{currency,status:'AUTHORITATIVE',reason:null,authority_refs:[]},
  total_to_receive:money(total,currency),verified_received:money(received,currency),remaining_to_receive:money(remaining,currency),
  due_now:money(due,currency),expected_not_due:money('0',currency),future_conditional:money(conditional,currency),
  actual_spend:money(spend,currency),actual_spend_status:'AUTHORITATIVE',remaining_execution:money(execution,currency),remaining_execution_status:'AUTHORITATIVE',
  payment_progress:{percent:String(Number(total)?Math.round(Number(received)/Number(total)*100):100),status:'AUTHORITATIVE',reason:null},
  financial_status:status,documentary_status:'SIGNED_SCHEDULE_MATERIALIZED',exceptions:[],authority_refs:[],
});

const data={paymentsV7Projection:{contract:'ADMIN_PAYMENTS_V7',generated_at:'2026-09-17T00:00:00Z',source_as_of:'2026-09-17T00:00:00Z',deals:[
  deal({id:'DEAL-2026-005',total:'672500',received:'201750',remaining:'470750',conditional:'470750',currency:'USD'}),
  deal({id:'DEAL-2026-006',total:'164400',received:'49320',remaining:'115080',conditional:'115080',currency:'USD'}),
  deal({id:'DEAL-2026-009',total:'31002300',received:'10000000',remaining:'21002300',conditional:'21002300',currency:'RUB'}),
  deal({id:'DEAL-2026-010',total:'131775',received:'0',remaining:'131775',conditional:'131775',currency:'USD',status:'NOT_DUE'}),
],owner_exception_queue:[],payment_exceptions:[],materialization_gaps:[],reconciliation_summary:{}}};

test('Payments V8 — main Expected means entire remaining receivable, not expected_not_due only',()=>{
  const view=createAdminPaymentsV7NativeView(data);
  const byId=new Map(view.deals.map(row=>[row.deal_id,row]));
  assert.equal(byId.get('DEAL-2026-005').expected,'470 750 USD');
  assert.equal(byId.get('DEAL-2026-006').expected,'115 080 USD');
  assert.equal(byId.get('DEAL-2026-009').expected,'21 002 300 RUB');
  assert.equal(byId.get('DEAL-2026-010').expected,'131 775 USD');
  assert.equal(byId.get('DEAL-2026-009').conditional,'21 002 300 RUB');
  assert.equal(byId.get('DEAL-2026-010').conditional,'131 775 USD');
});

test('Payments V8 — 005/006 documentary 70% and 009/010 conditional balances remain visible, not zeroed',()=>{
  const html=renderAdminPaymentsV7NativeHtml(data);
  for(const expected of ['470 750 USD','115 080 USD','21 002 300 RUB','131 775 USD']) assert.match(html,new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(html,/Conditional: 470 750 USD/);
  assert.match(html,/Conditional: 115 080 USD/);
  assert.match(html,/Conditional: 21 002 300 RUB/);
  assert.match(html,/Conditional: 131 775 USD/);
});

test('Payments V8 — global Expected aggregates remaining_to_receive without FX',()=>{
  const view=createAdminPaymentsV7NativeView(data);
  assert.deepEqual(view.kpis.expected.rows,[{currency:'RUB',amount:'21 002 300'},{currency:'USD',amount:'717 605'}]);
  assert.deepEqual(view.kpis.expected.conditional.rows,[{currency:'RUB',amount:'21 002 300'},{currency:'USD',amount:'717 605'}]);
  assert.deepEqual(view.kpis.received.rows,[{currency:'RUB',amount:'10 000 000'},{currency:'USD',amount:'251 070'}]);
});

test('Payments V8 — pending signed schedule fails closed instead of rendering legacy amounts',()=>{
  const pending=structuredClone(data);
  const d=pending.paymentsV7Projection.deals[0];
  d.total_to_receive={amount:null,currency:null,status:'TO_VERIFY',reason:'SIGNED_SCHEDULE_PENDING',authority_refs:[]};
  d.remaining_to_receive={amount:null,currency:null,status:'TO_VERIFY',reason:'SIGNED_SCHEDULE_PENDING',authority_refs:[]};
  d.future_conditional={amount:null,currency:null,status:'TO_VERIFY',reason:'SIGNED_SCHEDULE_PENDING',authority_refs:[]};
  const view=createAdminPaymentsV7NativeView(pending);
  assert.equal(view.deals[0].total,'TO_VERIFY');
  assert.equal(view.deals[0].expected,'TO_VERIFY');
  assert.equal(view.deals[0].conditional_present,false);
});
