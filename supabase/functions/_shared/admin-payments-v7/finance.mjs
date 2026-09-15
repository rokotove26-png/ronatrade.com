import { resolveAuthorityClaims, stableFinanceSignature } from './authority.mjs';
import { decimalAdd, decimalCompare, parseDecimal } from './decimal.mjs';
import { authorityRef, moneyValue, toVerifyMoney } from './money.mjs';

const CURRENCY_RE = /^[A-Z]{3}$/;
function upper(value) { return value === null || value === undefined ? null : String(value).trim().toUpperCase(); }

function validateExecutionMoney(claim, field, statusField) {
  const status = upper(claim?.[statusField] || claim?.[field]?.status);
  if (!status) return { valid: true, present: false, status: null, currency: null };
  if (!['AUTHORITATIVE', 'TO_VERIFY'].includes(status)) return { valid: false, reason: 'FINANCE_EXECUTION_AUTHORITY_INTEGRITY_ERROR' };
  const value = claim?.[field];
  const currency = upper(claim?.execution_currency || value?.currency);
  if (!currency || !CURRENCY_RE.test(currency)) return { valid: false, reason: 'FINANCE_EXECUTION_AUTHORITY_INTEGRITY_ERROR' };
  if (status === 'AUTHORITATIVE') {
    if (!value || value.amount === null || value.amount === undefined) return { valid: false, reason: 'FINANCE_EXECUTION_AUTHORITY_INTEGRITY_ERROR' };
    const amount = parseDecimal(String(value.amount));
    if (field === 'actual_spend' && decimalCompare(amount, '0') < 0) return { valid: false, reason: 'FINANCE_EXECUTION_AUTHORITY_INTEGRITY_ERROR' };
  }
  return { valid: true, present: true, status, currency };
}

export function validateDealFinanceAuthorityIntegrity(claim) {
  try {
    if (!claim || typeof claim !== 'object') return { valid: false, reason: 'FINANCE_AUTHORITY_INTEGRITY_ERROR' };
    const fields = ['total_to_receive', 'due_now', 'expected_not_due', 'future_conditional'];
    const values = {};
    let obligationCurrency = null;
    for (const field of fields) {
      const value = claim[field];
      const currency = upper(value?.currency);
      if (!value || value.status !== 'AUTHORITATIVE' || value.amount === null || value.amount === undefined || !currency || !CURRENCY_RE.test(currency)) {
        return { valid: false, reason: 'FINANCE_AUTHORITY_INTEGRITY_ERROR' };
      }
      if (obligationCurrency === null) obligationCurrency = currency;
      if (currency !== obligationCurrency) return { valid: false, reason: 'FINANCE_AUTHORITY_INTEGRITY_ERROR' };
      values[field] = parseDecimal(String(value.amount));
      if (decimalCompare(values[field], '0') < 0) return { valid: false, reason: 'FINANCE_AUTHORITY_INTEGRITY_ERROR' };
    }

    const total = values.total_to_receive;
    for (const field of ['due_now', 'expected_not_due', 'future_conditional']) {
      if (decimalCompare(values[field], total) > 0) return { valid: false, reason: 'FINANCE_AUTHORITY_INTEGRITY_ERROR' };
    }
    const bucketSum = decimalAdd(decimalAdd(values.due_now, values.expected_not_due), values.future_conditional);
    if (decimalCompare(bucketSum, total) > 0) return { valid: false, reason: 'FINANCE_AUTHORITY_INTEGRITY_ERROR' };

    for (const currency of [claim.contractual_payment_currency, claim.mixed_inbound_accounting_currency]) {
      if (currency !== null && currency !== undefined && !CURRENCY_RE.test(upper(currency) || '')) {
        return { valid: false, reason: 'FINANCE_AUTHORITY_INTEGRITY_ERROR' };
      }
    }

    const spend = validateExecutionMoney(claim, 'actual_spend', 'actual_spend_status');
    const remaining = validateExecutionMoney(claim, 'remaining_execution', 'remaining_execution_status');
    if (!spend.valid || !remaining.valid) return { valid: false, reason: 'FINANCE_EXECUTION_AUTHORITY_INTEGRITY_ERROR' };
    if (spend.present !== remaining.present) return { valid: false, reason: 'FINANCE_EXECUTION_AUTHORITY_INTEGRITY_ERROR' };
    if (spend.present && spend.currency !== remaining.currency) return { valid: false, reason: 'FINANCE_EXECUTION_AUTHORITY_INTEGRITY_ERROR' };

    return {
      valid: true,
      reason: null,
      obligation_currency: obligationCurrency,
      execution_authority_present: spend.present && remaining.present,
      execution_currency: spend.present ? spend.currency : null,
    };
  } catch {
    return { valid: false, reason: 'FINANCE_AUTHORITY_INTEGRITY_ERROR' };
  }
}

