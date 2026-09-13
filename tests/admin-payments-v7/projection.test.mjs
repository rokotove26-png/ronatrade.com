import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAdminPaymentsV7Projection,
  buildOwnerPaymentDecision,
  canExecuteOwnerPaymentDecision,
  normalizeFinanceSourceRecordV1,
  normalizeFinanceSourceRecordV2,
} from '../../supabase/functions/rona-portal-api/admin-payments-v7/index.mjs';

const ref = (id) => ({ source_type: 'TEST', source_id: id, source_version: '1', source_timestamp: '2026-09-13T00:00:00Z', authority_state: 'AUTHORITATIVE', lifecycle_state: 'CURRENT' });
const mv = (amount, currency = 'USD') => ({ amount: String(amount), currency, status: 'AUTHORITATIVE', reason: null, authority_refs: [ref(`money-${amount}`)] });

function deal(key = 'deal-a', id = 'D-A') {
  return { deal_key: key, deal_id: id, client_display: `Client ${id}`, payment_handoff_state: 'READY', authority_refs: [ref(key)] };
}

function financeClaim({ id = 'fin-a', dealKey = 'deal-a', total = '100', due = '0', expected = '60', future = '0', currency = 'USD', supersedes = null, status = 'OPEN', documentary = 'CONFIRMED' } = {}) {
  return {
    id,
    deal_key: dealKey,
    total_to_receive: mv(total, currency),
    due_now: mv(due, currency),
    expected_not_due: mv(expected, currency),
    future_conditional: mv(future, currency),
    finance_status: status,
    documentary_status: documentary,
    contractual_payment_currency: currency,
    current: true,
    source_locked: true,
    authority_state: 'AUTHORITATIVE',
    lifecycle_state: 'CURRENT',
    effective_at: '2026-09-13T00:00:00Z',
    supersedes_id: supersedes,
    source_version: '1',
    authority_refs: [ref(id)],
  };
}

function payment({ key, id, direction = 'INCOMING', kind = 'CLIENT_PAYMENT', amount = '40', currency = 'USD', candidates = [] } = {}) {
  return {
    payment_key: key,
    payment_id: id || key,
    payment_at: '2026-09-13T00:00:00Z',
    direction,
    kind,
    amount,
    currency,
    bank_fact_status: 'BANK_CONFIRMED',
    finance_verification_status: 'VERIFIED',
    allocation_applicability: kind === 'FX_CONVERSION' ? 'NOT_APPLICABLE' : 'APPLICABLE',
    candidate_deal_ids: candidates,
    authority_refs: [ref(key)],
  };
}

function attribution({ id, paymentKey, lines = [], scope = [], classification = null, disposition = 'BIND_TO_DEAL', supersedes = null, principal = null } = {}) {
  return {
    id,
    payment_key: paymentKey,
    classification,
    disposition,
    lines,
    scope_deal_keys: scope,
    principal_payment_key: principal,
    current: true,
    source_locked: true,
    authority_state: 'AUTHORITATIVE',
    lifecycle_state: 'CURRENT',
    supersedes_id: supersedes,
    authority_refs: [ref(id)],
  };
}

function physical({ id, paymentKey, dealKey, amount, currency = 'USD', current = true } = {}) {
  return {
    id,
    payment_key: paymentKey,
    deal_key: dealKey,
    amount,
    currency,
    allocation_status: 'VERIFIED',
    current,
    source_locked: true,
    authority_refs: [ref(id)],
  };
}

function baseSource() {
  return {
    generatedAt: '2026-09-13T00:00:00Z',
    sourceAsOf: '2026-09-13T00:00:00Z',
    capabilities: { paymentBusinessAuthority: true, financeAuthority: true, resourceChain: true },
    contour: [deal()],
    payments: [payment({ key: 'pay-in-1', amount: '40' })],
    attributionClaims: [attribution({ id: 'attr-in-1', paymentKey: 'pay-in-1', lines: [{ deal_key: 'deal-a', amount: '40', currency: 'USD', amount_status: 'EXACT' }] })],
    physicalAllocations: [physical({ id: 'mat-in-1', paymentKey: 'pay-in-1', dealKey: 'deal-a', amount: '40' })],
    financeAuthorities: [financeClaim()],
    resourceChains: [],
  };
}

function project(source) { return buildAdminPaymentsV7Projection(structuredClone(source)); }

