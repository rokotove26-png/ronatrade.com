import { authorityRef } from './money.mjs';

const INELIGIBLE_LIFECYCLE = new Set(['SUPERSEDED', 'REVERSED', 'REJECTED', 'CANCELLED', 'INACTIVE', 'ARCHIVED']);
const INELIGIBLE_AUTHORITY = new Set(['REJECTED', 'REVERSED', 'INVALID', 'INACTIVE', 'SUPERSEDED']);

export function isEligibleAuthorityClaim(claim) {
  if (!claim || claim.qa_only === true || claim.rejected === true || claim.reversed === true) return false;
  if (claim.current === false || claim.source_locked === false) return false;
  if (claim.lifecycle_state && INELIGIBLE_LIFECYCLE.has(String(claim.lifecycle_state).toUpperCase())) return false;
  if (claim.authority_state && INELIGIBLE_AUTHORITY.has(String(claim.authority_state).toUpperCase())) return false;
  return true;
}

function transitiveSupersededIds(claims) {
  const byId = new Map(claims.filter((c) => c.id).map((c) => [String(c.id), c]));
  const superseded = new Set();
  for (const claim of claims) {
    let cursor = claim.supersedes_id ? String(claim.supersedes_id) : null;
    const seen = new Set();
    while (cursor && !seen.has(cursor)) {
      seen.add(cursor);
      superseded.add(cursor);
      const previous = byId.get(cursor);
      cursor = previous?.supersedes_id ? String(previous.supersedes_id) : null;
    }
  }
  return superseded;
}

export function resolveAuthorityClaims(claims, signatureFn) {
  const eligible = (claims || []).filter(isEligibleAuthorityClaim);
  if (!eligible.length) {
    return { status: 'MISSING', reason: 'NO_ELIGIBLE_AUTHORITY', claim: null, claims: [], authority_refs: [] };
  }
  const superseded = transitiveSupersededIds(eligible);
  const survivors = eligible.filter((claim) => !claim.id || !superseded.has(String(claim.id)));
  if (!survivors.length) {
    return { status: 'MISSING', reason: 'NO_CURRENT_AUTHORITY_AFTER_SUPERSESSION', claim: null, claims: [], authority_refs: [] };
  }
  const signatures = new Map();
  for (const claim of survivors) {
    const signature = signatureFn(claim);
    if (!signatures.has(signature)) signatures.set(signature, []);
    signatures.get(signature).push(claim);
  }
  const refs = survivors.map(authorityRef);
  if (signatures.size > 1) {
    return {
      status: 'TO_VERIFY',
      reason: 'AUTHORITY_CONFLICT',
      claim: null,
      claims: survivors,
      authority_refs: refs,
    };
  }
  const compatible = [...survivors].sort((a, b) => String(a.id || '').localeCompare(String(b.id || '')));
  return {
    status: 'AUTHORITATIVE',
    reason: null,
    claim: compatible[0],
    claims: compatible,
    authority_refs: refs,
  };
}

export function stableAttributionSignature(claim) {
  const lines = [...(claim.lines || [])]
    .map((line) => ({
      deal_key: line.deal_key || null,
      amount: line.amount === null || line.amount === undefined ? null : String(line.amount),
      currency: line.currency || null,
      amount_status: line.amount_status || 'EXACT',
    }))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const scope = [...(claim.scope_deal_keys || [])].map(String).sort();
  return JSON.stringify({
    classification: claim.classification || null,
    disposition: claim.disposition || null,
    principal_payment_key: claim.principal_payment_key || null,
    lines,
    scope,
  });
}

export function stableFinanceSignature(claim) {
  const mv = (value) => value ? [value.amount ?? null, value.currency ?? null, value.status ?? null] : null;
  return JSON.stringify({
    total_to_receive: mv(claim.total_to_receive),
    due_now: mv(claim.due_now),
    expected_not_due: mv(claim.expected_not_due),
    future_conditional: mv(claim.future_conditional),
    finance_status: claim.finance_status || null,
    documentary_status: claim.documentary_status || null,
    contractual_payment_currency: claim.contractual_payment_currency || null,
    mixed_inbound_accounting_currency: claim.mixed_inbound_accounting_currency || null,
  });
}
