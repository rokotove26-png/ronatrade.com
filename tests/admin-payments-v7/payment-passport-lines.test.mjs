import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizePaymentPassportLines } from '../../supabase/functions/rona-owner-ai-sync/payment-passport-lines.mjs';
import { createRonaOwnerAiSyncV7Handler } from '../../supabase/functions/rona-owner-ai-sync/admin-payments-v7-integration.mjs';

const ready = (deal_id,payment_id,payment_kind,attributed_amount,attributed_currency,accounting_amount,recipient,purpose,bank_transaction_reference=null) => ({
  deal_id,payment_id,payment_at:'2026-08-16T21:00:00Z',payment_kind,recipient,original_payment_purpose:purpose,
  bank_transaction_reference,bank_account_reference:null,bank_statement_date:null,
  attributed_amount,attributed_currency,accounting_amount,accounting_currency:'USD',conversion_source_basis:'BANK_ACTUAL',
  line_status:'AUTHORITATIVE',line_reason:null,
});

test('Payment Passport lines — DEAL-004 exposes six confirmed BANK_ACTUAL equivalents', () => {
  const rows=normalizePaymentPassportLines([
    ready('DEAL-2026-004','OUT-2026-004-BNK','COUNTERPARTY_PAYMENT','8484210','RUB','103026.23','ЗАО «БНК»','Аванс поставщику'),
    ready('DEAL-2026-004','OUT-2026-004-BNK-FEE','BANK_FEE','3000','RUB','36.43','BAKAI Bank','Комиссия'),
    ready('DEAL-2026-004','OUT-2026-004-ORIENT','COUNTERPARTY_PAYMENT','25444800','KZT','54956.37','ТОО «Orient Logistic»','Логистика','BAKAI doc 1808256'),
    ready('DEAL-2026-004','OUT-2026-004-ORIENT-FEE','BANK_FEE','20000','KZT','43.20','BAKAI Bank','Комиссия','BAKAI doc 1808258'),
    ready('DEAL-2026-004','OUT-2026-004-SGTRANS','COUNTERPARTY_PAYMENT','5899358.9','RUB','71637.63','РУП «СГ-ТРАНС»','ЖД услуги','BAKAI doc 5967658'),
    ready('DEAL-2026-004','OUT-2026-004-SGTRANS-FEE','BANK_FEE','3000','RUB','36.43','BAKAI Bank','Комиссия','BAKAI doc 5967660'),
  ]);
  assert.equal(rows.length,6);
  assert.equal(rows.filter(x=>x.row_type==='COMMISSION').length,3);
  assert.ok(rows.every(x=>x.status==='AUTHORITATIVE'&&x.conversion_source_basis==='BANK_ACTUAL'&&x.deal_equivalent_currency==='USD'));
  assert.equal(rows.reduce((sum,x)=>sum+Number(x.deal_equivalent_amount),0).toFixed(2),'229736.29');
});

test('Payment Passport lines — 005/006 consume normalized 80/20 Finance lines, not full legacy shared payment', () => {
  const rows=normalizePaymentPassportLines([
    ready('DEAL-2026-005','OUT-2026-005006-KUZMASH','COUNTERPARTY_PAYMENT','13229568','RUB','162708.48','ЧПТУП «КУЗМАШ»','Агрегированный платёж','BAKAI doc 5631125'),
    ready('DEAL-2026-005','OUT-2026-005006-KUZMASH-FEE','BANK_FEE','2400','RUB','29.52','BAKAI Bank','Комиссия','BAKAI doc 5631127'),
    ready('DEAL-2026-006','OUT-2026-005006-KUZMASH','COUNTERPARTY_PAYMENT','3307392','RUB','40677.12','ЧПТУП «КУЗМАШ»','Агрегированный платёж','BAKAI doc 5631125'),
    ready('DEAL-2026-006','OUT-2026-005006-KUZMASH-FEE','BANK_FEE','600','RUB','7.38','BAKAI Bank','Комиссия','BAKAI doc 5631127'),
  ]);
  const d5=rows.filter(x=>x.deal_id==='DEAL-2026-005'),d6=rows.filter(x=>x.deal_id==='DEAL-2026-006');
  assert.deepEqual(d5.map(x=>x.native_amount),['13229568','2400']);
  assert.deepEqual(d6.map(x=>x.native_amount),['3307392','600']);
  assert.equal(d5.reduce((sum,x)=>sum+Number(x.deal_equivalent_amount),0).toFixed(2),'162738.00');
  assert.equal(d6.reduce((sum,x)=>sum+Number(x.deal_equivalent_amount),0).toFixed(2),'40684.50');
  assert.ok(rows.every(x=>x.conversion_source_basis==='BANK_ACTUAL'));
});

