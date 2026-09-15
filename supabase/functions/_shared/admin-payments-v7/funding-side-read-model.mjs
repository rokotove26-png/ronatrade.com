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

export const FINANCE_GLOBAL_PAYMENT_POLICY_KEY = 'FINANCE_GLOBAL_PAYMENT_SEMANTICS';
// Backward-compatible export name. Runtime resolution is by stable policy_key, never by a versioned policy_id.
export const FINANCE_GLOBAL_PAYMENT_POLICY_ID = FINANCE_GLOBAL_PAYMENT_POLICY_KEY;
export const FUNDING_PASSPORT_CONTRACT = 'ADMIN_PAYMENTS_V7_FUNDING_PAYMENT_PASSPORT_V2';

const FINANCE_AUTHORITY_KINDS = new Set(['FINANCE', 'FINANCE-AI', 'AI-FINANCE']);
const VERIFIED_FINANCE_STATES = new Set(['VERIFIED', 'PAID', 'CONFIRMED']);
const STRONG_LINK_REF_TYPES = new Set([
  'FUNDING_EVENT',
  'FUNDING_PAYMENT',
  'BANK_STATEMENT',
  'BANK_TRANSACTION',
  'BANK_DOCUMENT',
  'PAYMENT',
  'PAYMENT_KEY',
  'FINANCE_EVENT',
]);

