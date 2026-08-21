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
function response(body,status,contentType,cookies=[],location=''){const h=headers({'content-type':contentType});if(location)h.set('location',location);for(const c of cookies)h.append('set-cookie',c);return new Response(body,{status,headers:h});}
function json(body,status=200,cookies=[]){return response(JSON.stringify(body),status,'application/json; charset=utf-8',cookies);}
function redirect(location,cookies=[]){return response(null,303,'text/plain; charset=utf-8',cookies,location);}
function sameOrigin(request){const u=new URL(request.url);const o=request.headers.get('origin');if(o)return o===u.origin;const r=request.headers.get('referer');if(!r)return false;try{return new URL(r).origin===u.origin}catch{return false}}
function canonicalPath(path){if(path==='/portal/admin.html')return'/portal/admin';if(path==='/portal/agent.html')return'/portal/agent';if(path==='/portal/client.html')return'/portal/client';return path;}
function parseLocalNext(value){if(!value)return null;try{const u=new URL(value,'https://local.invalid');if(u.origin!=='https://local.invalid')return null;const path=canonicalPath(u.pathname);return ['/portal/admin','/portal/staff','/portal/agent','/portal/client','/portal/select'].includes(path)?path:null}catch{return null}}
function targets(roles){const out=[];if(roles.includes('ADMIN'))out.push('/portal/admin');if(roles.includes('RONA_OPERATOR'))out.push('/portal/staff');if(roles.includes('AGENT'))out.push('/portal/agent');if(roles.includes('CLIENT'))out.push('/portal/client');return out;}
function roleAllows(path,roles){if(path==='/portal/admin')return roles.includes('ADMIN');if(path==='/portal/staff')return roles.includes('RONA_OPERATOR');if(path==='/portal/agent')return roles.includes('AGENT');if(path==='/portal/client')return roles.includes('CLIENT');if(path==='/portal/select')return targets(roles).length>1;return false;}
function emailForIdentifier(value){const id=String(value||'').trim();const lower=id.toLowerCase();if(lower===OWNER_ALIAS)return OWNER_EMAIL;if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id))return lower;return 'invalid-login@invalid.rona.local';}
async function authPassword(identifier,password){const email=emailForIdentifier(identifier);const r=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'content-type':'application/json'},body:JSON.stringify({email,password})});return {ok:r.ok,data:await r.json().catch(()=>({}))};}
async function sessionMe(accessToken){for(let attempt=0;attempt<4;attempt++){try{const r=await fetch(`${PORTAL_API}/session/me`,{headers:{authorization:`Bearer ${accessToken}`,accept:'application/json'}});if(r.ok){const j=await r.json();if(j?.ok&&j?.user)return j}}catch{}if(attempt<3)await new Promise(resolve=>setTimeout(resolve,400));}return null}
async function logout(accessToken){try{await fetch(`${SUPABASE_URL}/auth/v1/logout`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,authorization:`Bearer ${accessToken}`}})}catch(_){}}

export async function onRequestPost({request}){
 if(!sameOrigin(request))return json({ok:false,code:'ORIGIN_DENIED'},403,clearCookies());
 const ct=request.headers.get('content-type')||'';let identifier='',password='',next='';
 if(ct.includes('application/json')){const body=await request.json().catch(()=>({}));identifier=String(body.identifier||body.email||'').trim();password=String(body.password||'');next=String(body.next||'');}
 else{const form=await request.formData();identifier=String(form.get('identifier')||form.get('email')||'').trim();password=String(form.get('password')||'');next=String(form.get('next')||'');}
 if(!identifier||!password||identifier.length>320||password.length>1024)return json({ok:false,code:'LOGIN_INVALID'},400,clearCookies());
 const login=await authPassword(identifier,password);
 if(!login.ok||!login.data?.access_token||!login.data?.refresh_token)return json({ok:false,code:'LOGIN_DENIED'},401,clearCookies());
 const me=await sessionMe(login.data.access_token);
 if(!me){await logout(login.data.access_token);return json({ok:false,code:'PORTAL_ACCESS_DENIED'},403,clearCookies());}
 const roles=Array.isArray(me.user.roles)?me.user.roles.map(String):[];const requested=parseLocalNext(next);
 if(requested&&!roleAllows(requested,roles))return json({ok:false,code:'ROLE_MISMATCH'},403,tokenCookies(login.data));
 const allowed=targets(roles);const target=requested||(allowed.length>1?'/portal/select':allowed[0]||null);
 if(!target){await logout(login.data.access_token);return json({ok:false,code:'ROLE_NOT_PORTAL_ENABLED'},403,clearCookies());}
 const cookies=tokenCookies(login.data);
 if((request.headers.get('accept')||'').includes('application/json'))return json({ok:true,redirect:target},200,cookies);
 return redirect(target,cookies);
}
export function onRequestGet(){return response(null,405,'text/plain; charset=utf-8');}