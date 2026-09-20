const SUPABASE_URL = 'https://sxawrwzeobaqwwmlkzws.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_W2MxTx00ILiugSyZKp8uyQ_zBzcyorL';
const PORTAL_API = `${SUPABASE_URL}/functions/v1/rona-portal-api`;
const ADMIN_CONTROL_PLANE_API = `${SUPABASE_URL}/functions/v1/rona-admin-control-plane`;
const ADMIN_CLIENT_AUTHORITY_API = `${SUPABASE_URL}/functions/v1/rona-admin-client-authority`;
const ACCESS_COOKIE = 'rona_portal_at';
const REFRESH_COOKIE = 'rona_portal_rt';
const IMPERSONATION_COOKIE = 'rona_admin_imp';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PORTAL_ORIGIN_HOSTS = new Set(['ronaoil.com','www.ronaoil.com']);

function parseCookies(header) {
  const out = {};
  for (const item of String(header || '').split(';')) {
    const i = item.indexOf('=');
    if (i < 1) continue;
    const key = item.slice(0, i).trim();
    const value = item.slice(i + 1).trim();
    if (key) out[key] = value;
  }
  return out;
}
function accessCookie(token, maxAge = 3600) { return `${ACCESS_COOKIE}=${token}; Max-Age=${Math.max(0, Number(maxAge) || 0)}; Path=/portal; Secure; HttpOnly; SameSite=Lax`; }
function refreshCookie(token, maxAge = 604800) { return `${REFRESH_COOKIE}=${token}; Max-Age=${Math.max(0, Number(maxAge) || 0)}; Path=/portal; Secure; HttpOnly; SameSite=Lax`; }
function tokenCookies(tokens) {
  const expires = Math.min(Math.max(Number(tokens?.expires_in || 3600), 60), 7200);
  return [accessCookie(tokens.access_token, expires), refreshCookie(tokens.refresh_token, 604800)];
}
function impersonationCookie(token, maxAge = 900) {
  return `${IMPERSONATION_COOKIE}=${token}; Max-Age=${Math.max(0, Number(maxAge) || 0)}; Path=/portal; Secure; HttpOnly; SameSite=Strict`;
}
function redirect(location, status = 303, cookies = []) {
  const headers = new Headers({
    location,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'x-frame-options': 'DENY',
  });
  for (const cookie of cookies) headers.append('set-cookie', cookie);
  return new Response(null, { status, headers });
}
function portalOriginAllowed(value) {
  try {
    const url = value instanceof URL ? value : new URL(value);
    return url.protocol === 'https:' && (url.port === '' || url.port === '443') && PORTAL_ORIGIN_HOSTS.has(url.hostname.toLowerCase());
  } catch { return false; }
}
function sameOriginPost(request) {
  const url = new URL(request.url);
  const origin = request.headers.get('origin');
  if (origin) {
    try {
      const source = new URL(origin);
      if (source.origin === url.origin) return true;
      const fetchSite = String(request.headers.get('sec-fetch-site') || '').toLowerCase();
      return (fetchSite === 'same-site' || fetchSite === 'same-origin') && portalOriginAllowed(source) && portalOriginAllowed(url);
    } catch { return false; }
  }
  const ref = request.headers.get('referer');
  if (!ref) return false;
  try {
    const source = new URL(ref);
    if (source.origin === url.origin) return true;
    const fetchSite = String(request.headers.get('sec-fetch-site') || '').toLowerCase();
    return (fetchSite === 'same-site' || fetchSite === 'same-origin') && portalOriginAllowed(source) && portalOriginAllowed(url);
  } catch { return false; }
}

