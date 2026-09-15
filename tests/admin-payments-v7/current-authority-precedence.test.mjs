import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAuthorityClaims, stableAttributionSignature } from '../../supabase/functions/_shared/admin-payments-v7/authority.mjs';
import { reconcilePaymentEvent } from '../../supabase/functions/_shared/admin-payments-v7/reconciliation.mjs';
import { computeDealSpend } from '../../supabase/functions/_shared/admin-payments-v7/spend.mjs';
import { decimalCompare, decimalSub, decimalToString } from '../../supabase/functions/_shared/admin-payments-v7/decimal.mjs';

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

function paymentAllocationClaim(overrides = {}) {
  return {
    id: 'PAYMENT_ALLOCATION_SET:allocation-1',
    payment_key: 'payment-1',
    classification: 'RESOLVED',
    disposition: 'BIND_TO_DEAL',
    lines: [{ deal_key: 'deal-a', amount: '100', currency: 'USD', amount_status: 'EXACT', materialization_id: 'allocation-1' }],
    scope_deal_keys: ['deal-a'],
    current: true,
    source_locked: true,
    authority_kind: 'PAYMENT_ALLOCATION',
    authority_ref: { source_type: 'PAYMENT_ALLOCATION', source_id: 'allocation-1' },
    authority_identity_refs: [{ source_type: 'PAYMENT_ALLOCATION', source_id: 'allocation-1' }],
    authority_state: 'AUTHORITATIVE',
    lifecycle_state: 'CURRENT',
    authority_refs: [{ source_type: 'PAYMENT_ALLOCATION', source_id: 'allocation-1' }],
    ...overrides,
  };
}

function physicalAllocation(overrides = {}) {
  return {
    id: 'allocation-1',
    payment_key: 'payment-1',
    deal_key: 'deal-a',
    amount: '100',
    currency: 'USD',
    current: true,
    source_locked: true,
    authority_state: 'AUTHORITATIVE',
    lifecycle_state: 'CURRENT',
    authority_refs: [{ source_type: 'PAYMENT_ALLOCATION', source_id: 'allocation-1' }],
    ...overrides,
  };
}

function exactClaimForComponent({ id, paymentKey, dealKey, amount, currency }) {
  return normalizedFinance({
    id,
    payment_key: paymentKey,
    lines: [{ deal_key: dealKey, amount, currency, amount_status: 'EXACT' }],
    scope_deal_keys: [dealKey],
    business_scope_refs: [`FINANCE_EVENT:${id}`],
    authority_refs: [{ source_type: 'FINANCE_AI', source_id: id }],
  });
}

function allocationClaimForComponent({ id, paymentKey, dealKey, amount, currency }) {
  return paymentAllocationClaim({
    id: `PAYMENT_ALLOCATION_SET:${id}`,
    payment_key: paymentKey,
    lines: [{ deal_key: dealKey, amount, currency, amount_status: 'EXACT', materialization_id: id }],
    scope_deal_keys: [dealKey],
    authority_ref: { source_type: 'PAYMENT_ALLOCATION', source_id: id },
    authority_identity_refs: [{ source_type: 'PAYMENT_ALLOCATION', source_id: id }],
    authority_refs: [{ source_type: 'PAYMENT_ALLOCATION', source_id: id }],
  });
}

function legacyClaimForComponent({ id, paymentKey, dealKey, amount, currency }) {
  return legacyOwnerFact({
    id: `OUTGOING_FACT:${id}`,
    payment_key: paymentKey,
    lines: [{ deal_key: dealKey, amount, currency, amount_status: 'EXACT' }],
    scope_deal_keys: [dealKey],
    business_scope_refs: [`LEGACY:${id}`],
    authority_refs: [{ source_type: 'OWNER_OUTGOING_PAYMENT_FACT', source_id: id }],
  });
}

