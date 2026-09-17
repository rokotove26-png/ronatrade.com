import { createAdminPaymentsV7SourceBundle as createBaseSourceBundle } from './adapters.mjs';
import { buildAdminPaymentsV7Projection as buildBaseProjection } from './projection.mjs';
import { buildConfirmedFundingAggregate, buildPaymentsCurrencyAggregates } from './confirmed-funding-aggregate.mjs';
import { resolveDealFinanceAuthority } from './finance.mjs';
import {
  ADMIN_PAYMENTS_V7_PROJECTION_VERSION,
  applyFinanceSettlementAllocations,
} from './finance-settlement-allocation.mjs';
import { moneyValue, toVerifyMoney } from './money.mjs';

const FINANCE_POLICY_KEY = 'FINANCE_GLOBAL_PAYMENT_SEMANTICS';
function upper(value) { return value === null || value === undefined ? null : String(value).trim().toUpperCase(); }
function truthAware(raw) { return Boolean(raw?.sourceVisibility); }

function prepareRaw(raw = {}) {
  if (!truthAware(raw)) return raw;
  const capabilities = raw.capabilities || {};
  const next = { ...raw, capabilities: { ...capabilities } };

  if (capabilities.contourAuthority !== true) {
    next.deals = [];
    next.workflows = [];
    next.clients = [];
    next.contracts = [];
  }
  if (capabilities.bankReceiptAuthority !== true) {
    next.payments = [];
    next.paymentAllocations = [];
    next.paymentAllocationHistory = [];
  }
  if (capabilities.ownerOutgoingPaymentFacts !== true) next.ownerOutgoingPaymentFacts = [];
  if (capabilities.paymentBusinessAuthority !== true) {
    next.paymentBusinessAttributions = [];
    next.paymentBusinessAttributionLines = [];
  }
  if (capabilities.financeAuthority !== true) next.dealFinanceAuthorities = [];
  if (capabilities.resourceChain !== true) next.resourceChains = [];
  if (capabilities.financeEvents !== true) next.financeEvents = [];
  if (capabilities.globalFinancePolicy !== true) next.globalFinancePolicies = [];
  if (capabilities.settlementFundingAllocation !== true) next.settlementFundingAllocations = [];
  return next;
}

function sourceTruthState(source) {
  const c = source?.capabilities || {};
  const status = (ready) => ready === true ? 'AUTHORITATIVE' : 'TO_VERIFY';
  return {
    contour: status(c.contourAuthority),
    bank_receipts_and_allocations: status(c.bankReceiptAuthority),
    finance_authority: status(c.financeAuthority),
    funding_events: status(c.financeEvents),
    global_finance_policy: status(c.globalFinancePolicy),
    settlement_resource_chain: status(c.resourceChain),
    settlement_funding_allocation: status(c.settlementFundingAllocation),
  };
}

function currentFinancePolicy(globalFinancePolicies = []) {
  return (globalFinancePolicies || [])
    .filter((entry) => String(entry?.policy_key || entry?.policy?.policy_key || '') === FINANCE_POLICY_KEY)
    .sort((a, b) => Number(b?.version || b?.policy?.version || 0) - Number(a?.version || a?.policy?.version || 0))[0] || null;
}

export function financeExecutionAuthorityEnabled(globalFinancePolicies = []) {
  const entry = currentFinancePolicy(globalFinancePolicies);
  const policy = entry?.policy || entry || {};
  const primary = policy?.rules?.FUNDING_CURRENCY_PRIMARY_SEMANTICS || {};
  return upper(primary.actual_spend_owner) === 'FINANCE'
    && upper(primary.remaining_owner) === 'FINANCE'
    && upper(primary.missing_direct_funding_side) === 'NOT_SUFFICIENT_FOR_TO_VERIFY'
    && primary.to_verify_only_when_finance_cannot_determine === true
    && primary.finance_authoritative_zero_when_no_actual_expense === true;
}

function executionMoney(raw, claim, amountField, statusField) {
  const status = upper(raw?.[statusField]);
  if (!status) return null;
  const currency = upper(raw?.execution_currency);
  const refs = claim.authority_refs || [];
  if (status === 'AUTHORITATIVE' && raw?.[amountField] !== null && raw?.[amountField] !== undefined && currency) {
    return moneyValue(String(raw[amountField]), currency, 'AUTHORITATIVE', null, refs);
  }
  return toVerifyMoney(currency || null, status === 'TO_VERIFY' ? 'FINANCE_EXECUTION_TO_VERIFY' : 'FINANCE_EXECUTION_AUTHORITY_INTEGRITY_ERROR', refs);
}

