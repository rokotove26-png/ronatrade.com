const BUILD='owner-fast-shell-v2-20260826-0300';
const SHELL_RUNTIME='/assets/portal-admin-shell-fast-v1.js?v=20260826-0300';
const SUPABASE_URL='https://sxawrwzeobaqwwmlkzws.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_W2MxTx00ILiugSyZKp8uyQ_zBzcyorL';
const PORTAL_API=`${SUPABASE_URL}/functions/v1/rona-portal-api`;
const ACCESS_COOKIE='rona_portal_at';
const REFRESH_COOKIE='rona_portal_rt';
const ADMIN_CSP="default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' https://unpkg.com; style-src 'self' 'unsafe-inline' https://unpkg.com; img-src 'self' data: blob: https://tiles.openfreemap.org; connect-src 'self'; font-src 'self' data: https://tiles.openfreemap.org; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'; object-src 'none'; form-action 'self'";
const SESSION_RETRY_DELAYS_MS=Object.freeze([0,250,500,1000]);
const CURRENT_ONLY_GUARD=`<style id="rona-current-only-paint-gate">html:not(.rona-current-ui-ready)::before{content:"";position:fixed;inset:0;z-index:2147483646;background:#07121f}html:not(.rona-current-ui-ready)::after{content:"Загрузка рабочего кабинета RONA Trade…";position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2147483647;color:#dce8ff;font:600 14px/1.4 Inter,Arial,sans-serif;letter-spacing:.02em}html.rona-current-ui-failed::after{content:"Рабочий кабинет не загрузился. Обновите страницу.";color:#ffd8dc}</style><script id="rona-current-only-paint-runtime">(()=>{'use strict';const root=document.documentElement;let observer=null,done=false;const ready=()=>window.__RONA_OWNER_ADMIN_READY__===true&&window.__RONA_POSTCORE_ENHANCEMENTS_READY__===true&&root.dataset.ronaPostcore==='ready'&&!!window.__RONA_ADMIN_CANONICAL_TWEAKS__;function release(){if(done||!ready())return false;done=true;root.classList.add('rona-current-ui-ready');root.classList.remove('rona-current-ui-failed');root.dataset.ronaOwnerPaint='current-only-ready';window.__RONA_OWNER_FIRST_PAINT_READY__=true;if(observer)observer.disconnect();return true}function arm(){if(release())return;if(typeof MutationObserver==='function'){observer=new MutationObserver(()=>release());observer.observe(root,{attributes:true,attributeFilter:['class','data-rona-postcore','data-rona-owner-paint']})}window.addEventListener('rona:admin-app-ready',()=>queueMicrotask(release));[250,750,1500,3000,6000,12000].forEach(ms=>setTimeout(release,ms));setTimeout(()=>{if(!release()){root.classList.add('rona-current-ui-failed');root.dataset.ronaOwnerPaint='blocked-error'}},20000)}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',arm,{once:true});else arm()})()</script>`;

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function parseCookies(header){
  const out={};
  for(const item of String(header||'').split(';')){
    const i=item.indexOf('=');
    if(i<1)continue;
    const key=item.slice(0,i).trim();
    if(key)out[key]=item.slice(i+1).trim();
  }
  return out;
}
function accessCookie(token,maxAge=3600){return `${ACCESS_COOKIE}=${token}; Max-Age=${Math.max(0,Number(maxAge)||0)}; Path=/portal; Secure; HttpOnly; SameSite=Lax`;}
function refreshCookie(token,maxAge=604800){return `${REFRESH_COOKIE}=${token}; Max-Age=${Math.max(0,Number(maxAge)||0)}; Path=/portal; Secure; HttpOnly; SameSite=Lax`;}
function clearCookies(){return [`${ACCESS_COOKIE}=; Max-Age=0; Path=/portal; Secure; HttpOnly; SameSite=Lax`,`${REFRESH_COOKIE}=; Max-Age=0; Path=/portal; Secure; HttpOnly; SameSite=Lax`];}
function tokenCookies(tokens){const expires=Math.min(Math.max(Number(tokens?.expires_in||3600),60),7200);return [accessCookie(tokens.access_token,expires),refreshCookie(tokens.refresh_token,604800)];}
function rolesOf(me){return Array.isArray(me?.user?.roles)?me.user.roles.map(String):[];}

