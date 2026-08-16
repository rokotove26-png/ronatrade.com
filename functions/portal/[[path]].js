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
const CSP = "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; object-src 'none'; form-action 'self'";

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
function withSecurity(headers = new Headers(), htmlResponse = false) {
  const out = new Headers(headers);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) out.set(k, v);
  out.delete('access-control-allow-origin');
  out.delete('access-control-allow-credentials');
  out.delete('content-security-policy-report-only');
  if (htmlResponse) out.set('content-security-policy', CSP);
  return out;
}
function secureResponse(response, cookies = [], htmlResponse = false) {
  const headers = withSecurity(response.headers, htmlResponse);
  headers.delete('content-length');
  headers.delete('etag');
  for (const cookie of cookies) headers.append('set-cookie', cookie);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
function redirect(location, status = 303, cookies = []) {
  const headers = withSecurity(new Headers({ location }));
  for (const cookie of cookies) headers.append('set-cookie', cookie);
  return new Response(null, { status, headers });
}
function html(body, status = 200, cookies = []) {
  const headers = withSecurity(new Headers({ 'content-type': 'text/html; charset=utf-8' }), true);
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
  return { ok: r.ok, data };
}
async function authRefresh(refreshToken) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, data };
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
  const headers = new Headers({ authorization: `Bearer ${accessToken}`, accept: 'application/json' });
  if (request) {
    for (const name of ['content-type', 'x-request-id', 'x-correlation-id', 'x-idempotency-key']) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
  }
  const init = { method: request?.method || 'GET', headers };
  if (request && !['GET', 'HEAD'].includes(request.method)) init.body = await request.clone().arrayBuffer();
  return fetch(`${PORTAL_API}${path}`, init);
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
  return { access: next.data.access_token, refresh: next.data.refresh_token, me, setCookies: tokenCookies(next.data) };
}
function rolesOf(me) { return Array.isArray(me?.user?.roles) ? me.user.roles.map(String) : []; }
function portalTargets(roles) {
  const out = [];
  if (roles.includes('ADMIN')) out.push({ path:'/portal/admin', label:'Кабинет администратора' });
  if (roles.includes('RONA_OPERATOR')) out.push({ path:'/portal/staff', label:'Внутренний офис' });
  if (roles.includes('AGENT')) out.push({ path:'/portal/agent', label:'Кабинет агента' });
  if (roles.includes('CLIENT')) out.push({ path:'/portal/client', label:'Кабинет клиента' });
  return out;
}
function defaultTarget(roles) {
  const targets = portalTargets(roles);
  if (targets.length > 1) return '/portal/select';
  return targets[0]?.path || null;
}
function canonicalProtectedPath(path) {
  if (path === '/portal/admin.html') return '/portal/admin';
  if (path === '/portal/agent.html') return '/portal/agent';
  if (path === '/portal/client.html') return '/portal/client';
  return path;
}
function roleAllows(path, roles) {
  const p = canonicalProtectedPath(path);
  if (p === '/portal/admin') return roles.includes('ADMIN');
  if (p === '/portal/staff') return roles.includes('RONA_OPERATOR');
  if (p === '/portal/agent') return roles.includes('AGENT');
  if (p === '/portal/client') return roles.includes('CLIENT');
  if (p === '/portal/select') return portalTargets(roles).length > 1;
  return false;
}
function parseLocalNext(value) {
  if (!value) return null;
  let path = '';
  try {
    const u = new URL(value, 'https://local.invalid');
    if (u.origin !== 'https://local.invalid') return null;
    path = canonicalProtectedPath(u.pathname);
  } catch { return null; }
  return ['/portal/admin','/portal/staff','/portal/agent','/portal/client','/portal/select'].includes(path) ? path : null;
}
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function loginPage(message = '') {
  const note = message ? `<div class="error">${escapeHtml(message)}</div>` : '';
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RONA Trade — Вход</title><style>:root{font-family:Inter,Arial,sans-serif;color:#eef4f7;background:#05090d}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at 80% 10%,#152633 0,#071018 42%,#05090d 75%)}.box{width:min(430px,calc(100vw - 32px));padding:28px;border:1px solid rgba(171,220,239,.24);border-radius:18px;background:rgba(8,15,22,.88);box-shadow:0 22px 80px rgba(0,0,0,.42)}h1{font-size:26px;margin:0 0 6px}.sub{color:#9db1bc;margin:0 0 24px}.field{display:grid;gap:7px;margin:14px 0}.field label{font-size:13px;color:#afc0c9}.field input{width:100%;padding:12px;border-radius:10px;border:1px solid rgba(171,220,239,.26);background:#09121a;color:#fff;font:inherit}.btn{width:100%;margin-top:10px;padding:12px;border:1px solid rgba(224,66,75,.45);border-radius:10px;background:rgba(224,66,75,.15);color:#fff;font-weight:800;cursor:pointer}.error{padding:10px 12px;border-radius:9px;background:#4b1e23;color:#ffdfe3;margin:12px 0;font-size:13px}.foot{margin-top:18px;color:#788d98;font-size:13px}</style></head><body><main class="box"><h1>RONA Trade</h1><p class="sub">Единый вход в защищённые кабинеты</p>${note}<form method="post" action="/portal/auth/login" autocomplete="on"><input type="hidden" name="next" id="next"><div class="field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="username" required></div><div class="field"><label for="password">Пароль</label><input id="password" name="password" type="password" autocomplete="current-password" required></div><button class="btn" type="submit">Войти</button></form><p class="foot">Один вход открывает только разрешённые сервером контуры: Кабинет администратора, Внутренний офис, Кабинет агента или Кабинет клиента.</p></main><script>const q=new URLSearchParams(location.search);const n=q.get('next')||'';document.getElementById('next').value=n.startsWith('/portal/')?n:'';</script></body></html>`;
}
function deniedPage(code = 'ROLE_MISMATCH') {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RONA Trade — Доступ запрещён</title><style>body{margin:0;background:#05090d;color:#eef4f7;font:16px Inter,Arial,sans-serif;min-height:100vh;display:grid;place-items:center}.box{max-width:620px;padding:28px;border:1px solid #50323a;border-radius:14px;background:#101820}a{color:#b7dbea}</style></head><body><div class="box"><h1>Доступ запрещён</h1><p>Сервер не подтвердил право на этот раздел.</p><p><code>${escapeHtml(code)}</code></p><p><a href="/portal/">Открыть разрешённый кабинет</a></p></div></body></html>`;
}
function selectorPage(roles) {
  const targets = portalTargets(roles);
  const links = targets.map(t => `<a class="choice" href="${t.path}">${escapeHtml(t.label)}</a>`).join('');
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RONA Trade — Выбор кабинета</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#05090d;color:#eef4f7;font:16px Inter,Arial,sans-serif}.box{width:min(520px,calc(100vw - 32px));padding:26px;border:1px solid #29404e;border-radius:16px;background:#0b151d}.choice{display:block;margin:10px 0;padding:13px 15px;border:1px solid #365464;border-radius:10px;color:#eef4f7;text-decoration:none;background:#101f29}.choice:hover{background:#152a37}.muted{color:#93a8b3;font-size:13px}</style></head><body><main class="box"><h1>Выберите рабочий контур</h1><p class="muted">Список сформирован сервером только из ролей текущей защищённой сессии.</p>${links}<form method="post" action="/portal/auth/logout"><button class="choice" style="width:100%;text-align:left" type="submit">Выйти</button></form></main></body></html>`;
}
const STAFF_BRIDGE = `<script id="rona-g82-staff-same-origin-bridge">(()=>{'use strict';const f=window.fetch.bind(window);window.fetch=(input,init)=>{let u=typeof input==='string'?input:(input instanceof URL?input.href:(input&&input.url)||'');if(u.startsWith('/functions/v1/rona-portal-api/')){const next='/portal/api/'+u.slice('/functions/v1/rona-portal-api/'.length);return f(input instanceof Request?new Request(next,input):next,{...init,credentials:'same-origin'})}return f(input,{...init,credentials:init?.credentials||'same-origin'})};addEventListener('DOMContentLoaded',()=>{document.title='RONA Trade — Внутренний офис';const t=document.querySelector('.toolbar');if(t&&!document.getElementById('ronaLogout')){const b=document.createElement('button');b.id='ronaLogout';b.className='btn';b.textContent='Выйти';b.onclick=async()=>{await fetch('/portal/auth/logout',{method:'POST',credentials:'same-origin'});location.replace('/portal/login')};t.appendChild(b)}})})();</script>`;
const AGENT_BRIDGE = `<script id="rona-g82-agent-same-origin-bridge">(()=>{'use strict';async function boot(){try{const r=await fetch('/portal/api/v1/agent/bootstrap',{credentials:'same-origin',headers:{accept:'application/json'}});if(r.status===401){location.replace('/portal/login?next=%2Fportal%2Fagent');return}const j=await r.json();if(!r.ok||!j?.data){window.RONA_AGENT_PORTAL?.failClosed?.(j?.code||'Серверный доступ агента не подтверждён.');return}window.RONA_AGENT_PORTAL?.boot?.(j.data)}catch(_e){window.RONA_AGENT_PORTAL?.failClosed?.('Не удалось получить подтверждённый серверный контекст.')}}addEventListener('DOMContentLoaded',boot)})();<\/script>`;
class BodyAppend { constructor(value) { this.value = value; } element(el) { el.append(this.value, { html: true }); } }
const ADMIN_SESSION_BRIDGE = `<script id="rona-admin-server-session-bridge">(()=>{'use strict';addEventListener('DOMContentLoaded',()=>{const b=document.getElementById('adminLogoutBtn');if(b){b.hidden=false;b.addEventListener('click',async e=>{e.preventDefault();try{await fetch('/portal/auth/logout',{method:'POST',credentials:'same-origin'})}finally{location.replace('/portal/login')}})}})})();<\/script>`;
// RONA_CANONICAL_RUNTIME_ADAPTER_V2: server-authenticated technical adapter only; no canonical visual redesign.
class RemoveCanonicalLegacyAuthNode { element(el) { el.remove(); } }
class UnlockCanonicalAdminBody {
  element(el) {
    const classes=String(el.getAttribute('class')||'').split(/\s+/).filter(Boolean).filter(x=>x!=='admin-auth-locked');
    if(classes.length) el.setAttribute('class',classes.join(' ')); else el.removeAttribute('class');
    el.append(ADMIN_SESSION_BRIDGE,{html:true});
  }
}
async function requireRealClientContext(session) {
  try {
    const r=await upstream(session.access,'/v1/client/bootstrap');
    const j=await r.json().catch(()=>null);
    const contexts=Array.isArray(j?.data?.contexts)?j.data.contexts:[];
    return { ok:r.ok && j?.ok===true && contexts.length>0, contexts };
  } catch (_) { return { ok:false, contexts:[] }; }
}


async function serveStaticProtected(context, session, kind) {
  const roles = rolesOf(session.me);
  const expected = kind === 'admin' ? '/portal/admin' : kind === 'agent' ? '/portal/agent' : '/portal/client';
  if (!roleAllows(expected, roles)) return html(deniedPage('ROLE_MISMATCH'), 403, session.setCookies);

  // CLIENT is fail-closed before any canonical standalone snapshot can be served.
  if (kind === 'client') {
    const gate = await requireRealClientContext(session);
    if (!gate.ok) return html(deniedPage('CLIENT_CONTEXT_NOT_AUTHORIZED'), 403, session.setCookies);
  }

  const response = await context.next();
  if (!response.ok) return secureResponse(response, session.setCookies, false);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('text/html')) return secureResponse(response, session.setCookies, false);

  if (kind === 'admin') {
    // Server session/role is authoritative. Remove only the frozen file's standalone legacy login mechanism.
    const transformed = new HTMLRewriter()
      .on('body', new UnlockCanonicalAdminBody())
      .on('#adminLoginGate', new RemoveCanonicalLegacyAuthNode())
      .on('#rona-admin-auth-v3413', new RemoveCanonicalLegacyAuthNode())
      .transform(response);
    return secureResponse(transformed, session.setCookies, true);
  }
  if (kind === 'client') return secureResponse(response, session.setCookies, true);

  const transformed = new HTMLRewriter().on('body', new BodyAppend(AGENT_BRIDGE)).transform(response);
  return secureResponse(transformed, session.setCookies, true);
}
async function serveStaff(session) {
  const roles = rolesOf(session.me);
  if (!roles.includes('RONA_OPERATOR')) return html(deniedPage('ROLE_MISMATCH'), 403, session.setCookies);
  const r = await fetch(STAFF_WORKSPACE, { headers: { accept: 'text/html' } });
  if (!r.ok) return html(deniedPage('STAFF_WORKSPACE_UNAVAILABLE'), 503, session.setCookies);
  let source = await r.text();
  source = source.replace('</body>', `${STAFF_BRIDGE}</body>`);
  return html(source, 200, session.setCookies);
}
async function proxyApi(request) {
  if (request.method !== 'GET' && !sameOriginPost(request)) return json({ ok:false, code:'ORIGIN_DENIED' }, 403);
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
    access = next.data.access_token;
    setCookies = tokenCookies(next.data);
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
    const roles = rolesOf(me);
    const requested = parseLocalNext(next);
    if (requested && !roleAllows(requested, roles)) return html(deniedPage('ROLE_MISMATCH'), 403, tokenCookies(login.data));
    const target = requested || defaultTarget(roles);
    if (!target) { await authLogout(login.data.access_token); return html(deniedPage('ROLE_NOT_PORTAL_ENABLED'), 403, clearCookies()); }
    return redirect(target, 303, tokenCookies(login.data));
  }
  if (path === '/portal/auth/logout' && request.method === 'POST') {
    if (!sameOriginPost(request)) return json({ ok:false, code:'ORIGIN_DENIED' }, 403, clearCookies());
    const cookies = parseCookies(request.headers.get('cookie'));
    await authLogout(cookies[ACCESS_COOKIE] || '');
    return redirect('/portal/login', 303, clearCookies());
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
  if (!session) return redirect(`/portal/login?next=${encodeURIComponent(canonicalProtectedPath(path))}`, 303, clearCookies());
  const roles = rolesOf(session.me);
  if (path === '/portal' || path === '/portal/') {
    const target = defaultTarget(roles);
    return target ? redirect(target, 303, session.setCookies) : html(deniedPage('ROLE_NOT_PORTAL_ENABLED'), 403, session.setCookies);
  }
  if (path === '/portal/select') {
    if (portalTargets(roles).length <= 1) {
      const target = defaultTarget(roles);
      return target ? redirect(target, 303, session.setCookies) : html(deniedPage('ROLE_NOT_PORTAL_ENABLED'), 403, session.setCookies);
    }
    return html(selectorPage(roles), 200, session.setCookies);
  }
  if (path === '/portal/admin.html') return redirect('/portal/admin', 308, session.setCookies);
  if (path === '/portal/agent.html') return redirect('/portal/agent', 308, session.setCookies);
  if (path === '/portal/client.html') return redirect('/portal/client', 308, session.setCookies);
  if (path === '/portal/admin') return serveStaticProtected(context, session, 'admin');
  if (path === '/portal/staff') return serveStaff(session);
  if (path === '/portal/agent') return serveStaticProtected(context, session, 'agent');
  if (path === '/portal/client') return serveStaticProtected(context, session, 'client');
  return html(deniedPage('ROUTE_NOT_FOUND'), 404, session.setCookies);
}