function attachRawExecutionAuthority(source, prepared) {
  const rawById = new Map((prepared?.dealFinanceAuthorities || []).map((row) => [String(row.id), row]));
  return (source.financeAuthorities || []).map((claim) => {
    const raw = rawById.get(String(claim.id));
    if (!raw) return claim;
    return {
      ...claim,
      actual_spend: executionMoney(raw, claim, 'actual_spend', 'actual_spend_status'),
      actual_spend_status: upper(raw.actual_spend_status),
      remaining_execution: executionMoney(raw, claim, 'remaining_execution', 'remaining_execution_status'),
      remaining_execution_status: upper(raw.remaining_execution_status),
      execution_currency: upper(raw.execution_currency),
      execution_status: raw.execution_status || null,
    };
  });
}

function passportWithFinanceExecution(passport, actualSpend, remainingExecution) {
  if (!passport) return passport;
  const settlementOk = passport.settlement_status === 'AUTHORITATIVE';
  const residualOk = passport.residual_status === 'AUTHORITATIVE';
  const executionOk = actualSpend?.status === 'AUTHORITATIVE' && remainingExecution?.status === 'AUTHORITATIVE';
  const reason = actualSpend?.reason || remainingExecution?.reason || passport.settlement_reason || passport.residual_reason || null;
  return {
    ...passport,
    funding_spent: actualSpend,
    funding_remaining: remainingExecution,
    funding_status: actualSpend?.status || 'TO_VERIFY',
    funding_reason: actualSpend?.reason || null,
    status: executionOk && settlementOk && residualOk ? 'AUTHORITATIVE' : 'TO_VERIFY',
    reason,
  };
}

export function applyFinanceExecutionAuthority(projection, source) {
  if (!financeExecutionAuthorityEnabled(source?.globalFinancePolicies || [])) return projection;
  const deals = (projection.deals || []).map((deal) => {
    const finance = resolveDealFinanceAuthority(deal.deal_key, source.financeAuthorities || [], source.capabilities?.financeAuthority === true);
    if (finance.status !== 'AUTHORITATIVE' || finance.execution_authority_present !== true) return deal;
    const currency = upper(deal.funding_currency || deal?.accounting_currency?.currency);
    if (!currency || finance.execution_currency !== currency) {
      const reason = 'FINANCE_EXECUTION_CURRENCY_MISMATCH';
      const unresolved = toVerifyMoney(currency || finance.execution_currency || null, reason, finance.authority_refs || []);
      return {
        ...deal,
        actual_spend: unresolved,
        actual_spend_status: 'TO_VERIFY',
        remaining_execution: unresolved,
        finance_execution_authority: true,
        finance_execution_status: finance.execution_status || 'TO_VERIFY',
        payment_passport: passportWithFinanceExecution(deal.payment_passport, unresolved, unresolved),
      };
    }
    const actualSpend = finance.actual_spend || toVerifyMoney(currency, 'FINANCE_EXECUTION_TO_VERIFY', finance.authority_refs || []);
    const remainingExecution = finance.remaining_execution || toVerifyMoney(currency, 'FINANCE_EXECUTION_TO_VERIFY', finance.authority_refs || []);
    return {
      ...deal,
      actual_spend: actualSpend,
      actual_spend_status: actualSpend.status,
      remaining_execution: remainingExecution,
      finance_execution_authority: true,
      finance_execution_status: finance.execution_status || null,
      payment_passport: passportWithFinanceExecution(deal.payment_passport, actualSpend, remainingExecution),
      authority_refs: [...new Map([...(deal.authority_refs || []), ...(finance.authority_refs || [])].map((ref) => [`${ref?.source_type || ''}:${ref?.source_id || ref?.id || JSON.stringify(ref)}`, ref])).values()],
    };
  });
  return {
    ...projection,
    deals,
    payment_passports: deals.map((deal) => deal.payment_passport).filter(Boolean),
  };
}

