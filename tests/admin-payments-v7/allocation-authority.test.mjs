import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAdminPaymentsV7Projection, createAdminPaymentsV7SourceBundle } from '../../supabase/functions/rona-portal-api/admin-payments-v7/index.mjs';

function rawFixture() {
  return {
    generatedAt: '2026-09-13T00:00:00Z', sourceAsOf: '2026-09-13T00:00:00Z',
    deals: [
      { id: 'deal-a', deal_id: 'D-A', client_key: 'client-a', contract_key: 'ctr-a', business_status: 'EXECUTING', authority_state: 'CONFIRMED', lifecycle_state: 'ACTIVE' },
      { id: 'deal-b', deal_id: 'D-B', client_key: 'client-b', contract_key: 'ctr-b', business_status: 'EXECUTING', authority_state: 'CONFIRMED', lifecycle_state: 'ACTIVE' },
    ],
    workflows: [
      { deal_key: 'deal-a', payment_handoff_state: 'READY', cancellation_state: 'ACTIVE' },
      { deal_key: 'deal-b', payment_handoff_state: 'READY', cancellation_state: 'ACTIVE' },
    ],
    clients: [{ id: 'client-a', legal_name: 'A' }, { id: 'client-b', legal_name: 'B' }],
    contracts: [{ id: 'ctr-a', contract_id: 'C-A' }, { id: 'ctr-b', contract_id: 'C-B' }],
    payments: [{
      id: 'payment-y', payment_id: 'P-Y', payment_direction: 'INCOMING', payment_kind: 'CLIENT_PAYMENT',
      amount: '40.0000', currency: 'USD', bank_fact_status: 'BANK_CONFIRMED', finance_verification_status: 'VERIFIED',
      deal_allocation_applicability: 'DEAL_ALLOCATABLE', allocation_review_status: 'VERIFIED', candidate_deal_ids: ['D-A'],
      authority_state: 'CONFIRMED', lifecycle_state: 'ACTIVE',
    }],
    paymentAllocations: [{
      id: 'allocation-y', payment_key: 'payment-y', deal_key: 'deal-a', allocated_amount: '40.0',
      allocation_status: 'VERIFIED', authority_state: 'CONFIRMED', lifecycle_state: 'ACTIVE',
    }],
    paymentAllocationHistory: [], ownerOutgoingPaymentFacts: [],
    paymentBusinessAttributions: [], paymentBusinessAttributionLines: [],
    dealFinanceAuthorities: [
      { id: 'finance-a', deal_key: 'deal-a', total_to_receive: '100', due_now: '0', expected_not_due: '100', future_conditional: '0', obligation_currency: 'USD', contractual_payment_currency: 'USD', finance_status: 'OPEN', documentary_status: 'CONFIRMED', authority_state: 'AUTHORITATIVE', lifecycle_state: 'CURRENT', source_locked: true },
      { id: 'finance-b', deal_key: 'deal-b', total_to_receive: '100', due_now: '0', expected_not_due: '100', future_conditional: '0', obligation_currency: 'USD', contractual_payment_currency: 'USD', finance_status: 'OPEN', documentary_status: 'CONFIRMED', authority_state: 'AUTHORITATIVE', lifecycle_state: 'CURRENT', source_locked: true },
    ],
    resourceChains: [],
  };
}

test('Y — CURRENT VERIFIED ALLOCATION AS AUTHORITY, then typed Owner supersession wins', () => {
  const raw = rawFixture();
  let bundle = createAdminPaymentsV7SourceBundle(raw);
  assert.equal(bundle.attributionClaims.some((claim) => claim.authority_kind === 'PAYMENT_ALLOCATION'), true);

  let projection = buildAdminPaymentsV7Projection(bundle);
  const dealA = projection.deals.find((deal) => deal.deal_id === 'D-A');
  assert.equal(dealA.accounting_currency.currency, 'USD');
  assert.equal(dealA.accounting_currency.status, 'AUTHORITATIVE');
  assert.equal(dealA.verified_received.amount, '40');
  assert.equal(dealA.verified_received.status, 'AUTHORITATIVE');
  assert.equal(projection.reconciliation_summary.authority_conflict_count, 0);

  raw.paymentBusinessAttributions = [{
    id: 'owner-y', payment_key: 'payment-y', classification: 'RESOLVED', decision_type: 'BIND_TO_DEAL', authority_kind: 'OWNER',
    authority_state: 'AUTHORITATIVE', lifecycle_state: 'CURRENT', source_locked: true, effective_at: '2026-09-13T01:00:00Z',
    supersedes_authority_refs: [{ source_type: 'PAYMENT_ALLOCATION', source_id: 'allocation-y' }],
  }];
  raw.paymentBusinessAttributionLines = [{ attribution_id: 'owner-y', deal_key: 'deal-b', amount: '40.0000', currency: 'USD', amount_status: 'EXACT' }];

  bundle = createAdminPaymentsV7SourceBundle(raw);
  projection = buildAdminPaymentsV7Projection(bundle);
  assert.equal(projection.deals.find((deal) => deal.deal_id === 'D-A').verified_received.amount, '0');
  assert.equal(projection.deals.find((deal) => deal.deal_id === 'D-B').verified_received.amount, '40');
  assert.equal(projection.reconciliation_summary.authority_conflict_count, 0);
  const exception = projection.payment_exceptions.find((item) => item.payment_ids.includes('P-Y'));
  assert.equal(exception.reconciliation_class, 'RESOLVED');
  assert.equal(exception.technical_gap, 'STALE_SUPERSEDED_MATERIALIZATION');
});
