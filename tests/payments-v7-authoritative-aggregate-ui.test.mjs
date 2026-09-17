import assert from 'node:assert/strict';
import vm from 'node:vm';
import aggregateRuntime from '../functions/portal/main-ui/payments-v7-authoritative-aggregate-ui.js';

const sandbox = {
  console,
  renderPayments() {},
  paymentsV7Projection: () => null,
  paymentsV7Array: (value) => Array.isArray(value) ? value : [],
  paymentsV7Upper: (value) => value === null || value === undefined ? '' : String(value).trim().toUpperCase(),
  paymentsV7Num: (value) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  },
  queueMicrotask,
};
vm.createContext(sandbox);
vm.runInContext(`${aggregateRuntime}\nthis.__aggregateTest={paymentsV7ServerAggregateRows,paymentsV7ServerFundingRows};`, sandbox);
const ui = sandbox.__aggregateTest;
const plain = (value) => JSON.parse(JSON.stringify(value));

const zero = ui.paymentsV7ServerFundingRows({
  funding_aggregate: [{
    currency: 'USD', funding_spent: '0', funding_remaining: '75', status: 'AUTHORITATIVE', completeness_status: 'COMPLETE', unresolved_deal_ids: [],
  }],
}, 'funding_spent');
assert.deepEqual(plain(zero), { rows: [{ currency: 'USD', amount: 0 }], verify: false });

const nonzero = ui.paymentsV7ServerFundingRows({
  funding_aggregate: [{
    currency: 'USD', funding_spent: '25', funding_remaining: '15', status: 'AUTHORITATIVE', completeness_status: 'COMPLETE', unresolved_deal_ids: [],
  }],
}, 'funding_spent');
assert.deepEqual(plain(nonzero), { rows: [{ currency: 'USD', amount: 25 }], verify: false });

const unknown = ui.paymentsV7ServerFundingRows({
  funding_aggregate: [{
    currency: 'RUB', funding_spent: null, funding_remaining: null, status: 'TO_VERIFY', completeness_status: 'UNRESOLVED', unresolved_deal_ids: ['DEAL-FUTURE-UNKNOWN'],
  }],
}, 'funding_spent');
assert.deepEqual(plain(unknown), { rows: [], verify: true });

const partial = ui.paymentsV7ServerFundingRows({
  funding_aggregate: [{
    currency: 'USD', funding_spent: '80', funding_remaining: '45', status: 'AUTHORITATIVE', completeness_status: 'PARTIAL', unresolved_deal_ids: ['DEAL-FUTURE-UNKNOWN'],
  }],
}, 'funding_spent');
assert.deepEqual(plain(partial), { rows: [{ currency: 'USD', amount: 80 }], verify: true });

const total = ui.paymentsV7ServerAggregateRows({
  groups: [{ currency: 'USD', amount: '100', status: 'AUTHORITATIVE', completeness_status: 'COMPLETE' }],
  completeness_status: 'COMPLETE',
  unresolved_deal_ids: [],
});
assert.deepEqual(plain(total), { rows: [{ currency: 'USD', amount: 100 }], verify: false });

for (const forbidden of ['DEAL-2026-004','DEAL-2026-005','DEAL-2026-006','DEAL-2026-009','229862.96','439862.96']) {
  assert.equal(aggregateRuntime.includes(forbidden), false, `hardcoded production token: ${forbidden}`);
}
assert.equal(aggregateRuntime.includes('paymentsV7Aggregate('), false);
assert.equal(/\.every\s*\([^\n]*actual_spend_status/i.test(aggregateRuntime), false);
assert.match(aggregateRuntime,/expected=paymentsV7ServerAggregateRows\(currencyAggregates\?\.due_now\)/);
assert.match(aggregateRuntime,/conditional=paymentsV7ServerAggregateRows\(currencyAggregates\?\.future_conditional\)/);
assert.doesNotMatch(aggregateRuntime,/expected=paymentsV7MergeServerAggregateRows\(currencyAggregates\?\.due_now,currencyAggregates\?\.expected_not_due\)/);
assert.match(aggregateRuntime,/paymentsV7Kpi\('Ожидается сейчас'/);

console.log('SERVER_AGGREGATE_UI=PASS');
console.log('DUE_NOW_ONLY_AGGREGATE=PASS');
console.log('CONDITIONAL_SEPARATE_AGGREGATE=PASS');
console.log('FUTURE_ZERO_UI=PASS');
console.log('FUTURE_NONZERO_UI=PASS');
console.log('FUTURE_UNKNOWN_UI=PASS');
console.log('PARTIAL_CONFIRMED_SUM_VISIBLE=PASS');
console.log('NO_DEAL_ID_HARDCODE=PASS');
console.log('NO_BROWSER_FINANCIAL_CALCULATION=PASS');
