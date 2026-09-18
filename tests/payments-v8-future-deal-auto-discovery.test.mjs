import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPaymentsCurrencyAggregates } from '../supabase/functions/_shared/admin-payments-v7/confirmed-funding-aggregate.mjs';
import { readFile } from 'node:fs/promises';

const authoritative=(amount)=>({amount:String(amount),currency:'USD',status:'AUTHORITATIVE'});
test('generic future deal is picked up by the next server projection aggregate',()=>{
  const before=[{deal_id:'GENERIC-A',accounting_currency:{currency:'USD'},verified_received:authoritative('10'),due_now:authoritative('0'),future_conditional:authoritative('90'),actual_spend:authoritative('2'),remaining_execution:authoritative('8'),total_to_receive:authoritative('100'),expected_not_due:authoritative('0')}];
  const after=[...before,{deal_id:'GENERIC-FUTURE',accounting_currency:{currency:'USD'},verified_received:authoritative('5'),due_now:authoritative('15'),future_conditional:authoritative('30'),actual_spend:authoritative('1'),remaining_execution:authoritative('4'),total_to_receive:authoritative('50'),expected_not_due:authoritative('0')}];
  assert.equal(buildPaymentsCurrencyAggregates(before).due_now.groups[0].amount,'0');
  assert.equal(buildPaymentsCurrencyAggregates(after).due_now.groups[0].amount,'15');
});
test('open Payments navigation requests a fresh bootstrap rather than rendering stale local projection',async()=>{
  const ui=await readFile(new URL('../functions/portal/payments-v8-ui.js',import.meta.url),'utf8');
  assert.match(ui,/if\(b\)scheduleRefresh\('navigation'\)/);
  assert.match(ui,/function scheduleRefresh\(reason\)\{setTimeout\(\(\)=>\{load\(reason\)/);
});