test('A — Finance projection mutation is data-driven', () => {
  const a = baseSource();
  const pa = project(a);
  const b = baseSource();
  b.financeAuthorities[0] = financeClaim({ total: '120', expected: '80' });
  const pb = project(b);
  assert.equal(pa.deals[0].total_to_receive.amount, '100');
  assert.equal(pb.deals[0].total_to_receive.amount, '120');
  assert.equal(pb.deals[0].expected_not_due.amount, '80');
  assert.equal(pb.deals[0].verified_received.amount, '40');
});

test('B — new Deal enters contour without code branch', () => {
  const source = baseSource();
  source.contour.push(deal('deal-b', 'D-B'));
  source.financeAuthorities.push(financeClaim({ id: 'fin-b', dealKey: 'deal-b', total: '25', expected: '25' }));
  const out = project(source);
  assert.equal(out.deals.length, 2);
  assert.equal(out.deals[1].deal_id, 'D-B');
});

test('C — new verified client payment recomputes receipt and progress only', () => {
  const source = baseSource();
  source.payments.push(payment({ key: 'pay-in-2', amount: '10' }));
  source.attributionClaims.push(attribution({ id: 'attr-in-2', paymentKey: 'pay-in-2', lines: [{ deal_key: 'deal-a', amount: '10', currency: 'USD', amount_status: 'EXACT' }] }));
  const out = project(source);
  assert.equal(out.deals[0].verified_received.amount, '50');
  assert.equal(out.deals[0].remaining_to_receive.amount, '50');
  assert.equal(out.deals[0].payment_progress.percent, '50');
  assert.equal(out.deals[0].actual_spend.amount, '0');
});

test('D — Deal spend same currency and exact cross-currency chain; missing chain fails closed', () => {
  const source = baseSource();
  source.payments.push(payment({ key: 'pay-out-usd', direction: 'OUTGOING', kind: 'COUNTERPARTY_PAYMENT', amount: '10', currency: 'USD' }));
  source.attributionClaims.push(attribution({ id: 'attr-out-usd', paymentKey: 'pay-out-usd', lines: [{ deal_key: 'deal-a', amount: '10', currency: 'USD', amount_status: 'EXACT' }] }));
  source.payments.push(payment({ key: 'pay-out-rub', direction: 'OUTGOING', kind: 'COUNTERPARTY_PAYMENT', amount: '1000', currency: 'RUB' }));
  source.attributionClaims.push(attribution({ id: 'attr-out-rub', paymentKey: 'pay-out-rub', lines: [{ deal_key: 'deal-a', amount: '1000', currency: 'RUB', amount_status: 'EXACT' }] }));
  source.resourceChains.push({ id: 'chain-1', payment_key: 'pay-out-rub', deal_key: 'deal-a', native_amount: '1000', native_currency: 'RUB', accounting_amount: '12.5', accounting_currency: 'USD', current: true, source_locked: true, authority_state: 'AUTHORITATIVE', lifecycle_state: 'CURRENT', authority_refs: [ref('chain-1')] });
  const good = project(source);
  assert.equal(good.deals[0].actual_spend.amount, '22.5');
  assert.equal(good.deals[0].actual_spend_status, 'AUTHORITATIVE');
  source.resourceChains = [];
  const failed = project(source);
  assert.equal(failed.deals[0].actual_spend_status, 'PARTIAL_TO_VERIFY');
  assert.equal(failed.deals[0].remaining_execution.status, 'TO_VERIFY');
});

test('E — genuine unresolved appears then disappears when scope authority arrives', () => {
  const source = baseSource();
  source.payments.push(payment({ key: 'pay-u', direction: 'OUTGOING', kind: 'COUNTERPARTY_PAYMENT', amount: '7' }));
  let out = project(source);
  assert.equal(out.owner_exception_queue.length, 1);
  assert.deepEqual(out.owner_exception_queue[0].allowed_owner_actions, ['BIND_TO_DEAL', 'ASSIGN_ADVANCE_PAYMENT']);
  source.attributionClaims.push(attribution({ id: 'scope-u', paymentKey: 'pay-u', lines: [], scope: ['deal-a'], classification: 'SHARED_DEAL_SCOPE_SPLIT_TO_VERIFY', disposition: null }));
  out = project(source);
  assert.equal(out.owner_exception_queue.length, 0);
  assert.equal(out.payment_exceptions.find((e) => e.payment_ids.includes('pay-u')).reconciliation_class, 'SHARED_DEAL_SCOPE_SPLIT_TO_VERIFY');
});

