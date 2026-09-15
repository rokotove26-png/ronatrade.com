import {
  decimalAdd,
  decimalCompare,
  decimalDivide,
  decimalSub,
  decimalToString,
  parseDecimal,
} from './decimal.mjs';
import { resolveAuthorityClaims, stableAttributionSignature } from './authority.mjs';
import { moneyValue, toVerifyMoney } from './money.mjs';

export const FINANCE_GLOBAL_PAYMENT_POLICY_ID = 'FINANCE_GLOBAL_PAYMENT_SEMANTICS_V1';
export const FUNDING_PASSPORT_CONTRACT = 'ADMIN_PAYMENTS_V7_FUNDING_PAYMENT_PASSPORT_V2';

const FINANCE_AUTHORITY_KINDS = new Set(['FINANCE', 'FINANCE-AI', 'AI-FINANCE']);
const VERIFIED_FINANCE_STATES = new Set(['VERIFIED', 'PAID', 'CONFIRMED']);

function text(value) { return value === null || value === undefined ? '' : String(value).trim(); }
function upper(value) { return text(value).toUpperCase(); }
function uniq(values) { return [...new Set((values || []).filter(Boolean).map(String))]; }
function normalizedAuthorityKind(value) { return upper(value).replaceAll('_', '-'); }
function isFinanceExactClaim(claim) {
  return claim?.current === true
    && claim?.source_locked === true
    && upper(claim?.authority_state) === 'AUTHORITATIVE'
    && upper(claim?.attribution_mode) === 'EXACT'
    && FINANCE_AUTHORITY_KINDS.has(normalizedAuthorityKind(claim?.authority_kind));
}
function asObject(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
function asArray(value) { return Array.isArray(value) ? value : []; }
function decimalMultiply(a, b) {
  const x = parseDecimal(String(a));
  const y = parseDecimal(String(b));
  return decimalToString({ coefficient: x.coefficient * y.coefficient, scale: x.scale + y.scale });
}
function canonicalAmount(value) {
  if (value === null || value === undefined || text(value) === '') return null;
  return decimalToString(parseDecimal(String(value)));
}
function financeEventPayload(event) {
  return asObject(asObject(event?.request_snapshot).payload);
}
function eventAccepted(event) {
  const accepted = asObject(event?.result_snapshot).accepted;
  return accepted === true || upper(accepted) === 'TRUE';
}
function bankDocument(payment, event) {
  if (text(payment?.bank_transaction_reference)) return text(payment.bank_transaction_reference);
  const bankRef = asArray(event?.source_refs).find((ref) => upper(ref?.source_type) === 'BANK_STATEMENT');
  return text(bankRef?.source_id) || null;
}
function refsFromEvent(event) {
  return asArray(event?.source_refs).map((ref) => ({
    source_type: text(ref?.source_type) || 'SOURCE',
    source_id: text(ref?.source_id) || null,
  })).filter((ref) => ref.source_id);
}
function currentPolicyEntry(source) {
  const matches = asArray(source?.globalFinancePolicies).filter((entry) => {
    const policy = asObject(entry?.policy);
    return text(entry?.policy_id || policy.policy_id) === FINANCE_GLOBAL_PAYMENT_POLICY_ID
      && text(entry?.scope || policy.scope) === 'GLOBAL_FINANCE_ROLE'
      && (entry?.task_scoped ?? policy.task_scoped) === false;
  });
  if (matches.length !== 1) return { status: 'TO_VERIFY', reason: matches.length ? 'GLOBAL_FINANCE_POLICY_CONFLICT' : 'GLOBAL_FINANCE_POLICY_MISSING', entry: null };
  const entry = matches[0];
  const rules = asObject(asObject(entry?.policy).rules);
  const primary = asObject(rules.FUNDING_CURRENCY_PRIMARY_SEMANTICS);
  const allocation = asObject(rules.MULTI_DEAL_PROPORTIONAL_ALLOCATION);
  const valid = upper(primary.primary_actual_spend_source) === 'BANK_CONFIRMED_FUNDING_SIDE_DEBIT'
    && upper(primary.reverse_fx_as_primary) === 'FORBIDDEN'
    && upper(primary.resource_chain_accounting_amount_as_primary) === 'FORBIDDEN'
    && upper(allocation.default_method) === 'PROPORTIONAL_TO_CONFIRMED_SHARES'
    && allocation.synthetic_allocation === false;
  return valid
    ? { status: 'AUTHORITATIVE', reason: null, entry }
    : { status: 'TO_VERIFY', reason: 'GLOBAL_FINANCE_POLICY_SEMANTICS_INVALID', entry };
}
function groupBy(items, keyFn) {
  const out = new Map();
  for (const item of items || []) {
    const key = keyFn(item);
    if (!out.has(key)) out.set(key, []);
    out.get(key).push(item);
  }
  return out;
}
function resolveAttributionForPayment(source, paymentKey) {
  const claims = asArray(source?.attributionClaims).filter((claim) => String(claim?.payment_key) === String(paymentKey));
  const resolved = resolveAuthorityClaims(claims, stableAttributionSignature);
  if (resolved.status !== 'AUTHORITATIVE') return { ...resolved, reason: resolved.reason || 'CURRENT_FINANCE_AUTHORITY_TO_VERIFY' };
  if (!isFinanceExactClaim(resolved.claim)) return { status: 'TO_VERIFY', reason: 'CURRENT_FINANCE_EXACT_ATTRIBUTION_MISSING', claim: null, claims: resolved.claims, authority_refs: resolved.authority_refs };
  const lines = asArray(resolved.claim.lines);
  if (!lines.length || lines.some((line) => !line?.deal_key || line?.amount === null || upper(line?.amount_status || 'EXACT') !== 'EXACT')) {
    return { status: 'TO_VERIFY', reason: 'CURRENT_FINANCE_EXACT_LINES_MISSING', claim: null, claims: resolved.claims, authority_refs: resolved.authority_refs };
  }
  return resolved;
}
function metadataSignature(event) {
  const payload = financeEventPayload(event);
  return JSON.stringify({
    payment_key: event?.payment_key ? String(event.payment_key) : null,
    event_type: upper(event?.event_type),
    amount: canonicalAmount(payload.amount),
    currency: upper(payload.currency),
    funding_leg_kind: upper(payload.funding_leg_kind),
    acquired_amount: canonicalAmount(payload.acquired_amount),
    acquired_currency: upper(payload.acquired_currency),
    conversion_rate: canonicalAmount(payload.conversion_rate),
    conversion_source_basis: upper(payload.conversion_source_basis),
    allocation_basis: upper(payload.allocation_basis),
    allocation_shares: asObject(payload.allocation_shares),
  });
}
function resolveFinanceEvent(events, paymentKey) {
  const eligible = asArray(events).filter((event) => String(event?.payment_key) === String(paymentKey)
    && upper(event?.event_type) === 'OUTGOING_PAYMENT_CONFIRMED'
    && upper(financeEventPayload(event).funding_leg_kind) === 'FUNDING_SIDE_DEBIT'
    && upper(event?.actor_role) === 'FINANCE'
    && eventAccepted(event));
  if (!eligible.length) return { status: 'MISSING', reason: 'DIRECT_FUNDING_SIDE_EVENT_MISSING', event: null, events: [] };
  const signatures = new Set(eligible.map(metadataSignature));
  if (signatures.size !== 1) return { status: 'TO_VERIFY', reason: 'DIRECT_FUNDING_SIDE_EVENT_CONFLICT', event: null, events: eligible };
  return { status: 'AUTHORITATIVE', reason: null, event: [...eligible].sort((a, b) => String(a?.id || '').localeCompare(String(b?.id || '')))[0], events: eligible };
}
function sumLineAmounts(lines) {
  let sum = parseDecimal('0');
  for (const line of lines) sum = decimalAdd(sum, String(line.amount));
  return decimalToString(sum);
}
function explicitShare(payload, dealId) {
  const value = asObject(payload?.allocation_shares)[dealId];
  return value === null || value === undefined ? null : canonicalAmount(value);
}
function buildAllocationLines({ resolved, payment, eventPayload, dealIdByKey }) {
  const lines = asArray(resolved?.claim?.lines);
  if (!lines.length) return { status: 'TO_VERIFY', reason: 'CURRENT_FINANCE_EXACT_LINES_MISSING', allocations: [] };
  if (lines.some((line) => upper(line.currency) !== upper(payment.currency))) return { status: 'TO_VERIFY', reason: 'FUNDING_ATTRIBUTION_CURRENCY_MISMATCH', allocations: [] };
  if (decimalCompare(sumLineAmounts(lines), payment.amount) !== 0) return { status: 'TO_VERIFY', reason: 'FUNDING_ATTRIBUTION_TOTAL_MISMATCH', allocations: [] };
  const multi = lines.length > 1;
  const allocations = [];
  let explicitTotal = parseDecimal('0');
  let anyExplicit = false;
  for (const line of lines) {
    const dealKey = String(line.deal_key);
    const dealId = dealIdByKey.get(dealKey);
    if (!dealId) return { status: 'TO_VERIFY', reason: 'FUNDING_ATTRIBUTION_DEAL_OUTSIDE_CONTOUR', allocations: [] };
    let share = multi ? explicitShare(eventPayload, dealId) : '1';
    let source = multi ? upper(eventPayload?.allocation_basis) : 'EXACT_SINGLE_DEAL';
    if (multi && share !== null) {
      anyExplicit = true;
      explicitTotal = decimalAdd(explicitTotal, share);
      if (decimalCompare(decimalMultiply(payment.amount, share), line.amount) !== 0) return { status: 'TO_VERIFY', reason: 'CONFIRMED_SHARE_AMOUNT_MISMATCH', allocations: [] };
    }
    if (multi && share === null) {
      share = decimalToString(decimalDivide(line.amount, payment.amount, 12));
      source = source || 'CURRENT_FINANCE_EXACT_ATTRIBUTION';
    }
    allocations.push({
      deal_key: dealKey,
      deal_id: dealId,
      amount: canonicalAmount(line.amount),
      currency: upper(line.currency),
      share,
      allocation_source: source || (multi ? 'CURRENT_FINANCE_EXACT_ATTRIBUTION' : 'EXACT_SINGLE_DEAL'),
      synthetic_allocation: false,
    });
  }
  if (anyExplicit && decimalCompare(explicitTotal, '1') !== 0) return { status: 'TO_VERIFY', reason: 'CONFIRMED_SHARES_MUST_SUM_TO_ONE', allocations: [] };
  return { status: 'AUTHORITATIVE', reason: null, allocations };
}
function settlementLine(payment, line, status = 'AUTHORITATIVE', reason = null) {
  return {
    payment_id: payment.payment_id || String(payment.payment_key),
    recipient: payment.recipient || payment.counterparty_name || null,
    purpose: payment.original_payment_purpose || null,
    amount: canonicalAmount(line.amount),
    currency: upper(line.currency),
    row_type: upper(payment.kind) === 'BANK_FEE' ? 'COMMISSION' : 'SETTLEMENT',
    is_fee: upper(payment.kind) === 'BANK_FEE',
    bank_document: payment.bank_transaction_reference || payment.bank_statement_date || payment.bank_account_reference || null,
    payment_at: payment.payment_at || null,
    status,
    reason,
    deal_key: String(line.deal_key),
  };
}
function fundingPaymentEligible(payment) {
  return payment?.current === true
    && upper(payment.direction) === 'OUTGOING'
    && upper(payment.bank_fact_status) === 'BANK_CONFIRMED'
    && VERIFIED_FINANCE_STATES.has(upper(payment.finance_verification_status));
}
function settlementPaymentEligible(payment) {
  return fundingPaymentEligible(payment)
    && !['FX_CONVERSION', 'CLIENT_PAYMENT'].includes(upper(payment.kind));
}
function eventTechnicalBasis(event, resolved) {
  return {
    finance_event_id: event?.id ? String(event.id) : null,
    attribution_id: resolved?.claim?.id ? String(resolved.claim.id) : null,
    source_refs: refsFromEvent(event),
    authority_refs: asArray(resolved?.authority_refs),
  };
}

export function buildFundingSideReadModel(source = {}) {
  const policy = currentPolicyEntry(source);
  const contour = asArray(source.contour);
  const payments = asArray(source.payments);
  const paymentByKey = new Map(payments.map((payment) => [String(payment.payment_key), payment]));
  const dealIdByKey = new Map(contour.map((deal) => [String(deal.deal_key), String(deal.deal_id)]));
  const financeEvents = asArray(source.financeEvents);
  const eventGroups = groupBy(financeEvents, (event) => String(event?.payment_key || ''));
  const fundingPaymentKeys = new Set();
  const events = [];
  const dealIssues = new Map();
  const markIssue = (dealKey, reason) => {
    const key = String(dealKey);
    if (!dealIssues.has(key)) dealIssues.set(key, []);
    dealIssues.get(key).push(reason);
  };

  for (const [paymentKey] of eventGroups) {
    const eventResolution = resolveFinanceEvent(financeEvents, paymentKey);
    if (eventResolution.status === 'MISSING') continue;
    fundingPaymentKeys.add(paymentKey);
    const payment = paymentByKey.get(paymentKey);
    const event = eventResolution.event;
    const eventPayload = event ? financeEventPayload(event) : {};
    const resolved = resolveAttributionForPayment(source, paymentKey);
    let status = 'AUTHORITATIVE';
    let reason = null;
    if (policy.status !== 'AUTHORITATIVE') { status = 'TO_VERIFY'; reason = policy.reason; }
    else if (eventResolution.status !== 'AUTHORITATIVE') { status = 'TO_VERIFY'; reason = eventResolution.reason; }
    else if (!payment || !fundingPaymentEligible(payment)) { status = 'TO_VERIFY'; reason = 'BANK_CONFIRMED_FUNDING_SIDE_PAYMENT_REQUIRED'; }
    else if (upper(eventPayload.funding_leg_kind) !== 'FUNDING_SIDE_DEBIT') { status = 'TO_VERIFY'; reason = 'DIRECT_FUNDING_SIDE_EVENT_MISSING'; }
    else if (canonicalAmount(eventPayload.amount) !== canonicalAmount(payment.amount) || upper(eventPayload.currency) !== upper(payment.currency)) { status = 'TO_VERIFY'; reason = 'FUNDING_EVENT_BANK_FACT_MISMATCH'; }
    else if (resolved.status !== 'AUTHORITATIVE') { status = 'TO_VERIFY'; reason = resolved.reason || 'CURRENT_FINANCE_AUTHORITY_TO_VERIFY'; }

    let allocation = { status: 'TO_VERIFY', reason: reason || 'FUNDING_ATTRIBUTION_TO_VERIFY', allocations: [] };
    if (status === 'AUTHORITATIVE') {
      allocation = buildAllocationLines({ resolved, payment, eventPayload, dealIdByKey });
      if (allocation.status !== 'AUTHORITATIVE') { status = 'TO_VERIFY'; reason = allocation.reason; }
    }

    const directEvent = {
      funding_event_id: payment?.payment_id || event?.event_identity || paymentKey,
      payment_key: paymentKey,
      funding_amount: payment ? canonicalAmount(payment.amount) : canonicalAmount(eventPayload.amount),
      funding_currency: upper(payment?.currency || eventPayload.currency) || null,
      direct_funding_side: status === 'AUTHORITATIVE',
      bank_fact_status: upper(payment?.bank_fact_status) || null,
      acquired_amount: canonicalAmount(eventPayload.acquired_amount),
      acquired_currency: upper(eventPayload.acquired_currency) || null,
      conversion_rate: canonicalAmount(eventPayload.conversion_rate),
      conversion_source_basis: upper(eventPayload.conversion_source_basis) || null,
      bank_document: bankDocument(payment, event),
      payment_at: payment?.payment_at || event?.effective_at || null,
      status,
      reason,
      allocations: allocation.allocations,
      settlement_lines_by_deal: new Map(),
      settlement_lines_all: [],
      native_residuals: [],
      technical_basis: eventTechnicalBasis(event, resolved),
    };
    events.push(directEvent);
    if (status !== 'AUTHORITATIVE') {
      const touched = new Set([
        ...asArray(resolved?.claim?.lines).map((line) => String(line.deal_key)),
        ...asArray(resolved?.claims).flatMap((claim) => asArray(claim?.lines).map((line) => String(line.deal_key))),
      ]);
      for (const dealKey of touched) markIssue(dealKey, reason || 'FUNDING_EVENT_TO_VERIFY');
    }
  }

  const eventCandidatesByDealCurrency = new Map();
  for (const event of events.filter((item) => item.status === 'AUTHORITATIVE' && item.acquired_currency)) {
    for (const allocation of event.allocations) {
      const key = `${allocation.deal_key}\u0000${event.acquired_currency}`;
      if (!eventCandidatesByDealCurrency.has(key)) eventCandidatesByDealCurrency.set(key, []);
      eventCandidatesByDealCurrency.get(key).push(event);
    }
  }

  const unlinkedSettlementLinesByDeal = new Map();
  const settlementIssuesByEvent = new Map();
  for (const payment of payments) {
    const paymentKey = String(payment.payment_key);
    if (fundingPaymentKeys.has(paymentKey) || !settlementPaymentEligible(payment) || upper(payment.kind) === 'INTERNAL_TRANSFER') continue;
    const resolved = resolveAttributionForPayment(source, paymentKey);
    if (resolved.status !== 'AUTHORITATIVE') {
      const touched = new Set(asArray(resolved?.claims).flatMap((claim) => asArray(claim?.lines).map((line) => String(line.deal_key))));
      for (const dealKey of touched) {
        markIssue(dealKey, resolved.reason || 'SETTLEMENT_FINANCE_AUTHORITY_TO_VERIFY');
        if (!unlinkedSettlementLinesByDeal.has(dealKey)) unlinkedSettlementLinesByDeal.set(dealKey, []);
      }
      continue;
    }
    for (const line of asArray(resolved.claim.lines)) {
      const dealKey = String(line.deal_key);
      const lineView = settlementLine(payment, line);
      const candidates = eventCandidatesByDealCurrency.get(`${dealKey}\u0000${upper(line.currency)}`) || [];
      if (candidates.length !== 1) {
        lineView.status = 'TO_VERIFY';
        lineView.reason = candidates.length ? 'FUNDING_EVENT_LINK_CONFLICT' : 'FUNDING_EVENT_LINK_MISSING';
        if (!unlinkedSettlementLinesByDeal.has(dealKey)) unlinkedSettlementLinesByDeal.set(dealKey, []);
        unlinkedSettlementLinesByDeal.get(dealKey).push(lineView);
        markIssue(dealKey, lineView.reason);
        for (const candidate of candidates) settlementIssuesByEvent.set(candidate.funding_event_id, lineView.reason);
        continue;
      }
      const event = candidates[0];
      event.settlement_lines_all.push(lineView);
      if (!event.settlement_lines_by_deal.has(dealKey)) event.settlement_lines_by_deal.set(dealKey, []);
      event.settlement_lines_by_deal.get(dealKey).push(lineView);
    }
  }

  for (const event of events) {
    const issue = settlementIssuesByEvent.get(event.funding_event_id);
    if (event.status !== 'AUTHORITATIVE' || !event.acquired_currency || event.acquired_amount === null) {
      event.native_residuals = [{ amount: null, currency: event.acquired_currency, source_basis: 'BANK_ACQUIRED_LESS_LINKED_SETTLEMENTS', status: 'TO_VERIFY', reason: event.reason || 'ACQUIRED_LEG_TO_VERIFY' }];
      continue;
    }
    if (issue) {
      event.native_residuals = [{ amount: null, currency: event.acquired_currency, source_basis: 'BANK_ACQUIRED_LESS_LINKED_SETTLEMENTS', status: 'TO_VERIFY', reason: issue }];
      continue;
    }
    let settlementTotal = parseDecimal('0');
    for (const line of event.settlement_lines_all) settlementTotal = decimalAdd(settlementTotal, line.amount);
    const residual = decimalSub(event.acquired_amount, settlementTotal);
    if (decimalCompare(residual, '0') < 0) {
      event.native_residuals = [{ amount: null, currency: event.acquired_currency, source_basis: 'BANK_ACQUIRED_LESS_LINKED_SETTLEMENTS', status: 'TO_VERIFY', reason: 'SETTLEMENT_EXCEEDS_ACQUIRED_AMOUNT' }];
    } else {
      event.native_residuals = [{ amount: decimalToString(residual), currency: event.acquired_currency, source_basis: 'BANK_ACQUIRED_LESS_CURRENT_FINANCE_SETTLEMENTS', status: 'AUTHORITATIVE', reason: null }];
    }
  }

  const eventsByDeal = new Map();
  for (const event of events) {
    for (const allocation of event.allocations) {
      if (!eventsByDeal.has(allocation.deal_key)) eventsByDeal.set(allocation.deal_key, []);
      eventsByDeal.get(allocation.deal_key).push(event);
    }
  }

  function computeDealSpend(dealKey, fundingCurrency) {
    const key = String(dealKey);
    if (policy.status !== 'AUTHORITATIVE') return { status: 'TO_VERIFY', issues: [policy.reason], value: toVerifyMoney(fundingCurrency || null, policy.reason, []) };
    const dealEvents = eventsByDeal.get(key) || [];
    const issues = uniq(dealIssues.get(key) || []);
    const hasSettlement = [...eventCandidatesByDealCurrency.keys(), ...unlinkedSettlementLinesByDeal.keys()].some((candidate) => String(candidate).split('\u0000')[0] === key);
    if (!dealEvents.length) {
      if (hasSettlement || issues.length) {
        const reason = issues[0] || 'DIRECT_FUNDING_SIDE_DEBIT_MISSING';
        return { status: 'TO_VERIFY', issues: [reason], value: toVerifyMoney(fundingCurrency || null, reason, []) };
      }
      return { status: 'AUTHORITATIVE', issues: [], value: moneyValue('0', fundingCurrency || null, 'AUTHORITATIVE', null, []) };
    }
    if (dealEvents.some((event) => event.status !== 'AUTHORITATIVE') || issues.length) {
      const reason = issues[0] || dealEvents.find((event) => event.status !== 'AUTHORITATIVE')?.reason || 'FUNDING_EVENT_TO_VERIFY';
      return { status: 'TO_VERIFY', issues: [reason], value: toVerifyMoney(fundingCurrency || null, reason, []) };
    }
    const allocations = dealEvents.flatMap((event) => event.allocations.filter((line) => line.deal_key === key).map((line) => ({ ...line, event })));
    const currencies = uniq(allocations.map((line) => line.currency));
    if (currencies.length !== 1) return { status: 'TO_VERIFY', issues: ['MULTIPLE_FUNDING_CURRENCIES'], value: toVerifyMoney(fundingCurrency || null, 'MULTIPLE_FUNDING_CURRENCIES', []) };
    if (fundingCurrency && upper(fundingCurrency) !== currencies[0]) return { status: 'TO_VERIFY', issues: ['FUNDING_CURRENCY_MISMATCH'], value: toVerifyMoney(upper(fundingCurrency), 'FUNDING_CURRENCY_MISMATCH', []) };
    let total = parseDecimal('0');
    for (const line of allocations) total = decimalAdd(total, line.amount);
    const refs = allocations.flatMap((line) => [...asArray(line.event.technical_basis?.authority_refs), ...asArray(line.event.technical_basis?.source_refs)]);
    return { status: 'AUTHORITATIVE', issues: [], value: moneyValue(decimalToString(total), currencies[0], 'AUTHORITATIVE', null, refs) };
  }

  function passportEventsForDeal(dealKey) {
    const key = String(dealKey);
    return (eventsByDeal.get(key) || []).map((event) => {
      const allocation = event.allocations.find((line) => line.deal_key === key);
      return {
        funding_event_id: event.funding_event_id,
        funding_amount: event.funding_amount,
        funding_currency: event.funding_currency,
        allocated_funding_amount: allocation?.amount || null,
        direct_funding_side: event.direct_funding_side,
        bank_fact_status: event.bank_fact_status,
        allocation_share: allocation?.share || null,
        allocation_source: allocation?.allocation_source || null,
        synthetic_allocation: allocation?.synthetic_allocation ?? false,
        acquired_amount: event.acquired_amount,
        acquired_currency: event.acquired_currency,
        conversion_rate: event.conversion_rate,
        conversion_source_basis: event.conversion_source_basis,
        bank_document: event.bank_document,
        payment_at: event.payment_at,
        status: event.status,
        reason: event.reason,
        settlement_lines: asArray(event.settlement_lines_by_deal.get(key)).map(({ deal_key, ...line }) => line),
        native_residuals: event.native_residuals.map((residual) => ({ ...residual })),
        technical_basis: event.technical_basis,
      };
    });
  }

  const nativeResiduals = events.flatMap((event) => event.native_residuals.map((residual) => ({ funding_event_id: event.funding_event_id, ...residual })));
  return {
    contract: FUNDING_PASSPORT_CONTRACT,
    policy,
    events,
    computeDealSpend,
    passportEventsForDeal,
    unlinkedSettlementLinesByDeal,
    nativeResiduals,
    reverseFxPrimaryCount: 0,
  };
}

export function buildFundingAggregate(deals = []) {
  const groups = new Map();
  for (const deal of deals || []) {
    const currency = upper(deal?.funding_currency || deal?.accounting_currency?.currency);
    if (!currency) continue;
    if (!groups.has(currency)) groups.set(currency, { currency, deals: [], received: parseDecimal('0'), spent: parseDecimal('0'), remaining: parseDecimal('0'), status: 'AUTHORITATIVE', reasons: [] });
    const group = groups.get(currency);
    group.deals.push(deal.deal_id);
    const received = deal.verified_received;
    const spent = deal.actual_spend;
    const remaining = deal.remaining_execution;
    if (received?.status !== 'AUTHORITATIVE' || spent?.status !== 'AUTHORITATIVE' || remaining?.status !== 'AUTHORITATIVE') {
      group.status = 'TO_VERIFY';
      group.reasons.push(received?.reason, spent?.reason, remaining?.reason);
      continue;
    }
    group.received = decimalAdd(group.received, received.amount);
    group.spent = decimalAdd(group.spent, spent.amount);
    group.remaining = decimalAdd(group.remaining, remaining.amount);
  }
  return [...groups.values()].map((group) => ({
    currency: group.currency,
    deal_ids: group.deals,
    funding_received: group.status === 'AUTHORITATIVE' ? decimalToString(group.received) : null,
    funding_spent: group.status === 'AUTHORITATIVE' ? decimalToString(group.spent) : null,
    funding_remaining: group.status === 'AUTHORITATIVE' ? decimalToString(group.remaining) : null,
    status: group.status,
    reason: group.status === 'AUTHORITATIVE' ? null : uniq(group.reasons)[0] || 'FUNDING_AGGREGATE_TO_VERIFY',
  }));
}

export function buildNativeResidualAggregate(residuals = []) {
  const groups = new Map();
  for (const residual of residuals || []) {
    const currency = upper(residual?.currency);
    if (!currency) continue;
    if (!groups.has(currency)) groups.set(currency, { currency, total: parseDecimal('0'), status: 'AUTHORITATIVE', reasons: [], events: [] });
    const group = groups.get(currency);
    group.events.push(residual.funding_event_id);
    if (residual.status !== 'AUTHORITATIVE' || residual.amount === null) {
      group.status = 'TO_VERIFY';
      group.reasons.push(residual.reason);
      continue;
    }
    group.total = decimalAdd(group.total, residual.amount);
  }
  return [...groups.values()].map((group) => ({
    currency: group.currency,
    amount: group.status === 'AUTHORITATIVE' ? decimalToString(group.total) : null,
    funding_event_ids: group.events,
    source_basis: 'NATIVE_EVENT_RESIDUALS_ONLY',
    status: group.status,
    reason: group.status === 'AUTHORITATIVE' ? null : uniq(group.reasons)[0] || 'NATIVE_RESIDUAL_TO_VERIFY',
  }));
}
