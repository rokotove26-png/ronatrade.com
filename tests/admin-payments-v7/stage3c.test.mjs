import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAdminPaymentsV7FromRawSources } from '../../supabase/functions/_shared/admin-payments-v7/index.mjs';

const ts = '2026-09-13T13:30:00Z';

function financeRow(id, dealKey, total, due, expected, future, currency, financeStatus = 'NOT_DUE', documentaryStatus = 'TO_VERIFY') {
  return {
    id, deal_key: dealKey,
    total_to_receive: String(total), due_now: String(due), expected_not_due: String(expected), future_conditional: String(future),
    obligation_currency: currency, contractual_payment_currency: currency, mixed_inbound_accounting_currency: null,
    finance_status: financeStatus, documentary_status: documentaryStatus,
    authority_state: 'AUTHORITATIVE', lifecycle_state: 'CURRENT', effective_at: ts,
    supersedes_id: null, supersedes_authority_refs: [], source_version: 'stage3c-preview', source_timestamp: ts,
    source_refs: ['STAGE3C_SOURCE_LOCK'], source_locked: true,
  };
}

function previewRaw() {
  const dealIds = ['DEAL-2026-004', 'DEAL-2026-005', 'DEAL-2026-006', 'DEAL-2026-009'];
  const keys = Object.fromEntries(dealIds.map((id) => [id, `key-${id}`]));
  const clientKeys = Object.fromEntries(dealIds.map((id) => [id, `client-${id}`]));
  const contractKeys = Object.fromEntries(dealIds.map((id) => [id, `contract-${id}`]));
  const deals = dealIds.map((deal_id) => ({
    id: keys[deal_id], deal_id, client_key: clientKeys[deal_id], contract_key: contractKeys[deal_id],
    business_status: 'EXECUTING', authority_state: 'CONFIRMED', lifecycle_state: 'ACTIVE',
  }));
  const workflows = dealIds.map((id) => ({ deal_key: keys[id], payment_handoff_state: 'READY', cancellation_state: 'ACTIVE' }));
  const clients = dealIds.map((id) => ({ id: clientKeys[id], client_id: `CLIENT-${id}`, legal_name: `Client ${id}` }));
  const contracts = dealIds.map((id) => ({ id: contractKeys[id], contract_id: `CONTRACT-${id}` }));

  const payments = [
    { id: 'pay-001', payment_id: 'PAYEV-2026-000001', payment_at: ts, payment_direction: 'INCOMING', payment_kind: 'CLIENT_PAYMENT', amount: '236250', currency: 'USD', bank_fact_status: 'BANK_CONFIRMED', finance_verification_status: 'VERIFIED', deal_allocation_applicability: 'DEAL_ALLOCATABLE', allocation_review_status: 'VERIFIED', candidate_deal_ids: ['DEAL-2026-004'], authority_state: 'CONFIRMED', lifecycle_state: 'ACTIVE' },
    { id: 'pay-002', payment_id: 'PAYEV-2026-000002', payment_at: ts, payment_direction: 'INCOMING', payment_kind: 'CLIENT_PAYMENT', amount: '201750', currency: 'USD', bank_fact_status: 'BANK_CONFIRMED', finance_verification_status: 'VERIFIED', deal_allocation_applicability: 'DEAL_ALLOCATABLE', allocation_review_status: 'VERIFIED', candidate_deal_ids: ['DEAL-2026-005'], authority_state: 'CONFIRMED', lifecycle_state: 'ACTIVE' },
    { id: 'pay-003', payment_id: 'PAYEV-2026-000003', payment_at: ts, payment_direction: 'INCOMING', payment_kind: 'CLIENT_PAYMENT', amount: '49320', currency: 'USD', bank_fact_status: 'BANK_CONFIRMED', finance_verification_status: 'VERIFIED', deal_allocation_applicability: 'DEAL_ALLOCATABLE', allocation_review_status: 'VERIFIED', candidate_deal_ids: ['DEAL-2026-006'], authority_state: 'CONFIRMED', lifecycle_state: 'ACTIVE' },
    { id: 'pay-out-004', payment_id: 'OUT-QA-004-RUB', payment_at: ts, payment_direction: 'OUTGOING', payment_kind: 'COUNTERPARTY_PAYMENT', amount: '1000', currency: 'RUB', bank_fact_status: 'BANK_CONFIRMED', finance_verification_status: 'VERIFIED', deal_allocation_applicability: 'DEAL_ALLOCATABLE', allocation_review_status: 'VERIFIED', candidate_deal_ids: ['DEAL-2026-004'], authority_state: 'CONFIRMED', lifecycle_state: 'ACTIVE' },
    { id: 'pay-shared-005006', payment_id: 'OUT-2026-005006-KUZMASH', payment_at: ts, payment_direction: 'OUTGOING', payment_kind: 'COUNTERPARTY_PAYMENT', amount: '16536960', currency: 'RUB', bank_fact_status: 'BANK_CONFIRMED', finance_verification_status: 'VERIFIED', deal_allocation_applicability: 'DEAL_ALLOCATABLE', allocation_review_status: 'TO_VERIFY', candidate_deal_ids: ['DEAL-2026-005','DEAL-2026-006'], authority_state: 'CONFIRMED', lifecycle_state: 'ACTIVE' },
  ];

  const paymentAllocations = [
    { id: 'alloc-001', payment_key: 'pay-001', deal_key: keys['DEAL-2026-004'], allocated_amount: '236250', allocation_status: 'VERIFIED', finance_status: 'PAID', authority_state: 'CONFIRMED', lifecycle_state: 'ACTIVE', source_timestamp: ts },
    { id: 'alloc-002', payment_key: 'pay-002', deal_key: keys['DEAL-2026-005'], allocated_amount: '201750', allocation_status: 'VERIFIED', finance_status: 'PAID', authority_state: 'CONFIRMED', lifecycle_state: 'ACTIVE', source_timestamp: ts },
    { id: 'alloc-003', payment_key: 'pay-003', deal_key: keys['DEAL-2026-006'], allocated_amount: '49320', allocation_status: 'VERIFIED', finance_status: 'PAID', authority_state: 'CONFIRMED', lifecycle_state: 'ACTIVE', source_timestamp: ts },
  ];

  const ownerOutgoingPaymentFacts = [
    { fact_id: 'OUT-QA-004-RUB', payment_at: ts, amount: '1000', currency: 'RUB', deal_ids: ['DEAL-2026-004'], deal_allocation_status: 'CONFIRMED', flow_kind: 'COUNTERPARTY_PAYMENT', bank_fact_status: 'BANK_CONFIRMED', authority_state: 'CONFIRMED', lifecycle_state: 'ACTIVE', source_timestamp: ts },
    { fact_id: 'OUT-2026-005006-KUZMASH', payment_at: ts, amount: '16536960', currency: 'RUB', deal_ids: ['DEAL-2026-005','DEAL-2026-006'], deal_allocation_status: 'TO_VERIFY', flow_kind: 'COUNTERPARTY_PAYMENT', bank_fact_status: 'BANK_CONFIRMED', authority_state: 'CONFIRMED', lifecycle_state: 'ACTIVE', source_timestamp: ts },
  ];

  const dealFinanceAuthorities = [
    financeRow('fin-004', keys['DEAL-2026-004'], '236250', '0', '0', '0', 'USD', 'PAID'),
    financeRow('fin-005', keys['DEAL-2026-005'], '672500', '0', '470750', '0', 'USD'),
    financeRow('fin-006', keys['DEAL-2026-006'], '164400', '0', '115080', '0', 'USD'),
    financeRow('fin-009', keys['DEAL-2026-009'], '31002300', '0', '9300690', '21701610', 'RUB'),
  ];

  return {
    generatedAt: ts, sourceAsOf: ts,
    capabilities: { paymentBusinessAuthority: false, financeAuthority: true, resourceChain: false },
    providerPresence: { paymentBusinessAttributions: false, paymentBusinessAttributionLines: false, financeAuthority: true, resourceChain: false },
    deals, workflows, clients, contracts, payments, paymentAllocations, paymentAllocationHistory: [], ownerOutgoingPaymentFacts,
    paymentBusinessAttributions: [], paymentBusinessAttributionLines: [], dealFinanceAuthorities, resourceChains: [],
  };
}