function candidateDealSpend({ dealKey, received, components }) {
  const payments = [];
  const reconciliations = new Map();
  const resourceChains = [];

  components.forEach((component, index) => {
    const paymentKey = `${dealKey}-payment-${index + 1}`;
    const paymentId = `${dealKey}-OUT-${index + 1}`;
    const allocationId = `${dealKey}-allocation-${index + 1}`;
    const financeId = `${dealKey}-finance-${index + 1}`;
    const currentPayment = payment({
      payment_key: paymentKey,
      payment_id: paymentId,
      amount: component.nativeAmount,
      currency: component.nativeCurrency,
    });
    const finance = exactClaimForComponent({ id: financeId, paymentKey, dealKey, amount: component.nativeAmount, currency: component.nativeCurrency });
    const allocationClaim = allocationClaimForComponent({ id: allocationId, paymentKey, dealKey, amount: component.nativeAmount, currency: component.nativeCurrency });
    const legacy = legacyClaimForComponent({ id: `${dealKey}-legacy-${index + 1}`, paymentKey, dealKey, amount: component.nativeAmount, currency: component.nativeCurrency });
    const physical = physicalAllocation({
      id: allocationId,
      payment_key: paymentKey,
      deal_key: dealKey,
      amount: component.nativeAmount,
      currency: component.nativeCurrency,
      authority_refs: [{ source_type: 'PAYMENT_ALLOCATION', source_id: allocationId }],
    });
    const rec = reconcilePaymentEvent(currentPayment, [legacy, allocationClaim, finance], [physical], { paymentBusinessAuthority: true }, [dealKey]);
    assert.equal(rec.status, 'AUTHORITATIVE');
    assert.equal(rec.materialization_status, 'ALIGNED');
    assert.equal(rec.current_authority_id, financeId);
    payments.push(currentPayment);
    reconciliations.set(paymentKey, rec);
    resourceChains.push({
      id: `${dealKey}-chain-${index + 1}`,
      payment_key: paymentKey,
      deal_key: dealKey,
      native_amount: component.nativeAmount,
      native_currency: component.nativeCurrency,
      accounting_amount: component.accountingAmount,
      accounting_currency: 'USD',
      current: true,
      source_locked: true,
      authority_state: 'AUTHORITATIVE',
      lifecycle_state: 'CURRENT',
      authority_refs: [{ source_type: 'BANK_ACTUAL_RESOURCE_CHAIN', source_id: `${dealKey}-chain-${index + 1}` }],
    });
  });

  const spend = computeDealSpend({
    dealKey,
    accountingCurrency: 'USD',
    payments,
    reconciliations,
    resourceChains,
    capability: true,
  });
  assert.equal(spend.status, 'AUTHORITATIVE');
  return { spend: spend.value.amount, remaining: decimalToString(decimalSub(received, spend.value.amount)) };
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

test('Finance EXACT plus matching physical PAYMENT_ALLOCATION uses Finance authority and reports ALIGNED materialization', () => {
  const normalized = normalizedFinance();
  const allocation = paymentAllocationClaim();
  const physical = physicalAllocation();
  const resolved = resolveAuthorityClaims([allocation, normalized], stableAttributionSignature);
  assert.equal(resolved.status, 'AUTHORITATIVE');
  assert.equal(resolved.claim.id, normalized.id);
  assert.deepEqual(resolved.claims.map((claim) => claim.id), [normalized.id]);
  assert.ok(resolved.authority_refs.some((ref) => ref.source_type === 'PAYMENT_ALLOCATION'));

  const rec = reconcilePaymentEvent(payment(), [allocation, normalized], [physical], { paymentBusinessAuthority: true }, ['deal-a']);
  assert.equal(rec.status, 'AUTHORITATIVE');
  assert.equal(rec.materialization_status, 'ALIGNED');
  assert.equal(rec.current_authority_id, normalized.id);
  assert.ok(rec.authority_refs.some((ref) => ref.source_type === 'PAYMENT_ALLOCATION'));
});

test('Finance EXACT plus conflicting physical allocation keeps Finance authority but reports stale materialization gap', () => {
  const normalized = normalizedFinance();
  const allocation = paymentAllocationClaim({
    id: 'PAYMENT_ALLOCATION_SET:allocation-conflict',
    lines: [{ deal_key: 'deal-b', amount: '100', currency: 'USD', amount_status: 'EXACT', materialization_id: 'allocation-conflict' }],
    scope_deal_keys: ['deal-b'],
    authority_ref: { source_type: 'PAYMENT_ALLOCATION', source_id: 'allocation-conflict' },
    authority_identity_refs: [{ source_type: 'PAYMENT_ALLOCATION', source_id: 'allocation-conflict' }],
    authority_refs: [{ source_type: 'PAYMENT_ALLOCATION', source_id: 'allocation-conflict' }],
  });
  const physical = physicalAllocation({
    id: 'allocation-conflict',
    deal_key: 'deal-b',
    authority_refs: [{ source_type: 'PAYMENT_ALLOCATION', source_id: 'allocation-conflict' }],
  });
  const rec = reconcilePaymentEvent(payment(), [allocation, normalized], [physical], { paymentBusinessAuthority: true }, ['deal-a', 'deal-b']);
  assert.equal(rec.status, 'AUTHORITATIVE');
  assert.equal(rec.current_authority_id, normalized.id);
  assert.equal(rec.materialization_status, 'STALE_SUPERSEDED_MATERIALIZATION');
  assert.ok(rec.authority_refs.some((ref) => ref.source_type === 'PAYMENT_ALLOCATION'));
});

test('two conflicting normalized current exact Finance authorities remain TO_VERIFY even with physical allocation present', () => {
  const first = normalizedFinance({ id: 'normalized-a' });
  const second = normalizedFinance({
    id: 'normalized-b',
    lines: [{ deal_key: 'deal-b', amount: '100', currency: 'USD', amount_status: 'EXACT' }],
    scope_deal_keys: ['deal-b'],
    business_scope_refs: ['FINANCE_EVENT:normalized-b'],
    authority_refs: [{ source_type: 'FINANCE_AI', source_id: 'normalized-b' }],
  });
  const allocation = paymentAllocationClaim();
  const resolved = resolveAuthorityClaims([legacyOwnerFact(), allocation, first, second], stableAttributionSignature);
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

test('payment-allocation-only authority keeps previous behavior', () => {
  const allocation = paymentAllocationClaim();
  const physical = physicalAllocation();
  const resolved = resolveAuthorityClaims([allocation], stableAttributionSignature);
  assert.equal(resolved.status, 'AUTHORITATIVE');
  assert.equal(resolved.claim.id, allocation.id);
  const rec = reconcilePaymentEvent(payment(), [allocation], [physical], { paymentBusinessAuthority: true }, ['deal-a']);
  assert.equal(rec.status, 'AUTHORITATIVE');
  assert.equal(rec.current_authority_id, allocation.id);
  assert.equal(rec.materialization_status, 'ALIGNED');
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

test('DEAL-004/005/006 candidate spend and remaining execution stay exact under Finance-over-materialization precedence', () => {
  const deal004 = candidateDealSpend({
    dealKey: 'DEAL-2026-004',
    received: '236250',
    components: [
      { nativeAmount: '8484210', nativeCurrency: 'RUB', accountingAmount: '103026.23' },
      { nativeAmount: '3000', nativeCurrency: 'RUB', accountingAmount: '36.43' },
      { nativeAmount: '20000', nativeCurrency: 'KZT', accountingAmount: '43.20' },
      { nativeAmount: '25444800', nativeCurrency: 'KZT', accountingAmount: '54956.37' },
      { nativeAmount: '3000', nativeCurrency: 'RUB', accountingAmount: '36.43' },
      { nativeAmount: '5899358.9', nativeCurrency: 'RUB', accountingAmount: '71637.63' },
    ],
  });
  assert.equal(decimalCompare(deal004.spend, '229736.29'), 0);
  assert.equal(decimalCompare(deal004.remaining, '6513.71'), 0);

  const deal005 = candidateDealSpend({
    dealKey: 'DEAL-2026-005',
    received: '201750',
    components: [
      { nativeAmount: '2400', nativeCurrency: 'RUB', accountingAmount: '29.52' },
      { nativeAmount: '13229568', nativeCurrency: 'RUB', accountingAmount: '162708.48' },
    ],
  });
  assert.equal(decimalCompare(deal005.spend, '162738.00'), 0);
  assert.equal(decimalCompare(deal005.remaining, '39012.00'), 0);

  const deal006 = candidateDealSpend({
    dealKey: 'DEAL-2026-006',
    received: '49320',
    components: [
      { nativeAmount: '3307392', nativeCurrency: 'RUB', accountingAmount: '40677.12' },
      { nativeAmount: '600', nativeCurrency: 'RUB', accountingAmount: '7.38' },
    ],
  });
  assert.equal(decimalCompare(deal006.spend, '40684.50'), 0);
  assert.equal(decimalCompare(deal006.remaining, '8635.50'), 0);
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
