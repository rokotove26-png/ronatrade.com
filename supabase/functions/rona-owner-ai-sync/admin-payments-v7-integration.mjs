import {
  buildAdminPaymentsV7FromRawSources,
  buildOwnerPaymentDecision,
  createAdminPaymentsV7SourceBundle,
  createOwnerDecisionPersistenceEnvelope,
} from '../_shared/admin-payments-v7/index.mjs';

export const ADMIN_PAYMENTS_V7_OWNER_DECISION_PATH = '/admin/payments-v7/owner-decision';

export function normalizeRonaOwnerAiSyncPath(pathname) {
  const value = String(pathname || '');
  if (/\/admin\/sync\/?$/.test(value)) return '/admin/sync';
  if (/\/agent\/sync\/?$/.test(value)) return '/agent/sync';
  if (/\/admin\/payments-v7\/owner-decision\/?$/.test(value)) return ADMIN_PAYMENTS_V7_OWNER_DECISION_PATH;
  return value;
}

function normalizeRequest(req, normalizedPath) {
  const url = new URL(req.url);
  if (url.pathname === normalizedPath) return req;
  url.pathname = normalizedPath;
  return new Request(url.toString(), req);
}
function ownerAuthProbeRequest(req) {
  const url = new URL(req.url);
  url.pathname = ADMIN_PAYMENTS_V7_OWNER_DECISION_PATH;
  return new Request(url.toString(), { method: 'POST', headers: req.headers });
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
function jsonError(status, code) { return jsonResponse(status, { ok: false, code, component: 'ADMIN_PAYMENTS_V7' }); }
function text(value) { return String(value ?? '').trim(); }
function ownerMutationStatus(error) {
  const code = String(error?.message || 'SERVER_ERROR');
  if (/STALE_OWNER_DECISION|RECONCILIATION_NOT_ACTIONABLE|CURRENT_AUTHORITY_CONFLICT|IDEMPOTENCY_CONFLICT/.test(code)) return 409;
  if (/REQUIRED|INVALID|NOT_ALLOWED|NOT_ACTIONABLE|NOT_IN_PAYMENTS_CONTOUR|ATTRIBUTION_INTEGRITY_ERROR|CLIENT_AUTHORITY_FIELDS_FORBIDDEN|DEAL_BINDING_FORBIDDEN/.test(code)) return 400;
  return 500;
}

function assertClientOwnerDecisionShape(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('OWNER_DECISION_REQUEST_REQUIRED');
  for (const forbidden of ['lines', 'amount', 'currency', 'scope_deal_keys', 'candidate_deal_ids', 'business_scope_refs', 'source_refs']) {
    if (Object.prototype.hasOwnProperty.call(body, forbidden)) throw new Error('OWNER_DECISION_CLIENT_AUTHORITY_FIELDS_FORBIDDEN');
  }
  const paymentKey = text(body.payment_key);
  const action = text(body.action).toUpperCase();
  const idempotencyKey = text(body.idempotency_key);
  if (!paymentKey) throw new Error('OWNER_DECISION_PAYMENT_KEY_REQUIRED');
  if (!['BIND_TO_DEAL', 'ASSIGN_ADVANCE_PAYMENT'].includes(action)) throw new Error('OWNER_ACTION_INVALID');
  if (!Object.prototype.hasOwnProperty.call(body, 'expected_current_authority_id')) throw new Error('EXPECTED_CURRENT_AUTHORITY_ID_REQUIRED');
  if (!idempotencyKey) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
  return {
    payment_key: paymentKey,
    action,
    deal_key: text(body.deal_key) || null,
    expected_current_authority_id: body.expected_current_authority_id === null ? null : text(body.expected_current_authority_id),
    idempotency_key: idempotencyKey,
  };
}

function currentAuthorityFor(sourceBundle, reconciliation) {
  const currentId = reconciliation?.current_authority_id;
  if (!currentId) return null;
  return (sourceBundle.attributionClaims || []).find((claim) => String(claim?.id) === String(currentId)) || null;
}

async function handleOwnerDecision(req, options) {
  if (req.method !== 'POST') return jsonError(405, 'METHOD_NOT_ALLOWED');
  const { runtimeHandler, readRawSources, buildProjection, buildSourceBundle, persistOwnerDecision, logger } = options;
  if (typeof persistOwnerDecision !== 'function') return jsonError(503, 'OWNER_DECISION_ENDPOINT_NOT_CONFIGURED');

  // Reuse the canonical runtime authentication/session/ADMIN authorization path. The probe response
  // is consumed here and never exposed as the mutation result.
  const authResponse = await runtimeHandler(ownerAuthProbeRequest(req));
  if (!authResponse.ok) return authResponse;
  const authPayload = await authResponse.json().catch(() => null);
  const ctx = authPayload?.data?.ownerMutationAuth;
  if (!ctx?.userId || !Array.isArray(ctx.roles) || !ctx.roles.includes('ADMIN')) return jsonError(403, 'ROLE_MISMATCH');

  let requestBody;
  try {
    requestBody = assertClientOwnerDecisionShape(await req.json());
  } catch (error) {
    return jsonError(ownerMutationStatus(error), String(error?.message || 'OWNER_DECISION_REQUEST_INVALID'));
  }

  try {
    // A mutation never trusts the browser projection. It re-reads current bank facts,
    // business authority, readiness and the current Payments contour in one fresh DB snapshot.
    const rawSources = await readRawSources();
    const sourceBundle = buildSourceBundle(rawSources);
    const projection = buildProjection(rawSources);
    if (!projection || projection.contract !== 'ADMIN_PAYMENTS_V7') throw new Error('ADMIN_PAYMENTS_V7_PROJECTION_INVALID');

    const reconciliation = (projection.owner_exception_queue || []).find((item) => String(item?.payment_key) === requestBody.payment_key);
    if (!reconciliation || reconciliation.reconciliation_class !== 'GENUINELY_UNALLOCATED' || reconciliation.owner_action_required !== true) {
      throw new Error('OWNER_ACTION_RECONCILIATION_NOT_ACTIONABLE');
    }
    if (!(reconciliation.allowed_owner_actions || []).includes(requestBody.action)) throw new Error('OWNER_ACTION_NOT_ALLOWED_FOR_CURRENT_STATE');
    if ((reconciliation.current_authority_id || null) !== requestBody.expected_current_authority_id) throw new Error('STALE_OWNER_DECISION');

    const payment = (sourceBundle.payments || []).find((item) => String(item?.payment_key) === requestBody.payment_key);
    if (!payment) throw new Error('PAYMENT_SCOPE_REQUIRED');

    const currentAuthority = currentAuthorityFor(sourceBundle, reconciliation);
    const payload = {
      expected_current_authority_id: requestBody.expected_current_authority_id,
      idempotency_key: requestBody.idempotency_key,
    };
    if (requestBody.action === 'BIND_TO_DEAL') {
      if (!requestBody.deal_key) throw new Error('BIND_TARGET_DEAL_REQUIRED');
      const target = (sourceBundle.contour || []).find((deal) => String(deal?.deal_key) === requestBody.deal_key);
      if (!target) throw new Error('BIND_TARGET_DEAL_NOT_IN_PAYMENTS_CONTOUR');
      // Single-deal Owner binding is exact full-payment coverage. Amount/currency come only from the
      // fresh bank fact. candidate_deal_ids are presentation hints and are not consumed here.
      payload.lines = [{ deal_key: requestBody.deal_key, amount: payment.amount, currency: payment.currency }];
    } else if (requestBody.deal_key) {
      throw new Error('OWNER_ADVANCE_DEAL_BINDING_FORBIDDEN');
    }

    const decision = buildOwnerPaymentDecision({
      actor: { id: String(ctx.userId), role: 'ADMIN', actor_type: 'HUMAN' },
      payment,
      currentAuthority,
      currentReconciliation: reconciliation,
      contourDeals: sourceBundle.contour || [],
      action: requestBody.action,
      payload,
    });
    const envelope = createOwnerDecisionPersistenceEnvelope(decision);
    const persisted = await persistOwnerDecision({ envelope, decision, context: ctx });
    return jsonResponse(200, {
      ok: true,
      data: {
        status: 'PERSISTED',
        payment_key: requestBody.payment_key,
        action: requestBody.action,
        authority_id: persisted?.id || decision.authority.id,
        refresh_required: '/admin/sync',
      },
    });
  } catch (error) {
    logger.error?.('admin-payments-v7 owner decision failed', error);
    return jsonError(ownerMutationStatus(error), String(error?.message || 'SERVER_ERROR'));
  }
}

export function createRonaOwnerAiSyncV7Handler(options) {
  const runtimeHandler = options?.runtimeHandler;
  const readRawSources = options?.readRawSources;
  const buildProjection = options?.buildProjection || buildAdminPaymentsV7FromRawSources;
  const buildSourceBundle = options?.buildSourceBundle || createAdminPaymentsV7SourceBundle;
  const persistOwnerDecision = options?.persistOwnerDecision;
  const logger = options?.logger || console;
  if (typeof runtimeHandler !== 'function') throw new TypeError('AI_SYNC_RUNTIME_HANDLER_REQUIRED');
  if (typeof readRawSources !== 'function') throw new TypeError('ADMIN_PAYMENTS_V7_SOURCE_READER_REQUIRED');
  if (typeof buildProjection !== 'function') throw new TypeError('ADMIN_PAYMENTS_V7_PROJECTION_BUILDER_REQUIRED');
  if (typeof buildSourceBundle !== 'function') throw new TypeError('ADMIN_PAYMENTS_V7_SOURCE_BUNDLE_BUILDER_REQUIRED');

  return async function handleRonaOwnerAiSync(req) {
    const normalizedPath = normalizeRonaOwnerAiSyncPath(new URL(req.url).pathname);
    if (normalizedPath === ADMIN_PAYMENTS_V7_OWNER_DECISION_PATH) {
      return handleOwnerDecision(req, { runtimeHandler, readRawSources, buildProjection, buildSourceBundle, persistOwnerDecision, logger });
    }

    const response = await runtimeHandler(normalizeRequest(req, normalizedPath));
    if (normalizedPath !== '/admin/sync' || req.method !== 'GET' || !response.ok) return response;

    const payload = await response.json().catch(() => null);
    if (!payload?.data || typeof payload.data !== 'object') return jsonError(502, 'ADMIN_SYNC_PAYLOAD_INVALID');

    let rawSources;
    try {
      rawSources = await readRawSources();
    } catch (error) {
      logger.error?.('admin-payments-v7 source read failed', error);
      return jsonError(502, 'ADMIN_PAYMENTS_V7_SOURCE_FAILURE');
    }

    let projection;
    try {
      projection = buildProjection(rawSources);
    } catch (error) {
      logger.error?.('admin-payments-v7 projection build failed', error);
      return jsonError(502, 'ADMIN_PAYMENTS_V7_PROJECTION_FAILURE');
    }

    if (!projection || projection.contract !== 'ADMIN_PAYMENTS_V7') return jsonError(502, 'ADMIN_PAYMENTS_V7_PROJECTION_INVALID');
    payload.data.paymentsV7Projection = projection;

    const headers = new Headers(response.headers);
    headers.set('content-type', 'application/json; charset=utf-8');
    headers.set('cache-control', 'no-store');
    headers.set('x-rona-owner-payments-semantics', 'ADMIN_PAYMENTS_V7');
    headers.set('x-rona-payments-upstream-lifecycle', 'READ_ONLY_EXISTING_HANDOFF');
    headers.delete('content-length');
    return new Response(JSON.stringify(payload), { status: response.status, statusText: response.statusText, headers });
  };
}
