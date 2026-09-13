import { canonicalDecimalString } from './decimal.mjs';
import { authorityRef } from './money.mjs';

const INELIGIBLE_LIFECYCLE = new Set(['SUPERSEDED', 'REVERSED', 'REJECTED', 'CANCELLED', 'INACTIVE', 'ARCHIVED']);
const INELIGIBLE_AUTHORITY = new Set(['REJECTED', 'REVERSED', 'INVALID', 'INACTIVE', 'SUPERSEDED']);

function upper(value) { return value === null || value === undefined ? null : String(value).trim().toUpperCase(); }

export function isEligibleAuthorityClaim(claim) {
  if (!claim || claim.qa_only === true || claim.rejected === true || claim.reversed === true) return false;
  if (claim.current === false || claim.source_locked === false) return false;
  if (claim.lifecycle_state && INELIGIBLE_LIFECYCLE.has(upper(claim.lifecycle_state))) return false;
  if (claim.authority_state && INELIGIBLE_AUTHORITY.has(upper(claim.authority_state))) return false;
  return true;
}

function typedRefKey(ref) {
  if (!ref) return null;
  if (typeof ref === 'string') return ref.includes(':') ? ref : `ID:${ref}`;
  const type = ref.source_type || ref.authority_kind || ref.type || null;
  const id = ref.source_id || ref.id || null;
  return id ? `${type || 'ID'}:${id}` : null;
}

export function authorityIdentityKeys(claim) {
  const keys = [];
  if (claim?.id) keys.push(`ID:${String(claim.id)}`);
  const typed = typedRefKey(claim?.authority_ref || (claim?.id ? { source_type: claim.authority_kind || claim.source_type || 'AUTHORITY', source_id: claim.id } : null));
  if (typed) keys.push(typed);
  for (const ref of claim?.authority_identity_refs || []) {
    const key = typedRefKey(ref);
    if (key) keys.push(key);
  }
  return [...new Set(keys)];
}

function explicitSupersededKeys(claim) {
  const keys = [];
  if (claim?.supersedes_id) keys.push(`ID:${String(claim.supersedes_id)}`);
  for (const ref of claim?.supersedes_authority_refs || []) {
    const key = typedRefKey(ref);
    if (key) keys.push(key);
    if (ref && typeof ref === 'object' && (ref.source_id || ref.id)) keys.push(`ID:${String(ref.source_id || ref.id)}`);
  }
  return [...new Set(keys)];
}

function transitiveSupersededKeys(claims) {
  const byKey = new Map();
  for (const claim of claims) for (const key of authorityIdentityKeys(claim)) byKey.set(key, claim);
  const superseded = new Set();
  const visit = (key) => {
    if (!key || superseded.has(key)) return;
    superseded.add(key);
    const target = byKey.get(key);
    if (target) for (const previous of explicitSupersededKeys(target)) visit(previous);
  };
  for (const claim of claims) for (const key of explicitSupersededKeys(claim)) visit(key);
  return superseded;
}

export function resolveAuthorityClaims(claims, signatureFn) {
  const eligible = (claims || []).filter(isEligibleAuthorityClaim);
  if (!eligible.length) return { status: 'MISSING', reason: 'NO_ELIGIBLE_AUTHORITY', claim: null, claims: [], authority_refs: [] };
  const superseded = transitiveSupersededKeys(eligible);
  const survivors = eligible.filter((claim) => !authorityIdentityKeys(claim).some((key) => superseded.has(key)));
  if (!survivors.length) return { status: 'MISSING', reason: 'NO_CURRENT_AUTHORITY_AFTER_SUPERSESSION', claim: null, claims: [], authority_refs: [] };
  const signatures = new Map();
  for (const claim of survivors) {
    const signature = signatureFn(claim);
    if (!signatures.has(signature)) signatures.set(signature, []);
    signatures.get(signature).push(claim);
  }
  const refs = survivors.flatMap((claim) => claim.authority_refs?.length ? claim.authority_refs : [authorityRef(claim)]);
  if (signatures.size > 1) return { status: 'TO_VERIFY', reason: 'AUTHORITY_CONFLICT', claim: null, claims: survivors, authority_refs: refs };
  const compatible = [...survivors].sort((a, b) => String(a.id || '').localeCompare(String(b.id || '')));
  return { status: 'AUTHORITATIVE', reason: null, claim: compatible[0], claims: compatible, authority_refs: refs };
}

export function stableAttributionSignature(claim) {
  const lines = [...(claim.lines || [])].map((line) => ({
    deal_key: line.deal_key ? String(line.deal_key) : null,
    amount: line.amount === null || line.amount === undefined ? null : canonicalDecimalString(line.amount),
    currency: line.currency ? upper(line.currency) : null,
    amount_status: upper(line.amount_status || 'EXACT'),
  })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const scope = [...new Set((claim.scope_deal_keys || []).filter(Boolean).map(String))].sort();
  return JSON.stringify({
    classification: upper(claim.classification) || null,
    disposition: upper(claim.disposition || claim.decision_type) || null,
    principal_payment_key: claim.principal_payment_key || null,
    lines,
    scope,
  });
}

export function stableFinanceSignature(claim) {
  const mv = (value) => value ? [value.amount === null || value.amount === undefined ? null : canonicalDecimalString(value.amount), value.currency ? upper(value.currency) : null, value.status || null] : null;
  return JSON.stringify({
    total_to_receive: mv(claim.total_to_receive),
    due_now: mv(claim.due_now),
    expected_not_due: mv(claim.expected_not_due),
    future_conditional: mv(claim.future_conditional),
    finance_status: claim.finance_status || null,
    documentary_status: claim.documentary_status || null,
    contractual_payment_currency: claim.contractual_payment_currency ? upper(claim.contractual_payment_currency) : null,
    mixed_inbound_accounting_currency: claim.mixed_inbound_accounting_currency ? upper(claim.mixed_inbound_accounting_currency) : null,
  });
}
