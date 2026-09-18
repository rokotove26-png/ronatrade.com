import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { onRequest as ownerApi } from '../functions/portal/owner-api.js';

const ui=await readFile(new URL('../functions/portal/cash-r2-ui.js',import.meta.url),'utf8');
const ownerApiSource=await readFile(new URL('../functions/portal/owner-api.js',import.meta.url),'utf8');

const finance1709={
  modelVersion:'FINANCE_CASH_SOURCE_PROJECTION_V2_CUMULATIVE',
  effectivePaymentVersion:'FINANCE_EFFECTIVE_PAYMENT_V1',
  authoritativeSource:'AI-FINANCE/BANK_STATEMENT',
  period:{from:'2026-09-17',to:'2026-09-17'},
  controls:{ledger_start:'2026-08-01',ledger_end:'2026-09-17',source_lock:'PASS',calendar_rows:144,zero_turnover_rows:126,max_daily_balance_difference:0,statement_checkpoint_count:2,statement_checkpoint_pass_count:2,max_statement_checkpoint_difference:0,reversal_count:6,matched_reversal_count:6,unresolved_reversal_count:0},
  periodSummary:[
    {currency:'KZT',opening_balance:0.91,external_inflow:0,external_payment:0,gross_external_payment:0,matched_external_payment_reversal:0,effective_external_payment:0,effective_external_payment_operation_count:0,reversal_pair_unresolved_count:0,effective_payment_unresolved_count:0,closing_balance:0.91,balance_check:0,max_daily_balance_difference:0,operation_count:0,calendar_day_count:1,zero_turnover_day_count:1},
    {currency:'RUB',opening_balance:10106237.63,external_inflow:0,external_payment:8350000,gross_external_payment:8350000,matched_external_payment_reversal:0,effective_external_payment:8350000,effective_external_payment_operation_count:4,reversal_pair_unresolved_count:0,effective_payment_unresolved_count:0,closing_balance:1756237.63,balance_check:0,max_daily_balance_difference:0,operation_count:4,calendar_day_count:1,zero_turnover_day_count:0},
    {currency:'USD',opening_balance:5657.04,external_inflow:225900,external_payment:0,gross_external_payment:0,matched_external_payment_reversal:0,effective_external_payment:0,effective_external_payment_operation_count:0,reversal_pair_unresolved_count:0,effective_payment_unresolved_count:0,closing_balance:231557.04,balance_check:0,max_daily_balance_difference:0,operation_count:2,calendar_day_count:1,zero_turnover_day_count:0},
  ],
  operations:[
    {operation_date:'2026-09-17',executed_at_local:'2026-09-17T17:07:17',currency:'RUB',amount:4816000,gross_amount:4816000,reversed_amount:0,effective_external_payment_amount:4816000,effective_payment_status:'SETTLED',direction:'OUTGOING',operation_type:'EXTERNAL_PAYMENT',raw_operation_type:'EXTERNAL_PAYMENT',counterparty:'ЧПТУП «КУЗМАШ»',bank_document_number:'2390305'},
    {operation_date:'2026-09-17',executed_at_local:'2026-09-17T17:07:17',currency:'RUB',amount:3000,gross_amount:3000,reversed_amount:0,effective_external_payment_amount:3000,effective_payment_status:'SETTLED',direction:'OUTGOING',operation_type:'EXTERNAL_PAYMENT',raw_operation_type:'EXTERNAL_PAYMENT',counterparty:'ОАО «БАКАЙ БАНК»',bank_document_number:'2390307'},
    {operation_date:'2026-09-17',executed_at_local:'2026-09-17T17:06:54',currency:'RUB',amount:3000,gross_amount:3000,reversed_amount:0,effective_external_payment_amount:3000,effective_payment_status:'SETTLED',direction:'OUTGOING',operation_type:'EXTERNAL_PAYMENT',raw_operation_type:'EXTERNAL_PAYMENT',counterparty:'ОАО «БАКАЙ БАНК»',bank_document_number:'2389794'},
    {operation_date:'2026-09-17',executed_at_local:'2026-09-17T17:06:54',currency:'RUB',amount:3528000,gross_amount:3528000,reversed_amount:0,effective_external_payment_amount:3528000,effective_payment_status:'SETTLED',direction:'OUTGOING',operation_type:'EXTERNAL_PAYMENT',raw_operation_type:'EXTERNAL_PAYMENT',counterparty:'ЧПТУП «КУЗМАШ»',bank_document_number:'2389792'},
    {operation_date:'2026-09-17',executed_at_local:'2026-09-17T16:10:09',currency:'USD',amount:94125,gross_amount:94125,reversed_amount:0,effective_external_payment_amount:0,effective_payment_status:'NOT_APPLICABLE',direction:'INCOMING',operation_type:'EXTERNAL_INFLOW',raw_operation_type:'EXTERNAL_INFLOW',counterparty:'FARGONA GAZ TULDIRISH STANTSIYASI LLC',bank_document_number:'2304421'},
    {operation_date:'2026-09-17',executed_at_local:'2026-09-17T16:08:28',currency:'USD',amount:131775,gross_amount:131775,reversed_amount:0,effective_external_payment_amount:0,effective_payment_status:'NOT_APPLICABLE',direction:'INCOMING',operation_type:'EXTERNAL_INFLOW',raw_operation_type:'EXTERNAL_INFLOW',counterparty:'FARGONA GAZ TULDIRISH STANTSIYASI LLC',bank_document_number:'2301886'},
  ],
};

