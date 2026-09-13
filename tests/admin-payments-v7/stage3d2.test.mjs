import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAdminPaymentsV7Projection } from '../../supabase/functions/_shared/admin-payments-v7/projection.mjs';
import { reconcileAllPayments } from '../../supabase/functions/_shared/admin-payments-v7/reconciliation.mjs';

const C1 = 'DEAL-2099-CANDIDATE-1';
const C2 = 'DEAL-2099-CANDIDATE-2';
const K1 = 'scope-deal-key-1';
const K2 = 'scope-deal-key-2';

function unresolvedPayment(candidates = []) {
  return {
    payment_key: 'future-candidate-payment',
    payment_id: 'PAYEV-2099-CANDIDATE',
    payment_at: '2099-01-01T00:00:00Z',
    direction: 'OUTGOING',
    kind: 'COUNTERPARTY_PAYMENT',
    amount: '7000',
    currency: 'RUB',
    bank_fact_status: 'BANK_CONFIRMED',
    finance_verification_status: 'VERIFIED',
    allocation_applicability: 'DEAL_ALLOCATABLE',
    allocation_review_status: 'TO_VERIFY',
    candidate_deal_ids: candidates,
    current: true,
    source_locked: true,
    authority_state: 'AUTHORITATIVE',
    lifecycle_state: 'CURRENT',
    authority_refs: [],
  };
}

function source(candidates = [], claims = []) {
  return {
    generatedAt: '2099-01-01T00:00:00Z',
    sourceAsOf: '2099-01-01T00:00:00Z',
    capabilities: {
      paymentBusinessAuthority: true,
      paymentBusinessAuthorityPresent: true,
      paymentBusinessAuthorityReady: true,
      financeAuthority: false,
      resourceChain: false,
    },
    contour: [],
    validDealKeys: [K1, K2],
    payments: [unresolvedPayment(candidates)],
    attributionClaims: claims,
    physicalAllocations: [],
    financeAuthorities: [],
    resourceChains: [],
  };
}

function reconciliation(s) {
  return reconcileAllPayments(s.payments, s.attributionClaims, s.physicalAllocations, s.capabilities, s.validDealKeys)[0];
}

function authoritativeScopeClaim() {
  return {
    id: 'future-authoritative-scope',
    payment_key: 'future-candidate-payment',
    classification: 'SHARED_DEAL_SCOPE_SPLIT_TO_VERIFY',
    disposition: null,
    lines: [],
    scope_deal_keys: [K1, K2],
    business_scope_refs: ['OWNER_OUTGOING_PAYMENT_FACT:FUTURE-SCOPE'],
    current: true,
    source_locked: true,
    authority_state: 'AUTHORITATIVE',
    lifecycle_state: 'CURRENT',
    authority_kind: 'OWNER_OUTGOING_PAYMENT_FACT',
    authority_refs: [],
  };
}

test('BA — CANDIDATE HINT DOES NOT SUPPRESS OWNER QUEUE', () => {
  const s = source([C1]);
  const r = reconciliation(s);
  assert.equal(r.reconciliation_class, 'GENUINELY_UNALLOCATED');
  assert.equal(r.owner_action_required, true);
  assert.deepEqual(r.candidate_deal_ids, [C1]);
  assert.deepEqual(r.scope_deal_keys, []);
  assert.equal(buildAdminPaymentsV7Projection(s).owner_exception_queue.length, 1);
});

test('BB — MULTIPLE CANDIDATE HINTS DO NOT BECOME SHARED SCOPE', () => {
  const s = source([C1, C2]);
  const r = reconciliation(s);
  assert.equal(r.reconciliation_class, 'GENUINELY_UNALLOCATED');
  assert.notEqual(r.reconciliation_class, 'SHARED_DEAL_SCOPE_SPLIT_TO_VERIFY');
  assert.deepEqual(r.candidate_deal_ids, [C1, C2]);
  assert.deepEqual(r.scope_deal_keys, []);
});

test('BC — CANDIDATES ARE EXPOSED AS HINTS', () => {
  const q = buildAdminPaymentsV7Projection(source([C1, C2])).owner_exception_queue;
  assert.equal(q.length, 1);
  assert.deepEqual(q[0].candidate_deal_ids, [C1, C2]);
  assert.deepEqual(q[0].scope_deal_keys, []);
  assert.deepEqual(q[0].known_scope_refs, []);
});

test('BD — AUTHORITATIVE SCOPE REMOVES QUEUE', () => {
  const s = source([C1, C2], [authoritativeScopeClaim()]);
  const projection = buildAdminPaymentsV7Projection(s);
  assert.equal(projection.owner_exception_queue.length, 0);
  const ex = projection.payment_exceptions.find((item) => item.payment_ids.includes('PAYEV-2099-CANDIDATE'));
  assert.equal(ex.reconciliation_class, 'SHARED_DEAL_SCOPE_SPLIT_TO_VERIFY');
  assert.deepEqual(ex.candidate_deal_ids, [C1, C2]);
  assert.deepEqual(ex.scope_deal_keys, [K1, K2]);
  assert.deepEqual(ex.known_scope_refs, ['OWNER_OUTGOING_PAYMENT_FACT:FUTURE-SCOPE']);
});
