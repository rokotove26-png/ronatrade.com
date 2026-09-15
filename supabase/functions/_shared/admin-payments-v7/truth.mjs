import { createAdminPaymentsV7SourceBundle as createBaseSourceBundle } from './adapters.mjs';
import { buildAdminPaymentsV7Projection as buildBaseProjection } from './projection.mjs';
import { buildConfirmedFundingAggregate, buildPaymentsCurrencyAggregates } from './confirmed-funding-aggregate.mjs';
import { toVerifyMoney } from './money.mjs';

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
    if (c.financeEvents !== true || c.globalFinancePolicy !== true || c.paymentBusinessAuthority !== true) {
      const currency = next?.funding_currency || next?.accounting_currency?.currency || next?.verified_received?.currency || null;
      const reason = c.globalFinancePolicy !== true
        ? 'GLOBAL_FINANCE_POLICY_NOT_VISIBLE'
        : (c.financeEvents !== true ? 'FUNDING_EVENTS_NOT_VISIBLE' : 'CURRENT_FINANCE_ATTRIBUTION_NOT_VISIBLE');
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
      recipient: rawPayment.beneficiary_name || rawPayment.counterparty_name || payment.counterparty_name || null,
      original_payment_purpose: rawPayment.original_payment_purpose || null,
      bank_account_reference: rawPayment.bank_account_reference || null,
      bank_statement_date: rawPayment.bank_statement_date || null,
    };
  });
  return {
    ...source,
    payments,
    financeEvents: Array.isArray(prepared.financeEvents) ? prepared.financeEvents : [],
    globalFinancePolicies: Array.isArray(prepared.globalFinancePolicies) ? prepared.globalFinancePolicies : [],
    sourceVisibility: raw.sourceVisibility || null,
    capabilities: {
      ...source.capabilities,
      ...(prepared.capabilities || {}),
      financeEvents: prepared.capabilities?.financeEvents ?? (prepared.financeEvents !== undefined),
      globalFinancePolicy: prepared.capabilities?.globalFinancePolicy ?? (prepared.globalFinancePolicies !== undefined),
    },
  };
}

export function buildAdminPaymentsV7Projection(source) {
  const projection = enforceTruth(buildBaseProjection(source), source);
  const deals = projection.deals || [];
  return {
    ...projection,
    funding_aggregate: buildConfirmedFundingAggregate(deals),
    currency_aggregates: buildPaymentsCurrencyAggregates(deals),
  };
}

export function buildAdminPaymentsV7FromRawSources(raw = {}) {
  const source = createAdminPaymentsV7SourceBundle(raw);
  return buildAdminPaymentsV7Projection(source);
}
