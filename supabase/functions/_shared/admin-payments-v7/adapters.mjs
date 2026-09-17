import { canonicalDecimalString } from './decimal.mjs';
import { authorityRef, moneyValue } from './money.mjs';
import { applyPaymentRecipientSemantics } from './recipient.mjs';

function upper(value) { return value === null || value === undefined ? null : String(value).trim().toUpperCase(); }
function isCurrentLifecycle(value) { return !['SUPERSEDED', 'REVERSED', 'REJECTED', 'CANCELLED', 'INACTIVE', 'ARCHIVED'].includes(upper(value)); }
function isAuthoritative(value) { return !['REJECTED', 'REVERSED', 'INVALID', 'INACTIVE', 'SUPERSEDED'].includes(upper(value)); }
function isLiveDeal(deal) {
  return isCurrentLifecycle(deal.lifecycle_state)
    && isAuthoritative(deal.authority_state)
    && !['CANCELLED', 'CLOSED', 'ARCHIVED', 'SUPERSEDED'].includes(upper(deal.business_status));
}

export function adaptPaymentsContour({ deals = [], workflows = [], clients = [], contracts = [] }) {
  const workflowByDeal = new Map(workflows.map((w) => [String(w.deal_key), w]));
  const clientByKey = new Map(clients.map((c) => [String(c.id), c]));
  const contractByKey = new Map(contracts.map((c) => [String(c.id), c]));
  return deals.flatMap((deal) => {
    const workflow = workflowByDeal.get(String(deal.id));
    if (!workflow || !['READY', 'SENT'].includes(upper(workflow.payment_handoff_state))) return [];
    if (!isLiveDeal(deal)) return [];
    if (workflow.cancellation_state && !['NONE', 'NOT_CANCELLED', 'ACTIVE'].includes(upper(workflow.cancellation_state))) return [];
    const client = clientByKey.get(String(deal.client_key));
    const contract = contractByKey.get(String(deal.contract_key));
    return [{
      deal_key: String(deal.id), deal_id: deal.deal_id, client_key: String(deal.client_key), client_display: client?.legal_name || null,
      contract_key: String(deal.contract_key), contract_id: contract?.contract_id || null, payment_handoff_state: upper(workflow.payment_handoff_state),
      current: true, authority_state: deal.authority_state || null, lifecycle_state: deal.lifecycle_state || null,
      authority_refs: [authorityRef(deal), authorityRef(workflow)],
    }];
  });
}

export function adaptBankFacts(rows = []) {
  return rows.filter((row) => isCurrentLifecycle(row.lifecycle_state) && isAuthoritative(row.authority_state)).map((row) => applyPaymentRecipientSemantics({
    payment_key: String(row.id), payment_id: row.payment_id, payment_at: row.payment_at,
    direction: upper(row.payment_direction), kind: upper(row.payment_kind), amount: canonicalDecimalString(row.amount),
    currency: upper(row.currency), bank_fact_status: upper(row.bank_fact_status),
    finance_verification_status: upper(row.finance_verification_status || row.finance_status),
    allocation_applicability: upper(row.deal_allocation_applicability), allocation_review_status: upper(row.allocation_review_status),
    candidate_deal_ids: Array.isArray(row.candidate_deal_ids) ? row.candidate_deal_ids.map(String) : [],
    bank_transaction_reference: row.bank_transaction_reference || null,
    original_payment_purpose: row.original_payment_purpose || null,
    bank_account_reference: row.bank_account_reference || null,
    bank_statement_date: row.bank_statement_date || null,
    current: true, source_locked: upper(row.bank_fact_status) === 'BANK_CONFIRMED',
    authority_state: row.authority_state || null, lifecycle_state: row.lifecycle_state || null,
    authority_refs: [authorityRef(row)],
  }, row));
}

