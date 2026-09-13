import { resolveAuthorityClaims, stableAttributionSignature } from './authority.mjs';
import { canonicalDecimalString, decimalAdd, decimalCompare, decimalToString, parseDecimal } from './decimal.mjs';

function upper(value) { return value === null || value === undefined ? null : String(value).trim().toUpperCase(); }
function unique(values) { return [...new Set((values || []).filter(Boolean).map(String))]; }
function rawExactLines(claim) { return (claim?.lines || []).filter((line) => upper(line.amount_status || 'EXACT') === 'EXACT'); }

export function validateAttributionIntegrity({ payment, claim, validDealKeys = [] }) {
  const raw = rawExactLines(claim);
  if (!raw.length) return { status: 'NOT_APPLICABLE', reason: null, lines: [], allocated_amount: null };
  const valid = new Set((validDealKeys || []).map(String));
  const aggregate = new Map();
  try {
    for (const line of raw) {
      if (!line.deal_key) return { status: 'TO_VERIFY', reason: 'ATTRIBUTION_DEAL_KEY_MISSING', lines: [] };
      const dealKey = String(line.deal_key);
      if (valid.size && !valid.has(dealKey)) return { status: 'TO_VERIFY', reason: 'ATTRIBUTION_DEAL_KEY_INVALID', lines: [] };
      if (line.amount === null || line.amount === undefined) return { status: 'TO_VERIFY', reason: 'ATTRIBUTION_AMOUNT_MISSING', lines: [] };
      const amount = canonicalDecimalString(line.amount);
      if (decimalCompare(amount, '0') <= 0) return { status: 'TO_VERIFY', reason: 'ATTRIBUTION_AMOUNT_NON_POSITIVE', lines: [] };
      const currency = upper(line.currency);
      if (!currency || currency !== upper(payment.currency)) return { status: 'TO_VERIFY', reason: 'ATTRIBUTION_CURRENCY_MISMATCH', lines: [] };
      const previous = aggregate.get(dealKey);
      aggregate.set(dealKey, previous ? decimalToString(decimalAdd(previous, amount)) : amount);
    }
    const lines = [...aggregate.entries()].map(([deal_key, amount]) => ({ deal_key, amount: canonicalDecimalString(amount), currency: upper(payment.currency), amount_status: 'EXACT' })).sort((a, b) => a.deal_key.localeCompare(b.deal_key));
    let allocated = parseDecimal('0');
    for (const line of lines) allocated = decimalAdd(allocated, line.amount);
    const allocatedAmount = decimalToString(allocated);
    if (decimalCompare(allocatedAmount, canonicalDecimalString(payment.amount)) !== 0) return { status: 'TO_VERIFY', reason: 'ATTRIBUTION_AMOUNT_COVERAGE_MISMATCH', lines: [], allocated_amount: allocatedAmount };
    return { status: 'AUTHORITATIVE', reason: null, lines, allocated_amount: allocatedAmount };
  } catch {
    return { status: 'TO_VERIFY', reason: 'ATTRIBUTION_DECIMAL_INVALID', lines: [] };
  }
}

