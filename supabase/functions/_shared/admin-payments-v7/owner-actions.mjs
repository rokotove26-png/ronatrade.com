import { validateAttributionIntegrity } from './reconciliation.mjs';

const OWNER_ROLES = new Set(['OWNER', 'ADMIN']);
const ALLOWED_ACTIONS = new Set(['BIND_TO_DEAL', 'ASSIGN_ADVANCE_PAYMENT']);
const INELIGIBLE_LIFECYCLE = new Set(['SUPERSEDED', 'REVERSED', 'REJECTED', 'CANCELLED', 'INACTIVE', 'ARCHIVED']);
const INELIGIBLE_AUTHORITY = new Set(['REJECTED', 'REVERSED', 'INVALID', 'INACTIVE', 'SUPERSEDED']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function upper(value) { return value === null || value === undefined ? null : String(value).trim().toUpperCase(); }

function assertHumanOwnerActor(actor) {
  const role = upper(actor?.role);
  if (!OWNER_ROLES.has(role) || actor?.is_system === true || actor?.is_ai === true || upper(actor?.actor_type || 'HUMAN') !== 'HUMAN') throw new Error('OWNER_ACTION_FORBIDDEN');
  if (!actor?.id) throw new Error('OWNER_ACTOR_ID_REQUIRED');
}
function assertCurrentBankEvent(payment) {
  if (!payment?.payment_key || payment?.amount === null || payment?.amount === undefined || !payment?.currency) throw new Error('PAYMENT_SCOPE_REQUIRED');
  if (payment.current === false || INELIGIBLE_LIFECYCLE.has(upper(payment.lifecycle_state)) || INELIGIBLE_AUTHORITY.has(upper(payment.authority_state))) throw new Error('PAYMENT_NOT_CURRENT_AUTHORITATIVE');
  if (upper(payment.bank_fact_status) !== 'BANK_CONFIRMED') throw new Error('PAYMENT_BANK_FACT_NOT_AUTHORITATIVE');
  if (upper(payment.kind) === 'FX_CONVERSION') throw new Error('OWNER_ACTION_PAYMENT_NOT_ACTIONABLE');
  if (!['DEAL_ALLOCATABLE', 'APPLICABLE', 'ALLOCATABLE'].includes(upper(payment.allocation_applicability))) throw new Error('OWNER_ACTION_PAYMENT_NOT_ALLOCATABLE');
}
function assertCurrentReconciliation(reconciliation, action) {
  if (!reconciliation || reconciliation.reconciliation_class !== 'GENUINELY_UNALLOCATED' || reconciliation.status !== 'AUTHORITATIVE' || reconciliation.owner_action_required !== true) throw new Error('OWNER_ACTION_RECONCILIATION_NOT_ACTIONABLE');
  if (!Array.isArray(reconciliation.allowed_owner_actions) || !reconciliation.allowed_owner_actions.includes(action)) throw new Error('OWNER_ACTION_NOT_ALLOWED_FOR_CURRENT_STATE');
}
function liveContourMap(contourDeals = []) {
  const map = new Map();
  for (const deal of contourDeals) {
    const live = deal && deal.current !== false && !INELIGIBLE_LIFECYCLE.has(upper(deal.lifecycle_state)) && !INELIGIBLE_AUTHORITY.has(upper(deal.authority_state)) && ['READY', 'SENT'].includes(upper(deal.payment_handoff_state));
    if (live && deal.deal_key) map.set(String(deal.deal_key), deal);
  }
  return map;
}
function typedAuthorityRef(authority) {
  if (!authority) return null;
  return authority.authority_ref || {
    source_type: authority.authority_kind || authority.source_type || 'AUTHORITY',
    source_id: authority.id || null,
  };
}
function sameTableSupersedesId(authority) {
  const id = authority?.id ? String(authority.id) : null;
  if (!id || !UUID_RE.test(id)) return null;
  const kind = upper(authority.authority_kind || authority.source_type);
  return ['OWNER', 'PAYMENT_BUSINESS_ATTRIBUTION_V7', 'NORMALIZED_PAYMENT_ATTRIBUTION'].includes(kind) ? id : null;
}

export function buildOwnerPaymentDecision({ actor, payment, currentAuthority = null, currentReconciliation, contourDeals = [], action, payload = {}, idFactory, now }) {
  assertHumanOwnerActor(actor);
  if (!ALLOWED_ACTIONS.has(action)) throw new Error('OWNER_ACTION_INVALID');
  assertCurrentBankEvent(payment);
  assertCurrentReconciliation(currentReconciliation, action);
  if (!Object.prototype.hasOwnProperty.call(payload, 'expected_current_authority_id')) throw new Error('EXPECTED_CURRENT_AUTHORITY_ID_REQUIRED');
  if (typeof payload.idempotency_key !== 'string' || !payload.idempotency_key.trim()) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
  const actualAuthorityId = currentAuthority?.id || null;
  if (payload.expected_current_authority_id !== actualAuthorityId) throw new Error('STALE_OWNER_DECISION');
  if ((currentReconciliation.current_authority_id || null) !== actualAuthorityId) throw new Error('STALE_OWNER_DECISION');

  const makeId = idFactory || (() => crypto.randomUUID());
  const timestamp = now || new Date().toISOString();
  const authorityId = makeId();
  const auditId = makeId();
  const sameTablePreviousId = sameTableSupersedesId(currentAuthority);
  const previousAuthorityRef = typedAuthorityRef(currentAuthority);

  let canonicalLines = [];
  let scopeDealKeys = [];
  if (action === 'BIND_TO_DEAL') {
    if (!Array.isArray(payload.lines) || payload.lines.length === 0) throw new Error('BIND_LINES_REQUIRED');
    const contour = liveContourMap(contourDeals);
    const validation = validateAttributionIntegrity({
      payment,
      claim: { lines: payload.lines.map((line) => ({ ...line, amount_status: 'EXACT' })) },
      validDealKeys: [...contour.keys()],
    });
    if (validation.status !== 'AUTHORITATIVE') throw new Error(`ATTRIBUTION_INTEGRITY_ERROR:${validation.reason}`);
    canonicalLines = validation.lines.map((line) => ({ ...line }));
    scopeDealKeys = canonicalLines.map((line) => String(line.deal_key));
    for (const dealKey of scopeDealKeys) if (!contour.has(dealKey)) throw new Error('BIND_TARGET_DEAL_NOT_IN_PAYMENTS_CONTOUR');
  }

  const attributionMode = action === 'BIND_TO_DEAL' ? 'EXACT' : 'NO_DEAL_BINDING';
  const classification = action === 'ASSIGN_ADVANCE_PAYMENT'
    ? 'RONA_ADVANCE_DEAL_SPEND'
    : (canonicalLines.length > 1 ? 'KNOWN_MULTI_DEAL_EXACT_SPLIT' : 'RESOLVED');
  const authority = {
    id: authorityId,
    payment_key: String(payment.payment_key),
    classification,
    attribution_mode: attributionMode,
    decision_type: action,
    authority_kind: 'OWNER',
    authority_source_ref: `OWNER_PAYMENT_DECISION:${auditId}`,
    business_scope_refs: Array.isArray(payload.business_scope_refs) ? payload.business_scope_refs.map(String) : [],
    scope_deal_keys: scopeDealKeys,
    lines_snapshot: canonicalLines,
    principal_payment_key: null,
    materialization_status: action === 'BIND_TO_DEAL' ? 'NOT_MATERIALIZED' : 'NOT_APPLICABLE',
    authority_state: 'AUTHORITATIVE',
    lifecycle_state: 'CURRENT',
    effective_at: timestamp,
    supersedes_id: sameTablePreviousId,
    supersedes_authority_refs: previousAuthorityRef ? [previousAuthorityRef] : [],
    source_version: 'OWNER_ACTION_V7',
    source_timestamp: timestamp,
    source_refs: Array.isArray(payload.source_refs) ? payload.source_refs : [],
    source_locked: true,
    actor_id: String(actor.id),
    actor_role: upper(actor.role),
    idempotency_key: payload.idempotency_key.trim(),
    current: true,
  };

  const requestSnapshot = {
    payment_key: String(payment.payment_key),
    action,
    expected_current_authority_id: sameTablePreviousId,
    expected_current_authority_ref: previousAuthorityRef,
    scope_deal_keys: scopeDealKeys,
    lines_snapshot: canonicalLines,
    business_scope_refs: authority.business_scope_refs,
    source_refs: authority.source_refs,
    idempotency_key: authority.idempotency_key,
  };
  const auditRecord = {
    id: auditId,
    event_type: 'OWNER_PAYMENT_DECISION',
    payment_key: String(payment.payment_key),
    action,
    actor_id: String(actor.id),
    actor_role: upper(actor.role),
    expected_current_authority_id: sameTablePreviousId,
    expected_current_authority_ref: previousAuthorityRef,
    supersedes_id: sameTablePreviousId,
    resulting_authority_id: authorityId,
    effective_at: timestamp,
    idempotency_key: authority.idempotency_key,
    request_fingerprint: authority.idempotency_key,
    request_snapshot: requestSnapshot,
    previous_authority_snapshot: currentAuthority || null,
    current_reconciliation_snapshot: currentReconciliation,
    resulting_authority_snapshot: authority,
    resulting_lines: canonicalLines,
  };

  // `lines` is retained as a compatibility projection only. Persistence consumes the sealed
  // `authority.lines_snapshot`; there is no header-then-child write protocol.
  const lines = canonicalLines.map((line) => ({ attribution_id: authorityId, ...line }));
  return { authority, lines, auditRecord };
}
export function canExecuteOwnerPaymentDecision(actor) { try { assertHumanOwnerActor(actor); return true; } catch { return false; } }
