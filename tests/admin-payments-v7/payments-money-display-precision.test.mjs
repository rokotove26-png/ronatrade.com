import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import paymentsMoneyDisplayContract from '../../functions/portal/main-ui/payments-money-display-contract.js';

const v8Ui=readFileSync(new URL('../../functions/portal/payments-v8-ui.js',import.meta.url),'utf8');
const middleware=readFileSync(new URL('../../functions/portal/main-ui/_middleware.js',import.meta.url),'utf8');
const passportActivation=readFileSync(new URL('../../functions/portal/main-ui/payments-v7-passport-activation-fix.js',import.meta.url),'utf8');
const passportUi=readFileSync(new URL('../../functions/portal/main-ui/payments-v7-owner-passport-ui.js',import.meta.url),'utf8');
const aggregateUi=readFileSync(new URL('../../functions/portal/main-ui/payments-v7-authoritative-aggregate-ui.js',import.meta.url),'utf8');

function displayContract(){
  const context={Intl,Number,String,Object};
  context.globalThis=context;
  vm.runInNewContext(paymentsMoneyDisplayContract,context);
  return context.__RONA_PAYMENTS_MONEY_DISPLAY__;
}

function fractionalDigits(text){
  const match=String(text).match(/[,.](\d+)/);
  return match?match[1].length:0;
}

function numericDisplay(text){
  return Number(String(text).replace(/[\u00a0\u202f\s]/g,'').replace(',','.'));
}

test('canonical Payments presentation contract preserves source precision and displays at most one decimal',()=>{
  const display=displayContract();
  assert.equal(display.contract,'RONA_PAYMENTS_MONEY_DISPLAY_V1');
  assert.equal(display.maximumFractionDigits,1);

  const apiPayload={actual_spend:{amount:'1234.567890123',currency:'USD',status:'AUTHORITATIVE'}};
  const before=JSON.stringify(apiPayload);
  const shown=display.formatAmount(apiPayload.actual_spend.amount);

  assert.equal(JSON.stringify(apiPayload),before,'presentation formatting must not mutate API/source values');
  assert.ok(fractionalDigits(shown)<=1,`display has more than one decimal: ${shown}`);
  assert.equal(numericDisplay(shown),1234.6);
});

test('aggregate arithmetic keeps raw precision and formatting is applied only after aggregation',()=>{
  const display=displayContract();
  const source=['1.26','2.27'];
  const preciseTotal=source.reduce((sum,value)=>sum+Number(value),0);
  const shown=display.formatAmount(preciseTotal);

  assert.ok(Math.abs(preciseTotal-3.53)<1e-12);
  assert.equal(numericDisplay(shown),3.5);
  assert.notEqual(preciseTotal,numericDisplay(shown),'display-rounded value must not feed aggregate arithmetic');

  assert.match(v8Ui,/projection\?\.currency_aggregates\?\.\[field\]/,'V8 board must consume server-computed currency aggregates');
  assert.doesNotMatch(v8Ui,/map\.set\(c,\(map\.get\(c\)\|\|0\)\+Number\(m\.amount\)\)/,'V8 UI must not recompute authoritative currency aggregates client-side');
  assert.match(aggregateUi,/totals\.set\(row\.currency,\(totals\.get\(row\.currency\)\|\|0\)\+Number\(row\.amount\)\)/);
  assert.doesNotMatch(v8Ui,/map\.set\([^\n]+formatAmount/);
});

test('live Payments board, passport, funding events and details converge on one presentation contract',()=>{
  assert.match(v8Ui,/paymentsMoneyDisplayContract\+String\.raw/);
  assert.match(v8Ui,/__RONA_PAYMENTS_MONEY_DISPLAY__\?\.formatAmount/);
  assert.doesNotMatch(v8Ui,/new Intl\.NumberFormat/);

  assert.match(middleware,/paymentsMoneyDisplayContract\+'\\n'\+script/);
  assert.match(middleware,/LEGACY_PAYMENTS_V7_FORMATTERS/);
  assert.match(middleware,/CANONICAL_PAYMENTS_V7_FORMATTER/);
  assert.match(middleware,/CANONICAL_PASSPORT_FORMATTER/);
  assert.match(middleware,/ADMIN_PAYMENTS_COMPETING_FORMATTER_REMAINS/);
  assert.match(middleware,/LEGACY_PAYMENTS_V7_FORMATTERS\.some\(legacy=>script\.includes\(legacy\)\)/);
  assert.match(middleware,/x-rona-payments-money-display','max-1-v1/);

  assert.match(passportActivation,/maximumFractionDigits:1/,'existing passport precision is the presentation baseline');
  assert.doesNotMatch(passportActivation,/maximumFractionDigits:2/);
  assert.match(passportUi,/paymentsV7OwnerAmount\(event\?\.conversion_rate\)/);
  assert.match(passportUi,/paymentsV7OwnerRawMoney\(event\?\.allocated_funding_amount/);
  assert.match(passportUi,/paymentsV7OwnerRawMoney\(row\?\.amount,row\?\.currency/);
});