function canonicalPhysicalLines(rows, paymentCurrency) {
  const aggregate = new Map();
  for (const row of rows) {
    if (!row.deal_key || row.amount === null || row.amount === undefined) continue;
    if (upper(row.currency) !== upper(paymentCurrency)) return null;
    const key = String(row.deal_key); const amount = canonicalDecimalString(row.amount); const previous = aggregate.get(key);
    aggregate.set(key, previous ? decimalToString(decimalAdd(previous, amount)) : amount);
  }
  return [...aggregate.entries()].map(([deal_key, amount]) => ({ deal_key, amount: canonicalDecimalString(amount), currency: upper(paymentCurrency) })).sort((a, b) => a.deal_key.localeCompare(b.deal_key));
}
function sameCanonicalLines(authorityLines, physicalRows, paymentCurrency) {
  const physical = canonicalPhysicalLines(physicalRows, paymentCurrency);
  if (!physical) return false;
  const authority = authorityLines.map((line) => ({ deal_key: String(line.deal_key), amount: canonicalDecimalString(line.amount), currency: upper(line.currency) })).sort((a, b) => a.deal_key.localeCompare(b.deal_key));
  return JSON.stringify(authority) === JSON.stringify(physical);
}
function typedRefKey(ref) {
  if (!ref) return null;
  if (typeof ref === 'string') return ref.includes(':') ? ref : `ID:${ref}`;
  const type = ref.source_type || ref.authority_kind || ref.type || null; const id = ref.source_id || ref.id || null;
  return id ? `${type || 'ID'}:${id}` : null;
}
function explicitlySupersedesPhysical(claim, currentPhysical) {
  const refs = new Set((claim?.supersedes_authority_refs || []).map(typedRefKey).filter(Boolean));
  return currentPhysical.some((row) => refs.has(`PAYMENT_ALLOCATION:${String(row.id)}`));
}
function materializationStatus(payment, claim, canonicalLines, physicalAllocations) {
  if (upper(claim?.disposition || claim?.decision_type) === 'ASSIGN_ADVANCE_PAYMENT') return 'NOT_APPLICABLE';
  const physical = (physicalAllocations || []).filter((row) => String(row.payment_key) === String(payment.payment_key));
  const current = physical.filter((row) => row.current === true && row.source_locked !== false && row.deal_key);
  if (explicitlySupersedesPhysical(claim, current)) return 'STALE_SUPERSEDED_MATERIALIZATION';
  if (!canonicalLines.length) return physical.length ? 'PRESENT_NOT_EXACT_TRUTH' : 'NOT_MATERIALIZED';
  if (current.length && sameCanonicalLines(canonicalLines, current, payment.currency)) return physical.some((row) => row.current !== true && row.deal_key) ? 'ALIGNED_WITH_STALE_HISTORY_PRESENT' : 'ALIGNED';
  if (!physical.length) return 'NOT_MATERIALIZED';
  return 'STALE_SUPERSEDED_MATERIALIZATION';
}

function classifyResolvedClaim(claim, canonicalLines) {
  const classification = upper(claim?.classification); const disposition = upper(claim?.disposition || claim?.decision_type);
  const scope = unique([...(claim?.scope_deal_keys || []), ...canonicalLines.map((line) => line.deal_key)]);
  if (disposition === 'ASSIGN_ADVANCE_PAYMENT') return { reconciliationClass: 'RESOLVED', businessDisposition: 'ASSIGN_ADVANCE_PAYMENT', scope };
  if (classification === 'OWNER_ASSERTED_ALLOCATED_SYSTEM_AUTHORITY_NOT_MATERIALIZED') return { reconciliationClass: classification, businessDisposition: disposition || null, scope };
  if (classification === 'ASSOCIATED_BANK_FEE') return { reconciliationClass: classification, businessDisposition: disposition || 'BIND_TO_DEAL', scope };
  if (classification === 'SHARED_DEAL_SCOPE_SPLIT_TO_VERIFY' || (scope.length && !canonicalLines.length)) return { reconciliationClass: 'SHARED_DEAL_SCOPE_SPLIT_TO_VERIFY', businessDisposition: disposition || null, scope };
  if (canonicalLines.length > 1) return { reconciliationClass: 'KNOWN_MULTI_DEAL_EXACT_SPLIT', businessDisposition: disposition || 'BIND_TO_DEAL', scope };
  if (canonicalLines.length === 1) return { reconciliationClass: 'RESOLVED', businessDisposition: disposition || 'BIND_TO_DEAL', scope };
  return { reconciliationClass: classification || 'AUTHORITY_MATERIALIZATION_REQUIRED', businessDisposition: disposition || null, scope };
}
function reconciliationBase(payment) { return { payment_key: String(payment.payment_key), payment_id: payment.payment_id, owner_action_required: false, allowed_owner_actions: [], current_lines: [], scope_deal_keys: [], business_scope_refs: [], authority_refs: payment.authority_refs || [] }; }

