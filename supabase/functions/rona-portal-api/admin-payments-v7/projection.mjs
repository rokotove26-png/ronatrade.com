import { createAdminPaymentsV7SourceBundle } from './adapters.mjs';
import { decimalAbs, decimalAdd, decimalCompare, decimalDivide, decimalMulInteger, decimalSub, decimalToString, parseDecimal } from './decimal.mjs';
import { resolveDealFinanceAuthority } from './finance.mjs';
import { moneyValue, toVerifyMoney } from './money.mjs';
import { reconcileAllPayments, validateExactAllocationCoverage } from './reconciliation.mjs';
import { computeDealSpend } from './spend.mjs';

function unique(values) { return [...new Set(values.filter(Boolean).map(String))]; }

function paymentIsVerifiedClientReceipt(payment) {
  return payment.direction === 'INCOMING'
    && payment.kind === 'CLIENT_PAYMENT'
    && payment.bank_fact_status === 'BANK_CONFIRMED'
    && ['VERIFIED', 'PAID', 'CONFIRMED'].includes(payment.finance_verification_status);
}

function collectReceiptComponents(dealKey, payments, reconciliations) {
  const components = [];
  const issues = [];
  const refs = [];
  for (const payment of payments) {
    if (!paymentIsVerifiedClientReceipt(payment)) continue;
    const reconciliation = reconciliations.get(payment.payment_key);
    if (!reconciliation) continue;
    const touchesDeal = reconciliation.scope_deal_keys.includes(String(dealKey))
      || reconciliation.current_lines.some((line) => String(line.deal_key) === String(dealKey));
    if (reconciliation.status === 'TO_VERIFY' && touchesDeal) {
      issues.push(reconciliation.reason || reconciliation.reconciliation_class);
      refs.push(...(reconciliation.authority_refs || []));
      continue;
    }
    if (reconciliation.business_disposition === 'ASSIGN_ADVANCE_PAYMENT') continue;
    const coverage = validateExactAllocationCoverage(payment, reconciliation);
    if (coverage.status === 'TO_VERIFY') {
      if (touchesDeal) issues.push(coverage.reason);
      continue;
    }
    for (const line of reconciliation.current_lines) {
      if (String(line.deal_key) !== String(dealKey)) continue;
      if (line.currency !== payment.currency) {
        issues.push('RECEIPT_ALLOCATION_CURRENCY_MISMATCH');
        continue;
      }
      components.push({ amount: String(line.amount), currency: payment.currency, payment_key: payment.payment_key });
      refs.push(...(reconciliation.authority_refs || []));
    }
  }
  return { components, issues: unique(issues), authority_refs: refs };
}

function resolveAccountingCurrency(receipts, finance) {
  if (receipts.issues.includes('AUTHORITY_CONFLICT')) {
    return { currency: null, status: 'TO_VERIFY', reason: 'AUTHORITY_CONFLICT', authority_refs: receipts.authority_refs };
  }
  const currencies = unique(receipts.components.map((component) => component.currency));
  if (currencies.length === 1) {
    return { currency: currencies[0], status: 'AUTHORITATIVE', reason: 'VERIFIED_INBOUND_CLIENT_PAYMENT', authority_refs: receipts.authority_refs };
  }
  if (currencies.length > 1) {
    if (finance.status === 'AUTHORITATIVE' && finance.mixed_inbound_accounting_currency) {
      return {
        currency: finance.mixed_inbound_accounting_currency,
        status: 'AUTHORITATIVE',
        reason: 'EXPLICIT_MIXED_INBOUND_OWNER_FINANCE_RULE',
        authority_refs: finance.authority_refs,
      };
    }
    return { currency: null, status: 'TO_VERIFY', reason: 'MIXED_INBOUND_CURRENCIES', authority_refs: receipts.authority_refs };
  }
  if (finance.status === 'AUTHORITATIVE' && finance.contractual_payment_currency) {
    return {
      currency: finance.contractual_payment_currency,
      status: 'AUTHORITATIVE',
      reason: 'AUTHORITATIVE_CONTRACTUAL_PAYMENT_CURRENCY',
      authority_refs: finance.authority_refs,
    };
  }
  return {
    currency: null,
    status: 'TO_VERIFY',
    reason: finance.reason || 'NO_AUTHORITATIVE_PREPAYMENT_CURRENCY',
    authority_refs: finance.authority_refs || [],
  };
}

