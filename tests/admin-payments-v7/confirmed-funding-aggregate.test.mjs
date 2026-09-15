import test from 'node:test';
import assert from 'node:assert/strict';
import { buildConfirmedFundingAggregate } from '../../supabase/functions/_shared/admin-payments-v7/confirmed-funding-aggregate.mjs';

function money(amount, currency, status = 'AUTHORITATIVE', reason = null) {
  return { amount, currency, status, reason, authority_refs: [] };
}

function deal(id, { received, spent, remaining, currency = 'USD' }) {
  return {
    deal_id: id,
    funding_currency: currency,
    verified_received: received,
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
