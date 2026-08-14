const SUPABASE_URL = 'https://sxawrwzeobaqwwmlkzws.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_W2MxTx00ILiugSyZKp8uyQ_zBzcyorL';
const PORTAL_API = `${SUPABASE_URL}/functions/v1/rona-portal-api`;
const STAFF_WORKSPACE = `${SUPABASE_URL}/functions/v1/rona-staff-workspace`;
const ACCESS_COOKIE = 'rona_portal_at';
const REFRESH_COOKIE = 'rona_portal_rt';

const SECURITY_HEADERS = Object.freeze({
  'cache-control': 'no-store, no-cache, must-revalidate',
  'pragma': 'no-cache',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
});

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

function accessCookie(token, maxAge = 3600) {
  return `${ACCESS_COOKIE}=${token}; Max-Age=${Math.max(0, Number(maxAge) || 0)}; Path=/portal; Secure; HttpOnly; SameSite=Lax`;
}
function refreshCookie(token, maxAge = 604800) {
  return `${REFRESH_COOKIE}=${token}; Max-Age=${Math.max(0, Number(maxAge) || 0)}; Path=/portal; Secure; HttpOnly; SameSite=Lax`;
}
function clearCookies() {
  return [
    `${ACCESS_COOKIE}=; Max-Age=0; Path=/portal; Secure; HttpOnly; SameSite=Lax`,
    `${REFRESH_COOKIE}=; Max-Age=0; Path=/portal; Secure; HttpOnly; SameSite=Lax`,
  ];
}
function tokenCookies(tokens) {
  const expires = Math.min(Math.max(Number(tokens?.expires_in || 3600), 60), 7200);
  return [accessCookie(tokens.access_token, expires), refreshCookie(tokens.refresh_token, 604800)];
}

function withSecurity(headers = new Headers()) {
  const out = new Headers(headers);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) out.set(k, v);
  return out;
}
function withCookies(response, cookies = []) {
  const headers = withSecurity(response.headers);
  for (const cookie of cookies) headers.append('set-cookie', cookie);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
function redirect(location, status = 303, cookies = []) {
  const headers = withSecurity(new Headers({ location }));
  for (const cookie of cookies) headers.append('set-cookie', cookie);
  return new Response(null, { status, headers });
}
function html(body, status = 200, cookies = []) {
  const headers = withSecurity(new Headers({
    'content-type': 'text/html; charset=utf-8',
    'content-security-policy': "default-src 'self' data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; object-src 'none'; form-action 'self'",
  }));
  for (const cookie of cookies) headers.append('set-cookie', cookie);
  return new Response(body, { status, headers });
}
function json(body, status = 200, cookies = []) {
  const headers = withSecurity(new Headers({ 'content-type': 'application/json; charset=utf-8' }));
  for (const cookie of cookies) headers.append('set-cookie', cookie);
  return new Response(JSON.stringify(body), { status, headers });
}

function sameOriginPost(request) {
  const url = new URL(request.url);
  const origin = request.headers.get('origin');
  if (origin) return origin === url.origin;
  const ref = request.headers.get('referer');
  if (!ref) return false;
  try { return new URL(ref).origin === url.origin; } catch { return false; }
}

async function authPassword(email, password) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}
async function authRefresh(refreshToken) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}
async function authLogout(accessToken) {
  if (!accessToken) return;
  try {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, authorization: `Bearer ${accessToken}` },
    });
  } catch (_) {}
}

async function upstream(accessToken, path, request = null) {
  const url = `${PORTAL_API}${path}`;
  const headers = new Headers();
  headers.set('authorization', `Bearer ${accessToken}`);
  headers.set('accept', 'application/json');
  if (request) {
    for (const name of ['content-type', 'x-request-id', 'x-correlation-id', 'x-idempotency-key']) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
  }
  const init = { method: request?.method || 'GET', headers };
  if (request && !['GET', 'HEAD'].includes(request.method)) init.body = await request.clone().arrayBuffer();
  return fetch(url, init);
}

