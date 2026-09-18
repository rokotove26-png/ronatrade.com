import { decimalAdd, decimalToString, parseDecimal } from './decimal.mjs';

function upper(value) {
  return value === null || value === undefined ? null : String(value).trim().toUpperCase();
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean).map(String))];
}

function currencyForDeal(deal) {
  return upper(
    deal?.funding_currency
    || deal?.accounting_currency?.currency
    || deal?.actual_spend?.currency
    || deal?.verified_received?.currency
    || deal?.remaining_execution?.currency,
  );
}

function authoritativeMoney(value, currency) {
  return Boolean(
    value
    && upper(value.status) === 'AUTHORITATIVE'
    && value.amount !== null
    && value.amount !== undefined
    && upper(value.currency) === currency,
  );
}

function unresolvedReason(deal) {
  return deal?.actual_spend?.reason
    || deal?.remaining_execution?.reason
    || deal?.verified_received?.reason
    || deal?.payment_passport?.funding_reason
    || 'FUNDING_AGGREGATE_TO_VERIFY';
}

export function buildConfirmedFundingAggregate(deals = []) {
  const groups = new Map();

  for (const deal of deals || []) {
    const currency = currencyForDeal(deal);
    if (!currency) continue;
    if (!groups.has(currency)) {
      groups.set(currency, {
        currency,
        dealIds: [],
        confirmedDealIds: [],
        unresolvedDealIds: [],
        unresolvedReasons: [],
        received: parseDecimal('0'),
        spent: parseDecimal('0'),
        remaining: parseDecimal('0'),
      });
    }

    const group = groups.get(currency);
    const dealId = deal?.deal_id ? String(deal.deal_id) : null;
    if (dealId) group.dealIds.push(dealId);

    const received = deal?.verified_received;
    const spent = deal?.actual_spend;
    const remaining = deal?.remaining_execution;
    const confirmed = authoritativeMoney(received, currency)
      && authoritativeMoney(spent, currency)
      && authoritativeMoney(remaining, currency);

    if (!confirmed) {
      if (dealId) group.unresolvedDealIds.push(dealId);
      group.unresolvedReasons.push(unresolvedReason(deal));
      continue;
    }

    if (dealId) group.confirmedDealIds.push(dealId);
    group.received = decimalAdd(group.received, received.amount);
    group.spent = decimalAdd(group.spent, spent.amount);
    group.remaining = decimalAdd(group.remaining, remaining.amount);
  }

  return [...groups.values()].map((group) => {
    const confirmedDealIds = unique(group.confirmedDealIds);
    const unresolvedDealIds = unique(group.unresolvedDealIds);
    const unresolvedReasons = unique(group.unresolvedReasons);
    const hasConfirmed = confirmedDealIds.length > 0;
    const hasUnresolved = unresolvedDealIds.length > 0;
    return {
      currency: group.currency,
      deal_ids: unique(group.dealIds),
      confirmed_deal_ids: confirmedDealIds,
      unresolved_deal_ids: unresolvedDealIds,
      confirmed_deal_count: confirmedDealIds.length,
      unresolved_deal_count: unresolvedDealIds.length,
      funding_received: hasConfirmed ? decimalToString(group.received) : null,
      funding_spent: hasConfirmed ? decimalToString(group.spent) : null,
      funding_remaining: hasConfirmed ? decimalToString(group.remaining) : null,
      status: hasConfirmed ? 'AUTHORITATIVE' : 'TO_VERIFY',
      completeness_status: hasUnresolved ? (hasConfirmed ? 'PARTIAL' : 'UNRESOLVED') : 'COMPLETE',
      reason: hasUnresolved
        ? (hasConfirmed ? 'PARTIAL_CONFIRMED_AGGREGATE' : unresolvedReasons[0] || 'FUNDING_AGGREGATE_TO_VERIFY')
        : null,
      unresolved_reasons: unresolvedReasons,
    };
  });
}

export function buildAuthoritativeMoneyAggregate(deals = [], field) {
  const groups = new Map();
  const unresolvedWithoutCurrency = [];

  for (const deal of deals || []) {
    const value = deal?.[field];
    const currency = upper(value?.currency || deal?.accounting_currency?.currency || deal?.funding_currency);
    const dealId = deal?.deal_id ? String(deal.deal_id) : null;
    if (!currency) {
      if (dealId) unresolvedWithoutCurrency.push(dealId);
      continue;
    }
    if (!groups.has(currency)) {
      groups.set(currency, {
        currency,
        confirmedDealIds: [],
        unresolvedDealIds: [],
        total: parseDecimal('0'),
      });
    }
    const group = groups.get(currency);
    if (!authoritativeMoney(value, currency)) {
      if (dealId) group.unresolvedDealIds.push(dealId);
      continue;
    }
    if (dealId) group.confirmedDealIds.push(dealId);
    group.total = decimalAdd(group.total, value.amount);
  }

  const aggregateGroups = [...groups.values()].map((group) => {
    const confirmedDealIds = unique(group.confirmedDealIds);
    const unresolvedDealIds = unique(group.unresolvedDealIds);
    const hasConfirmed = confirmedDealIds.length > 0;
    const hasUnresolved = unresolvedDealIds.length > 0;
    return {
      currency: group.currency,
      amount: hasConfirmed && !hasUnresolved ? decimalToString(group.total) : null,
      status: hasConfirmed && !hasUnresolved ? 'AUTHORITATIVE' : 'TO_VERIFY',
      completeness_status: hasUnresolved ? (hasConfirmed ? 'PARTIAL' : 'UNRESOLVED') : 'COMPLETE',
      confirmed_deal_ids: confirmedDealIds,
      unresolved_deal_ids: unresolvedDealIds,
    };
  });

  const unresolvedDealIds = unique([
    ...unresolvedWithoutCurrency,
    ...aggregateGroups.flatMap((group) => group.unresolved_deal_ids || []),
  ]);
  const confirmedCount = aggregateGroups.reduce((total, group) => total + (group.confirmed_deal_ids?.length || 0), 0);
  return {
    groups: aggregateGroups,
    unresolved_deal_ids: unresolvedDealIds,
    completeness_status: unresolvedDealIds.length ? (confirmedCount > 0 ? 'PARTIAL' : 'UNRESOLVED') : 'COMPLETE',
  };
}

export function buildPaymentsCurrencyAggregates(deals = []) {
  return {
    total_to_receive: buildAuthoritativeMoneyAggregate(deals, 'total_to_receive'),
    verified_received: buildAuthoritativeMoneyAggregate(deals, 'verified_received'),
    due_now: buildAuthoritativeMoneyAggregate(deals, 'due_now'),
    expected_not_due: buildAuthoritativeMoneyAggregate(deals, 'expected_not_due'),
    future_conditional: buildAuthoritativeMoneyAggregate(deals, 'future_conditional'),
    actual_spend: buildAuthoritativeMoneyAggregate(deals, 'actual_spend'),
    remaining_execution: buildAuthoritativeMoneyAggregate(deals, 'remaining_execution'),
  };
}