export function reconcilePaymentEvent(payment, allClaims, physicalAllocations, capabilities = {}, validDealKeys = []) {
  const base = reconciliationBase(payment);
  if (upper(payment.kind) === 'FX_CONVERSION') return { ...base, reconciliation_class: 'FX_CONVERSION_NOT_APPLICABLE', status: 'AUTHORITATIVE', reason: null, integrity_status: 'NOT_APPLICABLE', materialization_status: 'NOT_APPLICABLE', business_disposition: 'NOT_APPLICABLE', fee_attribution_state: null, current_authority_id: null };
  const paymentKey = String(payment.payment_key); const claims = (allClaims || []).filter((claim) => String(claim.payment_key) === paymentKey); const resolved = resolveAuthorityClaims(claims, stableAttributionSignature); const claim = resolved.claim;
  if (resolved.status === 'TO_VERIFY') {
    const candidateDealKeys = unique(claims.flatMap((c) => [...(c.scope_deal_keys || []), ...(c.lines || []).map((line) => line.deal_key)]));
    const businessScopeRefs = unique(claims.flatMap((c) => c.business_scope_refs || []));
    return { ...base, reconciliation_class: 'AUTHORITY_CONFLICT', status: 'TO_VERIFY', reason: 'AUTHORITY_CONFLICT', integrity_status: 'TO_VERIFY', scope_deal_keys: candidateDealKeys, business_scope_refs: businessScopeRefs, materialization_status: 'AUTHORITY_CONFLICT', business_disposition: null, fee_attribution_state: null, authority_refs: [...base.authority_refs, ...resolved.authority_refs], current_authority_id: null };
  }
  if (!claim) {
    const hasKnownCandidateScope = (payment.candidate_deal_ids || []).length > 0;
    const capabilityPresent = capabilities.paymentBusinessAuthority === true;
    const explicitUnallocated = ['UNALLOCATED', 'GENUINELY_UNALLOCATED'].includes(upper(payment.allocation_review_status));
    const classification = capabilityPresent && !hasKnownCandidateScope && explicitUnallocated ? 'GENUINELY_UNALLOCATED' : 'AUTHORITY_MATERIALIZATION_REQUIRED';
    return { ...base, reconciliation_class: classification, status: classification === 'GENUINELY_UNALLOCATED' ? 'AUTHORITATIVE' : 'TO_VERIFY', reason: classification === 'GENUINELY_UNALLOCATED' ? null : 'AUTHORITY_MATERIALIZATION_REQUIRED', integrity_status: 'NOT_APPLICABLE', owner_action_required: classification === 'GENUINELY_UNALLOCATED', allowed_owner_actions: classification === 'GENUINELY_UNALLOCATED' ? ['BIND_TO_DEAL', 'ASSIGN_ADVANCE_PAYMENT'] : [], scope_deal_keys: unique(payment.candidate_deal_ids || []), materialization_status: 'NO_CURRENT_BUSINESS_AUTHORITY', business_disposition: null, fee_attribution_state: null, current_authority_id: null };
  }
  const businessScopeRefs = unique(claim.business_scope_refs || []);
  const disposition = upper(claim.disposition || claim.decision_type);
  if (disposition === 'ASSIGN_ADVANCE_PAYMENT') return { ...base, reconciliation_class: 'RESOLVED', status: 'AUTHORITATIVE', reason: null, integrity_status: 'NOT_APPLICABLE', scope_deal_keys: [], business_scope_refs: businessScopeRefs, materialization_status: 'NOT_APPLICABLE', business_disposition: 'ASSIGN_ADVANCE_PAYMENT', fee_attribution_state: null, authority_refs: [...base.authority_refs, ...resolved.authority_refs], current_authority_id: claim.id || null };
  const integrity = validateAttributionIntegrity({ payment, claim, validDealKeys }); const hasExactLines = rawExactLines(claim).length > 0;
  if (hasExactLines && integrity.status !== 'AUTHORITATIVE') return { ...base, reconciliation_class: 'ATTRIBUTION_INTEGRITY_ERROR', status: 'TO_VERIFY', reason: 'ATTRIBUTION_INTEGRITY_ERROR', integrity_status: 'TO_VERIFY', integrity_reason: integrity.reason, scope_deal_keys: unique([...(claim.scope_deal_keys || []), ...(claim.lines || []).map((line) => line.deal_key)]), business_scope_refs: businessScopeRefs, materialization_status: 'NOT_EVALUATED_INTEGRITY_ERROR', business_disposition: disposition || null, fee_attribution_state: upper(claim.classification) === 'ASSOCIATED_BANK_FEE' ? 'TO_VERIFY' : null, authority_refs: [...base.authority_refs, ...resolved.authority_refs], current_authority_id: claim.id || null };
  const canonicalLines = integrity.status === 'AUTHORITATIVE' ? integrity.lines : []; const classified = classifyResolvedClaim(claim, canonicalLines);
  const materialization = classified.reconciliationClass === 'ASSOCIATED_BANK_FEE' && !canonicalLines.length ? 'ATTRIBUTION_TO_VERIFY' : materializationStatus(payment, claim, canonicalLines, physicalAllocations || []);
  let status = 'AUTHORITATIVE'; let reason = null; let feeAttributionState = null;
  if (classified.reconciliationClass === 'SHARED_DEAL_SCOPE_SPLIT_TO_VERIFY') { status = 'TO_VERIFY'; reason = 'EXACT_SPLIT_TO_VERIFY'; }
  if (classified.reconciliationClass === 'OWNER_ASSERTED_ALLOCATED_SYSTEM_AUTHORITY_NOT_MATERIALIZED') { status = 'TO_VERIFY'; reason = 'SYSTEM_AUTHORITY_NOT_MATERIALIZED'; }
  if (classified.reconciliationClass === 'ASSOCIATED_BANK_FEE') {
    if (canonicalLines.length) feeAttributionState = 'EXACT'; else if (upper(payment.allocation_applicability) === 'NOT_APPLICABLE') feeAttributionState = 'NOT_APPLICABLE'; else if (classified.scope.length) feeAttributionState = 'SHARED_SCOPE'; else feeAttributionState = 'TO_VERIFY';
    if (feeAttributionState === 'SHARED_SCOPE' || feeAttributionState === 'TO_VERIFY') { status = 'TO_VERIFY'; reason = 'FEE_ATTRIBUTION_TO_VERIFY'; }
  }
  if (classified.reconciliationClass === 'AUTHORITY_MATERIALIZATION_REQUIRED') { status = 'TO_VERIFY'; reason = 'AUTHORITY_MATERIALIZATION_REQUIRED'; }
  return { ...base, reconciliation_class: classified.reconciliationClass, status, reason, integrity_status: canonicalLines.length ? 'AUTHORITATIVE' : 'NOT_APPLICABLE', current_lines: canonicalLines, scope_deal_keys: classified.scope, business_scope_refs: businessScopeRefs, materialization_status: materialization, business_disposition: classified.businessDisposition, principal_payment_key: claim.principal_payment_key || null, fee_attribution_state: feeAttributionState, authority_refs: [...base.authority_refs, ...resolved.authority_refs], current_authority_id: claim.id || null };
}

export function reconcileAllPayments(payments, attributionClaims, physicalAllocations, capabilities, validDealKeys = []) { return (payments || []).map((payment) => reconcilePaymentEvent(payment, attributionClaims, physicalAllocations, capabilities, validDealKeys)); }
export function validateExactAllocationCoverage(payment, reconciliation) {
  if (reconciliation.integrity_status === 'AUTHORITATIVE') { let allocated = parseDecimal('0'); for (const line of reconciliation.current_lines || []) allocated = decimalAdd(allocated, line.amount); return { status: 'AUTHORITATIVE', reason: null, allocated_amount: decimalToString(allocated) }; }
  if (!(reconciliation.current_lines || []).length) return { status: 'NOT_APPLICABLE', reason: reconciliation.integrity_reason || null };
  return { status: 'TO_VERIFY', reason: reconciliation.integrity_reason || 'ATTRIBUTION_INTEGRITY_ERROR' };
}
