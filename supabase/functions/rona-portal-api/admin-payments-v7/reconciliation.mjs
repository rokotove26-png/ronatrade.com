import { resolveAuthorityClaims, stableAttributionSignature } from './authority.mjs';
import { decimalCompare, decimalSum, decimalToString } from './decimal.mjs';

function upper(value) { return value === null || value === undefined ? null : String(value).toUpperCase(); }

function exactLines(claim) {
  return (claim?.lines || []).filter((line) => upper(line.amount_status || 'EXACT') === 'EXACT' && line.deal_key && line.amount !== null && line.amount !== undefined);
}

function unique(values) { return [...new Set(values.filter(Boolean).map(String))]; }

function sameExactLines(authorityLines, physicalRows) {
  const sig = (rows, isPhysical) => rows.map((row) => ({
    deal_key: String(row.deal_key),
    amount: String(isPhysical ? row.amount : row.amount),
    currency: row.currency || null,
  })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return JSON.stringify(sig(authorityLines, false)) === JSON.stringify(sig(physicalRows, true));
}

function materializationStatus(paymentKey, claim, physicalAllocations) {
  const physical = physicalAllocations.filter((row) => String(row.payment_key) === String(paymentKey));
  const current = physical.filter((row) => row.current === true && row.deal_key);
  const winnerLines = exactLines(claim);
  if (!winnerLines.length) return physical.length ? 'PRESENT_NOT_EXACT_TRUTH' : 'NOT_MATERIALIZED';
  if (sameExactLines(winnerLines, current)) {
    const staleAlsoPresent = physical.some((row) => !row.current && row.deal_key);
    return staleAlsoPresent ? 'ALIGNED_WITH_STALE_HISTORY_PRESENT' : 'ALIGNED';
  }
  if (!physical.length) return 'NOT_MATERIALIZED';
  return 'STALE_SUPERSEDED_MATERIALIZATION';
}

function classifyClaim(claim) {
  const disposition = upper(claim?.disposition);
  const classification = upper(claim?.classification);
  const lines = exactLines(claim);
  const scope = unique([...(claim?.scope_deal_keys || []), ...lines.map((line) => line.deal_key)]);
  if (disposition === 'ASSIGN_ADVANCE_PAYMENT') return 'ADVANCE_PAYMENT_ASSIGNED';
  if (classification === 'OWNER_ASSERTED_ALLOCATED_SYSTEM_AUTHORITY_NOT_MATERIALIZED') return classification;
  if (classification === 'ASSOCIATED_BANK_FEE') return classification;
  if (classification === 'SHARED_DEAL_SCOPE_SPLIT_TO_VERIFY' || (scope.length && !lines.length)) return 'SHARED_DEAL_SCOPE_SPLIT_TO_VERIFY';
  if (lines.length > 1) return 'KNOWN_MULTI_DEAL_EXACT_SPLIT';
  if (lines.length === 1) return 'RESOLVED';
  return classification || 'AUTHORITY_MATERIALIZATION_REQUIRED';
}

export function reconcilePaymentEvent(payment, allClaims, physicalAllocations, capabilities = {}) {
  const paymentKey = String(payment.payment_key);
  if (upper(payment.kind) === 'FX_CONVERSION' || upper(payment.allocation_applicability) === 'NOT_APPLICABLE') {
    return {
      payment_key: paymentKey,
      payment_id: payment.payment_id,
      reconciliation_class: 'FX_CONVERSION_NOT_APPLICABLE',
      status: 'AUTHORITATIVE',
      reason: null,
      owner_action_required: false,
      allowed_owner_actions: [],
      current_lines: [],
      scope_deal_keys: [],
      materialization_status: 'NOT_APPLICABLE',
      business_disposition: 'NOT_APPLICABLE',
      authority_refs: payment.authority_refs || [],
    };
  }

  const claims = (allClaims || []).filter((claim) => String(claim.payment_key) === paymentKey);
  const resolved = resolveAuthorityClaims(claims, stableAttributionSignature);
  const candidateDealKeys = unique(claims.flatMap((claim) => [
    ...(claim.scope_deal_keys || []),
    ...(claim.lines || []).map((line) => line.deal_key),
  ]));

  if (resolved.status === 'TO_VERIFY') {
    return {
      payment_key: paymentKey,
      payment_id: payment.payment_id,
      reconciliation_class: 'AUTHORITY_CONFLICT',
      status: 'TO_VERIFY',
      reason: 'AUTHORITY_CONFLICT',
      owner_action_required: false,
      allowed_owner_actions: [],
      current_lines: [],
      scope_deal_keys: candidateDealKeys,
      materialization_status: 'AUTHORITY_CONFLICT',
      business_disposition: null,
      authority_refs: [...(payment.authority_refs || []), ...resolved.authority_refs],
    };
  }

  if (resolved.status === 'MISSING') {
    const hasKnownCandidateScope = (payment.candidate_deal_ids || []).length > 0;
    const capabilityPresent = capabilities.paymentBusinessAuthority === true;
    const classification = capabilityPresent && !hasKnownCandidateScope
      ? 'GENUINELY_UNALLOCATED'
      : 'AUTHORITY_MATERIALIZATION_REQUIRED';
    return {
      payment_key: paymentKey,
      payment_id: payment.payment_id,
      reconciliation_class: classification,
      status: classification === 'GENUINELY_UNALLOCATED' ? 'AUTHORITATIVE' : 'TO_VERIFY',
      reason: classification === 'GENUINELY_UNALLOCATED' ? null : 'AUTHORITY_MATERIALIZATION_REQUIRED',
      owner_action_required: classification === 'GENUINELY_UNALLOCATED',
      allowed_owner_actions: classification === 'GENUINELY_UNALLOCATED' ? ['BIND_TO_DEAL', 'ASSIGN_ADVANCE_PAYMENT'] : [],
      current_lines: [],
      scope_deal_keys: unique(payment.candidate_deal_ids || []),
      materialization_status: 'NO_CURRENT_BUSINESS_AUTHORITY',
      business_disposition: null,
      authority_refs: payment.authority_refs || [],
    };
  }

  const claim = resolved.claim;
  const lines = exactLines(claim);
  const scope = unique([...(claim.scope_deal_keys || []), ...lines.map((line) => line.deal_key)]);
  const reconciliationClass = classifyClaim(claim);
  return {
    payment_key: paymentKey,
    payment_id: payment.payment_id,
    reconciliation_class: reconciliationClass,
    status: ['SHARED_DEAL_SCOPE_SPLIT_TO_VERIFY', 'OWNER_ASSERTED_ALLOCATED_SYSTEM_AUTHORITY_NOT_MATERIALIZED', 'ASSOCIATED_BANK_FEE'].includes(reconciliationClass) ? 'TO_VERIFY' : 'AUTHORITATIVE',
    reason: reconciliationClass === 'SHARED_DEAL_SCOPE_SPLIT_TO_VERIFY' ? 'EXACT_SPLIT_TO_VERIFY'
      : reconciliationClass === 'OWNER_ASSERTED_ALLOCATED_SYSTEM_AUTHORITY_NOT_MATERIALIZED' ? 'SYSTEM_AUTHORITY_NOT_MATERIALIZED'
      : reconciliationClass === 'ASSOCIATED_BANK_FEE' && !lines.length ? 'FEE_ATTRIBUTION_TO_VERIFY'
      : null,
    owner_action_required: false,
    allowed_owner_actions: [],
    current_lines: lines,
    scope_deal_keys: scope,
    materialization_status: materializationStatus(paymentKey, claim, physicalAllocations || []),
    business_disposition: upper(claim.disposition) || 'BIND_TO_DEAL',
    principal_payment_key: claim.principal_payment_key || null,
    authority_refs: [...(payment.authority_refs || []), ...resolved.authority_refs],
  };
}

export function reconcileAllPayments(payments, attributionClaims, physicalAllocations, capabilities) {
  return payments.map((payment) => reconcilePaymentEvent(payment, attributionClaims, physicalAllocations, capabilities));
}

export function validateExactAllocationCoverage(payment, reconciliation) {
  if (!reconciliation.current_lines.length) return { status: 'NOT_APPLICABLE', reason: null };
  const currencies = unique(reconciliation.current_lines.map((line) => line.currency));
  if (currencies.length !== 1 || currencies[0] !== payment.currency) return { status: 'TO_VERIFY', reason: 'ALLOCATION_CURRENCY_MISMATCH' };
  const allocated = decimalSum(reconciliation.current_lines.map((line) => line.amount));
  if (decimalCompare(allocated, payment.amount) !== 0) {
    return { status: 'TO_VERIFY', reason: 'ALLOCATION_AMOUNT_COVERAGE_MISMATCH', allocated_amount: decimalToString(allocated) };
  }
  return { status: 'AUTHORITATIVE', reason: null, allocated_amount: decimalToString(allocated) };
}
