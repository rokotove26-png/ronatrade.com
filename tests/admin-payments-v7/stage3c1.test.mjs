import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAdminPaymentsV7Projection,
  buildOwnerPaymentDecision,
  createOwnerDecisionPersistenceEnvelope,
  persistOwnerPaymentDecisionV7,
} from '../../supabase/functions/_shared/admin-payments-v7/index.mjs';

const TS = '2026-09-13T14:30:00Z';
const PAYMENT_KEY = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const DEAL_A = '11111111-1111-4111-8111-111111111111';
const DEAL_B = '22222222-2222-4222-8222-222222222222';
const AUTHORITY_ID = '33333333-3333-4333-8333-333333333333';
const AUDIT_ID = '44444444-4444-4444-8444-444444444444';

function idFactory() {
  const ids = [AUTHORITY_ID, AUDIT_ID];
  return () => ids.shift();
}
function ownerActor() { return { id: '55555555-5555-4555-8555-555555555555', role: 'OWNER', actor_type: 'HUMAN' }; }
function payment(amount = '100') {
  return {
    payment_key: PAYMENT_KEY,
    payment_id: 'PAY-QA-SEALED',
    payment_at: TS,
    direction: 'OUTGOING',
    kind: 'COUNTERPARTY_PAYMENT',
    amount,
    currency: 'USD',
    bank_fact_status: 'BANK_CONFIRMED',
    finance_verification_status: 'VERIFIED',
    allocation_applicability: 'DEAL_ALLOCATABLE',
    current: true,
    source_locked: true,
    authority_state: 'AUTHORITATIVE',
    lifecycle_state: 'CURRENT',
    authority_refs: [],
  };
}
function contour() {
  return [
    { deal_key: DEAL_A, deal_id: 'DEAL-QA-A', payment_handoff_state: 'READY', current: true, authority_state: 'AUTHORITATIVE', lifecycle_state: 'CURRENT' },
    { deal_key: DEAL_B, deal_id: 'DEAL-QA-B', payment_handoff_state: 'SENT', current: true, authority_state: 'AUTHORITATIVE', lifecycle_state: 'CURRENT' },
  ];
}
function actionable(paymentKey = PAYMENT_KEY) {
  return {
    payment_key: paymentKey,
    payment_id: 'PAY-QA-SEALED',
    reconciliation_class: 'GENUINELY_UNALLOCATED',
    status: 'AUTHORITATIVE',
    owner_action_required: true,
    allowed_owner_actions: ['BIND_TO_DEAL', 'ASSIGN_ADVANCE_PAYMENT'],
    current_authority_id: null,
  };
}

function ref(id) {
  return { source_type: 'QA', source_id: id, source_version: '1', source_timestamp: TS, authority_state: 'AUTHORITATIVE', lifecycle_state: 'CURRENT' };
}
function money(amount, currency = 'USD') {
  return { amount: String(amount), currency, status: 'AUTHORITATIVE', reason: null, authority_refs: [ref(`m-${amount}`)] };
}

test('AL — BIND_TO_DEAL DOMAIN OUTPUT MATCHES SEALED DB CONTRACT', async () => {
  const decision = buildOwnerPaymentDecision({
    actor: ownerActor(),
    payment: payment('100'),
    currentAuthority: null,
    currentReconciliation: actionable(),
    contourDeals: contour(),
    action: 'BIND_TO_DEAL',
    payload: {
      expected_current_authority_id: null,
      idempotency_key: 'al-bind-sealed-1',
      source_refs: ['OWNER_REQUEST:AL'],
      business_scope_refs: ['QA:SCOPE'],
      lines: [
        { deal_key: DEAL_B, amount: '40.00', currency: 'USD' },
        { deal_key: DEAL_A, amount: '60', currency: 'USD' },
      ],
    },
    idFactory: idFactory(),
    now: TS,
  });

  assert.equal(decision.authority.attribution_mode, 'EXACT');
  assert.equal(decision.authority.decision_type, 'BIND_TO_DEAL');
  assert.equal(decision.authority.classification, 'KNOWN_MULTI_DEAL_EXACT_SPLIT');
  assert.deepEqual(decision.authority.scope_deal_keys, [DEAL_A, DEAL_B]);
  assert.deepEqual(decision.authority.lines_snapshot, [
    { deal_key: DEAL_A, amount: '60', currency: 'USD', amount_status: 'EXACT' },
    { deal_key: DEAL_B, amount: '40', currency: 'USD', amount_status: 'EXACT' },
  ]);
  assert.equal(decision.authority.lines_snapshot.reduce((sum, line) => sum + Number(line.amount), 0), 100);
  assert.equal(decision.authority.supersedes_id, null);
  assert.deepEqual(decision.authority.supersedes_authority_refs, []);
  assert.equal(decision.authority.actor_id, ownerActor().id);
  assert.equal(decision.authority.idempotency_key, 'al-bind-sealed-1');
  assert.equal(decision.auditRecord.resulting_authority_id, AUTHORITY_ID);
  assert.deepEqual(decision.auditRecord.request_snapshot.lines_snapshot, decision.authority.lines_snapshot);

  const envelope = createOwnerDecisionPersistenceEnvelope(decision);
  assert.equal(envelope.p_expected_current_authority_id, null);
  assert.equal(envelope.p_authority, decision.authority);
  assert.equal(envelope.p_audit, decision.auditRecord);

  let invoked = null;
  const persisted = await persistOwnerPaymentDecisionV7({
    decision,
    executeRpc: async (name, args) => { invoked = { name, args }; return { id: AUTHORITY_ID }; },
  });
  assert.equal(invoked.name, 'portal_private.persist_owner_payment_decision_v7');
  assert.equal(invoked.args.p_authority.lines_snapshot.length, 2);
  assert.deepEqual(persisted, { id: AUTHORITY_ID });
});

