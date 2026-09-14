function send(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function pathOf(req) {
  const pathname = new URL(req.url).pathname;
  const marker = '/rona-owner-ai-sync';
  const index = pathname.indexOf(marker);
  return index >= 0 ? (pathname.slice(index + marker.length) || '/') : pathname;
}

function requireRole(ctx, role) {
  if (!ctx?.roles?.includes(role)) throw Object.assign(new Error('ROLE_MISMATCH'), { status: 403 });
}

export function createRonaOwnerAiSyncRuntimeHandler(options = {}) {
  const authContext = options.authContext;
  const adminSync = options.adminSync;
  const agentSync = options.agentSync;
  const logger = options.logger || console;
  if (typeof authContext !== 'function') throw new TypeError('RUNTIME_AUTH_CONTEXT_REQUIRED');
  if (typeof adminSync !== 'function') throw new TypeError('RUNTIME_ADMIN_SYNC_REQUIRED');
  if (typeof agentSync !== 'function') throw new TypeError('RUNTIME_AGENT_SYNC_REQUIRED');

  return async function ronaOwnerAiSyncRuntimeHandler(req) {
    const ctx = await authContext(req);
    if (!ctx) return send(401, { ok: false, code: 'PORTAL_ACCESS_DENIED' });
    try {
      const path = pathOf(req);
      if (path === '/admin/payments-v7/owner-decision') {
        if (req.method !== 'POST') return send(405, { ok: false, code: 'METHOD_NOT_ALLOWED' });
        requireRole(ctx, 'ADMIN');
        // This is an authentication/authorization handoff only. The outer V7 handler consumes it
        // server-side, re-reads authoritative Payment/reconciliation state and owns persistence.
        return send(200, { ok: true, data: { ownerMutationAuth: { userId: String(ctx.userId), roles: ctx.roles || [] } } });
      }
      if (req.method !== 'GET') return send(405, { ok: false, code: 'METHOD_NOT_ALLOWED' });
      if (path === '/admin/sync') {
        requireRole(ctx, 'ADMIN');
        return send(200, { ok: true, data: await adminSync() });
      }
      if (path === '/agent/sync') {
        requireRole(ctx, 'AGENT');
        return send(200, { ok: true, data: await agentSync(ctx) });
      }
      return send(404, { ok: false, code: 'ROUTE_NOT_FOUND' });
    } catch (error) {
      logger.error?.('rona-owner-ai-sync error', error);
      const status = Number(error?.status || 500);
      return send(status >= 400 && status < 600 ? status : 500, { ok: false, code: String(error?.message || 'SERVER_ERROR') });
    }
  };
}
