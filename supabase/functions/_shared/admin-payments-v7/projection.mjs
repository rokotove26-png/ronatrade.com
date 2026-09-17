import { createAdminPaymentsV7SourceBundle } from './adapters.mjs';
import { decimalAbs, decimalAdd, decimalCompare, decimalDivide, decimalMulInteger, decimalSub, decimalToString, parseDecimal } from './decimal.mjs';
import { resolveDealFinanceAuthority } from './finance.mjs';
import { moneyValue, toVerifyMoney } from './money.mjs';
import { reconcileAllPayments } from './reconciliation.mjs';
import { applyPaymentRecipientSemantics } from './recipient.mjs';
import {
  buildFundingAggregate,
  buildFundingSideReadModel,
  buildNativeResidualAggregate,
  FUNDING_PASSPORT_CONTRACT,
} from './funding-side-read-model.mjs';

function unique(values) { return [...new Set((values || []).filter(Boolean).map(String))]; }
function paymentIsVerifiedClientReceipt(payment) {
  return payment.direction === 'INCOMING' && payment.kind === 'CLIENT_PAYMENT' && payment.bank_fact_status === 'BANK_CONFIRMED' && ['VERIFIED', 'PAID', 'CONFIRMED'].includes(payment.finance_verification_status);
}

function collectReceiptComponents(dealKey, payments, reconciliations) {
  const components = []; const issues = []; const refs = [];
  for (const payment of payments || []) {
    if (!paymentIsVerifiedClientReceipt(payment)) continue;
    const reconciliation = reconciliations.get(String(payment.payment_key));
    if (!reconciliation) continue;
    const touchesDeal = (reconciliation.scope_deal_keys || []).includes(String(dealKey)) || (reconciliation.current_lines || []).some((line) => String(line.deal_key) === String(dealKey));
    if (reconciliation.status !== 'AUTHORITATIVE') {
      if (touchesDeal) { issues.push(reconciliation.integrity_reason || reconciliation.reason || reconciliation.reconciliation_class); refs.push(...(reconciliation.authority_refs || [])); }
      continue;
    }
    if (reconciliation.business_disposition === 'ASSIGN_ADVANCE_PAYMENT') continue;
    if ((reconciliation.current_lines || []).length && reconciliation.integrity_status !== 'AUTHORITATIVE') {
      if (touchesDeal) issues.push(reconciliation.integrity_reason || 'ATTRIBUTION_INTEGRITY_ERROR');
      continue;
    }
    for (const line of reconciliation.current_lines || []) {
      if (String(line.deal_key) !== String(dealKey)) continue;
      components.push({ amount: String(line.amount), currency: payment.currency, payment_key: payment.payment_key });
      refs.push(...(reconciliation.authority_refs || []));
    }
  }
  return { components, issues: unique(issues), authority_refs: refs };
}

function resolveAccountingCurrency(receipts, finance) {
  if (receipts.issues.includes('AUTHORITY_CONFLICT')) return { currency: null, status: 'TO_VERIFY', reason: 'AUTHORITY_CONFLICT', authority_refs: receipts.authority_refs };
  const currencies = unique(receipts.components.map((component) => component.currency));
  if (currencies.length === 1) return { currency: currencies[0], status: 'AUTHORITATIVE', reason: 'VERIFIED_INBOUND_CLIENT_PAYMENT', authority_refs: receipts.authority_refs };
  if (currencies.length > 1) {
    if (finance.status === 'AUTHORITATIVE' && finance.mixed_inbound_accounting_currency) return { currency: finance.mixed_inbound_accounting_currency, status: 'AUTHORITATIVE', reason: 'EXPLICIT_MIXED_INBOUND_OWNER_FINANCE_RULE', authority_refs: finance.authority_refs };
    return { currency: null, status: 'TO_VERIFY', reason: 'MIXED_INBOUND_CURRENCIES', authority_refs: receipts.authority_refs };
  }
  if (finance.status === 'AUTHORITATIVE' && finance.contractual_payment_currency) return { currency: finance.contractual_payment_currency, status: 'AUTHORITATIVE', reason: 'AUTHORITATIVE_CONTRACTUAL_PAYMENT_CURRENCY', authority_refs: finance.authority_refs };
  return { currency: null, status: 'TO_VERIFY', reason: finance.reason || 'NO_AUTHORITATIVE_PREPAYMENT_CURRENCY', authority_refs: finance.authority_refs || [] };
}