export function impersonationEnterPostAllowed(request) {
  const url = new URL(request.url);
  if (!portalOriginAllowed(url)) return false;

  // Prefer the existing explicit Origin/Referer validation whenever either header exists.
  // The canonical portal sends Referrer-Policy: no-referrer, and some browser form POSTs
  // may omit both Origin and Referer. In that narrow case, rely on the browser-controlled
  // Fetch Metadata header and accept only an actual same-origin navigation.
  const origin = request.headers.get('origin');
  const ref = request.headers.get('referer');
  if (origin || ref) return sameOriginPost(request);

  const fetchSite = String(request.headers.get('sec-fetch-site') || '').toLowerCase();
  return fetchSite === 'same-origin';
}
async function authRefresh(refreshToken) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST', headers: { apikey: SUPABASE_PUBLISHABLE_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, data };
}
async function sessionMe(accessToken) {
  if (!accessToken) return null;
  try {
    const r = await fetch(`${PORTAL_API}/session/me`, { headers: { apikey: SUPABASE_PUBLISHABLE_KEY, authorization: `Bearer ${accessToken}`, accept: 'application/json' } });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.ok && j?.user ? j : null;
  } catch (_) { return null; }
}
async function ensureSession(request) {
  const cookies = parseCookies(request.headers.get('cookie'));
  const access = cookies[ACCESS_COOKIE] || '';
  const refresh = cookies[REFRESH_COOKIE] || '';
  if (access) {
    const me = await sessionMe(access);
    if (me) return { access, me, setCookies: [] };
  }
  if (!refresh) return null;
  const next = await authRefresh(refresh);
  if (!next.ok || !next.data?.access_token || !next.data?.refresh_token) return null;
  const me = await sessionMe(next.data.access_token);
  if (!me) return null;
  return { access: next.data.access_token, me, setCookies: tokenCookies(next.data) };
}
function json(body, status = 200, cookies = []) {
  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store',
    'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'x-frame-options': 'DENY',
  });
  for (const cookie of cookies) headers.append('set-cookie', cookie);
  return new Response(JSON.stringify(body), { status, headers });
}
async function secureUpstream(response, cookies = []) {
  if (!response.ok) {
    const payload = await response.clone().json().catch(() => null);
    if (!payload || typeof payload !== 'object' || !String(payload.code || '').trim()) {
      return json({ ok:false, code:`ACCESS_UPSTREAM_HTTP_${response.status}` }, response.status, cookies);
    }
  }
  const headers = new Headers(response.headers);
  headers.set('cache-control', 'no-store');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('referrer-policy', 'no-referrer');
  headers.set('x-frame-options', 'DENY');
  headers.delete('access-control-allow-origin');
  headers.delete('access-control-allow-credentials');
  headers.delete('content-length');
  for (const cookie of cookies) headers.append('set-cookie', cookie);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
async function normalizeBootstrapCompanyNames(response, cookies = []) {
  if (!response.ok) return secureUpstream(response, cookies);
  const payload = await response.clone().json().catch(() => null);
  const contracts = payload?.data?.contracts;
  if (!Array.isArray(contracts)) return secureUpstream(response, cookies);
  payload.data.contracts = contracts.map((contract) => {
    if (!contract || typeof contract !== 'object') return contract;
    const legalName = String(contract.legalName || contract.legal_name || '').trim();
    if (!legalName) return contract;
    return { ...contract, companyName: legalName, clientName: legalName };
  });
  return json(payload, response.status, cookies);
}
function clientAuthorityTarget(path) {
  return /^\/contracts\/[^/]+\/signed-document\/attach$/.test(path);
}

export async function onRequest(context) {
  const request = context.request;
  if (!['GET','POST'].includes(request.method)) return json({ ok:false, code:'METHOD_NOT_ALLOWED' }, 405);

  const url = new URL(request.url);
  const prefix = '/portal/admin-authority';
  const path = url.pathname.startsWith(prefix) ? (url.pathname.slice(prefix.length) || '/') : '/';
  const postAllowed = path === '/impersonation/enter'
    ? impersonationEnterPostAllowed(request)
    : sameOriginPost(request);
  if (request.method === 'POST' && !postAllowed) return json({ ok:false, code:'ORIGIN_DENIED' }, 403);

  let session;
  try { session = await ensureSession(request); }
  catch (_) { return json({ ok:false, code:'PORTAL_SESSION_UPSTREAM_UNAVAILABLE' }, 503); }
  if (!session) return json({ ok:false, code:'PORTAL_ACCESS_DENIED' }, 401);
  const roles = Array.isArray(session.me?.user?.roles) ? session.me.user.roles.map(String) : [];
  if (!roles.includes('ADMIN')) return json({ ok:false, code:'ROLE_MISMATCH' }, 403, session.setCookies);

  // Cloudflare Pages gives this more-specific route precedence over /portal/[[path]].
  // Keep the top-level browser handoff here so the opaque impersonation token is never exposed to browser JS.
  if (path === '/impersonation/enter' && request.method === 'POST') {
    const contentType = request.headers.get('content-type') || '';
    let body = {};
    try {
      if (contentType.includes('application/json')) body = await request.clone().json();
      else {
        const form = await request.clone().formData();
        body = {
          kind: String(form.get('kind') || ''),
          entityId: String(form.get('entityId') || ''),
          targetPortalUserId: String(form.get('targetPortalUserId') || '') || null,
        };
      }
    } catch (_) {
      return redirect('/portal/admin?accessView=companies&impersonationError=INVALID_REQUEST', 303, session.setCookies);
    }

    const kind = String(body?.kind || '').trim().toUpperCase();
    const entityId = String(body?.entityId || '').trim();
    const targetPortalUserId = String(body?.targetPortalUserId || '').trim() || null;
    const returnView = kind === 'AGENT' ? 'agents' : 'companies';
    if (!['COMPANY','AGENT'].includes(kind) || !entityId) {
      return redirect('/portal/admin?accessView=' + returnView + '&impersonationError=INVALID_REQUEST', 303, session.setCookies);
    }

    let start;
    try {
      start = await fetch(`${ADMIN_CONTROL_PLANE_API}/impersonation/start`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          authorization: `Bearer ${session.access}`,
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ kind, entityId, targetPortalUserId }),
        cache: 'no-store',
      });
    } catch (_) {
      return redirect('/portal/admin?accessView=' + returnView + '&impersonationError=ACCESS_UPSTREAM_UNAVAILABLE', 303, session.setCookies);
    }

    const payload = await start.json().catch(() => null);
    if (!start.ok || !payload?.ok || !payload?.data?.impersonationToken) {
      const code = encodeURIComponent(String(payload?.code || 'IMPERSONATION_START_FAILED'));
      return redirect('/portal/admin?accessView=' + returnView + '&impersonationError=' + code, 303, session.setCookies);
    }

    const opaque = String(payload.data.impersonationToken);
    const impersonation = payload.data?.impersonation || {};
    const sessionId = String(impersonation.id || '');
    const targetPath = String(payload.data?.targetPath || '');
    if (!UUID_RE.test(sessionId) || !['/portal/client','/portal/agent'].includes(targetPath)) {
      return redirect('/portal/admin?accessView=' + returnView + '&impersonationError=IMPERSONATION_START_FAILED', 303, session.setCookies);
    }
    const expires = Date.parse(String(impersonation.expiresAt || ''));
    const maxAge = Number.isFinite(expires) ? Math.max(1, Math.min(900, Math.floor((expires - Date.now()) / 1000))) : 720;
    return redirect(targetPath + '?impSession=' + encodeURIComponent(sessionId), 303, [...session.setCookies, impersonationCookie(opaque, maxAge)]);
  }

  const headers = new Headers({ apikey: SUPABASE_PUBLISHABLE_KEY, authorization: `Bearer ${session.access}`, accept: 'application/json' });
  for (const name of ['content-type','x-request-id','x-correlation-id','x-idempotency-key','x-current-document-id']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const bodyBytes = !['GET','HEAD'].includes(request.method) ? await request.clone().arrayBuffer() : null;
  const init = { method: request.method, headers };
  if (bodyBytes) init.body = bodyBytes;

  // Account creation for both Client and Agent is owned by the unified Admin Control Plane.
  // Client Authority remains the single owner only for signed-contract PDF attachment/activation.
  const base = clientAuthorityTarget(path) ? ADMIN_CLIENT_AUTHORITY_API : ADMIN_CONTROL_PLANE_API;
  let upstream;
  try { upstream = await fetch(`${base}${path}${url.search}`, init); }
  catch (_) { return json({ ok:false, code:'ACCESS_UPSTREAM_UNAVAILABLE' }, 502, session.setCookies); }

  // Canonical Admin -> Client/Agent handoff:
  // browser JS receives only the safe target path + session id.
  // The opaque impersonation credential is consumed here and persisted only
  // as an HttpOnly SameSite=Strict cookie, never exposed to browser JS.
  if (path === '/impersonation/start' && request.method === 'POST') {
    const payload = await upstream.json().catch(() => null);
    if (!upstream.ok || !payload?.ok || !payload?.data?.impersonationToken) {
      return json(payload || { ok:false, code:'IMPERSONATION_START_FAILED' }, upstream.status || 502, session.setCookies);
    }
    const opaque = String(payload.data.impersonationToken);
    const impersonation = payload.data?.impersonation || {};
    const sessionId = String(impersonation.id || '');
    const targetPath = String(payload.data?.targetPath || '');
    if (!UUID_RE.test(sessionId) || !['/portal/client','/portal/agent'].includes(targetPath)) {
      return json({ ok:false, code:'IMPERSONATION_START_FAILED' }, 502, session.setCookies);
    }
    delete payload.data.impersonationToken;
    const expires = Date.parse(String(impersonation.expiresAt || ''));
    const maxAge = Number.isFinite(expires) ? Math.max(1, Math.min(900, Math.floor((expires - Date.now()) / 1000))) : 720;
    return json(payload, upstream.status, [...session.setCookies, impersonationCookie(opaque, maxAge)]);
  }

  return path === '/bootstrap'
    ? normalizeBootstrapCompanyNames(upstream, session.setCookies)
    : secureUpstream(upstream, session.setCookies);
}