async function sessionMe(accessToken) {
  if (!accessToken) return null;
  try {
    const r = await upstream(accessToken, '/session/me');
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
    if (me) return { access, refresh, me, setCookies: [] };
  }
  if (!refresh) return null;
  const next = await authRefresh(refresh);
  if (!next.ok || !next.data?.access_token || !next.data?.refresh_token) return null;
  const me = await sessionMe(next.data.access_token);
  if (!me) return null;
  return {
    access: next.data.access_token,
    refresh: next.data.refresh_token,
    me,
    setCookies: tokenCookies(next.data),
  };
}

function rolesOf(me) {
  return Array.isArray(me?.user?.roles) ? me.user.roles.map(String) : [];
}
function defaultTarget(roles) {
  if (roles.includes('ADMIN') || roles.includes('RONA_OPERATOR')) return '/portal/staff';
  if (roles.includes('AGENT')) return '/portal/agent.html';
  if (roles.includes('CLIENT')) return '/portal/client.html';
  return null;
}
function roleAllows(path, roles) {
  if (path === '/portal/staff') return roles.includes('ADMIN') || roles.includes('RONA_OPERATOR');
  if (path === '/portal/agent.html') return roles.includes('AGENT');
  if (path === '/portal/client.html') return roles.includes('CLIENT');
  return false;
}
function safeNext(value, roles) {
  if (!value) return defaultTarget(roles);
  let path = '';
  try { path = new URL(value, 'https://invalid.example').pathname; } catch { return defaultTarget(roles); }
  return roleAllows(path, roles) ? path : defaultTarget(roles);
}