function enforceTruth(projection, source) {
  if (!source?.sourceVisibility && source?.capabilities?.bankReceiptAuthority === undefined) return projection;
  const c = source.capabilities || {};
  const deals = (projection.deals || []).map((deal) => {
    let next = deal;
    if (c.bankReceiptAuthority !== true) {
      const currency = deal?.accounting_currency?.currency || deal?.total_to_receive?.currency || null;
      next = {
        ...next,
        verified_received: toVerifyMoney(currency, 'BANK_RECEIPT_SOURCE_NOT_VISIBLE', []),
        remaining_to_receive: toVerifyMoney(currency, 'BANK_RECEIPT_SOURCE_NOT_VISIBLE', []),
        payment_progress: { ratio: null, percent: null, status: 'TO_VERIFY', reason: 'BANK_RECEIPT_SOURCE_NOT_VISIBLE' },
        financial_status: 'TO_VERIFY',
      };
    }
    const explicitFinanceExecution = next.finance_execution_authority === true;
    if (c.globalFinancePolicy !== true || c.financeAuthority !== true || (!explicitFinanceExecution && (c.financeEvents !== true || c.paymentBusinessAuthority !== true))) {
      const currency = next?.funding_currency || next?.accounting_currency?.currency || next?.verified_received?.currency || null;
      const reason = c.globalFinancePolicy !== true
        ? 'GLOBAL_FINANCE_POLICY_NOT_VISIBLE'
        : (c.financeAuthority !== true
          ? 'FINANCE_AUTHORITY_NOT_VISIBLE'
          : (c.financeEvents !== true ? 'FUNDING_EVENTS_NOT_VISIBLE' : 'CURRENT_FINANCE_ATTRIBUTION_NOT_VISIBLE'));
      next = {
        ...next,
        actual_spend: toVerifyMoney(currency, reason, []),
        actual_spend_status: 'TO_VERIFY',
        remaining_execution: toVerifyMoney(currency, reason, []),
        payment_passport: next.payment_passport ? { ...next.payment_passport, status: 'TO_VERIFY', reason } : next.payment_passport,
      };
    }
    return next;
  });
  return {
    ...projection,
    deals,
    payment_passports: deals.map((deal) => deal.payment_passport).filter(Boolean),
    owner_exception_queue: c.bankReceiptAuthority === true ? (projection.owner_exception_queue || []) : [],
    source_truth: sourceTruthState(source),
  };
}

export function createAdminPaymentsV7SourceBundle(raw = {}) {
  const prepared = prepareRaw(raw);
  const source = createBaseSourceBundle(prepared);
  const rawPaymentByKey = new Map((prepared?.payments || []).map((row) => [String(row.id), row]));
  const payments = (source.payments || []).map((payment) => {
    const rawPayment = rawPaymentByKey.get(String(payment.payment_key)) || {};
    return {
      ...payment,
      recipient: rawPayment.counterparty_name || rawPayment.beneficiary_name || payment.counterparty_name || null,
      original_payment_purpose: rawPayment.original_payment_purpose || null,
      bank_account_reference: rawPayment.bank_account_reference || null,
      bank_statement_date: rawPayment.bank_statement_date || null,
    };
  });
  return {
    ...source,
    payments,
    financeAuthorities: attachRawExecutionAuthority(source, prepared),
    financeEvents: Array.isArray(prepared.financeEvents) ? prepared.financeEvents : [],
    globalFinancePolicies: Array.isArray(prepared.globalFinancePolicies) ? prepared.globalFinancePolicies : [],
    settlementFundingAllocations: Array.isArray(prepared.settlementFundingAllocations) ? prepared.settlementFundingAllocations : [],
    sourceVisibility: raw.sourceVisibility || null,
    capabilities: {
      ...source.capabilities,
      ...(prepared.capabilities || {}),
      financeEvents: prepared.capabilities?.financeEvents ?? (prepared.financeEvents !== undefined),
      globalFinancePolicy: prepared.capabilities?.globalFinancePolicy ?? (prepared.globalFinancePolicies !== undefined),
      settlementFundingAllocation: prepared.capabilities?.settlementFundingAllocation ?? (prepared.settlementFundingAllocations !== undefined),
    },
  };
}

export function buildAdminPaymentsV7Projection(source) {
  const base = buildBaseProjection(source);
  const withAllocations = applyFinanceSettlementAllocations(base, source);
  const projection = enforceTruth(applyFinanceExecutionAuthority(withAllocations, source), source);
  const deals = projection.deals || [];
  return {
    ...projection,
    projection_version: ADMIN_PAYMENTS_V7_PROJECTION_VERSION,
    funding_aggregate: buildConfirmedFundingAggregate(deals),
    currency_aggregates: buildPaymentsCurrencyAggregates(deals),
  };
}

export function buildAdminPaymentsV7FromRawSources(raw = {}) {
  const source = createAdminPaymentsV7SourceBundle(raw);
  return buildAdminPaymentsV7Projection(source);
}