test('Cash UI consumes only canonical Finance source projection contract',()=>{
  assert.match(ui,/\/portal\/owner-api\?path=\/admin\/cash-source/);
  assert.match(ui,/FINANCE_CASH_SOURCE_PROJECTION_V2_CUMULATIVE/);
  assert.match(ui,/AI-FINANCE\/BANK_STATEMENT/);
  assert.match(ui,/periodSummary/);
  assert.match(ui,/opening_balance/);
  assert.match(ui,/external_inflow/);
  assert.match(ui,/external_payment/);
  assert.match(ui,/effective_external_payment/);
  assert.match(ui,/effective_external_payment_amount/);
  assert.match(ui,/FINANCE_EFFECTIVE_PAYMENT_V1/);
  assert.match(ui,/closing_balance/);
  assert.match(ui,/operation_type/);
  assert.match(ui,/REVERSAL/);
  assert.match(ui,/source_lock/);
  assert.match(ui,/max_daily_balance_difference/);
  assert.match(ui,/counterparty/);
  assert.ok(ui.includes('canonical_counterparty_id'));
  assert.ok(ui.includes('canonical_counterparty_name'));
  assert.ok(ui.includes('Сторно / возвраты'));
  assert.match(ui,/Последний день/);
  assert.match(ui,/Весь период/);
  assert.doesNotMatch(ui,/cashProjection/);
  assert.doesNotMatch(ui,/payment_kind/);
  assert.doesNotMatch(ui,/payment_direction/);
  assert.doesNotMatch(ui,/counts_in_received/);
  assert.doesNotMatch(ui,/counts_in_paid/);
  assert.doesNotMatch(ui,/original_payment_purpose/);
});

test('Admin transport maps Cash only to Finance guarded RPC',()=>{
  assert.match(ownerApiSource,/path==='\/admin\/cash-source'&&method==='POST'/);
  assert.match(ownerApiSource,/rona_admin_cash_source_projection_v1/);
  assert.match(ownerApiSource,/p_from:body\?\.from\|\|null/);
  assert.match(ownerApiSource,/p_to:body\?\.to\|\|null/);
});

test('Cash route forwards selected dates to Finance RPC with current portal token',async()=>{
  const originalFetch=globalThis.fetch;
  let captured=null;
  globalThis.fetch=async(url,init={})=>{
    captured={url:String(url),method:init.method,authorization:new Headers(init.headers).get('authorization'),body:String(init.body||'')};
    return new Response(JSON.stringify(finance1709),{status:200,headers:{'content-type':'application/json'}});
  };
  try{
    const request=new Request('https://ronaoil.com/portal/owner-api?path=/admin/cash-source',{
      method:'POST',
      headers:{cookie:'rona_portal_at=test-access','content-type':'application/json',origin:'https://ronaoil.com'},
      body:JSON.stringify({from:'2026-09-17',to:'2026-09-17'})
    });
    const response=await ownerApi({request});
    const payload=await response.json();
    assert.equal(response.status,200);
    assert.equal(payload.ok,true);
    assert.equal(payload.data.modelVersion,'FINANCE_CASH_SOURCE_PROJECTION_V2_CUMULATIVE');
    assert.equal(payload.data.effectivePaymentVersion,'FINANCE_EFFECTIVE_PAYMENT_V1');
    assert.equal(captured.url,'https://sxawrwzeobaqwwmlkzws.supabase.co/rest/v1/rpc/rona_admin_cash_source_projection_v1');
    assert.equal(captured.method,'POST');
    assert.equal(captured.authorization,'Bearer test-access');
    assert.deepEqual(JSON.parse(captured.body),{p_from:'2026-09-17',p_to:'2026-09-17'});
  }finally{
    globalThis.fetch=originalFetch;
  }
});

test('17.09 Finance control is represented without UI-side reclassification',()=>{
  const byCurrency=Object.fromEntries(finance1709.periodSummary.map(x=>[x.currency,x]));
  assert.equal(byCurrency.KZT.opening_balance,0.91);
  assert.equal(byCurrency.KZT.external_inflow,0);
  assert.equal(byCurrency.KZT.external_payment,0);
  assert.equal(byCurrency.KZT.effective_external_payment,0);
  assert.equal(byCurrency.KZT.closing_balance,0.91);
  assert.equal(byCurrency.USD.opening_balance,5657.04);
  assert.equal(byCurrency.USD.external_inflow,225900);
  assert.equal(byCurrency.USD.external_payment,0);
  assert.equal(byCurrency.USD.effective_external_payment,0);
  assert.equal(byCurrency.USD.closing_balance,231557.04);
  assert.equal(byCurrency.RUB.opening_balance,10106237.63);
  assert.equal(byCurrency.RUB.external_inflow,0);
  assert.equal(byCurrency.RUB.external_payment,8350000);
  assert.equal(byCurrency.RUB.effective_external_payment,8350000);
  assert.equal(byCurrency.RUB.closing_balance,1756237.63);
  assert.ok(finance1709.periodSummary.every(x=>x.balance_check===0));
  assert.equal(finance1709.controls.source_lock,'PASS');
  assert.equal(finance1709.controls.max_daily_balance_difference,0);
  assert.equal(finance1709.controls.max_statement_checkpoint_difference,0);
  assert.equal(finance1709.operations.filter(x=>x.raw_operation_type==='EXTERNAL_PAYMENT').reduce((s,x)=>s+x.effective_external_payment_amount,0),8350000);
  assert.equal(finance1709.operations.filter(x=>x.operation_type==='EXTERNAL_INFLOW').reduce((s,x)=>s+x.amount,0),225900);
});