export function adaptAllocationMaterialization(rows = [], history = []) {
  const supersededByNew = new Map();
  for (const event of history) if (event.old_allocation_id && event.new_allocation_id) supersededByNew.set(String(event.old_allocation_id), String(event.new_allocation_id));
  return rows.map((row) => ({
    id: String(row.id), payment_key: String(row.payment_key), deal_key: row.deal_key ? String(row.deal_key) : null,
    amount: canonicalDecimalString(row.allocated_amount), currency: row.currency ? upper(row.currency) : null,
    allocation_status: upper(row.allocation_status), finance_status: upper(row.finance_status),
    authority_state: row.authority_state ? String(row.authority_state) : null, lifecycle_state: row.lifecycle_state ? String(row.lifecycle_state) : null,
    source_version: row.source_version || null, source_timestamp: row.source_timestamp || row.updated_at || row.created_at || null,
    superseded_by_allocation_id: supersededByNew.get(String(row.id)) || null,
    current: isCurrentLifecycle(row.lifecycle_state) && isAuthoritative(row.authority_state) && upper(row.allocation_status) === 'VERIFIED' && !supersededByNew.has(String(row.id)),
    source_locked: upper(row.allocation_status) === 'VERIFIED',
    authority_ref: { source_type: 'PAYMENT_ALLOCATION', source_id: String(row.id) },
    authority_refs: [authorityRef(row)],
  }));
}

export function allocationRowsToAuthorityClaims(materialization = [], payments = []) {
  const paymentByKey = new Map((payments || []).map((payment) => [String(payment.payment_key), payment]));
  const grouped = new Map();
  for (const row of (materialization || []).filter((item) => item.current === true && item.source_locked === true && item.deal_key)) {
    const key = String(row.payment_key);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }
  return [...grouped.entries()].map(([paymentKey, rows]) => {
    const sorted = [...rows].sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const ids = sorted.map((row) => String(row.id));
    const typedAllocationRefs = ids.map((id) => ({ source_type: 'PAYMENT_ALLOCATION', source_id: id }));
    const payment = paymentByKey.get(paymentKey);
    const isFee = upper(payment?.kind) === 'BANK_FEE';
    return {
      id: `PAYMENT_ALLOCATION_SET:${ids.join('+')}`,
      payment_key: paymentKey,
      classification: isFee ? 'ASSOCIATED_BANK_FEE' : (sorted.length > 1 ? 'KNOWN_MULTI_DEAL_EXACT_SPLIT' : 'RESOLVED'),
      disposition: 'BIND_TO_DEAL',
      lines: sorted.map((row) => ({
        deal_key: String(row.deal_key), amount: canonicalDecimalString(row.amount), currency: upper(row.currency),
        amount_status: 'EXACT', materialization_id: row.id,
      })),
      scope_deal_keys: [...new Set(sorted.map((row) => String(row.deal_key)))],
      current: true,
      source_locked: true,
      authority_kind: 'PAYMENT_ALLOCATION',
      authority_ref: typedAllocationRefs.length === 1
        ? typedAllocationRefs[0]
        : { source_type: 'PAYMENT_ALLOCATION_SET', source_id: ids.join('+') },
      authority_identity_refs: typedAllocationRefs,
      authority_state: 'AUTHORITATIVE',
      lifecycle_state: 'CURRENT',
      effective_at: sorted.map((row) => row.source_timestamp).filter(Boolean).sort().at(-1) || null,
      source_version: [...new Set(sorted.map((row) => row.source_version).filter(Boolean))].join('|') || null,
      authority_refs: sorted.flatMap((row) => row.authority_refs || []),
    };
  });
}

export function adaptOutgoingPaymentFactsAuthority(rows = [], payments = [], contour = []) {
  const paymentById = new Map(payments.map((payment) => [String(payment.payment_id), payment]));
  const dealKeyById = new Map(contour.map((item) => [String(item.deal_id), String(item.deal_key)]));
  const claims = [];
  for (const row of rows) {
    const payment = paymentById.get(String(row.payment_id || row.fact_id));
    if (!payment) continue;
    const dealKeys = (row.deal_ids || []).map((id) => dealKeyById.get(String(id))).filter(Boolean);
    if (!dealKeys.length) continue;
    const sourceLocked = upper(row.bank_fact_status) === 'BANK_CONFIRMED' && isCurrentLifecycle(row.lifecycle_state) && isAuthoritative(row.authority_state);
    if (!sourceLocked) continue;
    const confirmedExactSingle = dealKeys.length === 1 && ['CONFIRMED', 'VERIFIED', 'ALLOCATED'].includes(upper(row.deal_allocation_status));
    const id = `OUTGOING_FACT:${row.id || row.fact_id}`;
    const isFee = upper(payment.kind) === 'BANK_FEE';
    claims.push({
      id, payment_key: payment.payment_key,
      classification: isFee ? 'ASSOCIATED_BANK_FEE' : (confirmedExactSingle ? 'RESOLVED' : 'SHARED_DEAL_SCOPE_SPLIT_TO_VERIFY'),
      disposition: confirmedExactSingle ? 'BIND_TO_DEAL' : null,
      lines: confirmedExactSingle ? [{ deal_key: dealKeys[0], amount: canonicalDecimalString(row.amount), currency: upper(row.currency), amount_status: 'EXACT' }] : [],
      scope_deal_keys: dealKeys, current: true, source_locked: true, authority_kind: 'OWNER_OUTGOING_PAYMENT_FACT',
      authority_ref: { source_type: 'OWNER_OUTGOING_PAYMENT_FACT', source_id: String(row.id || row.fact_id) },
      authority_state: row.authority_state || 'AUTHORITATIVE', lifecycle_state: row.lifecycle_state || 'CURRENT',
      effective_at: row.source_timestamp || row.updated_at || row.payment_at || null, source_version: row.source_version || null,
      supersedes_authority_refs: Array.isArray(row.supersedes_authority_refs) ? row.supersedes_authority_refs : [],
      authority_refs: [authorityRef(row)],
    });
  }
  return claims;
}