test('AM — ASSIGN_ADVANCE_PAYMENT DOMAIN OUTPUT MATCHES SEALED DB CONTRACT', () => {
  const outgoing = payment('25');
  const decision = buildOwnerPaymentDecision({
    actor: ownerActor(),
    payment: outgoing,
    currentAuthority: null,
    currentReconciliation: actionable(),
    contourDeals: contour(),
    action: 'ASSIGN_ADVANCE_PAYMENT',
    payload: {
      expected_current_authority_id: null,
      idempotency_key: 'am-advance-sealed-1',
      source_refs: ['OWNER_REQUEST:AM'],
    },
    idFactory: idFactory(),
    now: TS,
  });

  assert.equal(decision.authority.attribution_mode, 'NO_DEAL_BINDING');
  assert.equal(decision.authority.decision_type, 'ASSIGN_ADVANCE_PAYMENT');
  assert.equal(decision.authority.classification, 'RONA_ADVANCE_DEAL_SPEND');
  assert.deepEqual(decision.authority.scope_deal_keys, []);
  assert.deepEqual(decision.authority.lines_snapshot, []);
  assert.equal(decision.authority.materialization_status, 'NOT_APPLICABLE');
  assert.deepEqual(createOwnerDecisionPersistenceEnvelope(decision).p_authority.lines_snapshot, []);

  const incomingPayment = {
    payment_key: 'pay-in-am', payment_id: 'PAY-IN-AM', payment_at: TS, direction: 'INCOMING', kind: 'CLIENT_PAYMENT', amount: '40', currency: 'USD',
    bank_fact_status: 'BANK_CONFIRMED', finance_verification_status: 'VERIFIED', allocation_applicability: 'DEAL_ALLOCATABLE', current: true, source_locked: true,
    authority_state: 'AUTHORITATIVE', lifecycle_state: 'CURRENT', authority_refs: [ref('pay-in-am')],
  };
  const source = {
    generatedAt: TS,
    sourceAsOf: TS,
    capabilities: { paymentBusinessAuthority: true, financeAuthority: true, resourceChain: true },
    contour: [{ deal_key: DEAL_A, deal_id: 'DEAL-QA-A', client_display: 'Client A', payment_handoff_state: 'READY', current: true, authority_state: 'AUTHORITATIVE', lifecycle_state: 'CURRENT', authority_refs: [ref('deal-a')] }],
    validDealKeys: [DEAL_A],
    payments: [incomingPayment, outgoing],
    attributionClaims: [
      { id: 'attr-in-am', payment_key: 'pay-in-am', classification: 'RESOLVED', disposition: 'BIND_TO_DEAL', lines: [{ deal_key: DEAL_A, amount: '40', currency: 'USD', amount_status: 'EXACT' }], scope_deal_keys: [DEAL_A], current: true, source_locked: true, authority_state: 'AUTHORITATIVE', lifecycle_state: 'CURRENT', authority_refs: [ref('attr-in-am')] },
      { ...decision.authority, disposition: decision.authority.decision_type, lines: decision.authority.lines_snapshot, authority_refs: [ref('advance-am')] },
    ],
    physicalAllocations: [{ id: 'mat-in-am', payment_key: 'pay-in-am', deal_key: DEAL_A, amount: '40', currency: 'USD', current: true, source_locked: true, allocation_status: 'VERIFIED', authority_state: 'AUTHORITATIVE', lifecycle_state: 'CURRENT', authority_refs: [ref('mat-in-am')] }],
    financeAuthorities: [{
      id: 'fin-am', deal_key: DEAL_A,
      total_to_receive: money('100'), due_now: money('0'), expected_not_due: money('60'), future_conditional: money('0'),
      finance_status: 'EXPECTED', documentary_status: 'TO_VERIFY', contractual_payment_currency: 'USD', mixed_inbound_accounting_currency: null,
      current: true, source_locked: true, authority_state: 'AUTHORITATIVE', lifecycle_state: 'CURRENT', effective_at: TS, source_version: '1', authority_refs: [ref('fin-am')],
    }],
    resourceChains: [],
  };
  const projection = buildAdminPaymentsV7Projection(source);
  const deal = projection.deals[0];
  assert.equal(deal.verified_received.amount, '40');
  assert.equal(deal.total_to_receive.amount, '100');
  assert.equal(deal.remaining_to_receive.amount, '60');
  assert.equal(projection.owner_exception_queue.length, 0);
});