function loginPage(message = '') {
  const note = message ? `<div class="error">${String(message).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</div>` : '';
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RONA Trade — Вход</title><style>
  :root{font-family:Inter,Arial,sans-serif;color:#eef4f7;background:#05090d}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at 80% 10%,#152633 0,#071018 42%,#05090d 75%)}.box{width:min(430px,calc(100vw - 32px));padding:28px;border:1px solid rgba(171,220,239,.24);border-radius:18px;background:rgba(8,15,22,.88);box-shadow:0 22px 80px rgba(0,0,0,.42)}h1{font-size:26px;margin:0 0 6px}.sub{color:#9db1bc;margin:0 0 24px}.field{display:grid;gap:7px;margin:14px 0}.field label{font-size:13px;color:#afc0c9}.field input{width:100%;padding:12px;border-radius:10px;border:1px solid rgba(171,220,239,.26);background:#09121a;color:#fff;font:inherit}.btn{width:100%;margin-top:10px;padding:12px;border:1px solid rgba(224,66,75,.45);border-radius:10px;background:rgba(224,66,75,.15);color:#fff;font-weight:800;cursor:pointer}.error{padding:10px 12px;border-radius:9px;background:#4b1e23;color:#ffdfe3;margin:12px 0;font-size:13px}.foot{margin-top:18px;color:#788d98;font-size:13px}
  </style></head><body><main class="box"><h1>RONA Trade</h1><p class="sub">Единый вход в защищённые кабинеты</p>${note}<form method="post" action="/portal/auth/login" autocomplete="on"><input type="hidden" name="next" id="next"><div class="field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="username" required></div><div class="field"><label for="password">Пароль</label><input id="password" name="password" type="password" autocomplete="current-password" required></div><button class="btn" type="submit">Войти</button></form><p class="foot">После входа сервер автоматически откроет разрешённый кабинет. Повторный вход внутри Staff / Agent / Client не требуется.</p></main><script>const q=new URLSearchParams(location.search);document.getElementById('next').value=q.get('next')||'';</script></body></html>`;
}

function deniedPage(code = 'ROLE_MISMATCH') {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RONA Trade — Доступ запрещён</title><style>body{margin:0;background:#05090d;color:#eef4f7;font:16px Inter,Arial,sans-serif;min-height:100vh;display:grid;place-items:center}.box{max-width:620px;padding:28px;border:1px solid #50323a;border-radius:14px;background:#101820}a{color:#b7dbea}</style></head><body><div class="box"><h1>Доступ запрещён</h1><p>Сервер не подтвердил право на этот раздел.</p><p><code>${code}</code></p><p><a href="/portal/">Открыть разрешённый кабинет</a></p></div></body></html>`;
}

const STAFF_BRIDGE = `<script id="rona-g8-staff-same-origin-bridge">(()=>{'use strict';const f=window.fetch.bind(window);window.fetch=(input,init)=>{let u=typeof input==='string'?input:(input instanceof URL?input.href:(input&&input.url)||'');if(u.startsWith('/functions/v1/rona-portal-api/')){const next='/portal/api/'+u.slice('/functions/v1/rona-portal-api/'.length);return f(input instanceof Request?new Request(next,input):next,init)}return f(input,init)};addEventListener('DOMContentLoaded',()=>{const t=document.querySelector('.toolbar');if(t&&!document.getElementById('ronaLogout')){const b=document.createElement('button');b.id='ronaLogout';b.className='btn';b.textContent='Выйти';b.onclick=async()=>{await fetch('/portal/auth/logout',{method:'POST',credentials:'same-origin'});location.replace('/portal/login')};t.appendChild(b)}})})();</script>`;

const AGENT_BRIDGE = `<script id="rona-g8-agent-same-origin-bridge">(()=>{'use strict';async function boot(){try{const r=await fetch('/portal/api/v1/agent/bootstrap',{credentials:'same-origin',headers:{accept:'application/json'}});if(r.status===401){location.replace('/portal/login?next=%2Fportal%2Fagent.html');return}const j=await r.json();if(!r.ok||!j?.data){window.RONA_AGENT_PORTAL?.failClosed?.(j?.code||'Серверный доступ агента не подтверждён.');return}window.RONA_AGENT_PORTAL?.boot?.(j.data)}catch(_e){window.RONA_AGENT_PORTAL?.failClosed?.('Не удалось получить подтверждённый серверный контекст.')}}addEventListener('DOMContentLoaded',()=>{boot();const host=document.querySelector('.top-right,.topbar');if(host&&!document.getElementById('ronaLogout')){const b=document.createElement('button');b.id='ronaLogout';b.className='btn secondary';b.type='button';b.textContent='Выйти';b.onclick=async()=>{await fetch('/portal/auth/logout',{method:'POST',credentials:'same-origin'});location.replace('/portal/login')};host.appendChild(b)}})})();</script>`;

class BodyAppend { constructor(html) { this.html = html; } element(el) { el.append(this.html, { html: true }); } }

async function serveStaticProtected(context, session, kind) {
  const roles = rolesOf(session.me);
  const expected = kind === 'agent' ? '/portal/agent.html' : '/portal/client.html';
  if (!roleAllows(expected, roles)) return html(deniedPage('ROLE_MISMATCH'), 403, session.setCookies);
  const response = await context.next();
  if (!response.ok) return withCookies(response, session.setCookies);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('text/html')) return withCookies(response, session.setCookies);
  if (kind === 'client') return withCookies(response, session.setCookies);
  const transformed = new HTMLRewriter().on('body', new BodyAppend(AGENT_BRIDGE)).transform(response);
  const headers = withSecurity(transformed.headers);
  headers.delete('content-length'); headers.delete('etag');
  headers.set('content-security-policy', "default-src 'self' data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; object-src 'none'; form-action 'self'");
  for (const c of session.setCookies) headers.append('set-cookie', c);
  return new Response(transformed.body, { status: transformed.status, statusText: transformed.statusText, headers });
}

async function serveStaff(session) {
  const roles = rolesOf(session.me);
  if (!(roles.includes('ADMIN') || roles.includes('RONA_OPERATOR'))) return html(deniedPage('ROLE_MISMATCH'), 403, session.setCookies);
  const r = await fetch(STAFF_WORKSPACE, { headers: { accept: 'text/html' } });
  if (!r.ok) return html(deniedPage('STAFF_WORKSPACE_UNAVAILABLE'), 503, session.setCookies);
  let source = await r.text();
  source = source.replace('</body>', `${STAFF_BRIDGE}</body>`);
  return html(source, 200, session.setCookies);
}

async function proxyApi(request) {
  const cookies = parseCookies(request.headers.get('cookie'));
  let access = cookies[ACCESS_COOKIE] || '';
  const refresh = cookies[REFRESH_COOKIE] || '';
  if (!access && !refresh) return json({ ok:false, code:'PORTAL_ACCESS_DENIED' }, 401, clearCookies());
  const path = new URL(request.url).pathname.slice('/portal/api'.length) || '/';
  let upstreamResponse = access ? await upstream(access, path, request) : null;
  let setCookies = [];
  if (!upstreamResponse || upstreamResponse.status === 401) {
    if (!refresh) return json({ ok:false, code:'PORTAL_ACCESS_DENIED' }, 401, clearCookies());
    const next = await authRefresh(refresh);
    if (!next.ok || !next.data?.access_token || !next.data?.refresh_token) return json({ ok:false, code:'PORTAL_ACCESS_DENIED' }, 401, clearCookies());
    access = next.data.access_token; setCookies = tokenCookies(next.data);
    upstreamResponse = await upstream(access, path, request);
  }
  const headers = withSecurity(new Headers());
  const ct = upstreamResponse.headers.get('content-type'); if (ct) headers.set('content-type', ct);
  const requestId = upstreamResponse.headers.get('x-request-id'); if (requestId) headers.set('x-request-id', requestId);
  for (const c of setCookies) headers.append('set-cookie', c);
  return new Response(upstreamResponse.body, { status: upstreamResponse.status, statusText: upstreamResponse.statusText, headers });
}

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  if (!path.startsWith('/portal')) return context.next();

  if (path === '/portal/auth/login' && request.method === 'POST') {
    if (!sameOriginPost(request)) return json({ ok:false, code:'ORIGIN_DENIED' }, 403);
    const ct = request.headers.get('content-type') || '';
    let email = '', password = '', next = '';
    if (ct.includes('application/json')) {
      const body = await request.json().catch(() => ({})); email = String(body.email || '').trim(); password = String(body.password || ''); next = String(body.next || '');
    } else {
      const form = await request.formData(); email = String(form.get('email') || '').trim(); password = String(form.get('password') || ''); next = String(form.get('next') || '');
    }
    if (!email || !password || email.length > 320 || password.length > 1024) return html(loginPage('Не удалось выполнить вход.'), 400);
    const login = await authPassword(email, password);
    if (!login.ok || !login.data?.access_token || !login.data?.refresh_token) return html(loginPage('Неверные данные входа или доступ неактивен.'), 401, clearCookies());
    const me = await sessionMe(login.data.access_token);
    if (!me) { await authLogout(login.data.access_token); return html(loginPage('Доступ к порталу не активирован.'), 403, clearCookies()); }
    const target = safeNext(next, rolesOf(me));
    if (!target) { await authLogout(login.data.access_token); return html(deniedPage('ROLE_NOT_PORTAL_ENABLED'), 403, clearCookies()); }
    return redirect(target, 303, tokenCookies(login.data));
  }

  if (path === '/portal/auth/logout' && request.method === 'POST') {
    if (!sameOriginPost(request)) return json({ ok:false, code:'ORIGIN_DENIED' }, 403, clearCookies());
    const cookies = parseCookies(request.headers.get('cookie'));
    await authLogout(cookies[ACCESS_COOKIE] || '');
    return json({ ok:true }, 200, clearCookies());
  }

  if (path.startsWith('/portal/api/')) {
    if (!['GET','POST'].includes(request.method)) return json({ ok:false, code:'METHOD_NOT_ALLOWED' }, 405);
    return proxyApi(request);
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') return json({ ok:false, code:'METHOD_NOT_ALLOWED' }, 405);

  if (path === '/portal/login') {
    const session = await ensureSession(request);
    if (session) {
      const target = defaultTarget(rolesOf(session.me));
      if (target) return redirect(target, 303, session.setCookies);
    }
    return html(loginPage(), 200, session?.setCookies || clearCookies());
  }

  const session = await ensureSession(request);
  if (!session) return redirect(`/portal/login?next=${encodeURIComponent(path)}`, 303, clearCookies());
  const roles = rolesOf(session.me);

  if (path === '/portal' || path === '/portal/') {
    const target = defaultTarget(roles);
    return target ? redirect(target, 303, session.setCookies) : html(deniedPage('ROLE_NOT_PORTAL_ENABLED'), 403, session.setCookies);
  }
  if (path === '/portal/staff') return serveStaff(session);
  if (path === '/portal/agent.html') return serveStaticProtected(context, session, 'agent');
  if (path === '/portal/client.html') return serveStaticProtected(context, session, 'client');

  return html(deniedPage('ROUTE_NOT_FOUND'), 404, session.setCookies);
}
