const SUPABASE_URL = 'https://sxawrwzeobaqwwmlkzws.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_W2MxTx00ILiugSyZKp8uyQ_zBzcyorL';
const PORTAL_API = `${SUPABASE_URL}/functions/v1/rona-portal-api`;
const STAFF_WORKSPACE = `${SUPABASE_URL}/functions/v1/rona-staff-workspace`;
const ADMIN_CONTROL_PLANE_API = `${SUPABASE_URL}/functions/v1/rona-admin-control-plane`;
const ACCESS_COOKIE = 'rona_portal_at';
const REFRESH_COOKIE = 'rona_portal_rt';
const IMPERSONATION_COOKIE = 'rona_admin_imp';

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
function impersonationCookie(token,maxAge=900){
  return `${IMPERSONATION_COOKIE}=${token}; Max-Age=${Math.max(0,Number(maxAge)||0)}; Path=/portal; Secure; HttpOnly; SameSite=Strict`;
}
function clearImpersonationCookie(){
  return `${IMPERSONATION_COOKIE}=; Max-Age=0; Path=/portal; Secure; HttpOnly; SameSite=Strict`;
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
function refreshFailureIsRetryable(result) {
  const status = Number(result?.status || 0);
  if (status === 429 || status >= 500) return true;
  const code = String(result?.data?.error_code || result?.data?.code || '').trim().toLowerCase();
  const message = String(result?.data?.message || result?.data?.error_description || '').trim().toLowerCase();
  return code === 'refresh_token_already_used' || message.includes('refresh token already used');
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
async function upstream(accessToken, path, request = null, impersonationToken = '', impersonationTab = '') {
  const headers = new Headers({ apikey: SUPABASE_PUBLISHABLE_KEY, authorization: `Bearer ${accessToken}`, accept: 'application/json' });
  if (request) {
    for (const name of ['content-type', 'x-request-id', 'x-correlation-id', 'x-idempotency-key']) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
  }
  if(impersonationToken){
    headers.set('x-rona-admin-impersonation-token',impersonationToken);
    if(impersonationTab)headers.set('x-rona-impersonation-tab',impersonationTab);
    if(!headers.has('x-request-id'))headers.set('x-request-id',crypto.randomUUID());
    if(!headers.has('x-correlation-id'))headers.set('x-correlation-id',crypto.randomUUID());
  }
  const init = { method: request?.method || 'GET', headers };
  if (request && !['GET', 'HEAD'].includes(request.method)) init.body = await request.clone().arrayBuffer();
  return fetch(`${PORTAL_API}${path}`, init);
}
const SESSION_RETRY_DELAYS_MS=Object.freeze([0,250,500,1000,2000,2500]);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function adminControlPlaneProbe(accessToken){
  try{
    const r=await fetch(`${ADMIN_CONTROL_PLANE_API}/readiness`,{
      headers:{apikey:SUPABASE_PUBLISHABLE_KEY,authorization:`Bearer ${accessToken}`,accept:'application/json'}
    });
    if(r.ok){
      const j=await r.json().catch(()=>null);
      if(j?.ok===true)return{state:'VALID',me:{user:{roles:['ADMIN']},authority:'ADMIN_CONTROL_PLANE_FALLBACK'},status:r.status};
      return{state:'UNAVAILABLE',me:null,status:r.status||502};
    }
    if(r.status===401||r.status===403)return{state:'INVALID',me:null,status:r.status};
    if(r.status===429||r.status>=500)return{state:'UNAVAILABLE',me:null,status:r.status};
    return{state:'INVALID',me:null,status:r.status};
  }catch(_){return{state:'UNAVAILABLE',me:null,status:503}}
}
async function authOwnerProbe(accessToken){
  try{
    const r=await fetch(`${SUPABASE_URL}/auth/v1/user`,{
      headers:{apikey:SUPABASE_PUBLISHABLE_KEY,authorization:`Bearer ${accessToken}`,accept:'application/json'}
    });
    if(r.ok){
      const user=await r.json().catch(()=>null);
      const identity=String(user?.app_metadata?.portal_identity||'').toUpperCase();
      if(identity==='OWNER_ADMIN')return{state:'VALID',me:{user:{roles:['ADMIN']},authority:'SUPABASE_AUTH_OWNER_FALLBACK'},status:r.status};
      return{state:'UNAVAILABLE',me:null,status:r.status,reason:'VALID_NON_OWNER_IDENTITY'};
    }
    if(r.status===401||r.status===403)return{state:'INVALID',me:null,status:r.status};
    if(r.status===429||r.status>=500)return{state:'UNAVAILABLE',me:null,status:r.status};
    return{state:'UNAVAILABLE',me:null,status:r.status};
  }catch(_){return{state:'UNAVAILABLE',me:null,status:503}}
}
async function adminOwnerJwtGatewayProbe(accessToken){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort('RONA_ADMIN_OWNER_GATEWAY_TIMEOUT'),2500);
  try{
    const r=await fetch(`${ADMIN_CONTROL_PLANE_API}/owner-auth-fallback`,{
      headers:{apikey:SUPABASE_PUBLISHABLE_KEY,authorization:`Bearer ${accessToken}`,accept:'application/json'},
      signal:controller.signal
    });
    if(r.ok){
      const j=await r.json().catch(()=>null);
      if(j?.ok===true&&j?.authority==='SUPABASE_EDGE_VERIFIED_OWNER'&&Array.isArray(j?.roles)&&j.roles.includes('ADMIN'))return{state:'VALID',me:{user:{roles:['ADMIN'],auth_user_id:j.auth_user_id||null},authority:j.authority},status:r.status,authority:j.authority};
      return{state:'UNAVAILABLE',me:null,status:r.status||502};
    }
    if(r.status===401)return{state:'INVALID',me:null,status:r.status};
    if(r.status===403)return{state:'UNAVAILABLE',me:null,status:r.status,reason:'VALID_NON_OWNER_IDENTITY'};
    if(r.status===429||r.status>=500)return{state:'UNAVAILABLE',me:null,status:r.status};
    return{state:'UNAVAILABLE',me:null,status:r.status};
  }catch(_){return{state:'UNAVAILABLE',me:null,status:503}}
  finally{clearTimeout(timer)}
}
async function sessionProbe(accessToken,{allowAdminFallback=false}={}){
  if(!accessToken)return{state:'INVALID',me:null,status:401};
  let lastStatus=503,ownerGatewayChecked=false;
  const ownerGatewayFallback=async()=>{
    if(!allowAdminFallback||ownerGatewayChecked)return null;
    ownerGatewayChecked=true;
    const gateway=await adminOwnerJwtGatewayProbe(accessToken);
    return gateway.state==='UNAVAILABLE'?null:gateway;
  };
  for(const delay of SESSION_RETRY_DELAYS_MS){
    if(delay)await sleep(delay);
    try{
      const r=await upstream(accessToken,'/session/me');
      lastStatus=r.status;
      if(r.ok){const j=await r.json().catch(()=>null);if(j?.ok&&j?.user)return{state:'VALID',me:j,status:r.status,authority:'PRIMARY_PORTAL_API'};continue}
      if(r.status===401||r.status===403)return{state:'INVALID',me:null,status:r.status};
      if(r.status===429||r.status>=500){const gateway=await ownerGatewayFallback();if(gateway)return gateway;continue}
      return{state:'INVALID',me:null,status:r.status};
    }catch(_){lastStatus=503;const gateway=await ownerGatewayFallback();if(gateway)return gateway}
  }
  if(allowAdminFallback){
    const gateway=await ownerGatewayFallback();if(gateway)return gateway;
    const fallback=await adminControlPlaneProbe(accessToken);if(fallback.state!=='UNAVAILABLE')return fallback;
    const ownerFallback=await authOwnerProbe(accessToken);if(ownerFallback.state!=='UNAVAILABLE')return ownerFallback
  }
  return{state:'UNAVAILABLE',me:null,status:lastStatus};
}
async function ensureSession(request){
  const cookies=parseCookies(request.headers.get('cookie')),access=cookies[ACCESS_COOKIE]||'',refresh=cookies[REFRESH_COOKIE]||'';
  const requestedPath=canonicalProtectedPath(new URL(request.url).pathname),allowAdminFallback=requestedPath==='/portal/admin';
  let accessProbeUnavailable=false;
  if(access){
    const probe=await sessionProbe(access,{allowAdminFallback});
    if(probe.state==='VALID')return{access,refresh,me:probe.me,setCookies:[]};
    if(probe.state==='UNAVAILABLE'){
      accessProbeUnavailable=true;
      if(!refresh)return{unavailable:true,access,refresh,me:null,setCookies:[]};
    }
  }
  if(!refresh)return null;
  let next;
  try{next=await authRefresh(refresh)}
  catch(_){return{unavailable:true,access,refresh,me:null,setCookies:[]}}
  if(!next.ok||!next.data?.access_token||!next.data?.refresh_token){
    if(refreshFailureIsRetryable(next)||accessProbeUnavailable)return{unavailable:true,access,refresh,me:null,setCookies:[],reason:'SESSION_REFRESH_CONVERGENCE'};
    return null;
  }
  const probe=await sessionProbe(next.data.access_token,{allowAdminFallback});
  if(probe.state==='UNAVAILABLE')return{unavailable:true,access:next.data.access_token,refresh:next.data.refresh_token,me:null,setCookies:tokenCookies(next.data)};
  if(probe.state!=='VALID')return null;
  return{access:next.data.access_token,refresh:next.data.refresh_token,me:probe.me,setCookies:tokenCookies(next.data)};
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
function unavailablePage(nextPath='/portal/'){
  const target=String(nextPath||'/portal/').startsWith('/portal/')?String(nextPath||'/portal/'):'/portal/',safeTarget=escapeHtml(target);
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="2;url=${safeTarget}"><title>RONA Trade — Восстановление соединения</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#05090d;color:#eef4f7;font:16px Inter,Arial,sans-serif}.box{width:min(520px,calc(100vw - 32px));padding:28px;border:1px solid #29404e;border-radius:16px;background:#0b151d}.muted{color:#93a8b3}.btn{display:inline-block;margin-top:12px;padding:11px 14px;border:1px solid #365464;border-radius:10px;color:#eef4f7;text-decoration:none;background:#101f29}</style></head><body><main class="box"><h1>Восстанавливаю соединение</h1><p class="muted">Сессия сохранена. Сервер авторизации временно недоступен; повторная проверка выполняется автоматически.</p><a class="btn" href="${safeTarget}">Повторить сейчас</a></main></body></html>`;
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
const CLIENT_HOME_BOOT_PRIORITY = '<script id="rona-client-home-boot-priority-v1" src="/assets/portal-runtime/client-home-command-center-v2.js?v=20260902-current-context-v3" defer fetchpriority="high"></script>';
function presenceBridge(role){
  const safeRole=String(role||'').toUpperCase()==='AGENT'?'AGENT':'CLIENT';
  return `<script id="rona-portal-presence-v1">(()=>{'use strict';if(window.__RONA_PORTAL_PRESENCE_V1__)return;window.__RONA_PORTAL_PRESENCE_V1__='${safeRole}';const role='${safeRole}',endpoint='/portal/owner-api?path=%2Fpresence%2Fheartbeat',connectionId=crypto.randomUUID(),intervalMs=25000;let timer=0,inflight=false,stopped=false;async function beat(online=true,keepalive=false){if(inflight&&online)return;inflight=online;try{await fetch(endpoint,{method:'POST',credentials:'same-origin',cache:'no-store',keepalive,headers:{accept:'application/json','content-type':'application/json'},body:JSON.stringify({connectionId,role,online})})}catch(_e){}finally{inflight=false}}function start(){if(stopped)return;beat(true);if(!timer)timer=setInterval(()=>beat(true),intervalMs)}function stop(){stopped=true;if(timer){clearInterval(timer);timer=0}beat(false,true)}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();window.addEventListener('pageshow',()=>{stopped=false;start()});window.addEventListener('focus',()=>beat(true));document.addEventListener('visibilitychange',()=>{if(!document.hidden)beat(true)},{passive:true});window.addEventListener('pagehide',stop,{once:true})})();<\/script>`;
}
class HeadPrepend { constructor(value) { this.value = value; } element(el) { el.prepend(this.value, { html: true }); } }
class HeadAppend { constructor(value) { this.value = value; } element(el) { el.append(this.value, { html: true }); } }
class BodyAppend { constructor(value) { this.value = value; } element(el) { el.append(this.value, { html: true }); } }
const ADMIN_SESSION_BRIDGE = `<script id="rona-admin-server-session-bridge">(()=>{'use strict';addEventListener('DOMContentLoaded',()=>{const b=document.getElementById('adminLogoutBtn');if(b){b.hidden=false;b.addEventListener('click',async e=>{e.preventDefault();try{await fetch('/portal/auth/logout',{method:'POST',credentials:'same-origin'})}finally{location.replace('/portal/login')}})}})})();<\/script>`;
const SERVER_AUTHENTICATED_ADMIN_BOOTSTRAP = `<script id="rona-server-authenticated-admin-bootstrap">(()=>{'use strict';
if(window.__RONA_SERVER_AUTHENTICATED_ADMIN_BOOTSTRAP_INSTALLED__)return;
window.__RONA_SERVER_AUTHENTICATED_ADMIN_BOOTSTRAP_INSTALLED__=true;
const DEFERRED_SCRIPT_TYPE='application/rona-admin-deferred',APP_READY_TIMEOUT_MS=9000;
const REQUIRED_PAGE_IDS=['page-home','page-applications','page-deals','page-access','page-publication','page-analytics','page-portal-contour'];
const deferredNodes=()=>Array.from(document.querySelectorAll('script[type="'+DEFERRED_SCRIPT_TYPE+'"][data-rona-admin-deferred="true"]')).sort((a,b)=>Number(a.dataset.ronaOrder||0)-Number(b.dataset.ronaOrder||0));
const moduleIdentity=node=>String(node?.id||('deferred-'+(node?.dataset?.ronaOrder||'x')));
const nodesAtInstall=deferredNodes();
const state=window.__RONA_ADMIN_BOOT_STATE__={authenticated:true,started:false,ready:false,failed:false,failureReason:null,errorCount:0,errors:[],timedOut:false,startCount:0,deferredScriptCount:nodesAtInstall.length,modules:nodesAtInstall.map(node=>({id:moduleIdentity(node),order:Number(node.dataset.ronaOrder||0),status:'PENDING',executionCount:0})),bootStage:'SERVER_AUTHORIZED',productionAuthActive:true,authMode:'SERVER_AUTHENTICATED_ADMIN_BOOTSTRAP',readyEventCount:0};
window.RONA_ADMIN_AUTH_CONTEXT=Object.freeze({schema:'RONA_ADMIN_AUTH_CONTEXT/1.0',mode:'SERVER_AUTHENTICATED_ADMIN_BOOTSTRAP',source:'SERVER_SESSION',serverSession:true,authenticatedByServer:true,productionHandoffActive:true});
let readyTimer=null,currentBootModule=null,readyCommitted=false;const seenErrors=new Set();const byId=id=>document.getElementById(id);
const mark=(id,status)=>{const row=state.modules.find(x=>x.id===id);if(row)row.status=status};
const safe=v=>String(v??'Unknown boot error').slice(0,240);
function fail(reason,error,source='ORCHESTRATOR'){if(state.ready||readyCommitted)return false;const message=safe(error?.message||error?.reason?.message||error?.reason||error||reason),fp=source+'|'+reason+'|'+message;if(!seenErrors.has(fp)){seenErrors.add(fp);state.errors.push({source,stage:reason,message,time:new Date().toISOString()});state.errorCount=state.errors.length}if(source&&source!=='ORCHESTRATOR')mark(source,'FAILED');state.failed=true;state.ready=false;state.failureReason=reason;state.bootStage='FAILED';if(readyTimer){clearTimeout(readyTimer);readyTimer=null}document.body.classList.add('admin-auth-locked');return false}
function onWindowError(event){if(!state.ready)fail('WINDOW_ERROR',event?.error||event?.message||'window error',currentBootModule||'BOOT_ASYNC')}
function onUnhandled(event){if(!state.ready)fail('UNHANDLED_REJECTION',event?.reason||'unhandled rejection',currentBootModule||'BOOT_ASYNC')}
window.addEventListener('error',onWindowError,true);window.addEventListener('unhandledrejection',onUnhandled,true);window.__RONA_ADMIN_RECORD_BOOT_ERROR__=(error,stage,source)=>fail(stage||'BOOT_RUNTIME_ERROR',error,source||currentBootModule||'BOOT_ASYNC');
function executeDeferredApplicationScripts(){state.bootStage='DEFERRED_EXECUTION';const nodes=deferredNodes();if(nodes.length===0)return fail('DEFERRED_COUNT_ZERO','No canonical deferred Admin modules found');if(nodes.length!==state.deferredScriptCount)return fail('DEFERRED_COUNT_MISMATCH','Deferred module count changed during boot');const executed=new Set();for(const source of nodes){if(state.failed||state.timedOut)break;const identity=moduleIdentity(source),row=state.modules.find(x=>x.id===identity);if(executed.has(identity)||(row&&row.executionCount>0))return fail('DEFERRED_DUPLICATE_EXECUTION','Deferred module attempted twice',identity);executed.add(identity);currentBootModule=identity;if(row)row.executionCount+=1;mark(identity,'STARTED');try{const runtime=document.createElement('script');runtime.type='text/javascript';runtime.dataset.ronaRuntimeFrom=identity;runtime.textContent=source.textContent+String.fromCharCode(10)+'//# sourceURL=rona-admin-deferred-'+(source.dataset.ronaOrder||'x')+'.js';document.body.appendChild(runtime);runtime.remove();if(!state.failed)mark(identity,'EXECUTED')}catch(error){fail('DEFERRED_EXECUTION',error,identity)}finally{currentBootModule=null}}if(state.failed||state.timedOut)return false;if(!state.modules.every(x=>x.status==='EXECUTED'&&x.executionCount===1))return fail('DEFERRED_COMPLETION','Not all deferred modules executed exactly once');state.bootStage='WAITING_READY';return true}
function readinessValidation(){const issues=[];if(state.started!==true||state.startCount!==1)issues.push('INVALID_START_COUNT');if(state.failed)issues.push('BOOT_FAILED');if(state.timedOut)issues.push('BOOT_TIMED_OUT');if(state.errorCount!==0)issues.push('BOOT_ERRORS_PRESENT');if(state.deferredScriptCount<=0)issues.push('DEFERRED_COUNT_ZERO');if(!state.modules.every(x=>x.status==='EXECUTED'&&x.executionCount===1))issues.push('DEFERRED_MODULES_INCOMPLETE');for(const id of REQUIRED_PAGE_IDS)if(!byId(id))issues.push('DOM_MISSING_'+id);if(typeof window.renderAccess!=='function')issues.push('RENDER_ACCESS_MISSING');if(window.__RONA_ADMIN_RENDER_ACCESS_COMPLETED__!==true)issues.push('RENDER_ACCESS_NOT_COMPLETED');if(window.__RONA_ADMIN_EXECUTIVE_BOOTSTRAP_ERROR__===true)issues.push('EXECUTIVE_BOOTSTRAP_ERROR');if(!window.RONA_ADMIN_PUBLICATION_CONTROL_V345||typeof window.RONA_ADMIN_PUBLICATION_CONTROL_V345.getWorklist!=='function')issues.push('PUBLICATION_CORE_MISSING');if(!window.RONA_ADMIN_V349)issues.push('ADMIN_CORE_MISSING');if(window.__RONA_ADMIN_RUSSIFY_COMPLETED__!==true)issues.push('RUSSIFICATION_NOT_COMPLETED');if(window.__RONA_ADMIN_APP_READY_DISPATCHED__!==true)issues.push('READY_DISPATCH_MARKER_MISSING');if(state.readyEventCount!==1)issues.push('READY_EVENT_COUNT_'+state.readyEventCount);return{ok:issues.length===0,issues}}
function commitReady(){if(readyCommitted||state.failed||state.timedOut)return false;state.bootStage='READINESS_VALIDATION';const validation=readinessValidation();if(!validation.ok)return fail('READINESS_VALIDATION',validation.issues.join(','));readyCommitted=true;state.ready=true;state.failed=false;state.failureReason=null;state.bootStage='READY';if(readyTimer){clearTimeout(readyTimer);readyTimer=null}window.removeEventListener('error',onWindowError,true);window.removeEventListener('unhandledrejection',onUnhandled,true);delete window.__RONA_ADMIN_RECORD_BOOT_ERROR__;document.body.classList.remove('admin-auth-locked');const logout=byId('adminLogoutBtn');if(logout)logout.hidden=false;return true}
window.addEventListener('rona:admin-app-ready',()=>{state.readyEventCount+=1;if(state.readyEventCount>1){fail('READY_EVENT_DUPLICATE','rona:admin-app-ready fired more than once');return}queueMicrotask(commitReady)});
function start(){if(state.started||state.failed||state.timedOut)return;state.started=true;state.startCount=1;state.bootStage='STARTING';document.body.classList.add('admin-auth-locked');window.dispatchEvent(new CustomEvent('rona:admin-app-started',{detail:{mode:'SERVER_AUTHENTICATED_ADMIN_BOOTSTRAP',startCount:1}}));readyTimer=setTimeout(()=>{if(state.ready||state.failed)return;state.timedOut=true;fail('BOOT_TIMEOUT','Admin application readiness timeout')},APP_READY_TIMEOUT_MS);if(!executeDeferredApplicationScripts()&&!state.failed)fail('BOOT_START_FAILED','Deferred application execution did not start');document.title='RONA Trade — Кабинет администратора v3.4.13'}
window.RONA_ADMIN_SERVER_BOOTSTRAP=Object.freeze({mode:'SERVER_AUTHENTICATED_ADMIN_BOOTSTRAP',bootState:()=>JSON.parse(JSON.stringify(state)),start});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else queueMicrotask(start);
})();<\/script>`;
// RONA_CANONICAL_RUNTIME_ADAPTER_V2: server-authenticated technical adapter only; no canonical visual redesign.
class RemoveCanonicalLegacyAuthNode { element(el) { el.remove(); } }
class BootServerAuthenticatedAdminBody {
  element(el) {
    const classes=String(el.getAttribute('class')||'').split(/\s+/).filter(Boolean);
    if(!classes.includes('admin-auth-locked'))classes.push('admin-auth-locked');
    el.setAttribute('class',classes.join(' '));
    el.append(ADMIN_SESSION_BRIDGE+SERVER_AUTHENTICATED_ADMIN_BOOTSTRAP,{html:true});
  }
}
async function resolveAdminImpersonationForRequest(request,session){
  const cookies=parseCookies(request.headers.get('cookie'));
  const token=String(cookies[IMPERSONATION_COOKIE]||'').trim();
  if(!token)return{state:'NONE',token:''};
  const roles=rolesOf(session.me);
  if(!roles.includes('ADMIN'))return{state:'INVALID',token};
  try{
    const r=await fetch(`${ADMIN_CONTROL_PLANE_API}/impersonation/resolve`,{
      headers:{authorization:`Bearer ${session.access}`,accept:'application/json','x-rona-admin-impersonation-token':token},
      cache:'no-store'
    });
    const body=await r.json().catch(()=>null);
    if(r.ok&&body?.ok&&body?.data)return{state:'VALID',token,data:body.data};
    if([401,403,404,409].includes(r.status))return{state:'INVALID',token};
    return{state:'UNAVAILABLE',token};
  }catch(_){return{state:'UNAVAILABLE',token}}
}
function impersonationReturnBridge(returnView,sessionId){
  const target='/portal/admin?accessView='+(returnView==='agents'?'agents':'companies');
  return `<script id="rona-admin-impersonation-return">(()=>{'use strict';const TARGET=${JSON.stringify(target)},SESSION=${JSON.stringify(sessionId)};const nativeFetch=window.fetch.bind(window);window.fetch=async(input,init={})=>{let nextInput=input,nextInit=init;try{const raw=typeof input==='string'?input:(input&&input.url)||'',u=new URL(raw,location.href);if(u.origin===location.origin&&(u.pathname.startsWith('/portal/api/')||u.pathname==='/portal/owner-api')){const h=new Headers((init&&init.headers)||(input instanceof Request?input.headers:undefined));h.set('x-rona-impersonation-tab',SESSION);if(input instanceof Request){nextInput=new Request(input,{...init,headers:h});nextInit=undefined}else nextInit={...init,headers:h}}}catch(_e){}const r=await nativeFetch(nextInput,nextInit);if(r.headers.get('x-rona-impersonation-ended')==='1'){location.replace(TARGET)}return r};function bind(){if(document.getElementById('ronaReturnAdmin'))return;const candidates=[...document.querySelectorAll('button,a')];const logout=candidates.find(x=>/^(выход|выйти|logout)$/i.test(String(x.textContent||'').trim()))||document.querySelector('#logoutBtn,#ronaLogout,[data-action="logout"]');if(!logout)return;const b=document.createElement('button');b.id='ronaReturnAdmin';b.type='button';b.className=logout.className||'';b.textContent='Вернуться в раздел администратора';b.setAttribute('aria-label','Вернуться в раздел администратора');b.addEventListener('click',async e=>{e.preventDefault();b.disabled=true;try{await nativeFetch('/portal/admin-authority/impersonation/end',{method:'POST',credentials:'same-origin',headers:{accept:'application/json','x-rona-impersonation-tab':SESSION}})}finally{location.replace(TARGET)}});logout.parentNode?.insertBefore(b,logout)}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else queueMicrotask(bind)})();<\/script>`;
}
async function requireRealClientContext(session,impersonationToken='',impersonationTab='') {
  try {
    const r=await upstream(session.access,'/v1/client/bootstrap',null,impersonationToken,impersonationTab);
    const j=await r.json().catch(()=>null);
    const contexts=Array.isArray(j?.data?.contexts)?j.data.contexts:[];
    const adminEntityPreview=j?.data?.admin_entity_preview===true&&j?.data?.read_only===true;
    return { ok:r.ok && j?.ok===true && (contexts.length>0||adminEntityPreview), contexts, adminEntityPreview };
  } catch (_) { return { ok:false, contexts:[] }; }
}

async function serveStaticProtected(context, session, kind) {
  const roles = rolesOf(session.me);
  const expected = kind === 'admin' ? '/portal/admin' : kind === 'agent' ? '/portal/agent' : '/portal/client';
  const normalAllowed=roleAllows(expected,roles);
  let impersonation=null;
  if(!normalAllowed&&kind!=='admin'&&roles.includes('ADMIN')){
    impersonation=await resolveAdminImpersonationForRequest(context.request,session);
    if(impersonation.state==='UNAVAILABLE')return html(unavailablePage(expected),503,session.setCookies);
    const expectedRole=kind==='agent'?'AGENT':'CLIENT';
    const tabSession=String(new URL(context.request.url).searchParams.get('impSession')||'');
    if(impersonation.state!=='VALID'){
      return redirect('/portal/admin?accessView='+(kind==='agent'?'agents':'companies'),303,[...session.setCookies,clearImpersonationCookie()]);
    }
    if(String(impersonation.data?.effectiveRole)!==expectedRole||tabSession!==String(impersonation.data?.id||'')){
      return redirect('/portal/admin?accessView='+(kind==='agent'?'agents':'companies'),303,session.setCookies);
    }
    impersonation.tabSession=tabSession;
  }
  if(!normalAllowed&&!impersonation?.data)return html(deniedPage('ROLE_MISMATCH'),403,session.setCookies);

  if (kind === 'client') {
    const gate = await requireRealClientContext(session,impersonation?.token||'',impersonation?.tabSession||'');
    if (!gate.ok) {
      if(impersonation?.data)return redirect('/portal/admin?accessView=companies',303,[...session.setCookies,clearImpersonationCookie()]);
      return html(deniedPage('CLIENT_CONTEXT_NOT_AUTHORIZED'), 403, session.setCookies);
    }
  }

  const response = await context.next();
  if (!response.ok) return secureResponse(response, session.setCookies, false);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('text/html')) return secureResponse(response, session.setCookies, false);

  if (kind === 'admin') {
    const transformed = new HTMLRewriter()
      .on('body', new BootServerAuthenticatedAdminBody())
      .on('#adminLoginGate', new RemoveCanonicalLegacyAuthNode())
      .on('#rona-admin-auth-v3413', new RemoveCanonicalLegacyAuthNode())
      .transform(response);
    return secureResponse(transformed, session.setCookies, true);
  }
  const bridge=impersonation?.data?impersonationReturnBridge(String(impersonation.data.returnView||''),String(impersonation.data.id||'')):'';
  if(kind==='client'){
    // Impersonated Client must receive the canonical static artifact byte stream without
    // a server-side HTMLRewriter. The canonical Client context runtime now owns
    // x-rona-impersonation-tab natively from the validated impSession URL parameter,
    // and the Admin-return control is attached as a static external runtime at build time.
    // This removes the only production-only document transformation from Client boot.
    if(impersonation?.data){
      const headers=new Headers(response.headers);
      headers.set('x-rona-client-impersonation-shell','static-unmodified-v1');
      const direct=new Response(response.body,{status:response.status,statusText:response.statusText,headers});
      return secureResponse(direct,session.setCookies,true);
    }
    const clientPresence=presenceBridge('CLIENT');
    const transformed=new HTMLRewriter()
      .on('head',new HeadAppend(CLIENT_HOME_BOOT_PRIORITY))
      .on('body',new BodyAppend(clientPresence))
      .transform(response);
    return secureResponse(transformed,session.setCookies,true);
  }
  const agentPresence=impersonation?.data?'':presenceBridge('AGENT');
  const transformed = impersonation?.data
    ? new HTMLRewriter().on('head',new HeadPrepend(bridge)).on('body',new BodyAppend(AGENT_BRIDGE)).transform(response)
    : new HTMLRewriter().on('body',new BodyAppend(AGENT_BRIDGE+agentPresence)).transform(response);
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
  const cookieImpersonation=String(cookies[IMPERSONATION_COOKIE]||'').trim();
  if (!access && !refresh) return json({ ok:false, code:'PORTAL_ACCESS_DENIED' }, 401, [...clearCookies(),clearImpersonationCookie()]);
  const path = new URL(request.url).pathname.slice('/portal/api'.length) || '/';
  const targetRoute=/^\/v1\/(client|agent)(\/|$)/.test(path)||path==='/v1/events';
  const impersonationToken=targetRoute?cookieImpersonation:'';
  const tabHeader=String(request.headers.get('x-rona-impersonation-tab')||'').trim();
  const impersonationTab=impersonationToken&&UUID_RE.test(tabHeader)?tabHeader:'';
  if(impersonationToken&&!impersonationTab){
    const h=withSecurity(new Headers({'content-type':'application/json; charset=utf-8','x-rona-impersonation-ended':'1'}));
    return new Response(JSON.stringify({ok:false,code:'IMPERSONATION_TAB_INVALID',returnTo:'/portal/admin'}),{status:409,headers:h});
  }
  let upstreamResponse = access ? await upstream(access, path, request, impersonationToken, impersonationTab) : null;
  let setCookies = [];
  if (!upstreamResponse || upstreamResponse.status === 401) {
    if (!refresh) return json({ ok:false, code:'PORTAL_ACCESS_DENIED' }, 401, [...clearCookies(),clearImpersonationCookie()]);
    let next;try{next=await authRefresh(refresh)}catch(_){return json({ok:false,code:'PORTAL_AUTH_BACKEND_UNAVAILABLE',retryable:true},503)}
    if(!next.ok||!next.data?.access_token||!next.data?.refresh_token){if(refreshFailureIsRetryable(next))return json({ok:false,code:'PORTAL_SESSION_STALE',retryable:true},409);return json({ok:false,code:'PORTAL_ACCESS_DENIED'},401,[...clearCookies(),clearImpersonationCookie()])}
    access = next.data.access_token;
    setCookies = tokenCookies(next.data);
    upstreamResponse = await upstream(access, path, request, impersonationToken, impersonationTab);
  }
  if(impersonationToken&&upstreamResponse.status===401){
    const headers=withSecurity(new Headers({'content-type':'application/json; charset=utf-8','x-rona-impersonation-ended':'1'}));
    for(const cookie of setCookies)headers.append('set-cookie',cookie);
    return new Response(JSON.stringify({ok:false,code:'IMPERSONATION_SESSION_INVALID',returnTo:'/portal/admin'}),{status:409,headers});
  }
  const headers = withSecurity(new Headers());
  const ct = upstreamResponse.headers.get('content-type'); if (ct) headers.set('content-type', ct);
  const requestId = upstreamResponse.headers.get('x-request-id'); if (requestId) headers.set('x-request-id', requestId);
  for (const cookie of setCookies) headers.append('set-cookie', cookie);
  return new Response(upstreamResponse.body, { status: upstreamResponse.status, statusText: upstreamResponse.statusText, headers });
}
async function proxyAdminAuthority(request) {
  if (!['GET','POST'].includes(request.method)) return json({ ok:false, code:'METHOD_NOT_ALLOWED' }, 405);
  if (request.method === 'POST' && !sameOriginPost(request)) return json({ ok:false, code:'ORIGIN_DENIED' }, 403);
  const session=await ensureSession(request);
  if(session?.unavailable)return json({ok:false,code:'PORTAL_AUTH_BACKEND_UNAVAILABLE',retryable:true},503,session.setCookies);
  if(!session)return json({ok:false,code:'PORTAL_ACCESS_DENIED'},401,[...clearCookies(),clearImpersonationCookie()]);
  const roles=rolesOf(session.me);
  if (!roles.includes('ADMIN')) return json({ ok:false, code:'ROLE_MISMATCH' }, 403, session.setCookies);
  const url = new URL(request.url);
  const prefix = '/portal/admin-authority';
  const upstreamPath = url.pathname.startsWith(prefix) ? (url.pathname.slice(prefix.length) || '/') : '/';
  const cookies=parseCookies(request.headers.get('cookie'));
  const impersonationToken=String(cookies[IMPERSONATION_COOKIE]||'').trim();

  if(upstreamPath==='/impersonation/enter'&&request.method==='POST'){
    const ct=request.headers.get('content-type')||'';
    let body={};
    try{
      if(ct.includes('application/json'))body=await request.clone().json();
      else{
        const form=await request.clone().formData();
        body={kind:String(form.get('kind')||''),entityId:String(form.get('entityId')||''),targetPortalUserId:String(form.get('targetPortalUserId')||'')||null};
      }
    }catch(_){return redirect('/portal/admin?accessView=companies&impersonationError=INVALID_REQUEST',303,session.setCookies)}
    const kind=String(body?.kind||'').trim().toUpperCase();
    const entityId=String(body?.entityId||'').trim();
    const targetPortalUserId=String(body?.targetPortalUserId||'').trim()||null;
    if(!['COMPANY','AGENT'].includes(kind)||!entityId)return redirect('/portal/admin?accessView=companies&impersonationError=INVALID_REQUEST',303,session.setCookies);
    const start=await fetch(`${ADMIN_CONTROL_PLANE_API}/impersonation/start`,{
      method:'POST',
      headers:{authorization:`Bearer ${session.access}`,accept:'application/json','content-type':'application/json'},
      body:JSON.stringify({kind,entityId,targetPortalUserId}),
      cache:'no-store'
    });
    const payload=await start.json().catch(()=>null);
    if(!start.ok||!payload?.ok||!payload?.data?.impersonationToken){
      const code=encodeURIComponent(String(payload?.code||'IMPERSONATION_START_FAILED'));
      return redirect('/portal/admin?accessView='+(kind==='AGENT'?'agents':'companies')+'&impersonationError='+code,303,session.setCookies);
    }
    const opaque=String(payload.data.impersonationToken);
    const imp=payload.data?.impersonation||{};
    const sessionId=String(imp.id||'');
    const targetPath=String(payload.data?.targetPath||'');
    if(!UUID_RE.test(sessionId)||!['/portal/client','/portal/agent'].includes(targetPath))return redirect('/portal/admin?accessView='+(kind==='AGENT'?'agents':'companies')+'&impersonationError=IMPERSONATION_START_FAILED',303,session.setCookies);
    const expires=Date.parse(String(imp.expiresAt||''));
    const maxAge=Number.isFinite(expires)?Math.max(1,Math.min(900,Math.floor((expires-Date.now())/1000))):720;
    return redirect(targetPath+'?impSession='+encodeURIComponent(sessionId),303,[...session.setCookies,impersonationCookie(opaque,maxAge)]);
  }

  const headers = new Headers({ authorization: `Bearer ${session.access}`, accept: 'application/json' });
  for (const name of ['content-type','x-request-id','x-correlation-id','x-idempotency-key','x-current-document-id']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  if((upstreamPath==='/impersonation/end'||upstreamPath==='/impersonation/resolve')&&impersonationToken){
    headers.set('x-rona-admin-impersonation-token',impersonationToken);
    const tabId=String(request.headers.get('x-rona-impersonation-tab')||'').trim();
    if(upstreamPath==='/impersonation/end'&&UUID_RE.test(tabId))headers.set('x-rona-impersonation-tab',tabId);
  }
  const init = { method: request.method, headers };
  if (!['GET','HEAD'].includes(request.method)) init.body = await request.clone().arrayBuffer();
  const upstreamResponse = await fetch(`${ADMIN_CONTROL_PLANE_API}${upstreamPath}${url.search}`, init);

  if(upstreamPath==='/impersonation/start'){
    const payload=await upstreamResponse.json().catch(()=>null);
    if(!upstreamResponse.ok||!payload?.ok||!payload?.data?.impersonationToken){
      return json(payload||{ok:false,code:'IMPERSONATION_START_FAILED'},upstreamResponse.status,session.setCookies);
    }
    const opaque=String(payload.data.impersonationToken);
    delete payload.data.impersonationToken;
    const expires=Date.parse(String(payload.data?.impersonation?.expiresAt||''));
    const maxAge=Number.isFinite(expires)?Math.max(1,Math.min(900,Math.floor((expires-Date.now())/1000))):720;
    return json(payload,upstreamResponse.status,[...session.setCookies,impersonationCookie(opaque,maxAge)]);
  }
  if(upstreamPath==='/impersonation/end'){
    const payload=await upstreamResponse.json().catch(()=>({ok:upstreamResponse.ok}));
    const cookiesOut=upstreamResponse.ok&&payload?.ok?[...session.setCookies,clearImpersonationCookie()]:session.setCookies;
    return json(payload,upstreamResponse.status,cookiesOut);
  }
  return secureResponse(upstreamResponse, session.setCookies, false);
}

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  if (!path.startsWith('/portal')) return context.next();

  if (path === '/portal/auth/login' && request.method === 'POST') {
    if (!sameOriginPost(request)) return json({ ok:false, code:'ORIGIN_DENIED' }, 403);
    const ct = request.headers.get('content-type') || '';
    const jsonMode = ct.includes('application/json');
    let email = '', password = '', next = '';
    if (jsonMode) {
      const body = await request.json().catch(() => ({}));
      email = String(body.email || body.identifier || '').trim();
      password = String(body.password || '');
      next = String(body.next || '');
    } else {
      const form = await request.formData();
      email = String(form.get('email') || form.get('identifier') || '').trim();
      password = String(form.get('password') || '');
      next = String(form.get('next') || '');
    }
    if (!email || !password || email.length > 320 || password.length > 1024) {
      return jsonMode ? json({ok:false,code:'LOGIN_INVALID'},400) : html(loginPage('Не удалось выполнить вход.'), 400);
    }
    const login = await authPassword(email, password);
    if (!login.ok || !login.data?.access_token || !login.data?.refresh_token) {
      return jsonMode ? json({ok:false,code:'LOGIN_DENIED'},401,clearCookies()) : html(loginPage('Неверные данные входа или доступ неактивен.'), 401, clearCookies());
    }
    const loginProbe=await sessionProbe(login.data.access_token);
    const recoveryTarget=parseLocalNext(next)||'/portal/';
    if(loginProbe.state==='UNAVAILABLE'){
      return jsonMode
        ? json({ok:false,code:'PORTAL_AUTH_BACKEND_UNAVAILABLE',sessionIssued:true,redirect:recoveryTarget},503,tokenCookies(login.data))
        : html(unavailablePage(recoveryTarget),503,tokenCookies(login.data));
    }
    if(loginProbe.state!=='VALID'){
      await authLogout(login.data.access_token);
      return jsonMode ? json({ok:false,code:'PORTAL_ACCESS_DENIED'},403,clearCookies()) : html(loginPage('Доступ к порталу не активирован.'),403,clearCookies());
    }
    const me=loginProbe.me;
    const roles=rolesOf(me);
    const requested = parseLocalNext(next);
    if (requested && !roleAllows(requested, roles)) {
      return jsonMode ? json({ok:false,code:'ROLE_MISMATCH'},403,tokenCookies(login.data)) : html(deniedPage('ROLE_MISMATCH'), 403, tokenCookies(login.data));
    }
    const target = requested || defaultTarget(roles);
    if (!target) {
      await authLogout(login.data.access_token);
      return jsonMode ? json({ok:false,code:'ROLE_NOT_PORTAL_ENABLED'},403,clearCookies()) : html(deniedPage('ROLE_NOT_PORTAL_ENABLED'), 403, clearCookies());
    }
    return jsonMode ? json({ok:true,redirect:target},200,tokenCookies(login.data)) : redirect(target, 303, tokenCookies(login.data));
  }
  if (path === '/portal/auth/logout' && request.method === 'POST') {
    if (!sameOriginPost(request)) return json({ ok:false, code:'ORIGIN_DENIED' }, 403, [...clearCookies(),clearImpersonationCookie()]);
    const cookies = parseCookies(request.headers.get('cookie'));
    await authLogout(cookies[ACCESS_COOKIE] || '');
    return redirect('/portal/login', 303, [...clearCookies(),clearImpersonationCookie()]);
  }
  if (path.startsWith('/portal/admin-authority')) return proxyAdminAuthority(request);
  if (path.startsWith('/portal/api/')) {
    if (!['GET','POST'].includes(request.method)) return json({ ok:false, code:'METHOD_NOT_ALLOWED' }, 405);
    return proxyApi(request);
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') return json({ ok:false, code:'METHOD_NOT_ALLOWED' }, 405);
  if (path === '/portal/login') {
    const session=await ensureSession(request);
    if(session?.unavailable)return html(unavailablePage('/portal/login'),503,session.setCookies);
    if(session){
      const target=defaultTarget(rolesOf(session.me));
      if (target) return redirect(target, 303, session.setCookies);
    }
    return html(loginPage(), 200, session?.setCookies || clearCookies());
  }
  const session=await ensureSession(request);
  if(session?.unavailable)return html(unavailablePage(canonicalProtectedPath(path)),503,session.setCookies);
  if(!session)return redirect(`/portal/login?next=${encodeURIComponent(canonicalProtectedPath(path))}`,303,clearCookies());
  const roles=rolesOf(session.me);
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