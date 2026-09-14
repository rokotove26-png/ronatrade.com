import test from 'node:test';
import assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';
import { buildAdminPaymentsV7FromRawSources } from '../../supabase/functions/_shared/admin-payments-v7/index.mjs';

const now = () => new Date().toISOString();
const uuid = () => randomUUID();

function visibility(readable = true) {
  const state = (name, ok = readable) => ({ relation: `portal_private.${name}`, present: true, select_granted: true, rls_enabled: true, rls_select_path: ok, readable: ok });
  return {
    db_role: 'rona_payments_v7_reader',
    relations: {
      deals: state('deals'), workflows: state('owner_deal_workflow'), clients: state('clients'), contracts: state('contracts'),
      payments: state('payments'), paymentAllocations: state('payment_allocations'), paymentAllocationHistory: state('payment_allocation_authority_history_v1'),
      ownerOutgoingPaymentFacts: state('owner_outgoing_payment_facts'), paymentBusinessAttributions: state('payment_business_attributions_v7'),
      paymentBusinessAttributionLines: state('payment_business_attribution_lines_v7'), providerReadiness: state('admin_payments_v7_provider_readiness'),
      financeAuthority: state('deal_finance_authority_v7'), resourceChain: state('payment_resource_chains_v7', false),
    },
    contourAuthority: true,
    bankReceiptAuthority: true,
    paymentBusinessAuthority: true,
    financeAuthority: true,
    resourceChain: false,
    ownerOutgoingPaymentFacts: true,
  };
}

function rawFixture(receivedAmount) {
  const dealKey = uuid();
  const hiddenDealKey = uuid();
  const clientKey = uuid();
  const contractKey = uuid();
  const paymentKey = uuid();
  const allocationKey = uuid();
  const hiddenClientKey = uuid();
  const hiddenContractKey = uuid();
  const total = receivedAmount * 3;
  const expected = total - receivedAmount;
  const sourceAsOf = now();
  return {
    generatedAt: sourceAsOf,
    sourceAsOf,
    sourceVisibility: visibility(),
    capabilities: {
      contourAuthority: true,
      bankReceiptAuthority: true,
      ownerOutgoingPaymentFacts: true,
      paymentBusinessAuthorityPresent: false,
      paymentBusinessAuthority: false,
      paymentBusinessAuthorityReady: false,
      financeAuthority: true,
      resourceChain: false,
    },
    deals: [
      { id: dealKey, deal_id: `QA-DEAL-${uuid().slice(0, 8)}`, client_key: clientKey, contract_key: contractKey, business_status: 'EXECUTING', authority_state: 'CONFIRMED', lifecycle_state: 'ACTIVE' },
      { id: hiddenDealKey, deal_id: `QA-DEAL-${uuid().slice(0, 8)}`, client_key: hiddenClientKey, contract_key: hiddenContractKey, business_status: 'EXECUTING', authority_state: 'CONFIRMED', lifecycle_state: 'ACTIVE' },
    ],
    workflows: [
      { deal_key: dealKey, payment_handoff_state: 'READY', cancellation_state: 'ACTIVE' },
      { deal_key: hiddenDealKey, payment_handoff_state: 'NOT_SENT', cancellation_state: 'ACTIVE' },
    ],
    clients: [
      { id: clientKey, client_id: `QA-CLIENT-${uuid().slice(0, 6)}`, legal_name: `QA Client ${uuid().slice(0, 6)}`, authority_state: 'CONFIRMED', lifecycle_state: 'ACTIVE' },
      { id: hiddenClientKey, client_id: `QA-CLIENT-${uuid().slice(0, 6)}`, legal_name: `QA Client ${uuid().slice(0, 6)}`, authority_state: 'CONFIRMED', lifecycle_state: 'ACTIVE' },
    ],
    contracts: [
      { id: contractKey, contract_id: `QA-CONTRACT-${uuid().slice(0, 6)}`, client_key: clientKey, authority_state: 'CONFIRMED', lifecycle_state: 'ACTIVE' },
      { id: hiddenContractKey, contract_id: `QA-CONTRACT-${uuid().slice(0, 6)}`, client_key: hiddenClientKey, authority_state: 'CONFIRMED', lifecycle_state: 'ACTIVE' },
    ],
    payments: [{
      id: paymentKey, payment_id: `QA-PAY-${uuid().slice(0, 8)}`, payment_at: sourceAsOf,
      amount: String(receivedAmount), currency: 'USD', payment_direction: 'INCOMING', payment_kind: 'CLIENT_PAYMENT',
      bank_fact_status: 'BANK_CONFIRMED', finance_verification_status: 'VERIFIED', deal_allocation_applicability: 'DEAL_ALLOCATABLE',
      allocation_review_status: 'VERIFIED', candidate_deal_ids: [], authority_state: 'CONFIRMED', lifecycle_state: 'ACTIVE',
    }],
    paymentAllocations: [{
      id: allocationKey, payment_key: paymentKey, deal_key: dealKey, allocated_amount: String(receivedAmount), allocation_status: 'VERIFIED',
      finance_status: 'PAID', authority_state: 'CONFIRMED', lifecycle_state: 'ACTIVE', source_version: `QA-${uuid().slice(0, 6)}`, source_timestamp: sourceAsOf,
    }],
    paymentAllocationHistory: [],
    ownerOutgoingPaymentFacts: [],
    paymentBusinessAttributions: [],
    paymentBusinessAttributionLines: [],
    dealFinanceAuthorities: [{
      id: uuid(), deal_key: dealKey, total_to_receive: String(total), due_now: '0', expected_not_due: String(expected), future_conditional: '0',
      obligation_currency: 'USD', contractual_payment_currency: 'USD', mixed_inbound_accounting_currency: null,
      finance_status: 'NOT_DUE', documentary_status: 'CONFIRMED', authority_state: 'AUTHORITATIVE', lifecycle_state: 'CURRENT',
      effective_at: sourceAsOf, source_version: `QA-${uuid().slice(0, 6)}`, source_timestamp: sourceAsOf, source_refs: [], source_locked: true,
    }],
    resourceChains: [],
  };
}

