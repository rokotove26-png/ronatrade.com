import { createAdminPaymentsV7SourceBundle as createBaseSourceBundle } from './adapters.mjs';
import { buildAdminPaymentsV7Projection as buildBaseProjection } from './projection.mjs';
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
  return next;
}

function sourceTruthState(source) {
  const c = source?.capabilities || {};
  const status = (ready) => ready === true ? 'AUTHORITATIVE' : 'TO_VERIFY';
  return {
    contour: status(c.contourAuthority),
    bank_receipts_and_allocations: status(c.bankReceiptAuthority),
    finance_authority: status(c.financeAuthority),
    spend_resource_chain: status(c.resourceChain),
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
    if (c.resourceChain !== true) {
      const currency = next?.accounting_currency?.currency || next?.verified_received?.currency || null;
      next = {
        ...next,
        actual_spend: toVerifyMoney(currency, 'SPEND_RESOURCE_CHAIN_NOT_VISIBLE', []),
        actual_spend_status: 'TO_VERIFY',
        remaining_execution: toVerifyMoney(currency, 'SPEND_RESOURCE_CHAIN_NOT_VISIBLE', []),
      };
    }
    return next;
  });
  return {
    ...projection,
    deals,
    owner_exception_queue: c.bankReceiptAuthority === true ? (projection.owner_exception_queue || []) : [],
    source_truth: sourceTruthState(source),
  };
}

export function createAdminPaymentsV7SourceBundle(raw = {}) {
  const prepared = prepareRaw(raw);
  const source = createBaseSourceBundle(prepared);
  return {
    ...source,
    sourceVisibility: raw.sourceVisibility || null,
    capabilities: { ...source.capabilities, ...(prepared.capabilities || {}) },
  };
}

export function buildAdminPaymentsV7Projection(source) {
  return enforceTruth(buildBaseProjection(source), source);
}

export function buildAdminPaymentsV7FromRawSources(raw = {}) {
  const source = createAdminPaymentsV7SourceBundle(raw);
  return buildAdminPaymentsV7Projection(source);
}
