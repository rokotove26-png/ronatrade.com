import assert from 'node:assert/strict';
import { onRequest as renderMainUi } from '../functions/portal/main-ui/index.js';
import { __test } from '../functions/portal/main-ui/_middleware.js';

const baseResponse = await renderMainUi();
assert.equal(baseResponse.status, 200, 'Base Admin main-ui must render successfully');
const base = await baseResponse.text();

assert.match(base, /function renderPayments\(\)\{/,'Base Payments renderer missing');
assert.match(base, /function renderCash\(\)\{/,'Base Cash renderer missing before single-owner middleware');

const paymentsPatched = __test.patchPaymentsCurrentSemantics(base);

assert.equal(__test.PAYMENTS_OWNER, 'admin-payments-v7-native-v2');
assert.match(paymentsPatched, /grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/,'Payments KPI grid must have five columns');
assert.match(paymentsPatched, /function paymentsV7AggregateExpected\(deals\)/,'Current expected aggregate helper missing');
assert.match(paymentsPatched, /for\(const field of \['due_now','expected_not_due'\]\)/,'Expected must aggregate due_now + expected_not_due only');
assert.match(paymentsPatched, /paymentsV7Kpi\('Conditional'/,'Conditional must be a separate KPI');
assert.match(paymentsPatched, /paymentsV7Money\(deal\?\.remaining_to_receive\)/,'Deal visible expected amount must use full remaining_to_receive');
assert.match(paymentsPatched, /text:'Сумма по сделке'/,'Deal total label must be explicit');
assert.match(paymentsPatched, /data-rona-payments-owner':'admin-payments-v7-native-v2'/,'Updated Payments route owner marker missing');

const lastDealRenderer = paymentsPatched.slice(paymentsPatched.lastIndexOf('function paymentsV7Deal('), paymentsPatched.lastIndexOf('function renderPayments(){'));
assert.match(lastDealRenderer, /paymentsV7Money\(deal\?\.remaining_to_receive\)/,'Active deal renderer must use remaining_to_receive');
assert.doesNotMatch(lastDealRenderer, /paymentsV7Money\(deal\?\.expected_not_due\)/,'Active deal renderer must not expose expected_not_due as full outstanding amount');

const lastPaymentsRenderer = paymentsPatched.slice(paymentsPatched.lastIndexOf('function renderPayments(){'));
assert.match(lastPaymentsRenderer, /paymentsV7AggregateExpected\(deals\)/,'Active Payments renderer must use current expected aggregate');
assert.match(lastPaymentsRenderer, /paymentsV7Kpi\('Conditional'/,'Active Payments renderer must expose Conditional separately');

const fullyPatched = __test.patchCashSingleOwner(paymentsPatched);

assert.equal(__test.CASH_OWNER, 'cash-r2-exclusive-v1');
assert.doesNotMatch(fullyPatched, /function renderCash\(\)\{/,'Legacy Cash renderer must be removed');
assert.doesNotMatch(fullyPatched, /renderPayments\(\);renderCash\(\)/,'Finance sync must not revive legacy Cash renderer');
assert.match(fullyPatched, /function ensureCashR2Host\(\)/,'Cash R2 host function missing');
assert.match(fullyPatched, /'data-rona-cash-host':'r2'/,'Cash R2 host marker must remain exact');
assert.match(fullyPatched, /accounting:ensureCashR2Host,/,'Accounting route must remain owned by Cash R2');
assert.match(fullyPatched, /renderPayments\(\);ensureCashR2Host\(\);renderRail\(\);/,'Boot sequence must preserve Payments + Cash R2 ownership');

const middlewareSource = await import('node:fs').then(({ readFileSync }) => readFileSync('functions/portal/main-ui/_middleware.js','utf8'));
const paymentsOrder = middlewareSource.indexOf('const paymentsPatched=patchPaymentsCurrentSemantics(await response.text());');
const cashOrder = middlewareSource.indexOf('patched=patchCashSingleOwner(paymentsPatched);');
assert.ok(paymentsOrder >= 0 && cashOrder > paymentsOrder, 'Middleware must patch Payments before applying Cash single-owner isolation');
assert.match(middlewareSource, /headers\.set\('x-rona-payments-current-runtime','conditional-aware-v2'\)/,'Production diagnostic header missing');

console.log('Admin Payments live middleware v2 regression: PASS');
