import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAuthorityClaims, stableAttributionSignature } from '../../supabase/functions/_shared/admin-payments-v7/authority.mjs';
import { reconcilePaymentEvent } from '../../supabase/functions/_shared/admin-payments-v7/reconciliation.mjs';
import { computeDealSpend } from '../../supabase/functions/_shared/admin-payments-v7/spend.mjs';

function payment(overrides = {}) {
  return {
    payment_key: 'payment-1',
    payment_id: 'PAYMENT-1',
    direction: 'OUTGOING',
    kind: 'SUPPLIER_PAYMENT',
    amount: '100',
    currency: 'USD',
    bank_fact_status: 'BANK_CONFIRMED',
    finance_verification_status: 'VERIFIED',
    allocation_applicability: 'DEAL_ALLOCATABLE',
    allocation_review_status: 'VERIFIED',
    source_locked: true,
    authority_refs: [],
    ...overrides,
  };
}

function legacyOwnerFact(overrides = {}) {
  return {
    id: 'OUTGOING_FACT:legacy-1',
    payment_key: 'payment-1',
    classification: 'RESOLVED',
    disposition: 'BIND_TO_DEAL',
    lines: [{ deal_key: 'deal-a', amount: '100', currency: 'USD', amount_status: 'EXACT' }],
    scope_deal_keys: ['deal-a'],
    business_scope_refs: ['LEGACY:owner-fact'],
    current: true,
    source_locked: true,
    authority_kind: 'OWNER_OUTGOING_PAYMENT_FACT',
    authority_state: 'CONFIRMED',
    lifecycle_state: 'ACTIVE',
    authority_refs: [{ source_type: 'OWNER_OUTGOING_PAYMENT_FACT', source_id: 'legacy-1' }],
    ...overrides,
  };
}

function normalizedFinance(overrides = {}) {
  return {
    id: 'normalized-1',
    payment_key: 'payment-1',
    classification: 'RESOLVED',
    attribution_mode: 'EXACT',
    disposition: 'BIND_TO_DEAL',
    lines: [{ deal_key: 'deal-a', amount: '100', currency: 'USD', amount_status: 'EXACT' }],
    scope_deal_keys: ['deal-a'],
    business_scope_refs: ['FINANCE_EVENT:normalized-1'],
    current: true,
    source_locked: true,
    authority_kind: 'FINANCE_AI',
    authority_state: 'AUTHORITATIVE',
    lifecycle_state: 'CURRENT',
    authority_refs: [{ source_type: 'FINANCE_AI', source_id: 'normalized-1' }],
    ...overrides,
  };
}

test('legacy owner fact remains evidence but current exact normalized Finance attribution wins precedence', () => {
  const legacy = legacyOwnerFact();
  const normalized = normalizedFinance();
  const resolved = resolveAuthorityClaims([legacy, normalized], stableAttributionSignature);
  assert.equal(resolved.status, 'AUTHORITATIVE');
  assert.equal(resolved.claim.id, normalized.id);
  assert.deepEqual(resolved.claims.map((claim) => claim.id), [normalized.id]);
  assert.ok(resolved.authority_refs.some((ref) => ref.source_type === 'OWNER_OUTGOING_PAYMENT_FACT'));

  const rec = reconcilePaymentEvent(payment(), [legacy, normalized], [], { paymentBusinessAuthority: true }, ['deal-a']);
  assert.equal(rec.status, 'AUTHORITATIVE');
  assert.notEqual(rec.reconciliation_class, 'AUTHORITY_CONFLICT');
  assert.equal(rec.current_authority_id, normalized.id);

  const spend = computeDealSpend({
    dealKey: 'deal-a',
    accountingCurrency: 'USD',
    payments: [payment()],
    reconciliations: new Map([['payment-1', rec]]),
    resourceChains: [],
    capability: true,
  });
  assert.equal(spend.status, 'AUTHORITATIVE');
  assert.equal(spend.value.amount, '100');
});