function computeVerifiedReceived(receipts, accountingCurrency) {
  if (accountingCurrency.status !== 'AUTHORITATIVE' || !accountingCurrency.currency) {
    return toVerifyMoney(null, accountingCurrency.reason, accountingCurrency.authority_refs);
  }
  if (receipts.issues.length) {
    return toVerifyMoney(accountingCurrency.currency, receipts.issues[0], receipts.authority_refs);
  }
  const mismatched = receipts.components.filter((component) => component.currency !== accountingCurrency.currency);
  if (mismatched.length) return toVerifyMoney(accountingCurrency.currency, 'MIXED_RECEIPT_CONVERSION_AUTHORITY_MISSING', receipts.authority_refs);
  let total = parseDecimal('0');
  for (const component of receipts.components) total = decimalAdd(total, component.amount);
  return moneyValue(decimalToString(total), accountingCurrency.currency, 'AUTHORITATIVE', null, receipts.authority_refs);
}

function validateFinanceMoney(value, accountingCurrency, field) {
  if (accountingCurrency.status !== 'AUTHORITATIVE' || !accountingCurrency.currency) return toVerifyMoney(null, accountingCurrency.reason, accountingCurrency.authority_refs);
  if (!value || value.status !== 'AUTHORITATIVE' || value.amount === null) return toVerifyMoney(accountingCurrency.currency, value?.reason || `${field.toUpperCase()}_TO_VERIFY`, value?.authority_refs || []);
  if (value.currency !== accountingCurrency.currency) return toVerifyMoney(accountingCurrency.currency, `${field.toUpperCase()}_CURRENCY_MISMATCH`, value.authority_refs || []);
  return moneyValue(value.amount, accountingCurrency.currency, 'AUTHORITATIVE', null, value.authority_refs || []);
}

function computeRemaining(total, received) {
  if (total.status !== 'AUTHORITATIVE' || received.status !== 'AUTHORITATIVE' || !total.currency || total.currency !== received.currency) {
    return toVerifyMoney(total.currency || received.currency || null, total.reason || received.reason || 'REMAINING_TO_RECEIVE_TO_VERIFY', [...(total.authority_refs || []), ...(received.authority_refs || [])]);
  }
  return moneyValue(decimalToString(decimalSub(total.amount, received.amount)), total.currency, 'AUTHORITATIVE', null, [...(total.authority_refs || []), ...(received.authority_refs || [])]);
}

function computeProgress(total, received) {
  if (total.status !== 'AUTHORITATIVE' || received.status !== 'AUTHORITATIVE' || total.currency !== received.currency || decimalCompare(total.amount, '0') <= 0) {
    return { ratio: null, percent: null, status: 'TO_VERIFY', reason: 'PAYMENT_PROGRESS_INPUT_TO_VERIFY' };
  }
  const ratio = decimalDivide(received.amount, total.amount, 12);
  return {
    ratio: decimalToString(ratio),
    percent: decimalToString(decimalMulInteger(ratio, 100)),
    status: 'AUTHORITATIVE',
    reason: null,
  };
}

function computeRemainingExecution(received, spend) {
  if (received.status !== 'AUTHORITATIVE' || spend.status !== 'AUTHORITATIVE' || received.currency !== spend.value.currency) {
    return toVerifyMoney(received.currency || spend.value.currency || null, spend.issues?.[0] || received.reason || 'REMAINING_EXECUTION_TO_VERIFY', [...(received.authority_refs || []), ...(spend.value.authority_refs || [])]);
  }
  return moneyValue(decimalToString(decimalSub(received.amount, spend.value.amount)), received.currency, 'AUTHORITATIVE', null, [...(received.authority_refs || []), ...(spend.value.authority_refs || [])]);
}

