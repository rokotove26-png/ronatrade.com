import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAuthoritativeMoneyAggregate,
  buildConfirmedFundingAggregate,
  buildPaymentsCurrencyAggregates,
} from '../../supabase/functions/_shared/admin-payments-v7/confirmed-funding-aggregate.mjs';

function money(amount, currency, status = 'AUTHORITATIVE', reason = null) {
  return { amount, currency, status, reason, authority_refs: [] };
}

function deal(id, { received, spent, remaining, currency = 'USD', total = '100', expected = '0', conditional = '0' }) {
  return {
    deal_id: id,
    funding_currency: currency,
    accounting_currency: { currency, status: 'AUTHORITATIVE' },
    total_to_receive: money(total, currency),
    verified_received: received,
    expected_not_due: money(expected, currency),
    future_conditional: money(conditional, currency),
    actual_spend: spent,
    remaining_execution: remaining,
  };
}

test('confirmed subtotal remains visible when another same-currency Deal is unresolved', () => {
  const result = buildConfirmedFundingAggregate([
    deal('DEAL-FUTURE-CONFIRMED', {
      received: money('125', 'USD'),
      spent: money('80', 'USD'),
      remaining: money('45', 'USD'),
    }),
    deal('DEAL-FUTURE-UNRESOLVED', {
      received: money('50', 'USD'),
      spent: money(null, 'USD', 'TO_VERIFY', 'SOURCE_UNRESOLVED'),
      remaining: money(null, 'USD', 'TO_VERIFY', 'SOURCE_UNRESOLVED'),
    }),
  ]);

  assert.deepEqual(result, [{
    currency: 'USD',
    deal_ids: ['DEAL-FUTURE-CONFIRMED', 'DEAL-FUTURE-UNRESOLVED'],
    confirmed_deal_ids: ['DEAL-FUTURE-CONFIRMED'],
    unresolved_deal_ids: ['DEAL-FUTURE-UNRESOLVED'],
    confirmed_deal_count: 1,
    unresolved_deal_count: 1,
    funding_received: '125',
    funding_spent: '80',
    funding_remaining: '45',
    status: 'AUTHORITATIVE',
    completeness_status: 'PARTIAL',
    reason: 'PARTIAL_CONFIRMED_AGGREGATE',
    unresolved_reasons: ['SOURCE_UNRESOLVED'],
  }]);
});

test('an explicit authoritative zero is preserved as zero and is not treated as missing', () => {
  const result = buildConfirmedFundingAggregate([
    deal('DEAL-FUTURE-ZERO', {
      received: money('75', 'USD'),
      spent: money('0', 'USD'),
      remaining: money('75', 'USD'),
    }),
  ]);

  assert.equal(result[0].funding_spent, '0');
  assert.equal(result[0].funding_remaining, '75');
  assert.equal(result[0].status, 'AUTHORITATIVE');
  assert.equal(result[0].completeness_status, 'COMPLETE');
});

test('a genuinely unresolved source remains TO_VERIFY and never becomes authoritative zero', () => {
  const result = buildConfirmedFundingAggregate([
    deal('DEAL-FUTURE-UNKNOWN', {
      received: money('0', 'RUB'),
      spent: money(null, 'RUB', 'TO_VERIFY', 'SOURCE_UNRESOLVED'),
      remaining: money(null, 'RUB', 'TO_VERIFY', 'SOURCE_UNRESOLVED'),
      currency: 'RUB',
    }),
  ]);

  assert.equal(result[0].funding_spent, null);
  assert.equal(result[0].funding_remaining, null);
  assert.equal(result[0].status, 'TO_VERIFY');
  assert.equal(result[0].completeness_status, 'UNRESOLVED');
  assert.deepEqual(result[0].unresolved_deal_ids, ['DEAL-FUTURE-UNKNOWN']);
});

test('server currency aggregate groups authoritative values by currency without cross-currency sums', () => {
  const deals = [
    deal('DEAL-FUTURE-USD', {
      received: money('30', 'USD'),
      spent: money('10', 'USD'),
      remaining: money('20', 'USD'),
      total: '90',
      expected: '60',
    }),
    deal('DEAL-FUTURE-RUB', {
      received: money('3000', 'RUB'),
      spent: money('1000', 'RUB'),
      remaining: money('2000', 'RUB'),
      currency: 'RUB',
      total: '9000',
      expected: '6000',
    }),
  ];
  const aggregates = buildPaymentsCurrencyAggregates(deals);
  assert.deepEqual(aggregates.total_to_receive.groups.map(({ currency, amount }) => ({ currency, amount })), [
    { currency: 'USD', amount: '90' },
    { currency: 'RUB', amount: '9000' },
  ]);
  assert.deepEqual(aggregates.expected_not_due.groups.map(({ currency, amount }) => ({ currency, amount })), [
    { currency: 'USD', amount: '60' },
    { currency: 'RUB', amount: '6000' },
  ]);
});

test('server currency aggregate excludes unresolved values and marks incomplete coverage', () => {
  const result = buildAuthoritativeMoneyAggregate([
    deal('DEAL-FUTURE-KNOWN', {
      received: money('40', 'USD'),
      spent: money('10', 'USD'),
      remaining: money('30', 'USD'),
    }),
    {
      deal_id: 'DEAL-FUTURE-UNKNOWN',
      funding_currency: 'USD',
      accounting_currency: { currency: 'USD', status: 'AUTHORITATIVE' },
      verified_received: money(null, 'USD', 'TO_VERIFY', 'SOURCE_UNRESOLVED'),
    },
  ], 'verified_received');

  assert.equal(result.groups[0].amount, '40');
  assert.equal(result.groups[0].status, 'AUTHORITATIVE');
  assert.equal(result.groups[0].completeness_status, 'PARTIAL');
  assert.deepEqual(result.unresolved_deal_ids, ['DEAL-FUTURE-UNKNOWN']);
});
