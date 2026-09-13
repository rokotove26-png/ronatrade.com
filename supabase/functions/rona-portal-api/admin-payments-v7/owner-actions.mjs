import { validateAttributionIntegrity } from './reconciliation.mjs';

const OWNER_ROLES = new Set(['OWNER', 'ADMIN']);
const ALLOWED_ACTIONS = new Set(['BIND_TO_DEAL', 'ASSIGN_ADVANCE_PAYMENT']);
const INELIGIBLE_LIFECYCLE = new Set(['SUPERSEDED', 'REVERSED', 'REJECTED', 'CANCELLED', 'INACTIVE', 'ARCHIVED']);
const INELIGIBLE_AUTHORITY = new Set(['REJECTED', 'REVERSED', 'INVALID', 'INACTIVE', 'SUPERSEDED']);
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

  const makeId = idFactory || (() => crypto.randomUUID()); const timestamp = now || new Date().toISOString(); const authorityId = makeId(); const auditId = makeId();
  let lines = [];
  if (action === 'BIND_TO_DEAL') {
    if (!Array.isArray(payload.lines) || payload.lines.length === 0) throw new Error('BIND_LINES_REQUIRED');
    const contour = liveContourMap(contourDeals);
    const validation = validateAttributionIntegrity({
      payment,
      claim: { lines: payload.lines.map((line) => ({ ...line, amount_status: 'EXACT' })) },
      validDealKeys: [...contour.keys()],
    });
    if (validation.status !== 'AUTHORITATIVE') throw new Error(`ATTRIBUTION_INTEGRITY_ERROR:${validation.reason}`);
    lines = validation.lines.map((line) => ({ attribution_id: authorityId, ...line }));
    for (const line of lines) if (!contour.has(String(line.deal_key))) throw new Error('BIND_TARGET_DEAL_NOT_IN_PAYMENTS_CONTOUR');
  }

  const authority = {
    id: authorityId, payment_key: String(payment.payment_key), classification: 'RESOLVED', decision_type: action,
    authority_kind: 'OWNER', business_scope_refs: payload.business_scope_refs || [],
    materialization_status: action === 'BIND_TO_DEAL' ? 'PENDING_MATERIALIZATION' : 'NOT_APPLICABLE',
    authority_state: 'AUTHORITATIVE', lifecycle_state: 'CURRENT', effective_at: timestamp,
    supersedes_id: actualAuthorityId,
    supersedes_authority_refs: currentAuthority ? [currentAuthority.authority_ref || { source_type: currentAuthority.authority_kind || 'AUTHORITY', source_id: actualAuthorityId }] : [],
    actor_id: String(actor.id), actor_role: upper(actor.role), source_refs: payload.source_refs || [], source_locked: true, current: true,
    idempotency_key: payload.idempotency_key.trim(),
  };
  const auditRecord = {
    id: auditId, event_type: 'OWNER_PAYMENT_DECISION', payment_key: String(payment.payment_key), action,
    actor_id: String(actor.id), actor_role: upper(actor.role), supersedes_id: actualAuthorityId, resulting_authority_id: authorityId,
    effective_at: timestamp, request_fingerprint: payload.idempotency_key.trim(), previous_authority_snapshot: currentAuthority || null,
    current_reconciliation_snapshot: currentReconciliation, resulting_authority_snapshot: authority, resulting_lines: lines,
  };
  return { authority, lines, auditRecord };
}
export function canExecuteOwnerPaymentDecision(actor) { try { assertHumanOwnerActor(actor); return true; } catch { return false; } }