function computeVerifiedReceived(receipts, accountingCurrency) {
  if (accountingCurrency.status !== 'AUTHORITATIVE' || !accountingCurrency.currency) return toVerifyMoney(null, accountingCurrency.reason, accountingCurrency.authority_refs);
  if (receipts.issues.length) return toVerifyMoney(accountingCurrency.currency, receipts.issues[0], receipts.authority_refs);
  if (receipts.components.some((component) => component.currency !== accountingCurrency.currency)) return toVerifyMoney(accountingCurrency.currency, 'MIXED_RECEIPT_CONVERSION_AUTHORITY_MISSING', receipts.authority_refs);
  let total = parseDecimal('0'); for (const component of receipts.components) total = decimalAdd(total, component.amount);
  return moneyValue(decimalToString(total), accountingCurrency.currency, 'AUTHORITATIVE', null, receipts.authority_refs);
}

function validateFinanceMoney(value, accountingCurrency, field) {
  if (accountingCurrency.status !== 'AUTHORITATIVE' || !accountingCurrency.currency) return toVerifyMoney(null, accountingCurrency.reason, accountingCurrency.authority_refs);
  if (!value || value.status !== 'AUTHORITATIVE' || value.amount === null) return toVerifyMoney(accountingCurrency.currency, value?.reason || `${field.toUpperCase()}_TO_VERIFY`, value?.authority_refs || []);
  if (value.currency !== accountingCurrency.currency) return toVerifyMoney(accountingCurrency.currency, `${field.toUpperCase()}_CURRENCY_MISMATCH`, value.authority_refs || []);
  return moneyValue(value.amount, accountingCurrency.currency, 'AUTHORITATIVE', null, value.authority_refs || []);
}
function computeRemaining(total, received) {
  if (total.status !== 'AUTHORITATIVE' || received.status !== 'AUTHORITATIVE' || !total.currency || total.currency !== received.currency) return toVerifyMoney(total.currency || received.currency || null, total.reason || received.reason || 'REMAINING_TO_RECEIVE_TO_VERIFY', [...(total.authority_refs || []), ...(received.authority_refs || [])]);
  return moneyValue(decimalToString(decimalSub(total.amount, received.amount)), total.currency, 'AUTHORITATIVE', null, [...(total.authority_refs || []), ...(received.authority_refs || [])]);
}
function computeProgress(total, received) {
  if (total.status !== 'AUTHORITATIVE' || received.status !== 'AUTHORITATIVE' || total.currency !== received.currency || decimalCompare(total.amount, '0') <= 0) return { ratio: null, percent: null, status: 'TO_VERIFY', reason: 'PAYMENT_PROGRESS_INPUT_TO_VERIFY' };
  const ratio = decimalDivide(received.amount, total.amount, 12);
  return { ratio: decimalToString(ratio), percent: decimalToString(decimalMulInteger(ratio, 100)), status: 'AUTHORITATIVE', reason: null };
}
function computeRemainingExecution(received, spend) {
  if (received.status !== 'AUTHORITATIVE' || spend.status !== 'AUTHORITATIVE' || received.currency !== spend.value.currency) return toVerifyMoney(received.currency || spend.value.currency || null, spend.issues?.[0] || received.reason || 'REMAINING_EXECUTION_TO_VERIFY', [...(received.authority_refs || []), ...(spend.value.authority_refs || [])]);
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
  return [{ code: 'OVERRECEIPT', amount: moneyValue(decimalToString(excess), total.currency, 'AUTHORITATIVE', null, [...(total.authority_refs || []), ...(received.authority_refs || [])]), authority_refs: [...(total.authority_refs || []), ...(received.authority_refs || [])] }];
}