function computeFinancialState({ finance, total, received, remaining, due, expected, future }) {
  const core = [total, received, remaining, due, expected, future];
  if (finance.reason === 'AUTHORITY_CONFLICT' || core.some((value) => value.status !== 'AUTHORITATIVE')) return 'TO_VERIFY';
  if (decimalCompare(received.amount, total.amount) > 0) return 'OVERRECEIVED';
  if (decimalCompare(remaining.amount, '0') === 0) return 'PAID';
  if (String(finance.finance_status).toUpperCase() === 'OVERDUE') return 'OVERDUE';
  if (decimalCompare(due.amount, '0') > 0) return 'DUE';
  if (decimalCompare(expected.amount, '0') > 0) return 'EXPECTED';
  if (decimalCompare(future.amount, '0') > 0) return 'CONDITIONAL';
  return 'OPEN';
}

function buildOverreceiptException(total, received) {
  if (total.status !== 'AUTHORITATIVE' || received.status !== 'AUTHORITATIVE' || total.currency !== received.currency || decimalCompare(received.amount, total.amount) <= 0) return [];
  const excess = decimalAbs(decimalSub(received.amount, total.amount));
  return [{
    code: 'OVERRECEIPT',
    amount: moneyValue(decimalToString(excess), total.currency, 'AUTHORITATIVE', null, [...(total.authority_refs || []), ...(received.authority_refs || [])]),
    authority_refs: [...(total.authority_refs || []), ...(received.authority_refs || [])],
  }];
}

function paymentException(reconciliation) {
  return {
    exception_id: `payment:${reconciliation.payment_key}:${reconciliation.reconciliation_class}`,
    payment_ids: [reconciliation.payment_id].filter(Boolean),
    reconciliation_class: reconciliation.reconciliation_class,
    status: reconciliation.status,
    reason: reconciliation.reason,
    owner_action_required: reconciliation.owner_action_required,
    allowed_owner_actions: reconciliation.allowed_owner_actions,
    candidate_deal_ids: reconciliation.scope_deal_keys,
    known_scope_refs: [],
    technical_gap: reconciliation.materialization_status,
    authority_refs: reconciliation.authority_refs || [],
  };
}

