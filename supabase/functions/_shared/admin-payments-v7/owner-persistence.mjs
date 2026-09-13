const OWNER_DECISIONS = new Set(['BIND_TO_DEAL', 'ASSIGN_ADVANCE_PAYMENT']);

function assertSealedOwnerDecision(authority, auditRecord) {
  if (!authority || !auditRecord) throw new Error('OWNER_DECISION_PERSISTENCE_ENVELOPE_REQUIRED');
  if (!OWNER_DECISIONS.has(authority.decision_type)) throw new Error('OWNER_DECISION_TYPE_INVALID');
  if (!authority.id || !authority.payment_key || !authority.idempotency_key) throw new Error('OWNER_DECISION_AUTHORITY_IDENTITY_REQUIRED');
  if (authority.source_locked !== true || authority.authority_state !== 'AUTHORITATIVE') throw new Error('OWNER_DECISION_AUTHORITY_NOT_SOURCE_LOCKED');
  if (!Array.isArray(authority.scope_deal_keys) || !Array.isArray(authority.lines_snapshot)) throw new Error('OWNER_DECISION_SEALED_AGGREGATE_REQUIRED');
  if (authority.decision_type === 'BIND_TO_DEAL') {
    if (authority.attribution_mode !== 'EXACT' || authority.lines_snapshot.length === 0 || authority.scope_deal_keys.length === 0) throw new Error('OWNER_BIND_SEALED_CONTRACT_INVALID');
  }
  if (authority.decision_type === 'ASSIGN_ADVANCE_PAYMENT') {
    if (authority.attribution_mode !== 'NO_DEAL_BINDING' || authority.classification !== 'RONA_ADVANCE_DEAL_SPEND' || authority.lines_snapshot.length !== 0 || authority.scope_deal_keys.length !== 0) throw new Error('OWNER_ADVANCE_SEALED_CONTRACT_INVALID');
  }
  if (String(auditRecord.resulting_authority_id) !== String(authority.id)) throw new Error('OWNER_DECISION_AUDIT_AUTHORITY_MISMATCH');
  if (String(auditRecord.payment_key) !== String(authority.payment_key)) throw new Error('OWNER_DECISION_AUDIT_PAYMENT_MISMATCH');
  if (auditRecord.action !== authority.decision_type) throw new Error('OWNER_DECISION_AUDIT_ACTION_MISMATCH');
  if (!auditRecord.request_snapshot || typeof auditRecord.request_snapshot !== 'object') throw new Error('OWNER_DECISION_REQUEST_AUDIT_REQUIRED');
}

export function createOwnerDecisionPersistenceEnvelope(decision) {
  const authority = decision?.authority;
  const auditRecord = decision?.auditRecord;
  assertSealedOwnerDecision(authority, auditRecord);
  return {
    p_expected_current_authority_id: authority.supersedes_id || null,
    p_authority: authority,
    p_audit: auditRecord,
  };
}

// This adapter is intentionally not wired to a production mutation endpoint in Stage 3C.1.
// `executeRpc` must invoke the single PostgreSQL function below as one statement; transaction,
// optimistic locking, idempotency, authority insert and audit insert are enforced inside the DB.
export async function persistOwnerPaymentDecisionV7({ executeRpc, decision }) {
  if (typeof executeRpc !== 'function') throw new Error('OWNER_DECISION_RPC_EXECUTOR_REQUIRED');
  const envelope = createOwnerDecisionPersistenceEnvelope(decision);
  return executeRpc('portal_private.persist_owner_payment_decision_v7', envelope);
}
