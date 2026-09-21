const SUPABASE_URL = 'https://sxawrwzeobaqwwmlkzws.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_W2MxTx00ILiugSyZKp8uyQ_zBzcyorL';
const PORTAL_API = `${SUPABASE_URL}/functions/v1/rona-portal-api`;
const OWNER_ALIAS = 'rokotove';
const OWNER_EMAIL = 'office_kg@ronaoil.com';
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
function headers(extra = {}) { const out=new Headers(extra); for(const [k,v] of Object.entries(SECURITY_HEADERS))out.set(k,v);out.delete('access-control-allow-origin');out.delete('access-control-allow-credentials');return out; }
function accessCookie(token,maxAge=3600){return `${ACCESS_COOKIE}=${token}; Max-Age=${Math.max(0,Number(maxAge)||0)}; Path=/portal; Secure; HttpOnly; SameSite=Lax`;}
function refreshCookie(token,maxAge=604800){return `${REFRESH_COOKIE}=${token}; Max-Age=${Math.max(0,Number(maxAge)||0)}; Path=/portal; Secure; HttpOnly; SameSite=Lax`;}
function clearCookies(){return [`${ACCESS_COOKIE}=; Max-Age=0; Path=/portal; Secure; HttpOnly; SameSite=Lax`,`${REFRESH_COOKIE}=; Max-Age=0; Path=/portal; Secure; HttpOnly; SameSite=Lax`];}
function tokenCookies(tokens){const expires=Math.min(Math.max(Number(tokens?.expires_in||3600),60),7200);return [accessCookie(tokens.access_token,expires),refreshCookie(tokens.refresh_token,604800)];}
function parseCookies(header){const out={};for(const item of String(header||'').split(';')){const i=item.indexOf('=');if(i<1)continue;const key=item.slice(0,i).trim(),value=item.slice(i+1).trim();if(key)out[key]=value;}return out;}
function response(body,status,contentType,cookies=[],location=''){const h=headers({'content-type':contentType});if(location)h.set('location',location);for(const c of cookies)h.append('set-cookie',c);return new Response(body,{status,headers:h});}
function json(body,status=200,cookies=[]){return response(JSON.stringify(body),status,'application/json; charset=utf-8',cookies);}
function redirect(location,cookies=[]){return response(null,303,'text/plain; charset=utf-8',cookies,location);}
function wantsJson(request){return (request.headers.get('accept')||'').toLowerCase().includes('application/json');}
function escapeHtml(value){return String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function loginHtml(message=''){
 const note=message?`<div class="error">${escapeHtml(message)}</div>`:'';
 return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RONA Trade — Вход</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#05090d;color:#eef4f7;font:16px Inter,Arial,sans-serif}.box{width:min(430px,calc(100vw - 32px));padding:28px;border:1px solid #29404e;border-radius:16px;background:#0b151d}.field{display:grid;gap:7px;margin:14px 0}.field input{padding:12px;border-radius:10px;border:1px solid #365464;background:#09121a;color:#fff}.btn{width:100%;padding:12px;border:1px solid #8a3540;border-radius:10px;background:#26151a;color:#fff;font-weight:800}.error{padding:10px 12px;border-radius:9px;background:#4b1e23;color:#ffdfe3;margin:12px 0}.muted{color:#93a8b3}</style></head><body><main class="box"><h1>RONA Trade</h1><p class="muted">Единый вход в защищённые кабинеты</p>${note}<form method="post" action="/portal/auth/login"><input type="hidden" name="next" value="/portal/admin"><div class="field"><label>Email или логин</label><input name="identifier" autocomplete="username" required></div><div class="field"><label>Пароль</label><input name="password" type="password" autocomplete="current-password" required></div><button class="btn" type="submit">Войти</button></form></main></body></html>`;
}
function unavailableHtml(next='/portal/admin'){
 const target=parseLocalNext(next)||'/portal/admin';
 return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta http-equiv="refresh" content="8;url=${escapeHtml(target)}"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RONA Trade — Восстановление соединения</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#05090d;color:#eef4f7;font:16px Inter,Arial,sans-serif}.box{max-width:540px;padding:28px;border:1px solid #29404e;border-radius:16px;background:#0b151d}.muted{color:#93a8b3}</style></head><body><main class="box"><h1>Восстанавливаю соединение</h1><p class="muted">Данные входа приняты. Сервер авторизации временно недоступен; повторная проверка выполняется автоматически.</p></main></body></html>`;
}
function sameOrigin(request){
 const u=new URL(request.url),o=request.headers.get('origin');
 if(o&&o!=='null')return o===u.origin;
 if(o==='null'){
  const site=String(request.headers.get('sec-fetch-site')||'').toLowerCase();
  const mode=String(request.headers.get('sec-fetch-mode')||'').toLowerCase();
  const dest=String(request.headers.get('sec-fetch-dest')||'').toLowerCase();
  if(site==='same-origin'&&mode==='navigate'&&(dest==='document'||dest===''))return true;
 }
 const r=request.headers.get('referer');if(!r)return false;try{return new URL(r).origin===u.origin}catch{return false}
}
function canonicalPath(path){if(path==='/portal/admin.html')return'/portal/admin';if(path==='/portal/agent.html')return'/portal/agent';if(path==='/portal/client.html')return'/portal/client';return path;}
function parseLocalNext(value){if(!value)return null;try{const u=new URL(value,'https://local.invalid');if(u.origin!=='https://local.invalid')return null;const path=canonicalPath(u.pathname);return ['/portal/admin','/portal/staff','/portal/agent','/portal/client','/portal/select'].includes(path)?path:null}catch{return null}}
function targets(roles){const out=[];if(roles.includes('ADMIN'))out.push('/portal/admin');if(roles.includes('RONA_OPERATOR'))out.push('/portal/staff');if(roles.includes('AGENT'))out.push('/portal/agent');if(roles.includes('CLIENT'))out.push('/portal/client');return out;}
function roleAllows(path,roles){if(path==='/portal/admin')return roles.includes('ADMIN');if(path==='/portal/staff')return roles.includes('RONA_OPERATOR');if(path==='/portal/agent')return roles.includes('AGENT');if(path==='/portal/client')return roles.includes('CLIENT');if(path==='/portal/select')return targets(roles).length>1;return false;}
function emailForIdentifier(value){const id=String(value||'').trim();const lower=id.toLowerCase();if(lower===OWNER_ALIAS)return OWNER_EMAIL;if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id))return lower;return 'invalid-login@invalid.rona.local';}
async function fetchWithTimeout(url,init={},timeoutMs=7000){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort('RONA_AUTH_TIMEOUT'),Math.max(1000,Number(timeoutMs)||7000));
 try{return await fetch(url,{...init,signal:controller.signal})}
 finally{clearTimeout(timer)}
}
const AUTH_PASSWORD_TIMEOUTS_MS=Object.freeze([18000,9000,12000]);
const AUTH_REFRESH_TIMEOUTS_MS=Object.freeze([15000,8000,10000]);
const AUTH_TRANSIENT_RETRY_DELAY_MS=450;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function authGrant(grantType,payload,timeouts,failureCode){
 let last={ok:false,status:503,data:{code:failureCode}};
 for(let attempt=0;attempt<timeouts.length;attempt++){
  try{
   const r=await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/token?grant_type=${grantType}`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'content-type':'application/json'},body:JSON.stringify(payload)},timeouts[attempt]);
   const result={ok:r.ok,status:r.status,data:await r.json().catch(()=>({}))};
   if(result.ok)return result;
   if(result.status===429||result.status<500)return result;
   last=result;
  }catch{
   last={ok:false,status:503,data:{code:failureCode}};
  }
  if(attempt<timeouts.length-1)await sleep(AUTH_TRANSIENT_RETRY_DELAY_MS);
 }
 return last;
}
async function authPassword(identifier,password){return authGrant('password',{email:emailForIdentifier(identifier),password},AUTH_PASSWORD_TIMEOUTS_MS,'AUTH_FETCH_FAILED')}
async function authRefresh(refreshToken){return authGrant('refresh_token',{refresh_token:refreshToken},AUTH_REFRESH_TIMEOUTS_MS,'AUTH_REFRESH_FAILED')}
async function authUser(accessToken){try{const r=await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:SUPABASE_PUBLISHABLE_KEY,authorization:`Bearer ${accessToken}`,accept:'application/json'}},5000);return {ok:r.ok,status:r.status,data:await r.json().catch(()=>({}))}}catch{return {ok:false,status:503,data:{code:'AUTH_USER_FAILED'}}}}
function retryableAuthFailure(result){const status=Number(result?.status||0);return status===429||status>=500||status===0;}
function ownerAuthIdentity(data){return String(data?.email||'').toLowerCase()===OWNER_EMAIL&&String(data?.app_metadata?.portal_identity||'')==='OWNER_ADMIN';}
function tokenOwnerHint(token){try{const part=String(token||'').split('.')[1]||'';if(!part)return false;const normalized=part.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(part.length/4)*4,'=');const payload=JSON.parse(atob(normalized));return String(payload?.email||'').toLowerCase()===OWNER_EMAIL&&String(payload?.app_metadata?.portal_identity||'')==='OWNER_ADMIN'}catch{return false}}
async function recoverExistingOwnerSession(request,next,identifier=''){
 const requested=parseLocalNext(next);
 if(requested&&requested!=='/portal/admin')return null;
 const cookies=parseCookies(request.headers.get('cookie'));
 const access=cookies[ACCESS_COOKIE]||'',refresh=cookies[REFRESH_COOKIE]||'';
 const explicitOwner=Boolean(String(identifier||'').trim())&&emailForIdentifier(identifier)===OWNER_EMAIL;
 let mayRefresh=explicitOwner;
 if(access){
   const current=await authUser(access);
   if(current.ok){
     if(ownerAuthIdentity(current.data))return {target:'/portal/admin',cookies:[],source:'ACCESS_COOKIE'};
     return null;
   }
   mayRefresh=mayRefresh||tokenOwnerHint(access);
 }
 if(refresh&&mayRefresh){
   const rotated=await authRefresh(refresh);
   if(rotated.ok&&rotated.data?.access_token&&rotated.data?.refresh_token){
     const current=await authUser(rotated.data.access_token);
     if(current.ok&&ownerAuthIdentity(current.data))return {target:'/portal/admin',cookies:tokenCookies(rotated.data),source:'REFRESH_COOKIE'};
   }
 }
 return null;
}
async function sessionAuthority(accessToken){let lastStatus=503;const timeouts=[5000,4000];for(let attempt=0;attempt<timeouts.length;attempt++){try{const r=await fetchWithTimeout(`${PORTAL_API}/session/authority`,{headers:{apikey:SUPABASE_PUBLISHABLE_KEY,authorization:`Bearer ${accessToken}`,accept:'application/json'}},timeouts[attempt]);lastStatus=r.status;if(r.ok){const j=await r.json().catch(()=>null);if(j?.ok&&j?.user&&j?.authority==='PORTAL_SESSION_AUTHORITY_V1')return {state:'VALID',me:j,status:r.status};}else if(r.status===401||r.status===403)return {state:'INVALID',me:null,status:r.status};else if(r.status!==429&&r.status<500)return {state:'INVALID',me:null,status:r.status};}catch{lastStatus=503}if(attempt<timeouts.length-1)await new Promise(resolve=>setTimeout(resolve,350));}return {state:'UNAVAILABLE',me:null,status:lastStatus}}
async function logout(accessToken){try{await fetch(`${SUPABASE_URL}/auth/v1/logout`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,authorization:`Bearer ${accessToken}`}})}catch(_){}}

export async function onRequestPost({request}){
 if(!sameOrigin(request))return json({ok:false,code:'ORIGIN_DENIED'},403,clearCookies());
 const ct=request.headers.get('content-type')||'';let identifier='',password='',next='',resumeOnly=false;
 if(ct.includes('application/json')){const body=await request.json().catch(()=>({}));identifier=String(body.identifier||body.email||'').trim();password=String(body.password||'');next=String(body.next||'');resumeOnly=body.resume===true;}
 else{const form=await request.formData();identifier=String(form.get('identifier')||form.get('email')||'').trim();password=String(form.get('password')||'');next=String(form.get('next')||'');resumeOnly=String(form.get('resume')||'')==='1';}
 const asJson=wantsJson(request);
 const recovered=await recoverExistingOwnerSession(request,next,identifier);
 if(recovered)return asJson?json({ok:true,redirect:recovered.target,recovered:true,source:recovered.source},200,recovered.cookies):redirect(recovered.target,recovered.cookies);
 if(resumeOnly)return json({ok:false,code:'NO_RECOVERABLE_SESSION'},401);
 if(!identifier||!password||identifier.length>320||password.length>1024)return asJson?json({ok:false,code:'LOGIN_INVALID'},400,clearCookies()):response(loginHtml('Не удалось выполнить вход.'),400,'text/html; charset=utf-8',clearCookies());
 const login=await authPassword(identifier,password);
 if(!login.ok||!login.data?.access_token||!login.data?.refresh_token){
   if(Number(login.status)===429)return asJson?json({ok:false,code:'LOGIN_RATE_LIMITED',retryable:true},429):response(loginHtml('Слишком много попыток входа. Подождите и повторите.'),429,'text/html; charset=utf-8');
   if(retryableAuthFailure(login))return asJson?json({ok:false,code:'PORTAL_AUTH_BACKEND_UNAVAILABLE',retryable:true},503):response(unavailableHtml(parseLocalNext(next)||'/portal/admin'),503,'text/html; charset=utf-8');
   return asJson?json({ok:false,code:'LOGIN_DENIED'},401,clearCookies()):response(loginHtml('Неверный логин или пароль.'),401,'text/html; charset=utf-8',clearCookies());
 }
 const probe=await sessionAuthority(login.data.access_token);
 if(probe.state==='UNAVAILABLE'){
   const target=parseLocalNext(next)||'/portal/admin';
   const ownerAdminHandoff=target==='/portal/admin'&&emailForIdentifier(identifier)===OWNER_EMAIL;
   if(ownerAdminHandoff){
     const cookies=tokenCookies(login.data);
     return asJson?json({ok:true,redirect:'/portal/admin',sessionIssued:true,deferredAuthority:true},200,cookies):redirect('/portal/admin',cookies);
   }
   return asJson?json({ok:false,code:'PORTAL_AUTH_BACKEND_UNAVAILABLE',retryable:true,sessionIssued:true,redirect:target},503,tokenCookies(login.data)):response(unavailableHtml(target),503,'text/html; charset=utf-8',tokenCookies(login.data));
 }
 if(probe.state!=='VALID'){await logout(login.data.access_token);return asJson?json({ok:false,code:'PORTAL_ACCESS_DENIED'},403,clearCookies()):response(loginHtml('Доступ к порталу не активирован.'),403,'text/html; charset=utf-8',clearCookies());}
 const me=probe.me;
 const roles=Array.isArray(me.user.roles)?me.user.roles.map(String):[];const requested=parseLocalNext(next);
 if(requested&&!roleAllows(requested,roles))return json({ok:false,code:'ROLE_MISMATCH'},403,tokenCookies(login.data));
 const allowed=targets(roles);const ownerLogin=emailForIdentifier(identifier)===OWNER_EMAIL&&roles.includes('ADMIN');
 const target=requested||(ownerLogin?'/portal/admin':(allowed.length>1?'/portal/select':allowed[0]||null));
 if(!target){await logout(login.data.access_token);return json({ok:false,code:'ROLE_NOT_PORTAL_ENABLED'},403,clearCookies());}
 const cookies=tokenCookies(login.data);
 if(asJson)return json({ok:true,redirect:target},200,cookies);
 return redirect(target,cookies);
}
export function onRequestGet(){return response(null,405,'text/plain; charset=utf-8');}
