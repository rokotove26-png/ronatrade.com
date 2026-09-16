export const ADMIN_PAYMENTS_V7_PROJECTION_VERSION = 'ADMIN_PAYMENTS_V7_PROJECTION_FINANCE_SETTLEMENT_ALLOCATION_V2';
export const FINANCE_SETTLEMENT_ALLOCATION_AUTHORITY = 'CALCULATED_FROM_AUTHORITATIVE_BANK_FACTS';
export const FINANCE_RESOURCE_CHAIN_DISPLAY_AUTHORITY = 'FINANCE_RESOURCE_CHAIN_SECONDARY_DISPLAY';

function text(value) { return value === null || value === undefined ? '' : String(value).trim(); }
function upper(value) { return text(value).toUpperCase(); }
function array(value) { return Array.isArray(value) ? value : []; }
function amountPresent(value) {
  if (value === null || value === undefined || text(value) === '') return false;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0;
}
function sameAmount(left, right) {
  if (!amountPresent(left) || !amountPresent(right)) return false;
  return Math.abs(Number(left) - Number(right)) <= 1e-8;
}

function validAllocation(row) {
  return row?.source_locked === true
    && upper(row?.funding_allocation_status || row?.status) === 'AUTHORITATIVE'
    && upper(row?.authority_status) === FINANCE_SETTLEMENT_ALLOCATION_AUTHORITY
    && amountPresent(row?.calculated_funding_amount)
    && Boolean(upper(row?.funding_currency))
    && Boolean(text(row?.deal_key))
    && Boolean(text(row?.payment_key) || text(row?.payment_id));
}

function allocationKeys(row) {
  const deal = text(row?.deal_key);
  const keys = [];
  if (deal && text(row?.payment_key)) keys.push(`${deal}\u0000KEY:${text(row.payment_key)}`);
  if (deal && text(row?.payment_id)) keys.push(`${deal}\u0000ID:${text(row.payment_id)}`);
  return keys;
}

function buildAllocationIndex(rows) {
  const grouped = new Map();
  for (const row of array(rows).filter(validAllocation)) {
    for (const key of allocationKeys(row)) {
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(row);
    }
  }
  return grouped;
}

function resolveAllocation(index, dealKey, settlement) {
  const deal = text(dealKey);
  const candidates = [];
  const seen = new Set();
  for (const key of [
    text(settlement?.payment_key) ? `${deal}\u0000KEY:${text(settlement.payment_key)}` : null,
    text(settlement?.payment_id) ? `${deal}\u0000ID:${text(settlement.payment_id)}` : null,
  ].filter(Boolean)) {
    for (const row of index.get(key) || []) {
      const identity = text(row?.id) || `${text(row?.proposal_record_id)}:${text(row?.payment_key)}:${text(row?.calculated_funding_amount)}`;
      if (!seen.has(identity)) {
        seen.add(identity);
        candidates.push(row);
      }
    }
  }
  return candidates.length === 1 ? candidates[0] : null;
}

function isResourceChainCurrent(row, supersededIds) {
  const lifecycle = upper(row?.lifecycle_state || 'CURRENT');
  const authority = upper(row?.authority_state || 'AUTHORITATIVE');
  return row?.current !== false
    && row?.source_locked === true
    && !supersededIds.has(text(row?.id))
    && !['SUPERSEDED', 'REVERSED', 'REJECTED', 'ARCHIVED', 'INACTIVE'].includes(lifecycle)
    && !['SUPERSEDED', 'REVERSED', 'REJECTED', 'INVALID', 'INACTIVE'].includes(authority)
    && amountPresent(row?.native_amount)
    && Boolean(upper(row?.native_currency))
    && amountPresent(row?.accounting_amount)
    && Boolean(upper(row?.accounting_currency))
    && Boolean(text(row?.deal_key))
    && Boolean(text(row?.payment_key));
}

