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
assert.match(paymentsPatched, /paymentsV7Money\(deal\?\.due_now\)/,'Base deal visible current due amount must use due_now');
assert.match(paymentsPatched, /paymentsV7Kpi\('Conditional'/,'Conditional must be a separate KPI');
assert.match(paymentsPatched, /paymentsV7Aggregate\(deals,'future_conditional'\)/,'Base Conditional must use future_conditional');
assert.match(paymentsPatched, /paymentsV7OwnerMoney\(deal\?\.due_now/,'Final deal/passport display must use due_now');
assert.match(paymentsPatched, /paymentsV7OwnerMoney\(deal\?\.future_conditional/,'Final deal/passport display must expose future_conditional separately');
assert.match(paymentsPatched, /paymentsV7Kpi\('Сумма по сделке'/,'Deal total KPI label must be explicit');
assert.match(paymentsPatched, /data-rona-payments-owner':'admin-payments-v7-native-v2'/,'Updated Payments route owner marker missing');

const finalDealStart = paymentsPatched.indexOf('paymentsV7Deal=function paymentsV7DealFinalDisplay(deal){');
const finalDealEnd = paymentsPatched.indexOf('const PAYMENTS_V7_SERVER_AGGREGATE_UI=', finalDealStart);
assert.ok(finalDealStart >= 0 && finalDealEnd > finalDealStart, 'Cannot isolate final deal display override');
const finalDealRenderer = paymentsPatched.slice(finalDealStart, finalDealEnd);
assert.match(finalDealRenderer, /paymentsV7OwnerMoney\(deal\?\.due_now/,'Final active deal renderer must use due_now');
assert.match(finalDealRenderer, /paymentsV7OwnerMoney\(deal\?\.future_conditional/,'Final active deal renderer must expose future_conditional');
assert.doesNotMatch(finalDealRenderer, /paymentsV7OwnerMoney\(deal\?\.remaining_to_receive/,'Final active deal renderer must not use remaining_to_receive as current due');

const aggregateRenderStart = paymentsPatched.indexOf('renderPayments=function renderPayments(){');
const aggregateRenderEnd = paymentsPatched.indexOf("if(paymentsV7Projection())queueMicrotask", aggregateRenderStart);
assert.ok(aggregateRenderStart >= 0 && aggregateRenderEnd > aggregateRenderStart, 'Cannot isolate authoritative aggregate renderer');
const aggregateRenderer = paymentsPatched.slice(aggregateRenderStart, aggregateRenderEnd);
assert.match(aggregateRenderer, /expected=paymentsV7ServerAggregateRows\(currencyAggregates\?\.due_now\)/,'Final active aggregate expected must use due_now only');
assert.match(aggregateRenderer, /conditional=paymentsV7ServerAggregateRows\(currencyAggregates\?\.future_conditional\)/,'Final active aggregate Conditional must use future_conditional');
assert.doesNotMatch(aggregateRenderer, /expected=paymentsV7MergeServerAggregateRows\(currencyAggregates\?\.due_now,currencyAggregates\?\.expected_not_due\)/,'Final active aggregate must not combine future amounts into due-now');
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
assert.match(fullyPatched, /ownerAdminSafeRender\('payments',renderPayments\);ownerAdminSafeRender\('accounting',ensureCashR2Host\);ownerAdminSafeRender\('monitoring',renderRailCurrentShell\);/,'Boot sequence must preserve isolated Payments + Cash R2 + current Rail ownership');
assert.doesNotMatch(fullyPatched,/renderRail\(\);/,'Cash middleware must not revive legacy Rail owner');

const middlewareSource = readFileSync('functions/portal/main-ui/_middleware.js','utf8');
const paymentsOrder = middlewareSource.indexOf('const paymentsPatched=patchPaymentsCurrentSemantics(await response.text());');
const cashOrder = middlewareSource.indexOf('patched=patchCashSingleOwner(paymentsPatched);');
assert.ok(paymentsOrder >= 0 && cashOrder > paymentsOrder, 'Middleware must verify Payments before applying Cash single-owner isolation');
assert.match(middlewareSource, /headers\.set\('x-rona-payments-current-runtime','due-now-conditional-v3'\)/,'Production V8 diagnostic header missing');

console.log('Admin Payments live middleware V8 regression: PASS');
