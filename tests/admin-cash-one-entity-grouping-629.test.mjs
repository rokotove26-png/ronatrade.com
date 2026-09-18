import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const ui=fs.readFileSync('functions/portal/cash-r2-ui.js','utf8');

test('resolved period rows group by canonical entity only, never entity+currency',()=>{
  assert.ok(ui.includes("key=party.resolved?'ENTITY:'+party.id:'SOURCE:'+sourceIdentityKey(x)"));
  assert.ok(ui.includes('currencySubtotalNode(xs,amountField)'));
  assert.doesNotMatch(ui,/party\.id\+'\|'\+txt\(x\.currency\)/);
});

test('multi-currency entity amounts remain separate subtotals',()=>{
  assert.ok(ui.includes("var sums=new Map(),counts=new Map()"));
  assert.ok(ui.includes("sums.set(currency"));
  assert.ok(ui.includes("money(sums.get(currency),currency)"));
  assert.ok(ui.includes("String(counts.get(currency))+' опер.'"));
  assert.ok(ui.includes("groupCounterparties(payments,'effective_external_payment_amount')"));
  assert.ok(ui.includes("paid=summaryMap(p,'effective_external_payment')"));
  assert.doesNotMatch(ui,/paid=summaryMap\(p,'external_payment'\)/);
});

test('TO_VERIFY rows never receive a synthetic canonical identity',()=>{
  assert.ok(ui.includes("resolved:!!id&&status!=='TO_VERIFY'"));
  assert.ok(ui.includes("function sourceIdentityKey(x)"));
  assert.doesNotMatch(ui,/NAME:'\+normParty/);
  assert.doesNotMatch(ui,/canonical_counterparty_id\s*=\s*['"]SOURCE:/);
});