export function resolveDealFinanceAuthority(dealKey, financeAuthorities = [], capability = true) {
  const claims = financeAuthorities.filter((claim) => String(claim.deal_key) === String(dealKey));
  let resolved;
  try {
    resolved = resolveAuthorityClaims(claims, stableFinanceSignature);
  } catch {
    return financeToVerify('FINANCE_AUTHORITY_INTEGRITY_ERROR', claims.flatMap((claim) => claim.authority_refs || [authorityRef(claim)]));
  }
  if (resolved.status === 'TO_VERIFY') return financeToVerify('AUTHORITY_CONFLICT', resolved.authority_refs);
  if (resolved.status === 'MISSING') return financeToVerify(capability ? 'NO_CURRENT_FINANCE_AUTHORITY' : 'AUTHORITY_MATERIALIZATION_REQUIRED', []);
  const claim = resolved.claim; const refs = resolved.authority_refs.length ? resolved.authority_refs : [authorityRef(claim)];
  const integrity = validateDealFinanceAuthorityIntegrity(claim);
  if (!integrity.valid) return financeToVerify(integrity.reason || 'FINANCE_AUTHORITY_INTEGRITY_ERROR', refs);

  const normalize = (value) => moneyValue(value.amount, integrity.obligation_currency, 'AUTHORITATIVE', null, refs);
  const normalizeExecution = (field, statusField) => {
    if (!integrity.execution_authority_present) return null;
    const status = upper(claim?.[statusField] || claim?.[field]?.status);
    if (status === 'AUTHORITATIVE') return moneyValue(claim[field].amount, integrity.execution_currency, 'AUTHORITATIVE', null, refs);
    return toVerifyMoney(integrity.execution_currency, claim?.[field]?.reason || 'FINANCE_EXECUTION_TO_VERIFY', refs);
  };
  const actualSpend = normalizeExecution('actual_spend', 'actual_spend_status');
  const remainingExecution = normalizeExecution('remaining_execution', 'remaining_execution_status');
  return {
    status: 'AUTHORITATIVE', reason: null,
    total_to_receive: normalize(claim.total_to_receive), due_now: normalize(claim.due_now),
    expected_not_due: normalize(claim.expected_not_due), future_conditional: normalize(claim.future_conditional),
    actual_spend: actualSpend,
    actual_spend_status: actualSpend?.status || null,
    remaining_execution: remainingExecution,
    remaining_execution_status: remainingExecution?.status || null,
    execution_currency: integrity.execution_currency,
    execution_status: claim.execution_status || null,
    execution_authority_present: integrity.execution_authority_present,
    finance_status: claim.finance_status || 'TO_VERIFY', documentary_status: claim.documentary_status || 'TO_VERIFY',
    contractual_payment_currency: claim.contractual_payment_currency ? upper(claim.contractual_payment_currency) : null,
    mixed_inbound_accounting_currency: claim.mixed_inbound_accounting_currency ? upper(claim.mixed_inbound_accounting_currency) : null,
    authority_state: claim.authority_state || null, lifecycle_state: claim.lifecycle_state || null, effective_at: claim.effective_at || null,
    version: claim.source_version || null, supersedes_id: claim.supersedes_id || null, authority_refs: refs,
  };
}
function financeToVerify(reason, refs) {
  return {
    status: 'TO_VERIFY', reason,
    total_to_receive: toVerifyMoney(null, reason, refs), due_now: toVerifyMoney(null, reason, refs), expected_not_due: toVerifyMoney(null, reason, refs), future_conditional: toVerifyMoney(null, reason, refs),
    actual_spend: null, actual_spend_status: null, remaining_execution: null, remaining_execution_status: null,
    execution_currency: null, execution_status: null, execution_authority_present: false,
    finance_status: 'TO_VERIFY', documentary_status: 'TO_VERIFY', contractual_payment_currency: null, mixed_inbound_accounting_currency: null,
    authority_state: null, lifecycle_state: null, effective_at: null, version: null, supersedes_id: null, authority_refs: refs,
  };
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
