export const ADMIN_PAYMENTS_V7_PROJECTION_VERSION = 'ADMIN_PAYMENTS_V7_PROJECTION_FINANCE_SETTLEMENT_ALLOCATION_V1';
export const FINANCE_SETTLEMENT_ALLOCATION_AUTHORITY = 'CALCULATED_FROM_AUTHORITATIVE_BANK_FACTS';

function text(value) { return value === null || value === undefined ? '' : String(value).trim(); }
function upper(value) { return text(value).toUpperCase(); }
function array(value) { return Array.isArray(value) ? value : []; }
function amountPresent(value) {
  if (value === null || value === undefined || text(value) === '') return false;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0;
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

function enrichSettlement(index, dealKey, settlement) {
  const allocation = resolveAllocation(index, dealKey, settlement);
  if (!allocation) return settlement;
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

function enrichPassport(index, deal) {
  const passport = deal?.payment_passport;
  if (!passport) return passport;
  const dealKey = text(deal?.deal_key);
  const fundingEvents = array(passport.funding_events).map((event) => ({
    ...event,
    settlement_lines: array(event?.settlement_lines).map((line) => enrichSettlement(index, dealKey, line)),
  }));
  const unlinkedSettlementLines = array(passport.unlinked_settlement_lines)
    .map((line) => enrichSettlement(index, dealKey, line));
  return {
    ...passport,
    funding_events: fundingEvents,
    unlinked_settlement_lines: unlinkedSettlementLines,
  };
}

export function applyFinanceSettlementAllocations(projection, source = {}) {
  if (source?.capabilities?.settlementFundingAllocation === false) return projection;
  const rows = array(source?.settlementFundingAllocations);
  if (!rows.length) return projection;
  const index = buildAllocationIndex(rows);
  const deals = array(projection?.deals).map((deal) => ({
    ...deal,
    payment_passport: enrichPassport(index, deal),
  }));
  return {
    ...projection,
    deals,
    payment_passports: deals.map((deal) => deal.payment_passport).filter(Boolean),
  };
}