test('two conflicting normalized current exact Finance authorities remain TO_VERIFY', () => {
  const first = normalizedFinance({ id: 'normalized-a' });
  const second = normalizedFinance({
    id: 'normalized-b',
    lines: [{ deal_key: 'deal-b', amount: '100', currency: 'USD', amount_status: 'EXACT' }],
    scope_deal_keys: ['deal-b'],
    business_scope_refs: ['FINANCE_EVENT:normalized-b'],
    authority_refs: [{ source_type: 'FINANCE_AI', source_id: 'normalized-b' }],
  });
  const resolved = resolveAuthorityClaims([legacyOwnerFact(), first, second], stableAttributionSignature);
  assert.equal(resolved.status, 'TO_VERIFY');
  assert.equal(resolved.reason, 'AUTHORITY_CONFLICT');
  assert.deepEqual(new Set(resolved.claims.map((claim) => claim.id)), new Set(['normalized-a', 'normalized-b']));
});

test('legacy-only authority keeps previous behavior', () => {
  const legacy = legacyOwnerFact();
  const resolved = resolveAuthorityClaims([legacy], stableAttributionSignature);
  assert.equal(resolved.status, 'AUTHORITATIVE');
  assert.equal(resolved.claim.id, legacy.id);
});

test('scope-only PAYEV-2026-000008 and PAYEV-2026-000009 remain TO_VERIFY', () => {
  const p8 = payment({ payment_key: 'payment-8', payment_id: 'PAYEV-2026-000008' });
  const p9 = payment({ payment_key: 'payment-9', payment_id: 'PAYEV-2026-000009', kind: 'BANK_FEE' });
  const c8 = {
    id: 'scope-8', payment_key: 'payment-8', classification: 'OWNER_ASSERTED_ALLOCATED_SYSTEM_AUTHORITY_NOT_MATERIALIZED',
    attribution_mode: 'SCOPE_ONLY', lines: [], scope_deal_keys: [], business_scope_refs: ['OWNER_ASSERTION:8'],
    current: true, source_locked: true, authority_kind: 'OWNER_SOURCE_RECORD', authority_state: 'AUTHORITATIVE', lifecycle_state: 'CURRENT', authority_refs: [],
  };
  const c9 = {
    id: 'scope-9', payment_key: 'payment-9', classification: 'ASSOCIATED_BANK_FEE', attribution_mode: 'SCOPE_ONLY',
    lines: [], scope_deal_keys: [], business_scope_refs: ['OWNER_ASSERTION:9'],
    current: true, source_locked: true, authority_kind: 'OWNER_SOURCE_RECORD', authority_state: 'AUTHORITATIVE', lifecycle_state: 'CURRENT', authority_refs: [],
  };
  const r8 = reconcilePaymentEvent(p8, [c8], [], { paymentBusinessAuthority: true }, ['deal-a']);
  const r9 = reconcilePaymentEvent(p9, [c9], [], { paymentBusinessAuthority: true }, ['deal-a']);
  assert.equal(r8.status, 'TO_VERIFY');
  assert.equal(r8.reason, 'SYSTEM_AUTHORITY_NOT_MATERIALIZED');
  assert.equal(r9.status, 'TO_VERIFY');
  assert.equal(r9.reason, 'FEE_ATTRIBUTION_TO_VERIFY');
});

test('FX conversion principal is not synthesized into Deal spend', () => {
  const fx = payment({ payment_key: 'fx-1', payment_id: 'FX-1', kind: 'FX_CONVERSION', amount: '1000', currency: 'RUB' });
  const spend = computeDealSpend({
    dealKey: 'deal-a',
    accountingCurrency: 'USD',
    payments: [fx],
    reconciliations: new Map(),
    resourceChains: [],
    capability: true,
  });
  assert.equal(spend.status, 'AUTHORITATIVE');
  assert.equal(Number(spend.value.amount), 0);
});
