import { resolveAuthorityClaims, stableFinanceSignature } from './authority.mjs';
import { authorityRef, moneyValue, toVerifyMoney } from './money.mjs';

export function resolveDealFinanceAuthority(dealKey, financeAuthorities = [], capability = true) {
  const claims = financeAuthorities.filter((claim) => String(claim.deal_key) === String(dealKey));
  const resolved = resolveAuthorityClaims(claims, stableFinanceSignature);
  if (resolved.status === 'TO_VERIFY') return financeToVerify('AUTHORITY_CONFLICT', resolved.authority_refs);
  if (resolved.status === 'MISSING') return financeToVerify(capability ? 'NO_CURRENT_FINANCE_AUTHORITY' : 'AUTHORITY_MATERIALIZATION_REQUIRED', []);
  const claim = resolved.claim; const refs = resolved.authority_refs.length ? resolved.authority_refs : [authorityRef(claim)];
  const normalize = (value, field) => {
    if (!value || value.amount === null || !value.currency || value.status !== 'AUTHORITATIVE') return toVerifyMoney(value?.currency || null, `FINANCE_${field.toUpperCase()}_TO_VERIFY`, refs);
    return moneyValue(value.amount, value.currency, 'AUTHORITATIVE', null, refs);
  };
  return {
    status: 'AUTHORITATIVE', reason: null,
    total_to_receive: normalize(claim.total_to_receive, 'total_to_receive'), due_now: normalize(claim.due_now, 'due_now'),
    expected_not_due: normalize(claim.expected_not_due, 'expected_not_due'), future_conditional: normalize(claim.future_conditional, 'future_conditional'),
    finance_status: claim.finance_status || 'TO_VERIFY', documentary_status: claim.documentary_status || 'TO_VERIFY',
    contractual_payment_currency: claim.contractual_payment_currency || null, mixed_inbound_accounting_currency: claim.mixed_inbound_accounting_currency || null,
    authority_state: claim.authority_state || null, lifecycle_state: claim.lifecycle_state || null, effective_at: claim.effective_at || null,
    version: claim.source_version || null, supersedes_id: claim.supersedes_id || null, authority_refs: refs,
  };
}
function financeToVerify(reason, refs) {
  return { status: 'TO_VERIFY', reason, total_to_receive: toVerifyMoney(null, reason, refs), due_now: toVerifyMoney(null, reason, refs), expected_not_due: toVerifyMoney(null, reason, refs), future_conditional: toVerifyMoney(null, reason, refs), finance_status: 'TO_VERIFY', documentary_status: 'TO_VERIFY', contractual_payment_currency: null, mixed_inbound_accounting_currency: null, authority_state: null, lifecycle_state: null, effective_at: null, version: null, supersedes_id: null, authority_refs: refs };
}

export function normalizeFinanceSourceRecordV1(record) {
  return normalizeFinanceAdapterEnvelope(record, { total: 'total_to_receive', due: 'due_now', expected: 'expected_not_due', future: 'future_conditional', currency: 'contractual_payment_currency' });
}
export function normalizeFinanceSourceRecordV2(record) {
  return normalizeFinanceAdapterEnvelope(record, { total: ['obligation', 'total'], due: ['buckets', 'due_now'], expected: ['buckets', 'expected_not_due'], future: ['buckets', 'future_conditional'], currency: ['currency', 'contractual'] });
}
function getPath(object, path) { return Array.isArray(path) ? path.reduce((value, key) => value?.[key], object) : object?.[path]; }
function normalizeFinanceAdapterEnvelope(record, paths) {
  const payload = record?.payload || {}; const total = getPath(payload, paths.total); const due = getPath(payload, paths.due); const expected = getPath(payload, paths.expected); const future = getPath(payload, paths.future); const currency = getPath(payload, paths.currency); const refs = [authorityRef(record)];
  const mv = (amount) => amount === undefined || amount === null || !currency ? toVerifyMoney(currency || null, 'SOURCE_SCHEMA_FIELD_MISSING', refs) : moneyValue(String(amount), String(currency).toUpperCase(), 'AUTHORITATIVE', null, refs);
  return {
    id: String(record.record_id || record.id), deal_key: String(record.deal_key || payload.deal_key), total_to_receive: mv(total), due_now: mv(due), expected_not_due: mv(expected), future_conditional: mv(future),
    finance_status: payload.finance_status || record.finance_status || 'OPEN', documentary_status: payload.documentary_status || record.documentary_status || 'TO_VERIFY', contractual_payment_currency: currency ? String(currency).toUpperCase() : null,
    mixed_inbound_accounting_currency: payload.mixed_inbound_accounting_currency || null, current: record.current !== false, source_locked: record.source_locked !== false, qa_only: record.qa_only === true,
    authority_state: record.authority_state || 'AUTHORITATIVE', lifecycle_state: record.lifecycle_state || 'CURRENT', effective_at: record.effective_at || record.created_at || null,
    supersedes_id: record.supersedes_id ? String(record.supersedes_id) : null, supersedes_authority_refs: Array.isArray(record.supersedes_authority_refs) ? record.supersedes_authority_refs : [],
    source_version: record.source_version || String(record.version || ''), source_timestamp: record.source_timestamp || record.created_at || null, authority_refs: refs,
  };
}