function isNormalReconciliation(item) {
  if (item.reconciliation_class === 'FX_CONVERSION_NOT_APPLICABLE') return true;
  if (item.reconciliation_class === 'RESOLVED' && item.business_disposition === 'ASSIGN_ADVANCE_PAYMENT') return true;
  const materializationAligned = ['ALIGNED', 'ALIGNED_WITH_STALE_HISTORY_PRESENT', 'NOT_APPLICABLE'].includes(item.materialization_status);
  if (['RESOLVED', 'KNOWN_MULTI_DEAL_EXACT_SPLIT'].includes(item.reconciliation_class) && item.status === 'AUTHORITATIVE' && materializationAligned) return true;
  if (item.reconciliation_class === 'ASSOCIATED_BANK_FEE' && item.status === 'AUTHORITATIVE' && ['EXACT', 'NOT_APPLICABLE'].includes(item.fee_attribution_state) && materializationAligned) return true;
  return false;
}
function paymentException(reconciliation) {
  return {
    exception_id: `payment:${reconciliation.payment_key}:${reconciliation.reconciliation_class}`,
    payment_key: reconciliation.payment_key,
    payment_ids: [reconciliation.payment_id].filter(Boolean),
    payment_amount: reconciliation.payment_amount,
    payment_currency: reconciliation.payment_currency,
    payment_at: reconciliation.payment_at || null,
    counterparty_name: reconciliation.counterparty_name || null,
    current_authority_id: reconciliation.current_authority_id || null,
    reconciliation_class: reconciliation.reconciliation_class,
    status: reconciliation.status, reason: reconciliation.reason, integrity_reason: reconciliation.integrity_reason || null,
    owner_action_required: reconciliation.owner_action_required, allowed_owner_actions: reconciliation.allowed_owner_actions,
    candidate_deal_ids: reconciliation.candidate_deal_ids || [],
    scope_deal_keys: reconciliation.scope_deal_keys || [],
    known_scope_refs: reconciliation.business_scope_refs || [],
    technical_gap: reconciliation.materialization_status,
    fee_attribution_state: reconciliation.fee_attribution_state || null, authority_refs: reconciliation.authority_refs || [],
  };
}

function passportPaymentMaps(source) {
  return {
    byKey: new Map((source.payments || []).map((payment) => [String(payment.payment_key), payment])),
    byId: new Map((source.payments || []).filter((payment) => payment.payment_id).map((payment) => [String(payment.payment_id), payment])),
  };
}

function decoratePassportLine(line, maps) {
  const payment = maps.byKey.get(String(line?.payment_key || '')) || maps.byId.get(String(line?.payment_id || '')) || {};
  const routed = applyPaymentRecipientSemantics({ ...line }, payment);
  return {
    ...routed,
    bank_beneficiary_name: routed.beneficiary_name || null,
    bank_route_reference: line?.bank_document || payment.bank_transaction_reference || payment.bank_account_reference || payment.bank_statement_date || null,
  };
}

function decoratePassportEvent(event, maps) {
  const payment = maps.byKey.get(String(event?.payment_key || '')) || maps.byId.get(String(event?.funding_event_id || '')) || {};
  const routed = applyPaymentRecipientSemantics({ ...event }, payment);
  return {
    ...routed,
    bank_beneficiary_name: routed.beneficiary_name || null,
    bank_route_reference: event?.bank_document || payment.bank_transaction_reference || payment.bank_account_reference || payment.bank_statement_date || null,
    settlement_lines: (event?.settlement_lines || []).map((line) => decoratePassportLine(line, maps)),
  };
}

