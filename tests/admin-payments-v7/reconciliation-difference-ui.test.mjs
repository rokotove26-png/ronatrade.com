import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PAYMENTS_RECONCILIATION_DIFFERENCE_BROWSER_RUNTIME,
  PAYMENTS_RECONCILIATION_DIFFERENCE_UI_CONTRACT,
  appendPaymentsReconciliationDifferenceRuntime,
  patchAdminPaymentsReconciliationDifferenceSource,
} from '../../scripts/admin-payments-reconciliation-difference-ui.mjs';

test('reconciliation difference runtime is appended without modifying the existing Payments renderer', () => {
  const existingRenderer = "function renderPayments(){const root=e('div',{class:'rona-payments-v7'});root.append(e('h2',{class:'rona-payments-v7-title',text:'Платежи'}));root.append(e('div',{class:'rona-payments-v7-kpis'}));replacePage('payments',root)}";
  const patched = appendPaymentsReconciliationDifferenceRuntime(existingRenderer);
  assert.equal(patched.slice(0, existingRenderer.length), existingRenderer);
  assert.match(patched, new RegExp(PAYMENTS_RECONCILIATION_DIFFERENCE_UI_CONTRACT));
  assert.match(patched, /Сверочная разница/);
  assert.match(patched, /position:absolute;top:0;right:0/);
});

test('source patch wraps only the assembled SCRIPT expression and leaves source renderer text byte-identical', () => {
  const renderer = "function renderPayments(){return 'UNCHANGED_RENDERER_SENTINEL'}";
  const source = `${renderer}\nconst SCRIPT=patchExisting(RAW);\n\nexport async function onRequest(){return new Response(SCRIPT)}`;
  const patched = patchAdminPaymentsReconciliationDifferenceSource(source);
  assert.ok(patched.includes(renderer));
  assert.equal((patched.match(/UNCHANGED_RENDERER_SENTINEL/g) || []).length, 1);
  assert.match(patched, /const SCRIPT=\(patchExisting\(RAW\)\)\+/);
  assert.match(patched, new RegExp(PAYMENTS_RECONCILIATION_DIFFERENCE_UI_CONTRACT));
});

test('header metric reads Finance bootstrap only, auto-refreshes, and never derives a local amount', () => {
  const source = PAYMENTS_RECONCILIATION_DIFFERENCE_BROWSER_RUNTIME;
  assert.match(source, /\/portal\/api\/v1\/admin\/bootstrap/);
  assert.match(source, /finance_reconciliation_difference/);
  assert.match(source, /setInterval\(refresh,refreshMs\)/);
  assert.match(source, /cache:'no-store'/);
  assert.match(source, /text:'—'/);
  assert.match(source, /publisher==='AI-FINANCE'/);
  assert.match(source, /role==='FINANCE'/);
  assert.doesNotMatch(source, /bank_balance|management_balance|remaining_execution|actual_spend|verified_received/);
});

test('header overlay adds no KPI/card/grid styling and contains no deal or business amount hardcode', () => {
  const source = PAYMENTS_RECONCILIATION_DIFFERENCE_BROWSER_RUNTIME;
  for (const forbidden of [
    '.rona-payments-v7-kpis', '.rona-payments-v7-kpi', '.rona-payments-v7-deal', 'grid-template-columns',
    'DEAL-2026-', '225900', '527100', '35574.47', '190325.53', '6225.53',
  ]) assert.equal(source.includes(forbidden), false, `${forbidden} must not be changed or hardcoded by the indicator overlay`);
});