function securityHeaders(source,cookies=[]){
  const h=new Headers(source||{});
  h.set('cache-control','no-store, no-cache, must-revalidate');
  h.set('pragma','no-cache');
  h.set('expires','0');
  h.set('referrer-policy','no-referrer');
  h.set('x-content-type-options','nosniff');
  h.set('x-frame-options','DENY');
  h.set('permissions-policy','camera=(), microphone=(), geolocation=(), payment=()');
  h.set('cross-origin-opener-policy','same-origin');
  h.set('cross-origin-resource-policy','same-origin');
  h.set('content-security-policy',ADMIN_CSP);
  h.set('x-rona-admin-shell','fast-static-v2');
  h.set('x-rona-admin-auth','server-verified-v1');
  h.set('x-rona-ui-build',BUILD);
  h.set('x-rona-admin-current-only','main-v2-canonical');
  h.delete('content-length');
  h.delete('etag');
  for(const cookie of cookies)h.append('set-cookie',cookie);
  return h;
}
function loginRedirect(request,cookies=[]){
  const u=new URL('/portal/login',request.url);
  u.searchParams.set('next','/portal/admin');
  const h=securityHeaders(null,cookies);
  h.set('location',u.toString());
  return new Response(null,{status:302,headers:h});
}
function recoveryPage(request,cookies=[]){
  const h=securityHeaders({'content-type':'text/html; charset=utf-8'},cookies);
  const target=new URL('/portal/admin',request.url).pathname;
  return new Response(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="2;url=${target}"><title>RONA Trade — Восстановление соединения</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#07121f;color:#f7fbff;font:16px Inter,Arial,sans-serif}.box{width:min(520px,calc(100vw - 32px));padding:28px;border:1px solid rgba(222,236,248,.24);border-radius:16px;background:rgba(6,16,28,.9)}p{color:#b6c4d1}</style></head><body><main class="box"><h1>Восстанавливаю соединение</h1><p>Сессия сохранена. Сервер авторизации временно недоступен; повторная проверка выполняется автоматически.</p></main></body></html>`,{status:503,headers:h});
}
function deniedPage(cookies=[]){
  const h=securityHeaders({'content-type':'text/html; charset=utf-8'},cookies);
  return new Response('<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RONA Trade — Доступ запрещён</title></head><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#07121f;color:#f7fbff;font:16px Inter,Arial,sans-serif"><main><h1>Доступ запрещён</h1><p>Текущая сессия не имеет роли администратора.</p></main></body></html>',{status:403,headers:h});
}

async function authRefresh(refreshToken){
  try{
    const r=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,{
      method:'POST',
      headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'content-type':'application/json'},
      body:JSON.stringify({refresh_token:refreshToken})
    });
    return {ok:r.ok,status:r.status,data:await r.json().catch(()=>({}))};
  }catch(_){return {ok:false,status:503,data:{}};}
}
async function sessionProbe(accessToken){
  if(!accessToken)return {state:'INVALID',me:null,status:401};
  let lastStatus=503;
  for(const delay of SESSION_RETRY_DELAYS_MS){
    if(delay)await sleep(delay);
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),3500);
    try{
      const r=await fetch(`${PORTAL_API}/session/me`,{headers:{authorization:`Bearer ${accessToken}`,accept:'application/json'},signal:controller.signal});
      lastStatus=r.status;
      if(r.ok){
        const j=await r.json().catch(()=>null);
        if(j?.ok&&j?.user)return {state:'VALID',me:j,status:r.status};
      }else if(r.status===401||r.status===403){
        return {state:'INVALID',me:null,status:r.status};
      }else if(r.status!==429&&r.status<500){
        return {state:'INVALID',me:null,status:r.status};
      }
    }catch(_){lastStatus=503;}
    finally{clearTimeout(timer);}
  }
  return {state:'UNAVAILABLE',me:null,status:lastStatus};
}
async function ensureSession(request){
  const cookies=parseCookies(request.headers.get('cookie'));
  const access=cookies[ACCESS_COOKIE]||'';
  const refresh=cookies[REFRESH_COOKIE]||'';
  if(access){
    const probe=await sessionProbe(access);
    if(probe.state==='VALID')return {access,refresh,me:probe.me,setCookies:[]};
    if(probe.state==='UNAVAILABLE')return {unavailable:true,access,refresh,me:null,setCookies:[]};
  }
  if(!refresh)return null;
  const next=await authRefresh(refresh);
  if(!next.ok||!next.data?.access_token||!next.data?.refresh_token){
    if(next.status===429||Number(next.status||0)>=500)return {unavailable:true,access,refresh,me:null,setCookies:[]};
    return null;
  }
  const probe=await sessionProbe(next.data.access_token);
  const setCookies=tokenCookies(next.data);
  if(probe.state==='UNAVAILABLE')return {unavailable:true,access:next.data.access_token,refresh:next.data.refresh_token,me:null,setCookies};
  if(probe.state!=='VALID')return null;
  return {access:next.data.access_token,refresh:next.data.refresh_token,me:probe.me,setCookies};
}