export function buildAdminPaymentsV7Projection(source) {
  const validDealKeys = source.validDealKeys?.length ? source.validDealKeys : (source.contour || []).map((deal) => deal.deal_key);
  const reconciled = reconcileAllPayments(source.payments || [], source.attributionClaims || [], source.physicalAllocations || [], source.capabilities || {}, validDealKeys);
  const reconciliationByPayment = new Map(reconciled.map((item) => [String(item.payment_key), item]));
  const globalPaymentExceptions = reconciled.filter((item) => !isNormalReconciliation(item)).map(paymentException);
  const ownerExceptionQueue = reconciled.filter((item) => item.reconciliation_class === 'GENUINELY_UNALLOCATED' && item.owner_action_required === true).map(paymentException);
  const fundingModel = buildFundingSideReadModel(source);
  const passportMaps = passportPaymentMaps(source);
  const deals = []; const materializationGaps = [];

  for (const contourDeal of source.contour || []) {
    const finance = resolveDealFinanceAuthority(contourDeal.deal_key, source.financeAuthorities || [], source.capabilities?.financeAuthority === true);
    const receipts = collectReceiptComponents(contourDeal.deal_key, source.payments || [], reconciliationByPayment);
    const accountingCurrency = resolveAccountingCurrency(receipts, finance);
    const verifiedReceived = computeVerifiedReceived(receipts, accountingCurrency);
    const total = validateFinanceMoney(finance.total_to_receive, accountingCurrency, 'total_to_receive');
    const due = validateFinanceMoney(finance.due_now, accountingCurrency, 'due_now');
    const expected = validateFinanceMoney(finance.expected_not_due, accountingCurrency, 'expected_not_due');
    const future = validateFinanceMoney(finance.future_conditional, accountingCurrency, 'future_conditional');
    const remaining = computeRemaining(total, verifiedReceived); const progress = computeProgress(total, verifiedReceived);
    const spend = fundingModel.computeDealSpend(contourDeal.deal_key, accountingCurrency.currency);
    const remainingExecution = computeRemainingExecution(verifiedReceived, spend);
    const settlementLayer = fundingModel.settlementStatusForDeal(contourDeal.deal_key);
    const residualLayer = fundingModel.residualStatusForDeal(contourDeal.deal_key);
    const financialStatus = computeFinancialState({ finance, total, received: verifiedReceived, remaining, due, expected, future });
    const financialExceptions = buildOverreceiptException(total, verifiedReceived);
    const dealExceptions = globalPaymentExceptions.filter((exception) => {
      const rec = reconciled.find((r) => r.payment_id === exception.payment_ids[0]);
      return rec ? rec.scope_deal_keys.includes(String(contourDeal.deal_key)) : false;
    });
    if (finance.reason === 'AUTHORITY_MATERIALIZATION_REQUIRED') materializationGaps.push({ domain: 'FINANCE_AUTHORITY', deal_id: contourDeal.deal_id, reason: 'AUTHORITY_MATERIALIZATION_REQUIRED', required_model: 'DealFinanceAuthorityV7' });
    const unlinkedSettlements = (fundingModel.unlinkedSettlementLinesByDeal.get(String(contourDeal.deal_key)) || [])
      .map(({ deal_key, ...line }) => decoratePassportLine(line, passportMaps));
    const passportStatus = spend.status === 'AUTHORITATIVE'
      && remainingExecution.status === 'AUTHORITATIVE'
      && settlementLayer.status === 'AUTHORITATIVE'
      && residualLayer.status === 'AUTHORITATIVE'
      ? 'AUTHORITATIVE'
      : 'TO_VERIFY';
    const passport = {
      contract: FUNDING_PASSPORT_CONTRACT,
      deal_id: contourDeal.deal_id,
      funding_currency: accountingCurrency.currency,
      funding_received: verifiedReceived,
      funding_spent: spend.value,
      funding_remaining: remainingExecution,
      funding_status: spend.status,
      funding_reason: spend.issues?.[0] || null,
      settlement_status: settlementLayer.status,
      settlement_reason: settlementLayer.reason,
      residual_status: residualLayer.status,
      residual_reason: residualLayer.reason,
      funding_events: fundingModel.passportEventsForDeal(contourDeal.deal_key).map((event) => decoratePassportEvent(event, passportMaps)),
      unlinked_settlement_lines: unlinkedSettlements,
      status: passportStatus,
      reason: spend.issues?.[0] || remainingExecution.reason || settlementLayer.reason || residualLayer.reason || null,
    };
    deals.push({
      deal_key: contourDeal.deal_key, deal_id: contourDeal.deal_id, client_display: contourDeal.client_display, payment_handoff_state: contourDeal.payment_handoff_state,
      accounting_currency: accountingCurrency, funding_currency: accountingCurrency.currency,
      total_to_receive: total, verified_received: verifiedReceived, due_now: due, expected_not_due: expected, future_conditional: future, remaining_to_receive: remaining,
      actual_spend: spend.value, actual_spend_status: spend.status, remaining_execution: remainingExecution, payment_progress: progress,
      payment_passport: passport,
      financial_status: financialStatus, documentary_status: finance.documentary_status || 'TO_VERIFY', financial_exceptions: financialExceptions, exceptions: dealExceptions,
      authority_refs: uniqueRefs([...(contourDeal.authority_refs || []), ...(finance.authority_refs || []), ...(verifiedReceived.authority_refs || []), ...(spend.value.authority_refs || [])]),
    });
  }

  for (const rec of reconciled) {
    if (rec.reconciliation_class === 'AUTHORITY_MATERIALIZATION_REQUIRED' || rec.reconciliation_class === 'OWNER_ASSERTED_ALLOCATED_SYSTEM_AUTHORITY_NOT_MATERIALIZED') {
      materializationGaps.push({ domain: 'PAYMENT_ATTRIBUTION_AUTHORITY', payment_id: rec.payment_id || null, reason: 'AUTHORITY_MATERIALIZATION_REQUIRED', required_model: 'payment_business_attributions_v7 + payment_business_attribution_lines_v7' });
    }
    if (['NOT_MATERIALIZED', 'STALE_SUPERSEDED_MATERIALIZATION'].includes(rec.materialization_status) && ['RESOLVED', 'KNOWN_MULTI_DEAL_EXACT_SPLIT', 'ASSOCIATED_BANK_FEE'].includes(rec.reconciliation_class)) {
      materializationGaps.push({ domain: 'PAYMENT_ALLOCATION_MATERIALIZATION', payment_id: rec.payment_id || null, reason: rec.materialization_status, required_model: 'payment_allocations materialization aligned to current business authority' });
    }
  }

  const fundingAggregate = buildFundingAggregate(deals);
  const nativeResidualAggregate = buildNativeResidualAggregate(fundingModel.nativeResiduals);
  return {
    contract: 'ADMIN_PAYMENTS_V7', generated_at: source.generatedAt, source_as_of: source.sourceAsOf, deals,
    funding_semantics: {
      policy_key: fundingModel.policy.policy_key || null,
      policy_id: fundingModel.policy.policy_id || fundingModel.policy.entry?.policy_id || fundingModel.policy.entry?.policy?.policy_id || null,
      policy_version: fundingModel.policy.policy_version ?? fundingModel.policy.entry?.version ?? fundingModel.policy.entry?.policy?.version ?? null,
      status: fundingModel.policy.status,
      reason: fundingModel.policy.reason,
      reverse_fx_primary_count: fundingModel.reverseFxPrimaryCount,
    },
    funding_aggregate: fundingAggregate,
    native_residuals: fundingModel.nativeResiduals,
    native_residual_aggregate: nativeResidualAggregate,
    payment_passports: deals.map((deal) => deal.payment_passport),
    owner_exception_queue: ownerExceptionQueue, payment_exceptions: globalPaymentExceptions, materialization_gaps: materializationGaps,
    reconciliation_summary: {
      genuinely_unallocated_count: reconciled.filter((item) => item.reconciliation_class === 'GENUINELY_UNALLOCATED').length,
      technical_gap_count: globalPaymentExceptions.filter((item) => item.reconciliation_class !== 'GENUINELY_UNALLOCATED').length,
      known_scope_count: reconciled.filter((item) => item.scope_deal_keys.length > 0).length,
      authority_conflict_count: reconciled.filter((item) => item.reconciliation_class === 'AUTHORITY_CONFLICT').length,
      authority_materialization_required_count: reconciled.filter((item) => item.reconciliation_class === 'AUTHORITY_MATERIALIZATION_REQUIRED').length,
      attribution_integrity_error_count: reconciled.filter((item) => item.reconciliation_class === 'ATTRIBUTION_INTEGRITY_ERROR').length,
    },
  };
}
function uniqueRefs(refs) { const seen = new Set(); return refs.filter((ref) => { const key = JSON.stringify(ref); if (seen.has(key)) return false; seen.add(key); return true; }); }
function fundingAwareSourceBundle(raw) {
  const source = createAdminPaymentsV7SourceBundle(raw);
  const rawPaymentByKey = new Map((raw?.payments || []).map((row) => [String(row.id), row]));
  const rawResourceChainById = new Map((raw?.resourceChains || []).map((row) => [String(row.id), row]));
  const payments = (source.payments || []).map((payment) => {
    const rawPayment = rawPaymentByKey.get(String(payment.payment_key)) || {};
    return applyPaymentRecipientSemantics({
      ...payment,
      original_payment_purpose: rawPayment.original_payment_purpose || payment.original_payment_purpose || null,
      bank_account_reference: rawPayment.bank_account_reference || payment.bank_account_reference || null,
      bank_statement_date: rawPayment.bank_statement_date || payment.bank_statement_date || null,
    }, rawPayment);
  });
  const resourceChains = (source.resourceChains || []).map((chain) => {
    const rawChain = rawResourceChainById.get(String(chain.id)) || {};
    return {
      ...chain,
      conversion_source_basis: rawChain.conversion_source_basis || null,
      source_refs: Array.isArray(rawChain.source_refs) ? rawChain.source_refs : [],
      correlation_id: rawChain.correlation_id ? String(rawChain.correlation_id) : null,
      effective_at: rawChain.effective_at || null,
      source_version: rawChain.source_version || null,
      source_timestamp: rawChain.source_timestamp || null,
    };
  });
  return {
    ...source,
    payments,
    resourceChains,
    financeEvents: Array.isArray(raw?.financeEvents) ? raw.financeEvents : [],
    globalFinancePolicies: Array.isArray(raw?.globalFinancePolicies) ? raw.globalFinancePolicies : [],
    capabilities: {
      ...(source.capabilities || {}),
      financeEvents: raw?.capabilities?.financeEvents === true,
      globalFinancePolicy: raw?.capabilities?.globalFinancePolicy === true,
    },
  };
}
export function buildAdminPaymentsV7FromRawSources(raw) { return buildAdminPaymentsV7Projection(fundingAwareSourceBundle(raw)); }
