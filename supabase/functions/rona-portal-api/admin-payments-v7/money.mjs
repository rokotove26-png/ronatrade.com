import { decimalToString, parseDecimal } from './decimal.mjs';

export function authorityRef(source = {}) {
  return {
    source_type: source.source_type || source.authority_kind || source.source_system || 'UNKNOWN',
    source_id: source.source_id || source.id || null,
    source_version: source.source_version || source.version || null,
    source_timestamp: source.source_timestamp || source.effective_at || source.created_at || null,
    authority_state: source.authority_state || null,
    lifecycle_state: source.lifecycle_state || null,
  };
}

export function moneyValue(amount, currency, status = 'AUTHORITATIVE', reason = null, authorityRefs = []) {
  return {
    amount: amount === null || amount === undefined ? null : decimalToString(parseDecimal(String(amount))),
    currency: currency || null,
    status,
    reason,
    authority_refs: authorityRefs,
  };
}

export function toVerifyMoney(currency = null, reason = 'TO_VERIFY', authorityRefs = []) {
  return moneyValue(null, currency, 'TO_VERIFY', reason, authorityRefs);
}

export function notApplicableMoney(reason = 'NOT_APPLICABLE', authorityRefs = []) {
  return moneyValue(null, null, 'NOT_APPLICABLE', reason, authorityRefs);
}
