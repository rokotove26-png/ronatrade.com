import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applyClientPaymentAuthorityV7 } from '../supabase/functions/rona-portal-api/client-payments-v7.js';

const finance009={
  id:'6b10de98-e6df-43de-9339-9f6f724f0094',
  total_to_receive:'31002300',obligation_currency:'RUB',finance_status:'NOT_DUE',documentary_status:'TO_VERIFY',
  due_now:'0',expected_not_due:'9300690',future_conditional:'21701610',source_version:'FINANCE_GLOBAL_PAYMENT_SEMANTICS_V2'
};
const deal009={deal_id:'DEAL-2026-009',payment_obligation_amount:362600,payment_received_amount:0,payment_currency:'USD',payment_source:'OWNER_DEAL_FINANCE_SUMMARY'};
applyClientPaymentAuthorityV7(deal009,[finance009],[]);
assert.deepEqual(
  [deal009.payment_obligation_amount,deal009.payment_received_amount,deal009.payment_remaining_amount,deal009.payment_currency,deal009.payment_source],
  [31002300,0,31002300,'RUB','FINANCE_V7_AUTHORITATIVE']
);
assert.equal(deal009.payment_expected_not_due,9300690);
assert.equal(deal009.payment_future_conditional,21701610);
assert.equal(deal009.payment_status,'NOT_DUE');
assert.equal(deal009.payment_label,'Срок оплаты ещё не наступил');

const financeDue={id:'v7-due',total_to_receive:'1000',obligation_currency:'USD',finance_status:'DUE',documentary_status:'TO_VERIFY',due_now:'1000',expected_not_due:'0',future_conditional:'0'};
const dealDue={deal_id:'DEAL-2099-001'};
applyClientPaymentAuthorityV7(dealDue,[financeDue],[]);
assert.equal(dealDue.payment_status,'DUE');
assert.equal(dealDue.payment_label,'Ожидается оплата');

const financePartial={id:'v7-partial',total_to_receive:'1000',obligation_currency:'USD',finance_status:'NOT_DUE',documentary_status:'BANK_STATEMENT_PENDING',due_now:'0',expected_not_due:'0',future_conditional:'700'};
const dealPartial={deal_id:'DEAL-2099-002'};
applyClientPaymentAuthorityV7(dealPartial,[financePartial],[{currency:'USD',amount:'300'}]);
assert.equal(dealPartial.payment_status,'PARTIALLY_PAID');
assert.equal(dealPartial.payment_label,'Оплачено 30%');
assert.equal(dealPartial.payment_received_amount,300);
assert.equal(dealPartial.payment_remaining_amount,700);
assert.equal(dealPartial.payment_percent,30);

const finance004={id:'v7-004',total_to_receive:'236250',obligation_currency:'USD',finance_status:'PAID',documentary_status:'CONFIRMED',due_now:'0',expected_not_due:'0',future_conditional:'0'};
const deal004={deal_id:'DEAL-2026-004'};
applyClientPaymentAuthorityV7(deal004,[finance004],[{currency:'USD',amount:'236250'}]);
assert.equal(deal004.payment_status,'PAID');
assert.equal(deal004.payment_percent,100);
assert.equal(deal004.payment_received_amount,236250);

const missing={deal_id:'DEAL-2026-999',payment_obligation_amount:999,payment_currency:'USD',payment_source:'OWNER_DEAL_FINANCE_SUMMARY'};
applyClientPaymentAuthorityV7(missing,[],[]);
assert.equal(missing.payment_status,'TO_VERIFY');
assert.equal(missing.payment_obligation_amount,'TO_VERIFY');
assert.equal(missing.payment_source,'FINANCE_V7_AUTHORITY_MISSING');

const mismatch={deal_id:'DEAL-2026-998'};
applyClientPaymentAuthorityV7(mismatch,[finance009],[{currency:'USD',amount:'1'}]);
assert.equal(mismatch.payment_status,'TO_VERIFY');
assert.equal(mismatch.payment_source,'FINANCE_V7_RECEIPT_RECONCILIATION_REQUIRED');

const active=await readFile('supabase/functions/rona-portal-api/application-business-bootstrap-v2.ts','utf8');
for(const marker of [
  'CLIENT_PAYMENTS_FINANCE_V7_AUTHORITATIVE_V1',
  'deal_finance_authority_v7',
  "p.payment_direction::text='INCOMING'",
  "p.payment_kind::text='CLIENT_PAYMENT'",
  "p.bank_fact_status::text='BANK_CONFIRMED'",
  "p.bank_fact_status::text='RECEIVED_UNVERIFIED'",
  "p.finance_verification_status::text='VERIFIED'",
  "p.source_system='OWNER_CONFIRMED_FINANCE_AI_V7'",
  "pa.source_system='OWNER_CONFIRMED_FINANCE_AI_V7'",
  "pa.allocation_status::text in ('ALLOCATED','VERIFIED')",
  "OWNER_CONFIRMED_RECEIPT_MATERIALIZED",
  "filter (where p.bank_fact_status::text='BANK_CONFIRMED') as payment_ids",
  'newer.supersedes_id=a.id',
  "'/v1/client/context'",
  "'/v1/client/deals'",
  "'/v1/client/payments'",
  'FINANCE_V7_PROJECTION_ERROR',
  'applyClientPaymentAuthorityV7'
])assert.ok(active.includes(marker),`active entrypoint missing ${marker}`);
assert.ok(!active.includes('owner_deal_finance_summary'),'active Finance V7 projection must not read legacy owner summary');
assert.ok(active.includes("for(const payment of incoming){payment.bank_fact_status='BANK_CONFIRMED'"),'legacy client payment rows may be marked bank-confirmed only from the bank-only payment_ids filter');

const config=await readFile('supabase/config.toml','utf8');
assert.ok(config.includes('entrypoint = "./functions/rona-portal-api/application-business-bootstrap-v2.ts"'),'Finance V7 must be attached to deployed rona-portal-api entrypoint');
console.log('CLIENT_PAYMENTS_FINANCE_V7_READ_MODEL=PASS');