function setBankVisibility(raw, ready) {
  const next = structuredClone(raw);
  next.capabilities.bankReceiptAuthority = ready;
  next.sourceVisibility.bankReceiptAuthority = ready;
  for (const key of ['payments', 'paymentAllocations', 'paymentAllocationHistory']) {
    next.sourceVisibility.relations[key].rls_select_path = ready;
    next.sourceVisibility.relations[key].readable = ready;
  }
  return next;
}

test('source visibility loss fails closed to TO_VERIFY and never synthesizes zero received', () => {
  const raw = rawFixture(randomInt(101, 999));
  const projection = buildAdminPaymentsV7FromRawSources(setBankVisibility(raw, false));
  assert.equal(projection.deals.length, 1);
  const deal = projection.deals[0];
  assert.equal(deal.verified_received.status, 'TO_VERIFY');
  assert.equal(deal.verified_received.amount, null);
  assert.equal(deal.verified_received.reason, 'BANK_RECEIPT_SOURCE_NOT_VISIBLE');
  assert.equal(deal.payment_progress.status, 'TO_VERIFY');
  assert.equal(deal.financial_status, 'TO_VERIFY');
  assert.equal(projection.owner_exception_queue.length, 0);
});

test('expected amount comes only from current finance authority; hidden finance source is TO_VERIFY', () => {
  const raw = rawFixture(randomInt(101, 999));
  raw.capabilities.financeAuthority = false;
  raw.sourceVisibility.financeAuthority = false;
  raw.sourceVisibility.relations.financeAuthority.rls_select_path = false;
  raw.sourceVisibility.relations.financeAuthority.readable = false;
  const projection = buildAdminPaymentsV7FromRawSources(raw);
  const deal = projection.deals[0];
  assert.equal(deal.expected_not_due.status, 'TO_VERIFY');
  assert.equal(deal.total_to_receive.status, 'TO_VERIFY');
});

test('payments contour is data-driven by current READY/SENT workflow and has no NOT_SENT fallback', () => {
  const raw = rawFixture(randomInt(101, 999));
  const projection = buildAdminPaymentsV7FromRawSources(raw);
  assert.equal(projection.deals.length, 1);
  assert.equal(projection.deals[0].payment_handoff_state, 'READY');
  assert.notEqual(projection.deals[0].deal_key, raw.deals[1].id);
});

test('authoritative source change updates projection without application-code change', () => {
  const firstAmount = randomInt(101, 499);
  const secondAmount = firstAmount + randomInt(7, 53);
  const firstRaw = rawFixture(firstAmount);
  const firstProjection = buildAdminPaymentsV7FromRawSources(firstRaw);

  const secondRaw = structuredClone(firstRaw);
  secondRaw.payments[0].amount = String(secondAmount);
  secondRaw.paymentAllocations[0].allocated_amount = String(secondAmount);
  const total = Number(secondRaw.dealFinanceAuthorities[0].total_to_receive);
  secondRaw.dealFinanceAuthorities[0].expected_not_due = String(total - secondAmount);
  secondRaw.dealFinanceAuthorities[0].source_version = `QA-SOURCE-CHANGED-${uuid().slice(0, 6)}`;
  secondRaw.sourceAsOf = now();
  secondRaw.generatedAt = secondRaw.sourceAsOf;

  const secondProjection = buildAdminPaymentsV7FromRawSources(secondRaw);
  assert.equal(Number(firstProjection.deals[0].verified_received.amount), firstAmount);
  assert.equal(Number(secondProjection.deals[0].verified_received.amount), secondAmount);
  assert.equal(Number(secondProjection.deals[0].expected_not_due.amount), total - secondAmount);
  assert.notEqual(firstProjection.deals[0].verified_received.amount, secondProjection.deals[0].verified_received.amount);
  assert.notEqual(firstProjection.deals[0].expected_not_due.amount, secondProjection.deals[0].expected_not_due.amount);
});

test('spend and remaining execution stay TO_VERIFY without authoritative resource chain', () => {
  const raw = rawFixture(randomInt(101, 999));
  const projection = buildAdminPaymentsV7FromRawSources(raw);
  const deal = projection.deals[0];
  assert.equal(deal.actual_spend_status, 'TO_VERIFY');
  assert.equal(deal.actual_spend.amount, null);
  assert.equal(deal.remaining_execution.amount, null);
});