export function buildAdminPaymentsV7Projection(source) {
  const reconciled = reconcileAllPayments(source.payments || [], source.attributionClaims || [], source.physicalAllocations || [], source.capabilities || {});
  const reconciliationByPayment = new Map(reconciled.map((item) => [String(item.payment_key), item]));
  const globalPaymentExceptions = reconciled
    .filter((item) => item.reconciliation_class !== 'RESOLVED' || !['ALIGNED', 'ALIGNED_WITH_STALE_HISTORY_PRESENT'].includes(item.materialization_status))
    .map(paymentException);
  const ownerExceptionQueue = globalPaymentExceptions.filter((item) => item.owner_action_required === true);
  const deals = [];
  const materializationGaps = [];

  for (const contourDeal of source.contour || []) {
    const finance = resolveDealFinanceAuthority(contourDeal.deal_key, source.financeAuthorities || [], source.capabilities?.financeAuthority === true);
    const receipts = collectReceiptComponents(contourDeal.deal_key, source.payments || [], reconciliationByPayment);
    const accountingCurrency = resolveAccountingCurrency(receipts, finance);
    const verifiedReceived = computeVerifiedReceived(receipts, accountingCurrency);
    const total = validateFinanceMoney(finance.total_to_receive, accountingCurrency, 'total_to_receive');
    const due = validateFinanceMoney(finance.due_now, accountingCurrency, 'due_now');
    const expected = validateFinanceMoney(finance.expected_not_due, accountingCurrency, 'expected_not_due');
    const future = validateFinanceMoney(finance.future_conditional, accountingCurrency, 'future_conditional');
    const remaining = computeRemaining(total, verifiedReceived);
    const progress = computeProgress(total, verifiedReceived);
    const spend = computeDealSpend({
      dealKey: contourDeal.deal_key,
      accountingCurrency: accountingCurrency.currency,
      payments: source.payments || [],
      reconciliations: reconciliationByPayment,
      resourceChains: source.resourceChains || [],
      capability: source.capabilities?.resourceChain === true,
    });
    const remainingExecution = computeRemainingExecution(verifiedReceived, spend);
    const financialStatus = computeFinancialState({ finance, total, received: verifiedReceived, remaining, due, expected, future });
    const financialExceptions = buildOverreceiptException(total, verifiedReceived);
    const dealExceptions = globalPaymentExceptions.filter((exception) => {
      const rec = reconciliationByPayment.get(String(exception.payment_ids.length ? reconciled.find((r) => r.payment_id === exception.payment_ids[0])?.payment_key : ''));
      return rec ? rec.scope_deal_keys.includes(String(contourDeal.deal_key)) : false;
    });

    if (finance.reason === 'AUTHORITY_MATERIALIZATION_REQUIRED') {
      materializationGaps.push({
        domain: 'FINANCE_AUTHORITY',
        deal_id: contourDeal.deal_id,
        reason: 'AUTHORITY_MATERIALIZATION_REQUIRED',
        required_model: 'DealFinanceAuthorityV7',
      });
    }

    deals.push({
      deal_id: contourDeal.deal_id,
      client_display: contourDeal.client_display,
      payment_handoff_state: contourDeal.payment_handoff_state,
      accounting_currency: accountingCurrency,
      total_to_receive: total,
      verified_received: verifiedReceived,
      due_now: due,
      expected_not_due: expected,
      future_conditional: future,
      remaining_to_receive: remaining,
      actual_spend: spend.value,
      actual_spend_status: spend.status,
      remaining_execution: remainingExecution,
      payment_progress: progress,
      financial_status: financialStatus,
      documentary_status: finance.documentary_status || 'TO_VERIFY',
      financial_exceptions: financialExceptions,
      exceptions: dealExceptions,
      authority_refs: uniqueRefs([...(contourDeal.authority_refs || []), ...(finance.authority_refs || []), ...(verifiedReceived.authority_refs || [])]),
    });
  }

  for (const rec of reconciled) {
    const normalizedAttributionUnavailable = source.capabilities?.paymentBusinessAuthority !== true;
    const requiresNormalizedAttribution = rec.reconciliation_class === 'AUTHORITY_MATERIALIZATION_REQUIRED'
      || (normalizedAttributionUnavailable && ['SHARED_DEAL_SCOPE_SPLIT_TO_VERIFY', 'OWNER_ASSERTED_ALLOCATED_SYSTEM_AUTHORITY_NOT_MATERIALIZED'].includes(rec.reconciliation_class));
    if (requiresNormalizedAttribution) {
      materializationGaps.push({
        domain: 'PAYMENT_ATTRIBUTION_AUTHORITY',
        payment_id: rec.payment_id || null,
        reason: 'AUTHORITY_MATERIALIZATION_REQUIRED',
        required_model: 'payment_business_attributions_v7 + payment_business_attribution_lines_v7',
      });
    }
  }

  return {
    contract: 'ADMIN_PAYMENTS_V7',
    generated_at: source.generatedAt,
    source_as_of: source.sourceAsOf,
    deals,
    owner_exception_queue: ownerExceptionQueue,
    payment_exceptions: globalPaymentExceptions,
    materialization_gaps: materializationGaps,
    reconciliation_summary: {
      genuinely_unallocated_count: reconciled.filter((item) => item.reconciliation_class === 'GENUINELY_UNALLOCATED').length,
      technical_gap_count: reconciled.filter((item) => item.reason || !['ALIGNED', 'NOT_APPLICABLE'].includes(item.materialization_status)).length,
      known_scope_count: reconciled.filter((item) => item.scope_deal_keys.length > 0).length,
      authority_conflict_count: reconciled.filter((item) => item.reconciliation_class === 'AUTHORITY_CONFLICT').length,
      authority_materialization_required_count: reconciled.filter((item) => item.reconciliation_class === 'AUTHORITY_MATERIALIZATION_REQUIRED').length,
    },
  };
}

function uniqueRefs(refs) {
  const seen = new Set();
  return refs.filter((ref) => {
    const key = JSON.stringify(ref);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildAdminPaymentsV7FromRawSources(raw) {
  return buildAdminPaymentsV7Projection(createAdminPaymentsV7SourceBundle(raw));
}
