import { buildAdminPaymentsV7FromRawSources } from '../_shared/admin-payments-v7/index.mjs';

export function normalizeRonaOwnerAiSyncPath(pathname) {
  const value = String(pathname || '');
  if (/\/admin\/sync\/?$/.test(value)) return '/admin/sync';
  if (/\/agent\/sync\/?$/.test(value)) return '/agent/sync';
  return value;
}

function normalizeRequest(req, normalizedPath) {
  const url = new URL(req.url);
  if (url.pathname === normalizedPath) return req;
  url.pathname = normalizedPath;
  return new Request(url.toString(), req);
}

function jsonError(status, code) {
  return new Response(JSON.stringify({ ok: false, code, component: 'ADMIN_PAYMENTS_V7' }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export function createRonaOwnerAiSyncV7Handler(options) {
  const runtimeHandler = options?.runtimeHandler;
  const readRawSources = options?.readRawSources;
  const buildProjection = options?.buildProjection || buildAdminPaymentsV7FromRawSources;
  const logger = options?.logger || console;
  if (typeof runtimeHandler !== 'function') throw new TypeError('AI_SYNC_RUNTIME_HANDLER_REQUIRED');
  if (typeof readRawSources !== 'function') throw new TypeError('ADMIN_PAYMENTS_V7_SOURCE_READER_REQUIRED');
  if (typeof buildProjection !== 'function') throw new TypeError('ADMIN_PAYMENTS_V7_PROJECTION_BUILDER_REQUIRED');

  return async function handleRonaOwnerAiSync(req) {
    const normalizedPath = normalizeRonaOwnerAiSyncPath(new URL(req.url).pathname);
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