function buildResourceChainIndex(rows) {
  const sourceRows = array(rows);
  const supersededIds = new Set(sourceRows.map((row) => text(row?.supersedes_id)).filter(Boolean));
  const grouped = new Map();
  for (const row of sourceRows.filter((item) => isResourceChainCurrent(item, supersededIds))) {
    const key = `${text(row.deal_key)}\u0000KEY:${text(row.payment_key)}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }
  return grouped;
}

function resolveResourceChain(index, dealKey, settlement) {
  const paymentKey = text(settlement?.payment_key);
  if (!paymentKey) return null;
  const candidates = array(index.get(`${text(dealKey)}\u0000KEY:${paymentKey}`))
    .filter((row) => upper(row?.native_currency) === upper(settlement?.currency)
      && sameAmount(row?.native_amount, settlement?.amount));
  return candidates.length === 1 ? candidates[0] : null;
}

function enrichFromAllocation(settlement, allocation) {
  return {
    ...settlement,
    allocated_funding_amount: String(allocation.calculated_funding_amount),
    funding_currency: upper(allocation.funding_currency),
    funding_allocation_status: 'AUTHORITATIVE',
    funding_allocation_source: 'FINANCE_AUTHORITATIVE_DERIVED',
    funding_allocation_authority_status: upper(allocation.authority_status),
    funding_allocation_conclusion_id: text(allocation.finance_conclusion_id) || null,
    funding_allocation_proposal_id: text(allocation.proposal_record_id) || null,
    funding_allocation_approval_id: text(allocation.approval_record_id) || null,
    funding_allocation_conversion_event_id: text(allocation.conversion_event_id) || null,
    funding_allocation_actual_conversion_rate: allocation.actual_conversion_rate === null || allocation.actual_conversion_rate === undefined
      ? null
      : String(allocation.actual_conversion_rate),
    funding_allocation_calculation_method: text(allocation.calculation_method) || null,
    funding_allocation_source_refs: array(allocation.source_refs),
  };
}

function enrichFromResourceChain(settlement, chain) {
  return {
    ...settlement,
    allocated_funding_amount: String(chain.accounting_amount),
    funding_currency: upper(chain.accounting_currency),
    funding_allocation_status: 'AUTHORITATIVE',
    funding_allocation_source: FINANCE_RESOURCE_CHAIN_DISPLAY_AUTHORITY,
    funding_allocation_authority_status: FINANCE_RESOURCE_CHAIN_DISPLAY_AUTHORITY,
    funding_allocation_conclusion_id: null,
    funding_allocation_proposal_id: null,
    funding_allocation_approval_id: null,
    funding_allocation_conversion_event_id: null,
    funding_allocation_actual_conversion_rate: null,
    funding_allocation_calculation_method: 'FINANCE_RESOURCE_CHAIN_ACCOUNTING_EQUIVALENT_DISPLAY_ONLY',
    funding_allocation_source_refs: array(chain.authority_refs),
    funding_allocation_resource_chain_id: text(chain.id) || null,
  };
}

function enrichSettlement(allocationIndex, resourceChainIndex, dealKey, settlement) {
  const allocation = resolveAllocation(allocationIndex, dealKey, settlement);
  if (allocation) return enrichFromAllocation(settlement, allocation);
  const chain = resolveResourceChain(resourceChainIndex, dealKey, settlement);
  if (chain) return enrichFromResourceChain(settlement, chain);
  return settlement;
}

function enrichPassport(allocationIndex, resourceChainIndex, deal) {
  const passport = deal?.payment_passport;
  if (!passport) return passport;
  const dealKey = text(deal?.deal_key);
  const fundingEvents = array(passport.funding_events).map((event) => ({
    ...event,
    settlement_lines: array(event?.settlement_lines).map((line) => enrichSettlement(allocationIndex, resourceChainIndex, dealKey, line)),
  }));
  const unlinkedSettlementLines = array(passport.unlinked_settlement_lines)
    .map((line) => enrichSettlement(allocationIndex, resourceChainIndex, dealKey, line));
  return {
    ...passport,
    funding_events: fundingEvents,
    unlinked_settlement_lines: unlinkedSettlementLines,
  };
}

export function applyFinanceSettlementAllocations(projection, source = {}) {
  const allocationRows = source?.capabilities?.settlementFundingAllocation === false
    ? []
    : array(source?.settlementFundingAllocations);
  const resourceChainRows = source?.capabilities?.resourceChain === false
    ? []
    : array(source?.resourceChains);
  if (!allocationRows.length && !resourceChainRows.length) return projection;
  const allocationIndex = buildAllocationIndex(allocationRows);
  const resourceChainIndex = buildResourceChainIndex(resourceChainRows);
  const deals = array(projection?.deals).map((deal) => ({
    ...deal,
    payment_passport: enrichPassport(allocationIndex, resourceChainIndex, deal),
  }));
  return {
    ...projection,
    deals,
    payment_passports: deals.map((deal) => deal.payment_passport).filter(Boolean),
  };
}
