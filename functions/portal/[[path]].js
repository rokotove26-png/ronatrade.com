const SUPABASE_URL = 'https://sxawrwzeobaqwwmlkzws.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_W2MxTx00ILiugSyZKp8uyQ_zBzcyorL';
const PORTAL_API = `${SUPABASE_URL}/functions/v1/rona-portal-api`;
const STAFF_WORKSPACE = `${SUPABASE_URL}/functions/v1/rona-staff-workspace`;
const ADMIN_CONTROL_PLANE_API = `${SUPABASE_URL}/functions/v1/rona-admin-control-plane`;
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
    // Server session/role is authoritative. Remove only the frozen file's standalone local auth, then boot canonical application modules.
    const transformed = new HTMLRewriter()
      .on('body', new BootServerAuthenticatedAdminBody())
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
async function proxyAdminAuthority(request) {
  if (!['GET','POST'].includes(request.method)) return json({ ok:false, code:'METHOD_NOT_ALLOWED' }, 405);
  if (request.method === 'POST' && !sameOriginPost(request)) return json({ ok:false, code:'ORIGIN_DENIED' }, 403);
  const session = await ensureSession(request);
  if (!session) return json({ ok:false, code:'PORTAL_ACCESS_DENIED' }, 401, clearCookies());
  const roles = rolesOf(session.me);
  if (!roles.includes('ADMIN')) return json({ ok:false, code:'ROLE_MISMATCH' }, 403, session.setCookies);
  const url = new URL(request.url);
  const prefix = '/portal/admin-authority';
  const upstreamPath = url.pathname.startsWith(prefix) ? (url.pathname.slice(prefix.length) || '/') : '/';
  const headers = new Headers({ authorization: `Bearer ${session.access}`, accept: 'application/json' });
  for (const name of ['content-type','x-request-id','x-correlation-id','x-idempotency-key','x-current-document-id']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const init = { method: request.method, headers };
  if (!['GET','HEAD'].includes(request.method)) init.body = await request.clone().arrayBuffer();
  const upstreamResponse = await fetch(`${ADMIN_CONTROL_PLANE_API}${upstreamPath}${url.search}`, init);
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
  if (path.startsWith('/portal/admin-authority')) return proxyAdminAuthority(request);
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