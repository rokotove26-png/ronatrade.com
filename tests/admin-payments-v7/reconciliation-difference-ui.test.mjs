import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PAYMENTS_RECONCILIATION_DIFFERENCE_BROWSER_RUNTIME,
  PAYMENTS_RECONCILIATION_DIFFERENCE_UI_CONTRACT,
  appendPaymentsReconciliationDifferenceRuntime,
  patchAdminPaymentsReconciliationDifferenceSource,
} from '../../scripts/admin-payments-reconciliation-difference-ui.mjs';

test('reconciliation indicator is append-only and preserves the Payments renderer', () => {
  const renderer="function renderPayments(){const root=e('div',{class:'rona-payments-v7'});root.append(e('h2',{class:'rona-payments-v7-title',text:'Платежи'}));replacePage('payments',root)}";
  const patched=appendPaymentsReconciliationDifferenceRuntime(renderer);
  assert.equal(patched.slice(0,renderer.length),renderer);
  assert.match(patched,new RegExp(PAYMENTS_RECONCILIATION_DIFFERENCE_UI_CONTRACT));
  assert.match(patched,/Сверочная разница/);
  assert.match(patched,/rona-payments-reconciliation-title-ticker/);
  assert.match(patched,/findTitleFrame/);
  assert.match(patched,/title\.closest\('\.rona-visual-hero'\)/);
  assert.match(patched,/rona-has-reconciliation-ticker/);
  assert.doesNotMatch(patched,/heading\.append\(title,right\)/);
});

test('assembled Admin source gets only an appended reconciliation runtime', () => {
  const renderer="function renderPayments(){return 'PAYMENTS_VISUAL_FREEZE_SENTINEL'}";
  const source=`${renderer}\nconst SCRIPT=patchExisting(RAW);\n\nexport async function onRequest(){return new Response(SCRIPT)}`;
  const patched=patchAdminPaymentsReconciliationDifferenceSource(source);
  assert.ok(patched.includes(renderer));
  assert.equal((patched.match(/PAYMENTS_VISUAL_FREEZE_SENTINEL/g)||[]).length,1);
  assert.match(patched,/const SCRIPT=\(patchExisting\(RAW\)\)\+/);
});

test('runtime reads only Finance publication payload and refreshes every 30s', () => {
  const source=PAYMENTS_RECONCILIATION_DIFFERENCE_BROWSER_RUNTIME;
  assert.match(source,/FINANCE_RECONCILIATION_DIFFERENCE_PUBLICATION_V1/);
  assert.match(source,/finance_reconciliation_difference/);
  assert.match(source,/\/portal\/api\/v1\/admin\/bootstrap/);
  assert.match(source,/setInterval\(refresh,refreshMs\)/);
  assert.match(source,/const refreshMs=30000/);
  assert.match(source,/publisher==='AI-FINANCE'/);
  assert.match(source,/role==='FINANCE'/);
  assert.match(source,/source_locked===true/);
  assert.doesNotMatch(source,/bank_balance|management_balance|exchange_rate|fx_rate|reverse_fx/);
});

test('indicator is display-only: no drill-down, no local component calculation, no production hardcode', () => {
  const source=PAYMENTS_RECONCILIATION_DIFFERENCE_BROWSER_RUNTIME;
  assert.doesNotMatch(source,/openDrilldown|normalizeBreakdown|allowedCurrencies|allowedDirections|primary_breakdown|components/);
  assert.doesNotMatch(source,/KZT/);
  assert.doesNotMatch(source,/58902|4712762|2913\.488/);
  assert.match(source,/pointer-events:none/);
  assert.match(source,/observer\.observe\(page,\{childList:true,subtree:false\}\)/);
  assert.match(source,/tone:n<0\?'negative':'positive'/);
  assert.match(source,/data-tone="positive"/);
  assert.match(source,/data-tone="negative"/);
  assert.match(source,/@keyframes ronaReconTickerV6/);
  assert.match(source,/function cleanupSingleton\(frame\)/);
  assert.match(source,/document\.querySelectorAll\('\[id="'\+tickerId\+'"\],\.'\+tickerClass\)/);
  assert.match(source,/if\(valid\)\{keeper=node;continue\}/);
  assert.match(source,/node\.remove\(\)/);
  assert.match(source,/oldObserver&&typeof oldObserver\.disconnect==='function'/);
  assert.match(source,/window\.removeEventListener\('focus',oldFocus\)/);
  assert.match(source,/document\.removeEventListener\('visibilitychange',oldVisibility\)/);
  assert.match(source,/window\.removeEventListener\('rona:finance-sync',oldFinanceSync\)/);
  assert.doesNotMatch(source,/rona-payments-reconciliation-heading'\);/);
});

test('indicator overlay does not alter Payments KPI, cards, deal grid or renderer styles', () => {
  const source=PAYMENTS_RECONCILIATION_DIFFERENCE_BROWSER_RUNTIME;
  for(const forbidden of ['.rona-payments-v7-kpis','.rona-payments-v7-kpi','.rona-payments-v7-deal','rona-payments-v7-deal-grid','grid-template-columns:repeat(5']) {
    assert.equal(source.includes(forbidden),false,forbidden+' must remain owned by Payments V8');
  }
});

test('reconciliation ticker runtime enforces exactly one canonical ticker host', () => {
  const source=PAYMENTS_RECONCILIATION_DIFFERENCE_BROWSER_RUNTIME;
  assert.match(source,/const tickerClass='rona-payments-reconciliation-title-ticker'/);
  assert.match(source,/const all=Array\.from\(document\.querySelectorAll/);
  assert.match(source,/node\.parentElement===frame/);
  assert.match(source,/for\(const host of document\.querySelectorAll\('\.'\+hostClass\)\)/);
  assert.match(source,/if\(host!==frame\)host\.classList\.remove\(hostClass\)/);
  assert.match(source,/removeLegacyNodes\(\)/);
  assert.match(source,/#rona-payments-reconciliation-difference/);
});
