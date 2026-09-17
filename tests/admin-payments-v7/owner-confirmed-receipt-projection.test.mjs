import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyOwnerConfirmedReceiptsV7,
  OWNER_CONFIRMED_RECEIPT_PROVENANCE_CONTRACT,
  OWNER_CONFIRMED_RECEIPT_RESOLVER_VERSION,
} from '../../supabase/functions/rona-owner-ai-sync/owner-confirmed-receipt-projection.mjs';

function money(amount, currency = 'RUB') {
  return { amount: String(amount), currency, status: 'AUTHORITATIVE', reason: null, authority_refs: [] };
}

function baseProjection() {
  return {
    contract: 'ADMIN_PAYMENTS_V7',
    generated_at: '2026-09-16T21:40:00Z',
    source_as_of: '2026-09-16T21:40:00Z',
    deals: [{
      deal_key: '6a2af55b-a945-43c0-8078-7385970c8dc3',
      deal_id: 'DEAL-2026-009',
      client_display: 'ГазОнэ',
      accounting_currency: { currency: 'RUB', status: 'AUTHORITATIVE', reason: null, authority_refs: [] },
      total_to_receive: money('31002300'),
      verified_received: money('0'),
      remaining_to_receive: money('31002300'),
      due_now: money('0'),
      expected_not_due: money('0'),
      future_conditional: money('21701610'),
      actual_spend: money('0'),
      actual_spend_status: 'AUTHORITATIVE',
      remaining_execution: money('10000000'),
      payment_progress: { ratio: '0', percent: '0', status: 'AUTHORITATIVE', reason: null },
      payment_passport: {
        funding_received: money('0'),
        funding_spent: money('0'),
        funding_remaining: money('10000000'),
      },
      financial_status: 'CONDITIONAL',
      authority_refs: [],
    }],
    payment_passports: [],
    owner_exception_queue: [],
    payment_exceptions: [],
    materialization_gaps: [],
  };
}

const receipt = {
  payment_key: '811a5c78-4b66-4f02-9aed-7ad93d9e6944',
  payment_id: 'PAYEV-2026-000011',
  amount: '10000000',
  currency: 'RUB',
  source_version: 'OWNER_CONFIRMED_RECEIPT_V1',
  source_timestamp: '2026-09-16T17:10:03.810Z',
  deal_key: '6a2af55b-a945-43c0-8078-7385970c8dc3',
  deal_id: 'DEAL-2026-009',
  finance_event_id: '0a8c7b7b-ea1b-43a2-bc5d-ddb1498c2734',
  event_source_version: 'OWNER_CONFIRMED_RECEIPT_V1',
  event_source_timestamp: '2026-09-16T17:10:03.810Z',
  bank_fact_status: 'RECEIVED_UNVERIFIED',
};

test('owner-confirmed receipt is projected as received without changing bank evidence', () => {
  const input = baseProjection();
  const output = applyOwnerConfirmedReceiptsV7(input, [receipt]);
  const deal = output.deals[0];

  assert.equal(deal.verified_received.amount, '10000000');
  assert.equal(deal.verified_received.currency, 'RUB');
  assert.equal(deal.remaining_to_receive.amount, '21002300');
  assert.equal(deal.actual_spend.amount, '0');
  assert.equal(deal.remaining_execution.amount, '10000000');
  assert.equal(deal.owner_confirmed_receipt_authority.status, 'AUTHORITATIVE');
  assert.equal(output.owner_confirmed_receipt_projection.status, 'AUTHORITATIVE');
  assert.equal(output.owner_confirmed_receipt_projection.receipt_count, 1);
  assert.equal(receipt.bank_fact_status, 'RECEIVED_UNVERIFIED');

  const receiptRef = deal.verified_received.authority_refs.find((ref) => ref.source_type === 'OWNER_CONFIRMED_RECEIPT');
  assert.equal(receiptRef?.source_id, 'PAYEV-2026-000011');
  assert.equal(output.funding_aggregate[0].funding_received, '10000000');
  assert.equal(output.funding_aggregate[0].funding_spent, '0');
  assert.equal(output.funding_aggregate[0].funding_remaining, '10000000');
});

test('atomic canonical writer provenance is projected through the same receipt contract', () => {
  const atomic = {
    ...receipt,
    payment_key: 'qa-payment-key-atomic',
    payment_id: 'QA-PAYMENT-ATOMIC',
    amount: '1250000',
    source_version: 'ATOMIC_PAYMENTS_V7_CANONICAL_STATE_V1',
    allocation_id: 'qa-allocation-atomic',
    allocation_source_version: 'ATOMIC_PAYMENTS_V7_CANONICAL_STATE_V1',
    attribution_id: 'qa-attribution-atomic',
    attribution_source_version: 'ATOMIC_PAYMENTS_V7_CANONICAL_STATE_V1',
    finance_event_id: 'qa-finance-event-atomic',
    event_source_version: 'ATOMIC_PAYMENTS_V7_CANONICAL_STATE_V1',
  };
  const output = applyOwnerConfirmedReceiptsV7(baseProjection(), [atomic]);
  const deal = output.deals[0];

  assert.equal(deal.verified_received.amount, '1250000');
  assert.equal(deal.owner_confirmed_receipt_authority.status, 'AUTHORITATIVE');
  assert.equal(deal.owner_confirmed_receipt_authority.resolver_version, OWNER_CONFIRMED_RECEIPT_RESOLVER_VERSION);
  assert.equal(deal.owner_confirmed_receipt_authority.provenance_contract, OWNER_CONFIRMED_RECEIPT_PROVENANCE_CONTRACT);
  assert.equal(output.owner_confirmed_receipt_projection.status, 'AUTHORITATIVE');
  assert.equal(output.owner_confirmed_receipt_projection.resolver_version, OWNER_CONFIRMED_RECEIPT_RESOLVER_VERSION);
  assert.equal(output.owner_confirmed_receipt_projection.provenance_contract, OWNER_CONFIRMED_RECEIPT_PROVENANCE_CONTRACT);

  const refs = new Map(deal.verified_received.authority_refs.map((ref) => [ref.source_type, ref]));
  assert.equal(refs.get('OWNER_CONFIRMED_RECEIPT')?.source_version, 'ATOMIC_PAYMENTS_V7_CANONICAL_STATE_V1');
  assert.equal(refs.get('PAYMENT_ALLOCATION')?.source_id, 'qa-allocation-atomic');
  assert.equal(refs.get('PAYMENT_BUSINESS_ATTRIBUTION')?.source_id, 'qa-attribution-atomic');
  assert.equal(refs.get('FINANCE_EVENT')?.source_id, 'qa-finance-event-atomic');
});

test('receipt with a different currency fails closed and is not added to the deal', () => {
  const output = applyOwnerConfirmedReceiptsV7(baseProjection(), [{ ...receipt, currency: 'USD' }]);
  assert.equal(output.deals[0].verified_received.amount, '0');
  assert.equal(output.owner_confirmed_receipt_projection.status, 'PARTIAL_TO_VERIFY');
  assert.deepEqual(output.owner_confirmed_receipt_projection.unmatched_deal_keys, ['6a2af55b-a945-43c0-8078-7385970c8dc3']);
});
