import { resolveDealFinanceAuthority } from '../_shared/admin-payments-v7/finance.mjs';
import {
  decimalCompare,
  decimalDivide,
  decimalMulInteger,
  decimalSub,
  decimalToString,
} from '../_shared/admin-payments-v7/decimal.mjs';
import { moneyValue, toVerifyMoney } from '../_shared/admin-payments-v7/money.mjs';
import {
  buildConfirmedFundingAggregate,
  buildPaymentsCurrencyAggregates,
} from '../_shared/admin-payments-v7/confirmed-funding-aggregate.mjs';

export const FINANCE_AUTHORITY_PROJECTION_V8_VERSION = 'FINANCE_AUTHORITY_PROJECTION_RECONCILIATION_V8';
const MISMATCH = 'FINANCE_AUTHORITY_PAYMENTS_PROJECTION_MISMATCH';
const CURRENT_LIFECYCLE_EXCLUSIONS = new Set(['SUPERSEDED', 'REVERSED', 'REJECTED', 'CANCELLED', 'INACTIVE', 'ARCHIVED']);
const AUTHORITY_EXCLUSIONS = new Set(['REJECTED', 'REVERSED', 'INVALID', 'INACTIVE', 'SUPERSEDED']);

function text(value) { return value === null || value === undefined ? '' : String(value).trim(); }
function upper(value) { return text(value).toUpperCase(); }
function asArray(value) { return Array.isArray(value) ? value : []; }
function unique(values) { return [...new Set(asArray(values).filter(Boolean).map(String))]; }
function uniqueRefs(refs) {
  const seen = new Set();
  return asArray(refs).filter((ref) => {
    const key = JSON.stringify(ref || null);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function sourceRefs(row) {
  return uniqueRefs([
    ...(asArray(row?.source_refs)),
    row?.id ? {
      source_type: 'FINANCE_AUTHORITY',
      source_id: String(row.id),
      source_version: row.source_version || null,
      source_timestamp: row.source_timestamp || row.effective_at || null,
    } : null,
  ]);
}
function rawMoney(amount, currency, status, refs, reason = null) {
  const normalizedStatus = upper(status || 'AUTHORITATIVE');
  if (normalizedStatus === 'TO_VERIFY') return toVerifyMoney(currency || null, reason || 'FINANCE_EXECUTION_TO_VERIFY', refs);
  if (amount === null || amount === undefined || !currency) return null;
  return moneyValue(String(amount), currency, 'AUTHORITATIVE', null, refs);
}
function normalizeFinanceAuthority(row) {
  if (!row || typeof row !== 'object') return row;
  if (row.total_to_receive && typeof row.total_to_receive === 'object' && Object.prototype.hasOwnProperty.call(row.total_to_receive, 'status')) return row;
  const obligationCurrency = upper(row.obligation_currency || row.contractual_payment_currency) || null;
  const executionCurrency = upper(row.execution_currency) || null;
  const refs = sourceRefs(row);
  const lifecycle = upper(row.lifecycle_state || 'CURRENT');
  const authority = upper(row.authority_state || 'AUTHORITATIVE');
  return {
    id: row.id ? String(row.id) : null,
    deal_key: row.deal_key ? String(row.deal_key) : null,
    total_to_receive: rawMoney(row.total_to_receive, obligationCurrency, 'AUTHORITATIVE', refs),
    due_now: rawMoney(row.due_now, obligationCurrency, 'AUTHORITATIVE', refs),
    expected_not_due: rawMoney(row.expected_not_due, obligationCurrency, 'AUTHORITATIVE', refs),
    future_conditional: rawMoney(row.future_conditional, obligationCurrency, 'AUTHORITATIVE', refs),
    actual_spend: rawMoney(row.actual_spend, executionCurrency, row.actual_spend_status, refs),
    actual_spend_status: upper(row.actual_spend_status) || null,
    remaining_execution: rawMoney(row.remaining_execution, executionCurrency, row.remaining_execution_status, refs),
    remaining_execution_status: upper(row.remaining_execution_status) || null,
    execution_currency: executionCurrency,
    execution_status: row.execution_status || null,
    finance_status: row.finance_status || 'TO_VERIFY',
    documentary_status: row.documentary_status || 'TO_VERIFY',
    contractual_payment_currency: row.contractual_payment_currency ? upper(row.contractual_payment_currency) : null,
    mixed_inbound_accounting_currency: row.mixed_inbound_accounting_currency ? upper(row.mixed_inbound_accounting_currency) : null,
    current: !CURRENT_LIFECYCLE_EXCLUSIONS.has(lifecycle) && !AUTHORITY_EXCLUSIONS.has(authority),
    source_locked: row.source_locked !== false,
    authority_state: row.authority_state || 'AUTHORITATIVE',
    lifecycle_state: row.lifecycle_state || 'CURRENT',
    effective_at: row.effective_at || row.source_timestamp || row.created_at || null,
    supersedes_id: row.supersedes_id ? String(row.supersedes_id) : null,
    supersedes_authority_refs: asArray(row.supersedes_authority_refs),
    source_version: row.source_version || null,
    source_timestamp: row.source_timestamp || null,
    authority_refs: refs,
  };
}
function authoritativeMoney(value, currency = null) {
  if (!value || upper(value.status) !== 'AUTHORITATIVE' || value.amount === null || value.amount === undefined) return false;
  return !currency || upper(value.currency) === upper(currency);
}
function sameMoney(left, right) {
  if (!authoritativeMoney(left) || !authoritativeMoney(right)) return false;
  if (upper(left.currency) !== upper(right.currency)) return false;
  try { return decimalCompare(String(left.amount), String(right.amount)) === 0; } catch { return false; }
}
function financeOwnedSnapshot(finance) {
  return {
    total_to_receive: finance.total_to_receive,
    due_now: finance.due_now,
    expected_not_due: finance.expected_not_due,
    future_conditional: finance.future_conditional,
    actual_spend: finance.actual_spend,
    remaining_execution: finance.remaining_execution,
  };
}
function correctedFields(deal, finance) {
  const corrected = [];
  for (const [field, value] of Object.entries(financeOwnedSnapshot(finance))) {
    if (!value) continue;
    if (!sameMoney(deal?.[field], value)) corrected.push(field);
  }
  return corrected;
}
function remainingToReceive(total, received) {
  const currency = upper(total?.currency || received?.currency);
  const refs = uniqueRefs([...(total?.authority_refs || []), ...(received?.authority_refs || [])]);
  if (!currency || !authoritativeMoney(total, currency) || !authoritativeMoney(received, currency)) {
    return toVerifyMoney(currency || null, 'REMAINING_TO_RECEIVE_TO_VERIFY', refs);
  }
  return moneyValue(decimalToString(decimalSub(total.amount, received.amount)), currency, 'AUTHORITATIVE', null, refs);
}
function paymentProgress(total, received) {
  if (!authoritativeMoney(total) || !authoritativeMoney(received) || upper(total.currency) !== upper(received.currency)) {
    return { ratio: null, percent: null, status: 'TO_VERIFY', reason: 'PAYMENT_PROGRESS_INPUT_TO_VERIFY' };
  }
  if (decimalCompare(total.amount, '0') <= 0) return { ratio: null, percent: null, status: 'TO_VERIFY', reason: 'PAYMENT_PROGRESS_INPUT_TO_VERIFY' };
  const ratio = decimalDivide(received.amount, total.amount, 12);
  return { ratio: decimalToString(ratio), percent: decimalToString(decimalMulInteger(ratio, 100)), status: 'AUTHORITATIVE', reason: null };
}
function financialState(finance, received, remaining, due, expected, future) {
  if (![received, remaining, due, expected, future].every((value) => authoritativeMoney(value))) return 'TO_VERIFY';
  const currency = upper(finance.total_to_receive?.currency);
  if (![received, remaining, due, expected, future].every((value) => upper(value.currency) === currency)) return 'TO_VERIFY';
  if (decimalCompare(received.amount, finance.total_to_receive.amount) > 0) return 'OVERRECEIVED';
  if (decimalCompare(remaining.amount, '0') === 0) return 'PAID';
  if (upper(finance.finance_status) === 'OVERDUE') return 'OVERDUE';
  if (decimalCompare(due.amount, '0') > 0) return 'DUE';
  if (decimalCompare(expected.amount, '0') > 0) return 'EXPECTED';
  if (decimalCompare(future.amount, '0') > 0) return 'CONDITIONAL';
  return 'OPEN';
}
function reconciliationException(reason, fields, refs) {
  return {
    code: MISMATCH,
    reason,
    mismatch_fields: unique(fields),
    authority_refs: uniqueRefs(refs),
  };
}
function executionArithmetic(finance, received) {
  if (!finance.execution_authority_present) return { status: 'NOT_APPLICABLE', mismatch_fields: [] };
  const spend = finance.actual_spend;
  const residual = finance.remaining_execution;
  const currency = upper(finance.execution_currency || spend?.currency || residual?.currency);
  if (!currency || !authoritativeMoney(spend, currency) || !authoritativeMoney(residual, currency)) {
    return { status: 'TO_VERIFY', reason: 'FINANCE_EXECUTION_AUTHORITY_TO_VERIFY', mismatch_fields: ['actual_spend', 'remaining_execution'] };
  }
  if (!authoritativeMoney(received, currency)) {
    return { status: 'RECEIPTS_TO_VERIFY', reason: 'VERIFIED_RECEIVED_TO_VERIFY', mismatch_fields: [] };
  }
  const expectedResidual = decimalToString(decimalSub(received.amount, spend.amount));
  if (decimalCompare(expectedResidual, residual.amount) !== 0) {
    return {
      status: 'TO_VERIFY',
      reason: MISMATCH,
      mismatch_fields: ['verified_received', 'actual_spend', 'remaining_execution'],
      expected_remaining_execution: expectedResidual,
      authority_remaining_execution: String(residual.amount),
    };
  }
  return { status: 'AUTHORITATIVE_ALIGNED', mismatch_fields: [] };
}
function failClosedExecution(deal, finance, check) {
  const currency = upper(finance.execution_currency || finance.actual_spend?.currency || deal?.funding_currency || deal?.accounting_currency?.currency) || null;
  const refs = uniqueRefs([...(finance.authority_refs || []), ...(deal?.verified_received?.authority_refs || [])]);
  const residual = toVerifyMoney(currency, check.reason || MISMATCH, refs);
  const exception = reconciliationException(check.reason || MISMATCH, check.mismatch_fields || [], refs);
  const passport = deal.payment_passport ? {
    ...deal.payment_passport,
    funding_spent: finance.actual_spend || deal.actual_spend,
    funding_remaining: residual,
    status: 'TO_VERIFY',
    reason: check.reason || MISMATCH,
    authority_refs: uniqueRefs([...(deal.payment_passport.authority_refs || []), ...refs]),
  } : deal.payment_passport;
  return {
    ...deal,
    actual_spend: finance.actual_spend || deal.actual_spend,
    actual_spend_status: finance.actual_spend?.status || deal.actual_spend_status || 'TO_VERIFY',
    remaining_execution: residual,
    remaining_execution_status: 'TO_VERIFY',
    payment_passport: passport,
    financial_status: 'TO_VERIFY',
    exceptions: [...asArray(deal.exceptions), exception],
  };
}
function applyFinanceAuthorityToDeal(deal, financeAuthorities) {
  const finance = resolveDealFinanceAuthority(deal?.deal_key, financeAuthorities, true);
  if (finance.status !== 'AUTHORITATIVE') {
    return {
      deal,
      reconciliation: {
        deal_id: deal?.deal_id || null,
        deal_key: deal?.deal_key || null,
        status: 'NO_CURRENT_FINANCE_AUTHORITY',
        reason: finance.reason || 'NO_CURRENT_FINANCE_AUTHORITY',
        corrected_fields: [],
        mismatch_fields: [],
      },
    };
  }

  const corrected = correctedFields(deal, finance);
  const total = finance.total_to_receive;
  const due = finance.due_now;
  const expected = finance.expected_not_due;
  const future = finance.future_conditional;
  const received = deal.verified_received;
  const remaining = remainingToReceive(total, received);
  const progress = paymentProgress(total, received);
  const check = executionArithmetic(finance, received);
  let next = {
    ...deal,
    total_to_receive: total,
    due_now: due,
    expected_not_due: expected,
    future_conditional: future,
    remaining_to_receive: remaining,
    payment_progress: progress,
    documentary_status: finance.documentary_status || deal.documentary_status || 'TO_VERIFY',
    authority_refs: uniqueRefs([...(deal.authority_refs || []), ...(finance.authority_refs || [])]),
  };

  if (finance.execution_authority_present) {
    next.actual_spend = finance.actual_spend;
    next.actual_spend_status = finance.actual_spend?.status || finance.actual_spend_status || 'TO_VERIFY';
    next.remaining_execution = finance.remaining_execution;
    next.remaining_execution_status = finance.remaining_execution?.status || finance.remaining_execution_status || 'TO_VERIFY';
    next.funding_currency = finance.execution_currency || next.funding_currency;
    if (next.payment_passport) {
      next.payment_passport = {
        ...next.payment_passport,
        funding_currency: finance.execution_currency || next.payment_passport.funding_currency,
        funding_received: received,
        funding_spent: finance.actual_spend,
        funding_remaining: finance.remaining_execution,
        status: check.status === 'AUTHORITATIVE_ALIGNED' ? 'AUTHORITATIVE' : next.payment_passport.status,
        reason: check.status === 'AUTHORITATIVE_ALIGNED' ? null : next.payment_passport.reason,
        authority_refs: uniqueRefs([...(next.payment_passport.authority_refs || []), ...(finance.authority_refs || []), ...(received?.authority_refs || [])]),
      };
    }
  }

  if (check.status === 'TO_VERIFY') next = failClosedExecution(next, finance, check);
  else next.financial_status = financialState(finance, received, remaining, due, expected, future);

  const reconciliation = {
    deal_id: deal?.deal_id || null,
    deal_key: deal?.deal_key || null,
    status: check.status === 'TO_VERIFY' ? 'TO_VERIFY' : (check.status === 'RECEIPTS_TO_VERIFY' ? 'RECEIPTS_TO_VERIFY' : 'AUTHORITATIVE_ALIGNED'),
    reason: check.reason || null,
    finance_authority_version: finance.version || null,
    finance_authority_effective_at: finance.effective_at || null,
    corrected_fields: unique(corrected),
    mismatch_fields: unique(check.mismatch_fields || []),
    expected_remaining_execution: check.expected_remaining_execution || null,
    authority_remaining_execution: check.authority_remaining_execution || null,
  };
  next.finance_authority_projection_reconciliation = reconciliation;
  return { deal: next, reconciliation };
}

export function applyFinanceAuthorityProjectionV8(projection, financeAuthorityRows = []) {
  if (!projection || projection.contract !== 'ADMIN_PAYMENTS_V7') throw new Error('ADMIN_PAYMENTS_V7_PROJECTION_REQUIRED');
  const financeAuthorities = asArray(financeAuthorityRows).map(normalizeFinanceAuthority);
  const results = asArray(projection.deals).map((deal) => applyFinanceAuthorityToDeal(deal, financeAuthorities));
  const deals = results.map((item) => item.deal);
  const rows = results.map((item) => item.reconciliation);
  const checked = rows.filter((row) => row.status !== 'NO_CURRENT_FINANCE_AUTHORITY');
  const mismatches = checked.filter((row) => row.status === 'TO_VERIFY');
  const receiptsToVerify = checked.filter((row) => row.status === 'RECEIPTS_TO_VERIFY');
  const status = mismatches.length
    ? 'TO_VERIFY'
    : receiptsToVerify.length
      ? 'PARTIAL_TO_VERIFY'
      : checked.length
        ? 'AUTHORITATIVE_ALIGNED'
        : 'NOT_APPLICABLE';

  return {
    ...projection,
    deals,
    payment_passports: deals.map((deal) => deal.payment_passport).filter(Boolean),
    funding_aggregate: buildConfirmedFundingAggregate(deals),
    currency_aggregates: buildPaymentsCurrencyAggregates(deals),
    finance_authority_projection_reconciliation: {
      version: FINANCE_AUTHORITY_PROJECTION_V8_VERSION,
      status,
      checked_deal_count: checked.length,
      mismatch_count: mismatches.length,
      receipts_to_verify_count: receiptsToVerify.length,
      rows,
    },
    source_truth: {
      ...(projection.source_truth || {}),
      finance_authority_projection: status,
    },
  };
}