async function canonicalAdminAsset(context){
  if(context.env?.ASSETS?.fetch){
    const u=new URL(context.request.url);
    u.pathname='/portal/admin';
    u.search='';
    return context.env.ASSETS.fetch(new Request(u.toString(),{method:context.request.method,headers:{accept:'text/html,application/xhtml+xml'}}));
  }
  return context.next();
}
class RemoveCanonicalLegacyAuthNode{element(el){el.remove();}}
class ServerVerifiedAdminBody{
  element(el){
    const classes=String(el.getAttribute('class')||'').split(/\s+/).filter(Boolean).filter(x=>x!=='admin-auth-locked');
    if(!classes.includes('admin-auth-server-verified'))classes.push('admin-auth-server-verified');
    el.setAttribute('class',classes.join(' '));
  }
}
class FastShellHeadInjector{
  element(el){
    el.append(`<meta name="rona-ui-primary" content="main-v2"><meta name="rona-ui-build" content="${BUILD}"><meta name="rona-admin-shell" content="fast-static-v2"><meta name="rona-admin-auth" content="server-verified-v1">${CURRENT_ONLY_GUARD}<script id="rona-admin-fast-shell-runtime" src="${SHELL_RUNTIME}" defer></script>`,{html:true});
  }
}

export async function onRequest(context){
  const request=context.request;
  if(!['GET','HEAD'].includes(request.method)){
    const h=securityHeaders({'content-type':'application/json; charset=utf-8','allow':'GET, HEAD'});
    return new Response(JSON.stringify({ok:false,code:'METHOD_NOT_ALLOWED'}),{status:405,headers:h});
  }

  const session=await ensureSession(request);
  if(session?.unavailable)return recoveryPage(request,session.setCookies);
  if(!session)return loginRedirect(request,clearCookies());
  if(!rolesOf(session.me).includes('ADMIN'))return deniedPage(session.setCookies);

  const started=Date.now();
  const response=await canonicalAdminAsset(context);
  const ct=String(response.headers.get('content-type')||'').toLowerCase();
  const h=securityHeaders(response.headers,session.setCookies);
  h.set('server-timing',`admin_shell;dur=${Math.max(0,Date.now()-started)}`);

  if(response.status!==200||!ct.includes('text/html')||request.method==='HEAD'){
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers:h});
  }

  if(typeof HTMLRewriter!=='function'){
    const source=await response.text();
    const guard=`<style>#adminLoginGate{display:none!important}</style><script>document.addEventListener('DOMContentLoaded',()=>{document.getElementById('adminLoginGate')?.remove();document.body?.classList.remove('admin-auth-locked');document.body?.classList.add('admin-auth-server-verified')},{once:true})</script>`;
    const tag=`<meta name="rona-ui-primary" content="main-v2"><meta name="rona-ui-build" content="${BUILD}"><meta name="rona-admin-shell" content="fast-static-v2"><meta name="rona-admin-auth" content="server-verified-v1">${guard}${CURRENT_ONLY_GUARD}<script id="rona-admin-fast-shell-runtime" src="${SHELL_RUNTIME}" defer></script>`;
    const html=source.replace('<body class="admin-auth-locked">','<body class="admin-auth-server-verified">').replace('</head>',tag+'</head>');
    return new Response(html,{status:200,headers:h});
  }

  const base=new Response(response.body,{status:response.status,statusText:response.statusText,headers:h});
  return new HTMLRewriter()
    .on('head',new FastShellHeadInjector())
    .on('body',new ServerVerifiedAdminBody())
    .on('#adminLoginGate',new RemoveCanonicalLegacyAuthNode())
    .on('#rona-admin-auth-v3413',new RemoveCanonicalLegacyAuthNode())
    .transform(base);
}