import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { onRequest as renderMainUi } from '../functions/portal/main-ui/index.js';
import { __test } from '../functions/portal/main-ui/_middleware.js';

const baseResponse = await renderMainUi();
assert.equal(baseResponse.status, 200, 'Base Admin main-ui must render successfully');
const base = await baseResponse.text();

assert.match(base, /function renderPayments\(\)\{/,'Base Payments renderer missing');
assert.match(base, /function renderCash\(\)\{/,'Base Cash renderer missing before single-owner middleware');
assert.match(base, /paymentsV7Deal=function paymentsV7DealFinalDisplay\(deal\)/,'Final deal display override missing');
assert.match(base, /renderPayments=function renderPayments\(\)/,'Authoritative aggregate renderer override missing');

const paymentsPatched = __test.patchPaymentsCurrentSemantics(base);

assert.equal(__test.PAYMENTS_OWNER, 'admin-payments-v7-native-v2');
assert.match(paymentsPatched, /grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/,'Payments KPI grid must have five columns');
assert.match(paymentsPatched, /function paymentsV7AggregateExpected\(deals\)/,'Base current expected aggregate helper missing');
assert.match(paymentsPatched, /for\(const field of \['due_now','expected_not_due'\]\)/,'Base expected must aggregate due_now + expected_not_due only');
assert.match(paymentsPatched, /function paymentsV7MergeServerAggregateRows\(\.\.\.aggregates\)/,'Server aggregate merge helper missing');
assert.match(paymentsPatched, /paymentsV7MergeServerAggregateRows\(currencyAggregates\?\.due_now,currencyAggregates\?\.expected_not_due\)/,'Final server aggregate expected must combine due_now + expected_not_due');
assert.match(paymentsPatched, /paymentsV7Kpi\('Conditional'/,'Conditional must be a separate KPI');
assert.match(paymentsPatched, /paymentsV7Money\(deal\?\.remaining_to_receive\)/,'Base deal visible expected amount must use full remaining_to_receive');
assert.match(paymentsPatched, /paymentsV7OwnerMoney\(deal\?\.remaining_to_receive/,'Final deal/passport display must use full remaining_to_receive');
assert.doesNotMatch(paymentsPatched, /paymentsV7OwnerMoney\(deal\?\.expected_not_due/,'No final Owner display may expose expected_not_due as full outstanding amount');
assert.match(paymentsPatched, /text:'Сумма по сделке'/,'Deal total label must be explicit');
assert.match(paymentsPatched, /data-rona-payments-owner':'admin-payments-v7-native-v2'/,'Updated Payments route owner marker missing');

const finalDealStart = paymentsPatched.indexOf('paymentsV7Deal=function paymentsV7DealFinalDisplay(deal){');
const finalDealEnd = paymentsPatched.indexOf('const PAYMENTS_V7_SERVER_AGGREGATE_UI=', finalDealStart);
assert.ok(finalDealStart >= 0 && finalDealEnd > finalDealStart, 'Cannot isolate final deal display override');
const finalDealRenderer = paymentsPatched.slice(finalDealStart, finalDealEnd);
assert.match(finalDealRenderer, /paymentsV7OwnerMoney\(deal\?\.remaining_to_receive/,'Final active deal renderer must use remaining_to_receive');
assert.doesNotMatch(finalDealRenderer, /paymentsV7OwnerMoney\(deal\?\.expected_not_due/,'Final active deal renderer must not use expected_not_due as full outstanding amount');

const aggregateRenderStart = paymentsPatched.indexOf('renderPayments=function renderPayments(){');
const aggregateRenderEnd = paymentsPatched.indexOf("if(paymentsV7Projection())queueMicrotask", aggregateRenderStart);
assert.ok(aggregateRenderStart >= 0 && aggregateRenderEnd > aggregateRenderStart, 'Cannot isolate authoritative aggregate renderer');
const aggregateRenderer = paymentsPatched.slice(aggregateRenderStart, aggregateRenderEnd);
assert.match(aggregateRenderer, /paymentsV7MergeServerAggregateRows\(currencyAggregates\?\.due_now,currencyAggregates\?\.expected_not_due\)/,'Final active aggregate renderer must combine current expected buckets');
assert.match(aggregateRenderer, /paymentsV7Kpi\('Conditional'/,'Final active aggregate renderer must expose Conditional separately');
assert.match(aggregateRenderer, /paymentsV7Kpi\('Сумма по сделке'/,'Final active aggregate renderer must use explicit deal-total KPI title');
assert.match(aggregateRenderer, /routeOwner:'admin-payments-v7-native-v2'/,'Final active aggregate renderer must publish v2 route owner');

const fullyPatched = __test.patchCashSingleOwner(paymentsPatched);

assert.equal(__test.CASH_OWNER, 'cash-r2-exclusive-v1');
assert.doesNotMatch(fullyPatched, /function renderCash\(\)\{/,'Legacy Cash renderer must be removed');
assert.doesNotMatch(fullyPatched, /renderPayments\(\);renderCash\(\)/,'Finance sync must not revive legacy Cash renderer');
assert.match(fullyPatched, /function ensureCashR2Host\(\)/,'Cash R2 host function missing');
assert.match(fullyPatched, /'data-rona-cash-host':'r2'/,'Cash R2 host marker must remain exact');
assert.match(fullyPatched, /accounting:ensureCashR2Host,/,'Accounting route must remain owned by Cash R2');
assert.match(fullyPatched, /renderPayments\(\);ensureCashR2Host\(\);renderRail\(\);/,'Boot sequence must preserve Payments + Cash R2 ownership');

const middlewareSource = readFileSync('functions/portal/main-ui/_middleware.js','utf8');
const paymentsOrder = middlewareSource.indexOf('const paymentsPatched=patchPaymentsCurrentSemantics(await response.text());');
const cashOrder = middlewareSource.indexOf('patched=patchCashSingleOwner(paymentsPatched);');
assert.ok(paymentsOrder >= 0 && cashOrder > paymentsOrder, 'Middleware must patch Payments before applying Cash single-owner isolation');
assert.match(middlewareSource, /headers\.set\('x-rona-payments-current-runtime','conditional-aware-v2'\)/,'Production diagnostic header missing');

console.log('Admin Payments live middleware v2 regression: PASS');
