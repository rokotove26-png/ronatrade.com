const SUPABASE_URL = 'https://sxawrwzeobaqwwmlkzws.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_W2MxTx00ILiugSyZKp8uyQ_zBzcyorL';
const PORTAL_API = `${SUPABASE_URL}/functions/v1/rona-portal-api`;
const ADMIN_CONTROL_PLANE_API = `${SUPABASE_URL}/functions/v1/rona-admin-control-plane`;
const ADMIN_CLIENT_AUTHORITY_API = `${SUPABASE_URL}/functions/v1/rona-admin-client-authority`;
const ACCESS_COOKIE = 'rona_portal_at';
const REFRESH_COOKIE = 'rona_portal_rt';

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
function sameOriginPost(request) {
  const url = new URL(request.url);
  const origin = request.headers.get('origin');
  if (origin) return origin === url.origin;
  const ref = request.headers.get('referer');
  if (!ref) return false;
  try { return new URL(ref).origin === url.origin; } catch { return false; }
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
  if (request.method === 'POST' && !sameOriginPost(request)) return json({ ok:false, code:'ORIGIN_DENIED' }, 403);
  let session;
  try { session = await ensureSession(request); }
  catch (_) { return json({ ok:false, code:'PORTAL_SESSION_UPSTREAM_UNAVAILABLE' }, 503); }
  if (!session) return json({ ok:false, code:'PORTAL_ACCESS_DENIED' }, 401);
  const roles = Array.isArray(session.me?.user?.roles) ? session.me.user.roles.map(String) : [];
  if (!roles.includes('ADMIN')) return json({ ok:false, code:'ROLE_MISMATCH' }, 403, session.setCookies);

  const url = new URL(request.url);
  const prefix = '/portal/admin-authority';
  const path = url.pathname.startsWith(prefix) ? (url.pathname.slice(prefix.length) || '/') : '/';
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
  return path === '/bootstrap'
    ? normalizeBootstrapCompanyNames(upstream, session.setCookies)
    : secureUpstream(upstream, session.setCookies);
}