export function adaptNormalizedAttributionRows(headers = [], lines = []) {
  const linesByHeader = new Map();
  for (const line of lines) {
    const key = String(line.attribution_id);
    if (!linesByHeader.has(key)) linesByHeader.set(key, []);
    linesByHeader.get(key).push({
      deal_key: line.deal_key ? String(line.deal_key) : null,
      amount: line.amount === null || line.amount === undefined ? null : canonicalDecimalString(line.amount),
      currency: line.currency ? upper(line.currency) : null,
      amount_status: upper(line.amount_status) || 'EXACT',
    });
  }
  return headers.map((row) => ({
    id: String(row.id), payment_key: String(row.payment_key), classification: row.classification,
    attribution_mode: upper(row.attribution_mode),
    disposition: row.decision_type || row.disposition || null, lines: linesByHeader.get(String(row.id)) || [],
    business_scope_refs: Array.isArray(row.business_scope_refs) ? row.business_scope_refs.map(String) : [],
    scope_deal_keys: Array.isArray(row.scope_deal_keys) ? row.scope_deal_keys.map(String) : [],
    principal_payment_key: row.principal_payment_key ? String(row.principal_payment_key) : null,
    current: isCurrentLifecycle(row.lifecycle_state) && isAuthoritative(row.authority_state), source_locked: row.source_locked !== false,
    authority_kind: row.authority_kind || 'NORMALIZED_PAYMENT_ATTRIBUTION',
    authority_ref: { source_type: row.authority_kind || 'PAYMENT_BUSINESS_ATTRIBUTION_V7', source_id: String(row.id) },
    authority_state: row.authority_state, lifecycle_state: row.lifecycle_state, effective_at: row.effective_at,
    supersedes_id: row.supersedes_id ? String(row.supersedes_id) : null,
    supersedes_authority_refs: Array.isArray(row.supersedes_authority_refs) ? row.supersedes_authority_refs : [],
    source_version: row.source_version || null, source_timestamp: row.source_timestamp || null, source_refs: row.source_refs || [],
    authority_refs: [authorityRef(row)],
  }));
}

export function adaptNormalizedFinanceRows(rows = []) {
  return rows.map((row) => {
    const refs = [authorityRef(row)]; const currency = row.obligation_currency ? upper(row.obligation_currency) : null;
    return {
      id: String(row.id), deal_key: String(row.deal_key),
      total_to_receive: row.total_to_receive === null || row.total_to_receive === undefined ? null : moneyValue(row.total_to_receive, currency, 'AUTHORITATIVE', null, refs),
      due_now: row.due_now === null || row.due_now === undefined ? null : moneyValue(row.due_now, currency, 'AUTHORITATIVE', null, refs),
      expected_not_due: row.expected_not_due === null || row.expected_not_due === undefined ? null : moneyValue(row.expected_not_due, currency, 'AUTHORITATIVE', null, refs),
      future_conditional: row.future_conditional === null || row.future_conditional === undefined ? null : moneyValue(row.future_conditional, currency, 'AUTHORITATIVE', null, refs),
      finance_status: row.finance_status || 'TO_VERIFY', documentary_status: row.documentary_status || 'TO_VERIFY',
      contractual_payment_currency: row.contractual_payment_currency ? upper(row.contractual_payment_currency) : null,
      mixed_inbound_accounting_currency: row.mixed_inbound_accounting_currency ? upper(row.mixed_inbound_accounting_currency) : null,
      current: isCurrentLifecycle(row.lifecycle_state) && isAuthoritative(row.authority_state), source_locked: row.source_locked !== false,
      authority_state: row.authority_state, lifecycle_state: row.lifecycle_state, effective_at: row.effective_at,
      supersedes_id: row.supersedes_id ? String(row.supersedes_id) : null,
      supersedes_authority_refs: Array.isArray(row.supersedes_authority_refs) ? row.supersedes_authority_refs : [],
      source_version: row.source_version || null, source_timestamp: row.source_timestamp || null, authority_refs: refs,
    };
  });
}

