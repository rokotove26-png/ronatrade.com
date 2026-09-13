import { decimalCompare, decimalSum, decimalToString } from './decimal.mjs';

const OWNER_ROLES = new Set(['OWNER', 'ADMIN']);
const ALLOWED_ACTIONS = new Set(['BIND_TO_DEAL', 'ASSIGN_ADVANCE_PAYMENT']);

function assertHumanOwnerActor(actor) {
  const role = String(actor?.role || '').toUpperCase();
  if (!OWNER_ROLES.has(role) || actor?.is_system === true || actor?.is_ai === true || String(actor?.actor_type || 'HUMAN').toUpperCase() !== 'HUMAN') {
    throw new Error('OWNER_ACTION_FORBIDDEN');
  }
  if (!actor?.id) throw new Error('OWNER_ACTOR_ID_REQUIRED');
}

export function buildOwnerPaymentDecision({ actor, payment, currentAuthority = null, action, payload = {}, idFactory, now }) {
  assertHumanOwnerActor(actor);
  if (!ALLOWED_ACTIONS.has(action)) throw new Error('OWNER_ACTION_INVALID');
  if (!payment?.payment_key || !payment?.amount || !payment?.currency) throw new Error('PAYMENT_SCOPE_REQUIRED');
  if (payload.expected_current_authority_id !== undefined) {
    const actual = currentAuthority?.id || null;
    if ((payload.expected_current_authority_id || null) !== actual) throw new Error('STALE_OWNER_DECISION');
  }
  const makeId = idFactory || (() => crypto.randomUUID());
  const timestamp = now || new Date().toISOString();
  const authorityId = makeId();
  const auditId = makeId();
  let lines = [];
  let classification = 'ADVANCE_PAYMENT_ASSIGNED';
  if (action === 'BIND_TO_DEAL') {
    if (!Array.isArray(payload.lines) || payload.lines.length === 0) throw new Error('BIND_LINES_REQUIRED');
    lines = payload.lines.map((line) => {
      if (!line.deal_key || line.amount === null || line.amount === undefined) throw new Error('BIND_LINE_INVALID');
      if (decimalCompare(String(line.amount), '0') <= 0) throw new Error('BIND_AMOUNT_MUST_BE_POSITIVE');
      const currency = String(line.currency || payment.currency).toUpperCase();
      if (currency !== String(payment.currency).toUpperCase()) throw new Error('BIND_CURRENCY_MISMATCH');
      return {
        attribution_id: authorityId,
        deal_key: String(line.deal_key),
        amount: String(line.amount),
        currency,
        amount_status: 'EXACT',
      };
    });
    const sum = decimalSum(lines.map((line) => line.amount));
    if (decimalCompare(sum, String(payment.amount)) !== 0) throw new Error('BIND_AMOUNT_COVERAGE_MISMATCH');
    classification = lines.length > 1 ? 'KNOWN_MULTI_DEAL_EXACT_SPLIT' : 'RESOLVED';
  }
  const authority = {
    id: authorityId,
    payment_key: String(payment.payment_key),
    classification,
    decision_type: action,
    authority_kind: 'OWNER',
    business_scope_refs: payload.business_scope_refs || [],
    materialization_status: action === 'BIND_TO_DEAL' ? 'PENDING_MATERIALIZATION' : 'NOT_APPLICABLE',
    authority_state: 'AUTHORITATIVE',
    lifecycle_state: 'CURRENT',
    effective_at: timestamp,
    supersedes_id: currentAuthority?.id || null,
    actor_id: String(actor.id),
    actor_role: String(actor.role).toUpperCase(),
    source_refs: payload.source_refs || [],
    source_locked: true,
    current: true,
  };
  const auditRecord = {
    id: auditId,
    event_type: 'OWNER_PAYMENT_DECISION',
    payment_key: String(payment.payment_key),
    action,
    actor_id: String(actor.id),
    actor_role: String(actor.role).toUpperCase(),
    supersedes_id: currentAuthority?.id || null,
    resulting_authority_id: authorityId,
    effective_at: timestamp,
    request_fingerprint: payload.idempotency_key || null,
    previous_authority_snapshot: currentAuthority || null,
    resulting_authority_snapshot: authority,
    resulting_lines: lines,
  };
  return { authority, lines, auditRecord };
}

export function canExecuteOwnerPaymentDecision(actor) {
  try {
    assertHumanOwnerActor(actor);
    return true;
  } catch {
    return false;
  }
}