function text(value) { return value === null || value === undefined ? '' : String(value).trim(); }
function upper(value) { return text(value).toUpperCase(); }
function uniq(values) { return [...new Set((values || []).filter(Boolean).map(String))]; }
function normalizedAuthorityKind(value) { return upper(value).replaceAll('_', '-'); }
function asObject(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
function asArray(value) { return Array.isArray(value) ? value : []; }

function isFinanceExactClaim(claim) {
  return claim?.current === true
    && claim?.source_locked === true
    && upper(claim?.authority_state) === 'AUTHORITATIVE'
    && upper(claim?.attribution_mode) === 'EXACT'
    && FINANCE_AUTHORITY_KINDS.has(normalizedAuthorityKind(claim?.authority_kind));
}

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

function policyEntryKey(entry) {
  const policy = asObject(entry?.policy);
  return text(entry?.policy_key || policy.policy_key);
}

function currentPolicyEntry(source) {
  const matches = asArray(source?.globalFinancePolicies).filter((entry) => {
    const policy = asObject(entry?.policy);
    return policyEntryKey(entry) === FINANCE_GLOBAL_PAYMENT_POLICY_KEY
      && text(entry?.scope || policy.scope) === 'GLOBAL_FINANCE_ROLE'
      && (entry?.task_scoped ?? policy.task_scoped) === false;
  });

  if (matches.length !== 1) {
    return {
      status: 'TO_VERIFY',
      reason: matches.length ? 'GLOBAL_FINANCE_POLICY_CONFLICT' : 'GLOBAL_FINANCE_POLICY_MISSING',
      entry: null,
      policy_key: FINANCE_GLOBAL_PAYMENT_POLICY_KEY,
    };
  }

  const entry = matches[0];
  const policy = asObject(entry?.policy);
  const rules = asObject(policy.rules);
  const primary = asObject(rules.FUNDING_CURRENCY_PRIMARY_SEMANTICS);
  const allocation = asObject(rules.MULTI_DEAL_PROPORTIONAL_ALLOCATION);
  const compatible = upper(primary.primary_actual_spend_source) === 'BANK_CONFIRMED_FUNDING_SIDE_DEBIT'
    && upper(primary.reverse_fx_as_primary) === 'FORBIDDEN'
    && upper(primary.resource_chain_accounting_amount_as_primary) === 'FORBIDDEN'
    && upper(allocation.default_method) === 'PROPORTIONAL_TO_CONFIRMED_SHARES'
    && allocation.synthetic_allocation === false;

  return compatible
    ? {
        status: 'AUTHORITATIVE',
        reason: null,
        entry,
        policy_key: FINANCE_GLOBAL_PAYMENT_POLICY_KEY,
        policy_id: text(entry?.policy_id || policy.policy_id) || null,
        policy_version: entry?.version ?? policy.version ?? null,
      }
    : {
        status: 'TO_VERIFY',
        reason: 'POLICY_CONTRACT_UNSUPPORTED',
        entry,
        policy_key: FINANCE_GLOBAL_PAYMENT_POLICY_KEY,
        policy_id: text(entry?.policy_id || policy.policy_id) || null,
        policy_version: entry?.version ?? policy.version ?? null,
      };
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
  if (resolved.status !== 'AUTHORITATIVE') {
    return { ...resolved, reason: resolved.reason || 'CURRENT_FINANCE_AUTHORITY_TO_VERIFY' };
  }
  if (!isFinanceExactClaim(resolved.claim)) {
    return {
      status: 'TO_VERIFY',
      reason: 'CURRENT_FINANCE_EXACT_ATTRIBUTION_MISSING',
      claim: null,
      claims: resolved.claims,
      authority_refs: resolved.authority_refs,
    };
  }
  const lines = asArray(resolved.claim.lines);
  if (!lines.length || lines.some((line) => !line?.deal_key || line?.amount === null || upper(line?.amount_status || 'EXACT') !== 'EXACT')) {
    return {
      status: 'TO_VERIFY',
      reason: 'CURRENT_FINANCE_EXACT_LINES_MISSING',
      claim: null,
      claims: resolved.claims,
      authority_refs: resolved.authority_refs,
    };
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

  if (!eligible.length) {
    return { status: 'MISSING', reason: 'DIRECT_FUNDING_SIDE_EVENT_MISSING', event: null, events: [] };
  }

  const signatures = new Set(eligible.map(metadataSignature));
  if (signatures.size !== 1) {
    return { status: 'TO_VERIFY', reason: 'DIRECT_FUNDING_SIDE_EVENT_CONFLICT', event: null, events: eligible };
  }

  return {
    status: 'AUTHORITATIVE',
    reason: null,
    event: [...eligible].sort((a, b) => String(a?.id || '').localeCompare(String(b?.id || '')))[0],
    events: eligible,
  };
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
  if (!lines.length) {
    return { status: 'TO_VERIFY', reason: 'CURRENT_FINANCE_EXACT_LINES_MISSING', allocations: [] };
  }
  if (lines.some((line) => upper(line.currency) !== upper(payment.currency))) {
    return { status: 'TO_VERIFY', reason: 'FUNDING_ATTRIBUTION_CURRENCY_MISMATCH', allocations: [] };
  }
  if (decimalCompare(sumLineAmounts(lines), payment.amount) !== 0) {
    return { status: 'TO_VERIFY', reason: 'FUNDING_ATTRIBUTION_TOTAL_MISMATCH', allocations: [] };
  }

  const multi = lines.length > 1;
  const allocations = [];
  let explicitTotal = parseDecimal('0');
  let anyExplicit = false;

  for (const line of lines) {
    const dealKey = String(line.deal_key);
    const dealId = dealIdByKey.get(dealKey);
    if (!dealId) {
      return { status: 'TO_VERIFY', reason: 'FUNDING_ATTRIBUTION_DEAL_OUTSIDE_CONTOUR', allocations: [] };
    }

    let share = multi ? explicitShare(eventPayload, dealId) : '1';
    let source = multi ? upper(eventPayload?.allocation_basis) : 'EXACT_SINGLE_DEAL';

    if (multi && share !== null) {
      anyExplicit = true;
      explicitTotal = decimalAdd(explicitTotal, share);
      if (decimalCompare(decimalMultiply(payment.amount, share), line.amount) !== 0) {
        return { status: 'TO_VERIFY', reason: 'CONFIRMED_SHARE_AMOUNT_MISMATCH', allocations: [] };
      }
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

  if (anyExplicit && decimalCompare(explicitTotal, '1') !== 0) {
    return { status: 'TO_VERIFY', reason: 'CONFIRMED_SHARES_MUST_SUM_TO_ONE', allocations: [] };
  }

  return { status: 'AUTHORITATIVE', reason: null, allocations };
}

function settlementLine(payment, line, status = 'AUTHORITATIVE', reason = null) {
  return {
    payment_id: payment.payment_id || String(payment.payment_key),
    payment_key: String(payment.payment_key),
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
    event_identity: text(event?.event_identity) || null,
    event_correlation_id: text(event?.correlation_id) || null,
    funding_payment_key: event?.payment_key ? String(event.payment_key) : null,
    attribution_id: resolved?.claim?.id ? String(resolved.claim.id) : null,
    source_refs: refsFromEvent(event),
    authority_refs: asArray(resolved?.authority_refs),
  };
}

function canonicalRefToken(ref) {
  if (!ref) return null;
  if (typeof ref === 'string') {
    const raw = text(ref);
    if (!raw) return null;
    const split = raw.indexOf(':');
    if (split <= 0) return raw;
    return `${upper(raw.slice(0, split))}:${text(raw.slice(split + 1))}`;
  }
  const type = upper(ref?.source_type);
  const id = text(ref?.source_id);
  if (!type || !id) return null;
  return `${type}:${id}`;
}

function strongRefTokens(refs) {
  return new Set(asArray(refs)
    .map(canonicalRefToken)
    .filter(Boolean)
    .filter((token) => {
      const split = token.indexOf(':');
      return split > 0 && STRONG_LINK_REF_TYPES.has(upper(token.slice(0, split)));
    }));
}

function businessScopeTokens(scopeRefs) {
  return new Set(asArray(scopeRefs).map(canonicalRefToken).filter(Boolean));
}

function tokenOverlap(a, b) {
  for (const token of a) if (b.has(token)) return true;
  return false;
}

function currentResourceChainsForSettlement(source, paymentKey, dealKey) {
  return asArray(source?.resourceChains).filter((row) =>
    String(row?.payment_key) === String(paymentKey)
    && String(row?.deal_key) === String(dealKey)
    && row?.current !== false
    && row?.source_locked === true
    && upper(row?.authority_state || 'AUTHORITATIVE') === 'AUTHORITATIVE'
    && !['ARCHIVED', 'SUPERSEDED', 'REVERSED', 'REJECTED'].includes(upper(row?.lifecycle_state || 'CURRENT')));
}

function eventSettlementCurrency(event) {
  return upper(event?.acquired_currency || event?.funding_currency) || null;
}

function eventExplicitSettlementTokens(event) {
  const payload = asObject(event?._event_payload);
  const out = new Set();
  for (const value of asArray(payload.settlement_payment_keys)) out.add(`PAYMENT_KEY:${text(value)}`);
  for (const value of asArray(payload.settlement_payment_ids)) out.add(`PAYMENT:${text(value)}`);
  for (const ref of asArray(payload.settlement_source_refs)) {
    const token = canonicalRefToken(ref);
    if (token) out.add(token);
  }
  if (text(event?.technical_basis?.event_identity)) {
    out.add(`FINANCE_EVENT:${text(event.technical_basis.event_identity)}`);
    out.add(`FUNDING_EVENT:${text(event.technical_basis.event_identity)}`);
  }
  if (text(event?.payment_key)) out.add(`PAYMENT_KEY:${text(event.payment_key)}`);
  if (text(event?.funding_event_id)) out.add(`PAYMENT:${text(event.funding_event_id)}`);
  for (const ref of asArray(event?.technical_basis?.source_refs)) {
    const token = canonicalRefToken(ref);
    if (token) out.add(token);
  }
  return out;
}

function settlementExplicitTokens(resolved, line, resourceChains) {
  const claim = asObject(resolved?.claim);
  const out = new Set([
    ...strongRefTokens(claim.source_refs),
    ...businessScopeTokens(claim.business_scope_refs),
    ...strongRefTokens(line?.source_refs),
  ]);
  for (const chain of resourceChains) {
    for (const token of strongRefTokens(chain?.source_refs)) out.add(token);
  }
  return out;
}

function settlementLinkEvidence({ event, payment, resolved, line, resourceChains }) {
  const claim = asObject(resolved?.claim);
  const evidence = [];
  const principal = text(claim.principal_payment_key);
  if (principal && principal === text(event.payment_key)) {
    evidence.push({ tier: 400, basis: 'FINANCE_ATTRIBUTION_PRINCIPAL_PAYMENT' });
  }

  const eventPayload = asObject(event?._event_payload);
  if (asArray(eventPayload.settlement_payment_keys).map(String).includes(String(payment.payment_key))
      || asArray(eventPayload.settlement_payment_ids).map(String).includes(String(payment.payment_id))) {
    evidence.push({ tier: 400, basis: 'FINANCE_EVENT_EXPLICIT_SETTLEMENT_RELATION' });
  }

  for (const chain of resourceChains) {
    const chainCorrelation = text(chain?.correlation_id);
    const eventCorrelation = text(event?.technical_basis?.event_correlation_id);
    if (chainCorrelation && eventCorrelation && chainCorrelation === eventCorrelation) {
      evidence.push({ tier: 300, basis: 'RESOURCE_CHAIN_CORRELATION' });
      break;
    }
  }

  const settlementTokens = settlementExplicitTokens(resolved, line, resourceChains);
  const eventTokens = eventExplicitSettlementTokens(event);
  if (tokenOverlap(settlementTokens, eventTokens)) {
    evidence.push({ tier: 200, basis: 'AUTHORITATIVE_SOURCE_REFERENCE' });
  }

  const bestTier = evidence.reduce((max, item) => Math.max(max, item.tier), 0);
  return { bestTier, evidence: evidence.filter((item) => item.tier === bestTier) };
}

function resolveSettlementFundingLink({ source, payment, resolved, line, candidateEvents }) {
  const resourceChains = currentResourceChainsForSettlement(source, payment.payment_key, line.deal_key);
  const ranked = candidateEvents.map((event) => ({
    event,
    link: settlementLinkEvidence({ event, payment, resolved, line, resourceChains }),
  })).filter((item) => item.link.bestTier > 0);

  if (!ranked.length) {
    return {
      status: 'TO_VERIFY',
      reason: 'SETTLEMENT_LINKAGE_MISSING',
      event: null,
      evidence: [],
      candidate_event_ids: candidateEvents.map((event) => event.funding_event_id),
    };
  }

  const maxTier = Math.max(...ranked.map((item) => item.link.bestTier));
  const winners = ranked.filter((item) => item.link.bestTier === maxTier);

  if (winners.length !== 1) {
    return {
      status: 'TO_VERIFY',
      reason: 'SETTLEMENT_LINKAGE_AMBIGUOUS',
      event: null,
      evidence: winners.flatMap((item) => item.link.evidence),
      candidate_event_ids: winners.map((item) => item.event.funding_event_id),
    };
  }

  return {
    status: 'AUTHORITATIVE',
    reason: null,
    event: winners[0].event,
    evidence: winners[0].link.evidence,
    candidate_event_ids: [winners[0].event.funding_event_id],
  };
}

function statusView(status, reasons, authoritativeReason = null) {
  const list = uniq(reasons);
  return {
    status,
    reason: status === 'AUTHORITATIVE' ? authoritativeReason : (list[0] || 'TO_VERIFY'),
    reasons: status === 'AUTHORITATIVE' ? [] : list,
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

  const fundingIssuesByDeal = new Map();
  const settlementIssuesByDeal = new Map();

  const markIssue = (map, dealKey, reason) => {
    const key = String(dealKey);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(reason);
  };

  for (const [paymentKey] of eventGroups) {
    const eventResolution = resolveFinanceEvent(financeEvents, paymentKey);
    if (eventResolution.status === 'MISSING') continue;

    fundingPaymentKeys.add(paymentKey);
    const payment = paymentByKey.get(paymentKey);
    const event = eventResolution.event;
    const eventPayload = event ? financeEventPayload(event) : {};
    const resolved = resolveAttributionForPayment(source, paymentKey);

    let fundingStatus = 'AUTHORITATIVE';
    let fundingReason = null;

    if (policy.status !== 'AUTHORITATIVE') {
      fundingStatus = 'TO_VERIFY';
      fundingReason = policy.reason;
    } else if (eventResolution.status !== 'AUTHORITATIVE') {
      fundingStatus = 'TO_VERIFY';
      fundingReason = eventResolution.reason;
    } else if (!payment || !fundingPaymentEligible(payment)) {
      fundingStatus = 'TO_VERIFY';
      fundingReason = 'BANK_CONFIRMED_FUNDING_SIDE_PAYMENT_REQUIRED';
    } else if (upper(eventPayload.funding_leg_kind) !== 'FUNDING_SIDE_DEBIT') {
      fundingStatus = 'TO_VERIFY';
      fundingReason = 'DIRECT_FUNDING_SIDE_DEBIT_MISSING';
    } else if (canonicalAmount(eventPayload.amount) !== canonicalAmount(payment.amount)
        || upper(eventPayload.currency) !== upper(payment.currency)) {
      fundingStatus = 'TO_VERIFY';
      fundingReason = 'FUNDING_EVENT_BANK_FACT_MISMATCH';
    } else if (resolved.status !== 'AUTHORITATIVE') {
      fundingStatus = 'TO_VERIFY';
      fundingReason = resolved.reason || 'CURRENT_FINANCE_AUTHORITY_TO_VERIFY';
    }

    let allocation = {
      status: 'TO_VERIFY',
      reason: fundingReason || 'FUNDING_ATTRIBUTION_TO_VERIFY',
      allocations: [],
    };

    if (fundingStatus === 'AUTHORITATIVE') {
      allocation = buildAllocationLines({ resolved, payment, eventPayload, dealIdByKey });
      if (allocation.status !== 'AUTHORITATIVE') {
        fundingStatus = 'TO_VERIFY';
        fundingReason = allocation.reason;
      }
    }

    const directEvent = {
      funding_event_id: payment?.payment_id || event?.event_identity || paymentKey,
      payment_key: paymentKey,
      funding_amount: payment ? canonicalAmount(payment.amount) : canonicalAmount(eventPayload.amount),
      funding_currency: upper(payment?.currency || eventPayload.currency) || null,
      direct_funding_side: fundingStatus === 'AUTHORITATIVE',
      bank_fact_status: upper(payment?.bank_fact_status) || null,
      acquired_amount: canonicalAmount(eventPayload.acquired_amount),
      acquired_currency: upper(eventPayload.acquired_currency) || null,
      conversion_rate: canonicalAmount(eventPayload.conversion_rate),
      conversion_source_basis: upper(eventPayload.conversion_source_basis) || null,
      bank_document: bankDocument(payment, event),
      payment_at: payment?.payment_at || event?.effective_at || null,
      funding_status: fundingStatus,
      funding_reason: fundingReason,
      status: fundingStatus,
      reason: fundingReason,
      allocations: allocation.allocations,
      settlement_lines_by_deal: new Map(),
      settlement_lines_all: [],
      settlement_issues: [],
      settlement_status: 'AUTHORITATIVE',
      settlement_reason: null,
      native_residuals: [],
      residual_status: 'AUTHORITATIVE',
      residual_reason: null,
      technical_basis: eventTechnicalBasis(event, resolved),
      _event_payload: eventPayload,
    };

    events.push(directEvent);

    if (fundingStatus !== 'AUTHORITATIVE') {
      const touched = new Set([
        ...asArray(resolved?.claim?.lines).map((line) => String(line.deal_key)),
        ...asArray(resolved?.claims).flatMap((claim) => asArray(claim?.lines).map((line) => String(line.deal_key))),
      ]);
      for (const dealKey of touched) {
        markIssue(fundingIssuesByDeal, dealKey, fundingReason || 'FUNDING_EVENT_TO_VERIFY');
      }
    }
  }

  const eventsByDeal = new Map();
  const eventCandidatesByDealCurrency = new Map();

  for (const event of events) {
    for (const allocation of event.allocations) {
      if (!eventsByDeal.has(allocation.deal_key)) eventsByDeal.set(allocation.deal_key, []);
      eventsByDeal.get(allocation.deal_key).push(event);

      if (event.funding_status === 'AUTHORITATIVE') {
        const settlementCurrency = eventSettlementCurrency(event);
        if (settlementCurrency) {
          const candidateKey = `${allocation.deal_key}\u0000${settlementCurrency}`;
          if (!eventCandidatesByDealCurrency.has(candidateKey)) eventCandidatesByDealCurrency.set(candidateKey, []);
          eventCandidatesByDealCurrency.get(candidateKey).push(event);
        }
      }
    }
  }

  const unlinkedSettlementLinesByDeal = new Map();

  for (const payment of payments) {
    const paymentKey = String(payment.payment_key);
    if (fundingPaymentKeys.has(paymentKey) || !settlementPaymentEligible(payment) || upper(payment.kind) === 'INTERNAL_TRANSFER') {
      continue;
    }

    const resolved = resolveAttributionForPayment(source, paymentKey);

    if (resolved.status !== 'AUTHORITATIVE') {
      const touched = new Set(asArray(resolved?.claims)
        .flatMap((claim) => asArray(claim?.lines).map((line) => String(line.deal_key))));
      for (const dealKey of touched) {
        const reason = resolved.reason || 'SETTLEMENT_FINANCE_AUTHORITY_TO_VERIFY';
        markIssue(settlementIssuesByDeal, dealKey, reason);
      }
      continue;
    }

    for (const line of asArray(resolved.claim.lines)) {
      const dealKey = String(line.deal_key);
      const lineView = settlementLine(payment, line);
      const candidates = eventCandidatesByDealCurrency.get(`${dealKey}\u0000${upper(line.currency)}`) || [];
      const link = resolveSettlementFundingLink({
        source,
        payment,
        resolved,
        line,
        candidateEvents: candidates,
      });

      if (link.status !== 'AUTHORITATIVE') {
        lineView.status = 'TO_VERIFY';
        lineView.reason = link.reason;
        lineView.linkage_evidence = link.evidence;
        lineView.candidate_funding_event_ids = link.candidate_event_ids;

        if (!unlinkedSettlementLinesByDeal.has(dealKey)) unlinkedSettlementLinesByDeal.set(dealKey, []);
        unlinkedSettlementLinesByDeal.get(dealKey).push(lineView);
        markIssue(settlementIssuesByDeal, dealKey, link.reason);

        for (const candidate of candidates) {
          candidate.settlement_issues.push(link.reason);
        }
        continue;
      }

      const linkedEvent = link.event;
      lineView.linkage_evidence = link.evidence;
      lineView.funding_event_id = linkedEvent.funding_event_id;
      linkedEvent.settlement_lines_all.push(lineView);
      if (!linkedEvent.settlement_lines_by_deal.has(dealKey)) {
        linkedEvent.settlement_lines_by_deal.set(dealKey, []);
      }
      linkedEvent.settlement_lines_by_deal.get(dealKey).push(lineView);
    }
  }

  for (const event of events) {
    if (event.settlement_issues.length) {
      event.settlement_status = 'TO_VERIFY';
      event.settlement_reason = uniq(event.settlement_issues)[0];
    }

    const baseCurrency = event.acquired_currency || event.funding_currency;
    const baseAmount = event.acquired_amount !== null ? event.acquired_amount : event.funding_amount;
    if (event.funding_status !== 'AUTHORITATIVE' || !baseCurrency || baseAmount === null) {
      event.native_residuals = [{
        amount: null,
        currency: baseCurrency || null,
        source_basis: 'FUNDING_EVENT_NATIVE_RESIDUAL',
        status: 'TO_VERIFY',
        reason: event.funding_reason || 'NATIVE_RESIDUAL_BASE_TO_VERIFY',
      }];
    } else if (event.settlement_status !== 'AUTHORITATIVE') {
      event.native_residuals = [{
        amount: null,
        currency: baseCurrency,
        source_basis: 'FUNDING_EVENT_NATIVE_RESIDUAL',
        status: 'TO_VERIFY',
        reason: event.settlement_reason || 'SETTLEMENT_LINKAGE_TO_VERIFY',
      }];
    } else {
      let settlementTotal = parseDecimal('0');
      const compatibleLines = event.settlement_lines_all.filter((line) => upper(line.currency) === upper(baseCurrency));
      for (const line of compatibleLines) settlementTotal = decimalAdd(settlementTotal, line.amount);
      const residual = decimalSub(baseAmount, settlementTotal);

      if (decimalCompare(residual, '0') < 0) {
        event.native_residuals = [{
          amount: null,
          currency: baseCurrency,
          source_basis: event.acquired_amount !== null
            ? 'BANK_ACQUIRED_LESS_LINKED_SETTLEMENTS'
            : 'FUNDING_AMOUNT_LESS_LINKED_SAME_CURRENCY_SETTLEMENTS',
          status: 'TO_VERIFY',
          reason: 'SETTLEMENT_EXCEEDS_NATIVE_FUNDING_BASE',
        }];
      } else {
        event.native_residuals = [{
          amount: decimalToString(residual),
          currency: baseCurrency,
          source_basis: event.acquired_amount !== null
            ? 'BANK_ACQUIRED_LESS_CURRENT_FINANCE_SETTLEMENTS'
            : 'FUNDING_AMOUNT_LESS_CURRENT_FINANCE_SAME_CURRENCY_SETTLEMENTS',
          status: 'AUTHORITATIVE',
          reason: null,
        }];
      }
    }

    const shared = event.allocations.length > 1;
    const relatedDealIds = uniq(event.allocations.map((allocation) => allocation.deal_id));
    const relatedDealKeys = uniq(event.allocations.map((allocation) => allocation.deal_key));

    event.native_residuals = event.native_residuals.map((residual) => ({
      ...residual,
      funding_event_id: event.funding_event_id,
      scope: shared ? 'FUNDING_EVENT_SHARED' : 'DEAL',
      deal_id: shared ? null : (relatedDealIds[0] || null),
      related_deal_ids: relatedDealIds,
      related_deal_keys: relatedDealKeys,
    }));

    const residualReasons = event.native_residuals
      .filter((residual) => residual.status !== 'AUTHORITATIVE')
      .map((residual) => residual.reason);

    event.residual_status = residualReasons.length ? 'TO_VERIFY' : 'AUTHORITATIVE';
    event.residual_reason = residualReasons[0] || null;
  }

  function computeDealSpend(dealKey, fundingCurrency) {
    const key = String(dealKey);

    if (policy.status !== 'AUTHORITATIVE') {
      return {
        status: 'TO_VERIFY',
        issues: [policy.reason],
        value: toVerifyMoney(fundingCurrency || null, policy.reason, []),
      };
    }

    const dealEvents = eventsByDeal.get(key) || [];
    const fundingIssues = uniq(fundingIssuesByDeal.get(key) || []);

    if (!dealEvents.length) {
      const reason = fundingIssues[0] || 'DIRECT_FUNDING_SIDE_DEBIT_MISSING';
      return {
        status: 'TO_VERIFY',
        issues: [reason],
        value: toVerifyMoney(fundingCurrency || null, reason, []),
      };
    }

    if (dealEvents.some((event) => event.funding_status !== 'AUTHORITATIVE') || fundingIssues.length) {
      const reason = fundingIssues[0]
        || dealEvents.find((event) => event.funding_status !== 'AUTHORITATIVE')?.funding_reason
        || 'FUNDING_EVENT_TO_VERIFY';
      return {
        status: 'TO_VERIFY',
        issues: [reason],
        value: toVerifyMoney(fundingCurrency || null, reason, []),
      };
    }

    const allocations = dealEvents.flatMap((event) =>
      event.allocations
        .filter((line) => line.deal_key === key)
        .map((line) => ({ ...line, event })));

    const currencies = uniq(allocations.map((line) => line.currency));
    if (currencies.length !== 1) {
      return {
        status: 'TO_VERIFY',
        issues: ['MULTIPLE_FUNDING_CURRENCIES'],
        value: toVerifyMoney(fundingCurrency || null, 'MULTIPLE_FUNDING_CURRENCIES', []),
      };
    }

    if (fundingCurrency && upper(fundingCurrency) !== currencies[0]) {
      return {
        status: 'TO_VERIFY',
        issues: ['FUNDING_CURRENCY_MISMATCH'],
        value: toVerifyMoney(upper(fundingCurrency), 'FUNDING_CURRENCY_MISMATCH', []),
      };
    }

    let total = parseDecimal('0');
    for (const line of allocations) total = decimalAdd(total, line.amount);
    const refs = allocations.flatMap((line) => [
      ...asArray(line.event.technical_basis?.authority_refs),
      ...asArray(line.event.technical_basis?.source_refs),
    ]);

    return {
      status: 'AUTHORITATIVE',
      issues: [],
      value: moneyValue(decimalToString(total), currencies[0], 'AUTHORITATIVE', null, refs),
    };
  }

  function settlementStatusForDeal(dealKey) {
    const key = String(dealKey);
    const reasons = uniq(settlementIssuesByDeal.get(key) || []);
    return statusView(reasons.length ? 'TO_VERIFY' : 'AUTHORITATIVE', reasons);
  }

  function residualStatusForDeal(dealKey) {
    const key = String(dealKey);
    const dealEvents = eventsByDeal.get(key) || [];
    const reasons = dealEvents
      .flatMap((event) => event.native_residuals)
      .filter((residual) => residual.status !== 'AUTHORITATIVE')
      .map((residual) => residual.reason);

    const settlementReasons = uniq(settlementIssuesByDeal.get(key) || []);
    if (settlementReasons.length) reasons.push(...settlementReasons.map(() => 'SETTLEMENT_LINKAGE_TO_VERIFY_FOR_RESIDUAL'));

    return statusView(reasons.length ? 'TO_VERIFY' : 'AUTHORITATIVE', reasons);
  }

  function passportEventsForDeal(dealKey) {
    const key = String(dealKey);

    return (eventsByDeal.get(key) || []).map((event) => {
      const allocation = event.allocations.find((line) => line.deal_key === key);
      const ownResiduals = event.native_residuals.filter((residual) => residual.scope !== 'FUNDING_EVENT_SHARED');
      const sharedResiduals = event.native_residuals.filter((residual) => residual.scope === 'FUNDING_EVENT_SHARED');

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
        funding_status: event.funding_status,
        funding_reason: event.funding_reason,
        settlement_status: event.settlement_status,
        settlement_reason: event.settlement_reason,
        residual_status: event.residual_status,
        residual_reason: event.residual_reason,
        status: event.funding_status === 'AUTHORITATIVE'
          && event.settlement_status === 'AUTHORITATIVE'
          && event.residual_status === 'AUTHORITATIVE'
          ? 'AUTHORITATIVE'
          : 'TO_VERIFY',
        reason: event.funding_reason || event.settlement_reason || event.residual_reason || null,
        settlement_lines: asArray(event.settlement_lines_by_deal.get(key)).map(({ deal_key, ...line }) => line),
        native_residuals: ownResiduals.map((residual) => ({ ...residual })),
        shared_native_residual_refs: sharedResiduals.map((residual) => ({
          funding_event_id: residual.funding_event_id,
          scope: residual.scope,
          amount: residual.amount,
          currency: residual.currency,
          status: residual.status,
          reason: residual.reason,
          source_basis: residual.source_basis,
          related_deal_ids: residual.related_deal_ids,
        })),
        technical_basis: event.technical_basis,
      };
    });
  }

  const nativeResiduals = events.flatMap((event) => event.native_residuals.map((residual) => ({ ...residual })));

  return {
    contract: FUNDING_PASSPORT_CONTRACT,
    policy,
    events,
    computeDealSpend,
    passportEventsForDeal,
    settlementStatusForDeal,
    residualStatusForDeal,
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

    if (!groups.has(currency)) {
      groups.set(currency, {
        currency,
        deals: [],
        received: parseDecimal('0'),
        spent: parseDecimal('0'),
        remaining: parseDecimal('0'),
        status: 'AUTHORITATIVE',
        reasons: [],
      });
    }

    const group = groups.get(currency);
    group.deals.push(deal.deal_id);
    const received = deal.verified_received;
    const spent = deal.actual_spend;
    const remaining = deal.remaining_execution;

    if (received?.status !== 'AUTHORITATIVE'
        || spent?.status !== 'AUTHORITATIVE'
        || remaining?.status !== 'AUTHORITATIVE') {
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
    reason: group.status === 'AUTHORITATIVE'
      ? null
      : uniq(group.reasons)[0] || 'FUNDING_AGGREGATE_TO_VERIFY',
  }));
}

export function buildNativeResidualAggregate(residuals = []) {
  const groups = new Map();

  for (const residual of residuals || []) {
    const currency = upper(residual?.currency);
    if (!currency) continue;

    if (!groups.has(currency)) {
      groups.set(currency, {
        currency,
        total: parseDecimal('0'),
        status: 'AUTHORITATIVE',
        reasons: [],
        events: [],
      });
    }

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
    funding_event_ids: uniq(group.events),
    source_basis: 'NATIVE_EVENT_RESIDUALS_ONLY',
    status: group.status,
    reason: group.status === 'AUTHORITATIVE'
      ? null
      : uniq(group.reasons)[0] || 'NATIVE_RESIDUAL_TO_VERIFY',
  }));
}