test('F — exact split without physical materialization is not Owner action', () => {
  const source = baseSource();
  source.contour.push(deal('deal-b', 'D-B'));
  source.financeAuthorities.push(financeClaim({ id: 'fin-b', dealKey: 'deal-b', total: '10', expected: '10' }));
  source.payments.push(payment({ key: 'pay-split', direction: 'OUTGOING', kind: 'COUNTERPARTY_PAYMENT', amount: '20' }));
  source.attributionClaims.push(attribution({ id: 'attr-split', paymentKey: 'pay-split', lines: [{ deal_key: 'deal-a', amount: '12', currency: 'USD', amount_status: 'EXACT' }, { deal_key: 'deal-b', amount: '8', currency: 'USD', amount_status: 'EXACT' }] }));
  const out = project(source);
  const ex = out.payment_exceptions.find((e) => e.payment_ids.includes('pay-split'));
  assert.equal(ex.reconciliation_class, 'KNOWN_MULTI_DEAL_EXACT_SPLIT');
  assert.equal(ex.owner_action_required, false);
  assert.equal(ex.technical_gap, 'NOT_MATERIALIZED');
});

test('G — Owner asserted allocated and associated fee remain non-queue technical gaps', () => {
  const source = baseSource();
  source.payments.push(payment({ key: 'principal', direction: 'OUTGOING', kind: 'COUNTERPARTY_PAYMENT', amount: '50' }));
  source.attributionClaims.push(attribution({ id: 'asserted', paymentKey: 'principal', scope: ['deal-a'], classification: 'OWNER_ASSERTED_ALLOCATED_SYSTEM_AUTHORITY_NOT_MATERIALIZED', disposition: null }));
  source.payments.push(payment({ key: 'fee', direction: 'OUTGOING', kind: 'BANK_FEE', amount: '1' }));
  source.attributionClaims.push(attribution({ id: 'fee-attr', paymentKey: 'fee', scope: ['deal-a'], classification: 'ASSOCIATED_BANK_FEE', disposition: null, principal: 'principal' }));
  const out = project(source);
  assert.equal(out.owner_exception_queue.length, 0);
  assert.equal(out.payment_exceptions.find((e) => e.payment_ids.includes('principal')).reconciliation_class, 'OWNER_ASSERTED_ALLOCATED_SYSTEM_AUTHORITY_NOT_MATERIALIZED');
  assert.equal(out.payment_exceptions.find((e) => e.payment_ids.includes('fee')).reconciliation_class, 'ASSOCIATED_BANK_FEE');
});

test('H — FX conversion is never receipt, spend, or Owner queue', () => {
  const source = baseSource();
  source.payments.push(payment({ key: 'fx-1', direction: 'OUTGOING', kind: 'FX_CONVERSION', amount: '500', currency: 'RUB' }));
  const out = project(source);
  const ex = out.payment_exceptions.find((e) => e.payment_ids.includes('fx-1'));
  assert.equal(ex.reconciliation_class, 'FX_CONVERSION_NOT_APPLICABLE');
  assert.equal(out.owner_exception_queue.length, 0);
  assert.equal(out.deals[0].verified_received.amount, '40');
  assert.equal(out.deals[0].actual_spend.amount, '0');
});

test('I — mixed inbound currencies fail closed without explicit rule', () => {
  const source = baseSource();
  source.payments.push(payment({ key: 'pay-eur', amount: '5', currency: 'EUR' }));
  source.attributionClaims.push(attribution({ id: 'attr-eur', paymentKey: 'pay-eur', lines: [{ deal_key: 'deal-a', amount: '5', currency: 'EUR', amount_status: 'EXACT' }] }));
  const out = project(source);
  assert.equal(out.deals[0].accounting_currency.status, 'TO_VERIFY');
  assert.equal(out.deals[0].accounting_currency.reason, 'MIXED_INBOUND_CURRENCIES');
  assert.equal(out.deals[0].financial_status, 'TO_VERIFY');
});

test('J — semantic baseline has zero generic unallocated for known/resolved/FX classes', () => {
  const source = baseSource();
  source.payments.push(payment({ key: 'known', direction: 'OUTGOING', kind: 'COUNTERPARTY_PAYMENT', amount: '2' }));
  source.attributionClaims.push(attribution({ id: 'known-scope', paymentKey: 'known', scope: ['deal-a'], classification: 'SHARED_DEAL_SCOPE_SPLIT_TO_VERIFY', disposition: null }));
  source.payments.push(payment({ key: 'asserted-j', direction: 'OUTGOING', kind: 'COUNTERPARTY_PAYMENT', amount: '3' }));
  source.attributionClaims.push(attribution({ id: 'asserted-j-a', paymentKey: 'asserted-j', scope: ['deal-a'], classification: 'OWNER_ASSERTED_ALLOCATED_SYSTEM_AUTHORITY_NOT_MATERIALIZED', disposition: null }));
  source.payments.push(payment({ key: 'fx-j', direction: 'OUTGOING', kind: 'FX_CONVERSION', amount: '4', currency: 'RUB' }));
  const out = project(source);
  assert.equal(out.reconciliation_summary.genuinely_unallocated_count, 0);
  assert.equal(out.owner_exception_queue.length, 0);
});

