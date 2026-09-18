import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildPaymentsCurrencyAggregates } from '../supabase/functions/_shared/admin-payments-v7/confirmed-funding-aggregate.mjs';

const money=(amount,currency='USD')=>({amount:String(amount),currency,status:'AUTHORITATIVE'});
const deals=[
  {deal_id:'FUTURE-DEAL-A',accounting_currency:{currency:'USD'},total_to_receive:money('100'),verified_received:money('20'),due_now:money('10'),expected_not_due:money('0'),future_conditional:money('70'),actual_spend:money('5'),remaining_execution:money('15')},
  {deal_id:'FUTURE-DEAL-B',accounting_currency:{currency:'USD'},total_to_receive:money('200'),verified_received:money('40'),due_now:money('20'),expected_not_due:money('0'),future_conditional:money('140'),actual_spend:money('10'),remaining_execution:money('30')},
];

test('server projection supplies every Payments KPI aggregate',()=>{
  const a=buildPaymentsCurrencyAggregates(deals);
  for(const field of ['verified_received','due_now','future_conditional','actual_spend','remaining_execution'])assert.equal(a[field].groups[0].status,'AUTHORITATIVE');
  assert.equal(a.due_now.groups[0].amount,'30');
  assert.equal(a.actual_spend.groups[0].amount,'15');
  assert.equal(a.remaining_execution.groups[0].amount,'45');
});

test('browser is display-only for cross-deal KPI values',async()=>{
  const ui=await readFile(new URL('../functions/portal/payments-v8-ui.js',import.meta.url),'utf8');
  assert.match(ui,/projection\?\.currency_aggregates\?\.\[field\]/);
  assert.doesNotMatch(ui,/function aggregate\(field\)/);
  assert.doesNotMatch(ui,/map\.set\(c,\(map\.get\(c\)\|\|0\)\+Number\(m\.amount\)\)/);
});


test('server KPI aggregate fails closed when any deal in a currency group is unresolved',()=>{
  const partial=[
    deals[0],
    {...deals[1],due_now:{amount:null,currency:'USD',status:'TO_VERIFY'}},
  ];
  const group=buildPaymentsCurrencyAggregates(partial).due_now.groups[0];
  assert.equal(group.status,'TO_VERIFY');
  assert.equal(group.amount,null);
  assert.equal(group.completeness_status,'PARTIAL');
});