export function adaptResourceChains(rows = []) {
  return rows.map((row) => ({
    id: String(row.id), payment_key: String(row.payment_key), deal_key: String(row.deal_key),
    native_amount: canonicalDecimalString(row.native_amount), native_currency: upper(row.native_currency),
    accounting_amount: canonicalDecimalString(row.accounting_amount), accounting_currency: upper(row.accounting_currency),
    current: row.current !== false, source_locked: row.source_locked === true,
    supersedes_id: row.supersedes_id ? String(row.supersedes_id) : null,
    supersedes_authority_refs: Array.isArray(row.supersedes_authority_refs) ? row.supersedes_authority_refs : [],
    authority_state: row.authority_state || 'AUTHORITATIVE', lifecycle_state: row.lifecycle_state || 'CURRENT', authority_refs: [authorityRef(row)],
  }));
}

export function createAdminPaymentsV7SourceBundle(raw = {}) {
  const contour = adaptPaymentsContour(raw);
  const payments = adaptBankFacts(raw.payments || []);
  const dealKeyById = new Map(contour.map((item) => [String(item.deal_id), String(item.deal_key)]));
  for (const bankFact of payments) bankFact.candidate_deal_ids = (bankFact.candidate_deal_ids || []).map((id) => dealKeyById.get(String(id)) || String(id));
  const paymentCurrencyByKey = new Map(payments.map((item) => [String(item.payment_key), item.currency]));
  const physicalAllocations = adaptAllocationMaterialization(raw.paymentAllocations || [], raw.paymentAllocationHistory || [])
    .map((row) => ({ ...row, currency: row.currency || paymentCurrencyByKey.get(String(row.payment_key)) || null }));
  const allocationAuthorityClaims = allocationRowsToAuthorityClaims(physicalAllocations, payments);
  const normalizedAttribution = adaptNormalizedAttributionRows(raw.paymentBusinessAttributions || [], raw.paymentBusinessAttributionLines || []);
  const outgoingFactClaims = adaptOutgoingPaymentFactsAuthority(raw.ownerOutgoingPaymentFacts || [], payments, contour);
  const financeAuthorities = adaptNormalizedFinanceRows(raw.dealFinanceAuthorities || []);
  const resourceChains = adaptResourceChains(raw.resourceChains || []);
  const validDealKeys = (raw.deals || []).filter(isLiveDeal).map((deal) => String(deal.id));
  const paymentBusinessAuthorityPresent = raw.capabilities?.paymentBusinessAuthorityPresent
    ?? raw.capabilities?.paymentBusinessAuthority
    ?? (raw.paymentBusinessAttributions !== undefined && raw.paymentBusinessAttributionLines !== undefined);
  const paymentBusinessAuthorityReady = raw.capabilities?.paymentBusinessAuthorityReady === true;
  return {
    generatedAt: raw.generatedAt || new Date().toISOString(), sourceAsOf: raw.sourceAsOf || new Date().toISOString(),
    capabilities: {
      paymentBusinessAuthority: paymentBusinessAuthorityPresent,
      paymentBusinessAuthorityPresent,
      paymentBusinessAuthorityReady,
      financeAuthority: raw.capabilities?.financeAuthority ?? (raw.dealFinanceAuthorities !== undefined),
      resourceChain: raw.capabilities?.resourceChain ?? (raw.resourceChains !== undefined),
    },
    contour, validDealKeys, payments,
    attributionClaims: [...allocationAuthorityClaims, ...outgoingFactClaims, ...normalizedAttribution, ...(raw.additionalAttributionClaims || [])],
    physicalAllocations, financeAuthorities: [...financeAuthorities, ...(raw.additionalFinanceAuthorities || [])],
    resourceChains: [...resourceChains, ...(raw.additionalResourceChains || [])], paymentReferences: raw.paymentReferences || [],
  };
}