test('AJ — FINANCE AUTHORITY INTEGRITY FAIL-CLOSED', () => {
  const raw = previewRaw();
  const row = raw.dealFinanceAuthorities.find((item) => item.id === 'fin-005');
  row.due_now = '400000';
  row.expected_not_due = '400000';
  const projection = buildAdminPaymentsV7FromRawSources(raw);
  const deal = projection.deals.find((item) => item.deal_id === 'DEAL-2026-005');
  assert.equal(deal.total_to_receive.status, 'TO_VERIFY');
  assert.equal(deal.total_to_receive.reason, 'FINANCE_AUTHORITY_INTEGRITY_ERROR');
  assert.equal(deal.due_now.status, 'TO_VERIFY');
  assert.equal(deal.expected_not_due.status, 'TO_VERIFY');
  assert.equal(deal.financial_status, 'TO_VERIFY');
});

test('AK — SOURCE-LOCKED MATERIALIZATION PREVIEW computes current Finance/receipt semantics', () => {
  const projection = buildAdminPaymentsV7FromRawSources(previewRaw());
  const byId = new Map(projection.deals.map((deal) => [deal.deal_id, deal]));
  const d004 = byId.get('DEAL-2026-004');
  const d005 = byId.get('DEAL-2026-005');
  const d006 = byId.get('DEAL-2026-006');
  const d009 = byId.get('DEAL-2026-009');

  assert.deepEqual([d004.total_to_receive.amount, d004.verified_received.amount, d004.payment_progress.percent], ['236250','236250','100']);
  assert.deepEqual([d005.total_to_receive.amount, d005.verified_received.amount, d005.expected_not_due.amount, d005.payment_progress.percent], ['672500','201750','470750','30']);
  assert.deepEqual([d006.total_to_receive.amount, d006.verified_received.amount, d006.expected_not_due.amount, d006.payment_progress.percent], ['164400','49320','115080','30']);
  assert.deepEqual([d009.total_to_receive.amount, d009.verified_received.amount, d009.expected_not_due.amount, d009.future_conditional.amount, d009.payment_progress.percent], ['31002300','0','9300690','21701610','0']);
  assert.equal(d009.accounting_currency.currency, 'RUB');
  assert.equal(d009.documentary_status, 'TO_VERIFY');

  assert.equal(d004.actual_spend_status, 'TO_VERIFY');
  assert.equal(d005.actual_spend_status, 'TO_VERIFY');
  assert.equal(d006.actual_spend_status, 'TO_VERIFY');
  assert.equal(projection.owner_exception_queue.length, 0);
  assert.equal(projection.payment_exceptions.some((item) => item.payment_ids.includes('OUT-2026-005006-KUZMASH') && item.reconciliation_class === 'SHARED_DEAL_SCOPE_SPLIT_TO_VERIFY'), true);
});