test('K — Owner BIND_TO_DEAL is human Owner/Admin only and append-only', () => {
  let n = 0;
  const result = buildOwnerPaymentDecision({ actor: { id: 'owner-1', role: 'OWNER', actor_type: 'HUMAN' }, payment: { payment_key: 'p-k', amount: '10', currency: 'USD' }, currentAuthority: { id: 'old-auth' }, action: 'BIND_TO_DEAL', payload: { expected_current_authority_id: 'old-auth', lines: [{ deal_key: 'deal-a', amount: '10', currency: 'USD' }], idempotency_key: 'idem-k' }, idFactory: () => `id-${++n}`, now: '2026-09-13T01:00:00Z' });
  assert.equal(result.authority.supersedes_id, 'old-auth');
  assert.equal(result.lines[0].amount, '10');
  assert.equal(result.auditRecord.previous_authority_snapshot.id, 'old-auth');
  assert.equal(canExecuteOwnerPaymentDecision({ id: 'finance-ai', role: 'FINANCE', actor_type: 'AI', is_ai: true }), false);
  assert.throws(() => buildOwnerPaymentDecision({ actor: { id: 'sys', role: 'ADMIN', actor_type: 'SYSTEM', is_system: true }, payment: { payment_key: 'p', amount: '1', currency: 'USD' }, action: 'BIND_TO_DEAL', payload: { lines: [{ deal_key: 'd', amount: '1' }] } }), /OWNER_ACTION_FORBIDDEN/);
});

test('L — ASSIGN_ADVANCE_PAYMENT remains outside client receipt and obligation arithmetic', () => {
  let n = 0;
  const decision = buildOwnerPaymentDecision({ actor: { id: 'admin-1', role: 'ADMIN', actor_type: 'HUMAN' }, payment: { payment_key: 'advance-p', amount: '25', currency: 'USD' }, action: 'ASSIGN_ADVANCE_PAYMENT', payload: {}, idFactory: () => `l-${++n}`, now: '2026-09-13T01:00:00Z' });
  const source = baseSource();
  source.payments.push(payment({ key: 'advance-p', amount: '25' }));
  source.attributionClaims.push({ id: decision.authority.id, payment_key: 'advance-p', classification: decision.authority.classification, disposition: 'ASSIGN_ADVANCE_PAYMENT', lines: [], scope_deal_keys: [], current: true, source_locked: true, authority_state: 'AUTHORITATIVE', lifecycle_state: 'CURRENT', authority_refs: [ref('advance')] });
  const out = project(source);
  assert.equal(out.owner_exception_queue.length, 0);
  assert.equal(out.deals[0].verified_received.amount, '40');
  assert.equal(out.deals[0].total_to_receive.amount, '100');
  assert.equal(out.deals[0].remaining_to_receive.amount, '60');
  assert.equal(out.deals[0].expected_not_due.amount, '60');
});

test('M — superseding Owner authority beats stale VERIFIED materialization', () => {
  const source = baseSource();
  source.contour.push(deal('deal-b', 'D-B'));
  source.financeAuthorities.push(financeClaim({ id: 'fin-b', dealKey: 'deal-b', total: '40', expected: '0' }));
  source.attributionClaims = [attribution({ id: 'old-auth', paymentKey: 'pay-in-1', lines: [{ deal_key: 'deal-a', amount: '40', currency: 'USD', amount_status: 'EXACT' }] }), attribution({ id: 'new-owner-auth', paymentKey: 'pay-in-1', lines: [{ deal_key: 'deal-b', amount: '40', currency: 'USD', amount_status: 'EXACT' }], supersedes: 'old-auth' })];
  source.physicalAllocations = [physical({ id: 'stale-row', paymentKey: 'pay-in-1', dealKey: 'deal-a', amount: '40', current: true })];
  const out = project(source);
  const a = out.deals.find((d) => d.deal_id === 'D-A');
  const b = out.deals.find((d) => d.deal_id === 'D-B');
  assert.equal(a.verified_received.amount, '0');
  assert.equal(b.verified_received.amount, '40');
  assert.equal(out.payment_exceptions.find((e) => e.payment_ids.includes('pay-in-1')).technical_gap, 'STALE_SUPERSEDED_MATERIALIZATION');
});