test('Payment Passport lines — unresolved resource chain fails closed without client-side equivalent', () => {
  const [row]=normalizePaymentPassportLines([{
    deal_id:'QA-DEAL',payment_id:'QA-PAY',payment_kind:'COUNTERPARTY_PAYMENT',attributed_amount:'10',attributed_currency:'RUB',
    accounting_amount:'1',accounting_currency:'USD',conversion_source_basis:'BANK_ACTUAL',line_status:'TO_VERIFY',line_reason:'RESOURCE_CHAIN_AUTHORITY_CONFLICT',
  }]);
  assert.equal(row.status,'TO_VERIFY');
  assert.equal(row.deal_equivalent_amount,null);
  assert.equal(row.deal_equivalent_currency,null);
  assert.equal(row.conversion_source_basis,null);
  assert.equal(row.reason,'RESOURCE_CHAIN_AUTHORITY_CONFLICT');
});

test('Payment Passport reader source is read-only Finance attribution + resource chain + bank metadata, with no legacy owner fact dependency', () => {
  const source=fs.readFileSync(new URL('../../supabase/functions/rona-owner-ai-sync/payment-passport-lines.mjs',import.meta.url),'utf8');
  assert.match(source,/isolation level repeatable read read only/);
  assert.match(source,/set local role rona_payments_v7_reader/);
  assert.match(source,/payment_business_attributions_v7/);
  assert.match(source,/payment_business_attribution_lines_v7/);
  assert.match(source,/payment_resource_chains_v7/);
  assert.match(source,/portal_private\.payments/);
  assert.match(source,/attribution_mode/);
  assert.match(source,/FINANCE-AI/);
  assert.doesNotMatch(source,/owner_outgoing_payment_facts/);
  assert.doesNotMatch(source,/allocated_amount\s*\*/);
});

test('Admin sync publishes injected paymentPassportLines without changing Payments V7 projection', async () => {
  const passport=[{deal_id:'QA-DEAL',payment_id:'QA-PAY',status:'AUTHORITATIVE'}];
  const handler=createRonaOwnerAiSyncV7Handler({
    runtimeHandler:async()=>new Response(JSON.stringify({ok:true,data:{shellMarker:'preserved'}}),{status:200,headers:{'content-type':'application/json'}}),
    readRawSources:async()=>({}),
    readPaymentPassportLines:async()=>structuredClone(passport),
    buildProjection:()=>({contract:'ADMIN_PAYMENTS_V7',deals:[],owner_exception_queue:[]}),
    buildSourceBundle:value=>value,
    logger:{error(){}},
  });
  const response=await handler(new Request('https://example.test/admin/sync',{method:'GET'}));
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.data.shellMarker,'preserved');
  assert.equal(body.data.paymentsV7Projection.contract,'ADMIN_PAYMENTS_V7');
  assert.deepEqual(body.data.paymentPassportLines,passport);
  assert.equal(response.headers.get('x-rona-payment-passport-lines'),'READ_ONLY_CURRENT_FINANCE_RESOURCE_CHAIN');
});
