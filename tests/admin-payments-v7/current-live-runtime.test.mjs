import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CURRENT_PAYMENTS_ROUTE_OWNER,
  PAYMENTS_V7_BROWSER_RUNTIME_CURRENT,
  patchAdminPaymentsRuntimeCurrentSource,
} from '../../scripts/admin-payments-v7-live-runtime-current.mjs';

test('current live Payments runtime has five summary tiles with separate Conditional', () => {
  assert.equal(CURRENT_PAYMENTS_ROUTE_OWNER, 'admin-payments-v7-native-v2');
  assert.match(PAYMENTS_V7_BROWSER_RUNTIME_CURRENT, /grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(PAYMENTS_V7_BROWSER_RUNTIME_CURRENT, /paymentsV7Kpi\('Conditional'/);
  assert.match(PAYMENTS_V7_BROWSER_RUNTIME_CURRENT, /text:'Условно ожидается'/);
});

test('Payments money and percentage display is rounded to tenths', () => {
  assert.match(PAYMENTS_V7_BROWSER_RUNTIME_CURRENT, /function paymentsV7Fmt\(v\).*maximumFractionDigits:1/);
  assert.doesNotMatch(PAYMENTS_V7_BROWSER_RUNTIME_CURRENT, /function paymentsV7Fmt\(v\).*maximumFractionDigits:2/);
});

test('top and deal Expected exclude Conditional and use current due semantics', () => {
  assert.match(PAYMENTS_V7_BROWSER_RUNTIME_CURRENT, /function paymentsV7AggregateExpected\(deals\)/);
  assert.match(PAYMENTS_V7_BROWSER_RUNTIME_CURRENT, /\['due_now','expected_not_due'\]/);
  assert.match(PAYMENTS_V7_BROWSER_RUNTIME_CURRENT, /paymentsV7Aggregate\(deals,'future_conditional'\)/);
  assert.match(PAYMENTS_V7_BROWSER_RUNTIME_CURRENT, /text:'Ожидается'\}\),e\('strong',\{text:paymentsV7Money\(deal\?\.due_now\)\}\)/);
  assert.doesNotMatch(PAYMENTS_V7_BROWSER_RUNTIME_CURRENT, /text:'Ожидается'\}\),e\('strong',\{text:paymentsV7Money\(deal\?\.remaining_to_receive\)\}\)/);
});

test('Cloudflare source wrapper patch replaces the assembled legacy Payments renderer', () => {
  const source = `const SCRIPT='function renderPayments(){isolatePaymentsPage();const f=financeFragment();legacy}function renderCash(){}';\n\nexport async function onRequest(){return new Response(SCRIPT,{headers:{'x-rona-payments-ui':'finance-current-v2','x-rona-payments-handoff':'canonical-finance-v3'}})}`;
  const patched = patchAdminPaymentsRuntimeCurrentSource(source);
  assert.match(patched, /patchPaymentsRuntimeCurrent/);
  assert.match(patched, /admin-payments-v7-native-v2/);
  assert.match(patched, /payments-v7-projection/);
});

test('live runtime contains no deal, client or amount hardcodes', () => {
  for (const forbidden of [
    /DEAL-2026-/,
    /236250|672500|470750|164400|115080|31002300|21002300|131775|753000/,
    /ГазОнэ|UNVERSAL SOLYARIS|FARGONA/i,
  ]) assert.doesNotMatch(PAYMENTS_V7_BROWSER_RUNTIME_CURRENT, forbidden);
});