test('N — Finance source schema versions normalize to one runtime contract without Deal branch', () => {
  const common = { record_id: 'f-n', deal_key: 'deal-a', current: true, source_locked: true, qa_only: false, authority_state: 'AUTHORITATIVE', lifecycle_state: 'CURRENT', version: 1, created_at: '2026-09-13T00:00:00Z' };
  const v1 = normalizeFinanceSourceRecordV1({ ...common, payload: { total_to_receive: '100', due_now: '10', expected_not_due: '90', future_conditional: '0', contractual_payment_currency: 'USD', finance_status: 'OPEN', documentary_status: 'CONFIRMED' } });
  const v2 = normalizeFinanceSourceRecordV2({ ...common, record_id: 'f-n2', payload: { obligation: { total: '100' }, buckets: { due_now: '10', expected_not_due: '90', future_conditional: '0' }, currency: { contractual: 'USD' }, finance_status: 'OPEN', documentary_status: 'CONFIRMED' } });
  assert.deepEqual([v1.total_to_receive.amount, v1.due_now.amount, v1.expected_not_due.amount, v1.contractual_payment_currency], [v2.total_to_receive.amount, v2.due_now.amount, v2.expected_not_due.amount, v2.contractual_payment_currency]);
  const source1 = baseSource(); source1.financeAuthorities = [v1];
  const source2 = baseSource(); source2.financeAuthorities = [v2];
  assert.equal(project(source1).deals[0].total_to_receive.amount, project(source2).deals[0].total_to_receive.amount);
});

test('O — over-receipt is explicit, negative remainder and >100% are preserved', () => {
  const source = baseSource();
  source.payments[0].amount = '120';
  source.attributionClaims[0].lines[0].amount = '120';
  source.physicalAllocations[0].amount = '120';
  const out = project(source);
  const d = out.deals[0];
  assert.equal(d.remaining_to_receive.amount, '-20');
  assert.equal(d.payment_progress.percent, '120');
  assert.equal(d.financial_status, 'OVERRECEIVED');
  assert.equal(d.financial_exceptions[0].code, 'OVERRECEIPT');
  assert.equal(d.financial_exceptions[0].amount.amount, '20');
  assert.equal(out.owner_exception_queue.length, 0);
});

test('P — incompatible current authorities fail closed as AUTHORITY_CONFLICT, never arbitrary Owner action', () => {
  const source = baseSource();
  source.payments.push(payment({ key: 'p-conflict', direction: 'OUTGOING', kind: 'COUNTERPARTY_PAYMENT', amount: '9' }));
  source.attributionClaims.push(attribution({ id: 'conf-a', paymentKey: 'p-conflict', lines: [{ deal_key: 'deal-a', amount: '9', currency: 'USD', amount_status: 'EXACT' }] }), attribution({ id: 'conf-b', paymentKey: 'p-conflict', scope: ['deal-a'], classification: 'SHARED_DEAL_SCOPE_SPLIT_TO_VERIFY', disposition: null }));
  const out = project(source);
  const ex = out.payment_exceptions.find((e) => e.payment_ids.includes('p-conflict'));
  assert.equal(ex.reconciliation_class, 'AUTHORITY_CONFLICT');
  assert.equal(ex.status, 'TO_VERIFY');
  assert.equal(ex.reason, 'AUTHORITY_CONFLICT');
  assert.equal(ex.owner_action_required, false);
  assert.equal(out.owner_exception_queue.length, 0);
});

test('Q — stale materialized incoming allocation is not double-counted after supersession', () => {
  const source = baseSource();
  source.attributionClaims = [attribution({ id: 'old-q', paymentKey: 'pay-in-1', lines: [{ deal_key: 'deal-a', amount: '40', currency: 'USD', amount_status: 'EXACT' }] }), attribution({ id: 'new-q', paymentKey: 'pay-in-1', lines: [{ deal_key: 'deal-a', amount: '40', currency: 'USD', amount_status: 'EXACT' }], supersedes: 'old-q' })];
  source.physicalAllocations = [physical({ id: 'raw-old', paymentKey: 'pay-in-1', dealKey: 'deal-a', amount: '40', current: true }), physical({ id: 'raw-new', paymentKey: 'pay-in-1', dealKey: 'deal-a', amount: '40', current: true })];
  const out = project(source);
  assert.equal(out.deals[0].verified_received.amount, '40');
});
